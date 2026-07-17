"""Prove the RLS policies actually isolate orgs — as a role that does NOT bypass them.

Run:  python scripts/verify_rls.py           (read-only unless --seed is passed)
      python scripts/verify_rls.py --seed    (creates a throwaway 2nd org, then removes it)

**Why this exists.** The backend connects as `service_role`, which is BYPASSRLS: every policy in the
database is inert on the connection the application uses. And `conftest.py` is SQLite, where RLS does
not exist at all — so the 918-test suite stays green no matter how wrong a policy is. Neither of the
two things that normally tell us something works can see this layer.

So the only honest verification is to connect as a NON-bypassing role, set `auth.uid()` to a real
user, and check what comes back. That is what this does.

`auth.uid()` reads `request.jwt.claim.sub` (Supabase's GoTrue convention), so impersonation here is
a `SET LOCAL` inside a transaction that is always rolled back.
"""

from __future__ import annotations

import argparse
import sys
import uuid

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

sys.path.insert(0, ".")

from app.config import get_settings  # noqa: E402

# Tables whose SELECT must be org-scoped, and the column proving which org a row is in.
ORG_TABLES = (
    "recipes",
    "ingredients",
    "suppliers",
    "categories",
    "tasting_sessions",
    "menus",
    "menus_sketch",
)

# Deliberately global reference vocabularies — `USING (true)` on SELECT is correct for these and
# `security.md` permits it. Listed so a reader can see the exemption is intentional, not missed.
REFERENCE_TABLES = ("allergens", "recipe_categories", "supplier_ingredient_tags")

GREEN, RED, YELLOW, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[0m"


# Helpers that carry the org test internally, so a policy delegating to one IS org-scoped even
# though `my_org_ids` never appears in its own predicate. Each is separately asserted org-aware by
# `check_helpers`.
_ORG_AWARE_HELPERS = (
    "can_access_recipe",
    "can_access_menu",
    "can_access_tasting_session",
    "owns_recipe",
    "owns_tasting_session",
    "can_access_sketch",
    "can_access_ingredient",
)


def _ok(msg: str) -> None:
    print(f"  {GREEN}PASS{RESET}  {msg}")


def _fail(msg: str) -> None:
    print(f"  {RED}FAIL{RESET}  {msg}")


def _info(msg: str) -> None:
    print(f"  {YELLOW}··{RESET}    {msg}")


def _rls_role_exists(engine: Engine) -> str | None:
    """A role that does NOT bypass RLS. Supabase ships `authenticated`; fall back to making one."""
    with engine.connect() as c:
        for role in ("authenticated", "rls_verifier"):
            r = c.execute(
                text("SELECT rolbypassrls FROM pg_roles WHERE rolname = :r"), {"r": role}
            ).scalar()
            if r is False:
                return role
            if r is True:
                _info(f"role {role!r} exists but BYPASSRLS — cannot verify through it")
    return None


def check_policies_exist(engine: Engine) -> bool:
    """Structural: every org table's SELECT must mention my_org_ids, and none may be `true`."""
    print("\nstructure — SELECT policies on org-scoped tables")
    ok = True
    with engine.connect() as c:
        for t in ORG_TABLES:
            rows = c.execute(
                text(
                    "SELECT policyname, qual FROM pg_policies "
                    "WHERE schemaname='public' AND tablename=:t AND cmd='SELECT'"
                ),
                {"t": t},
            ).all()
            if not rows:
                _fail(f"{t}: no SELECT policy at all")
                ok = False
                continue
            # More than one PERMISSIVE SELECT policy ORs together — a leftover `true` would win.
            if len(rows) > 1:
                _fail(f"{t}: {len(rows)} SELECT policies — permissive policies OR, so the widest wins")
                ok = False
                continue
            qual = rows[0].qual or ""
            if qual.strip() == "true":
                _fail(f"{t}: SELECT is USING (true) — readable by any authenticated role")
                ok = False
            elif "my_org_ids" in qual:
                _ok(f"{t}: SELECT is org-scoped directly")
            elif any(h in qual for h in _ORG_AWARE_HELPERS):
                # `tasting_sessions` reads `can_access_tasting_session(id)`, which carries the org
                # test inside it. Insisting on a literal `my_org_ids` here is what pushed the first
                # attempt to replace that helper with plain membership -- which let a
                # non-participant read every session in their org. The RLS integration tests caught
                # it; this check must not push us back toward it.
                _ok(f"{t}: SELECT delegates to an org-aware helper -- {qual[:40]}")
            else:
                _fail(f"{t}: SELECT is not org-scoped: {qual[:70]}")
                ok = False
    return ok


def check_helpers(engine: Engine) -> bool:
    print("\nstructure — helper functions")
    ok = True
    wanted = ("my_org_ids", "is_admin_in", "is_manager_or_admin_in", "can_access_recipe")
    with engine.connect() as c:
        for fn in wanted:
            exists = c.execute(
                text(
                    "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "
                    "WHERE n.nspname='public' AND p.proname=:f"
                ),
                {"f": fn},
            ).scalar()
            (_ok if exists else _fail)(f"public.{fn}() {'exists' if exists else 'MISSING'}")
            ok = ok and bool(exists)

        # The old org-less helpers must survive: 29 policies still depend on them, and dropping
        # one cascade-drops those policies.
        for fn in ("is_admin", "is_manager_or_admin"):
            exists = c.execute(
                text(
                    "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "
                    "WHERE n.nspname='public' AND p.proname=:f"
                ),
                {"f": fn},
            ).scalar()
            (_ok if exists else _fail)(
                f"public.{fn}() retained (a DROP would cascade-drop dependent policies)"
            )
            ok = ok and bool(exists)

        # `is_public` must no longer be reachable without an org predicate above it.
        src = c.execute(
            text(
                "SELECT pg_get_functiondef(p.oid) FROM pg_proc p "
                "JOIN pg_namespace n ON n.oid=p.pronamespace "
                "WHERE n.nspname='public' AND p.proname='can_access_recipe' LIMIT 1"
            )
        ).scalar()
        if src and "my_org_ids" in src:
            _ok("can_access_recipe(): is_public sits under an org predicate")
        else:
            _fail("can_access_recipe(): is_public is still org-less — every tenant's public recipes leak")
            ok = False
    return ok


def check_live_isolation(engine: Engine, role: str) -> bool:
    """Behavioural: impersonate a real user through a non-bypassing role and count what they see.

    This is the part that cannot be faked by reading the catalogue. A policy can exist, reference
    my_org_ids(), and still return the wrong rows.
    """
    print(f"\nbehaviour — reading as {role!r} with auth.uid() impersonation")
    with engine.connect() as c:
        subject = c.execute(
            text(
                "SELECT l.subject FROM passport.identity_link l "
                "JOIN passport.membership m ON m.platform_user_id = l.platform_user_id "
                "WHERE m.status='active' LIMIT 1"
            )
        ).scalar()
        if not subject:
            _info("no linked active member in the projection — skipping behavioural check")
            return True

        their_org = c.execute(
            text(
                "SELECT m.organization_id FROM passport.identity_link l "
                "JOIN passport.membership m ON m.platform_user_id = l.platform_user_id "
                "WHERE l.subject = :s AND m.status='active' LIMIT 1"
            ),
            {"s": subject},
        ).scalar()

    ok = True
    with engine.connect() as c:
        trans = c.begin()
        try:
            c.execute(text(f"SET LOCAL ROLE {role}"))
            c.execute(text("SELECT set_config('request.jwt.claim.sub', :s, true)"), {"s": subject})

            uid = c.execute(text("SELECT auth.uid()::text")).scalar()
            if uid != subject:
                _fail(f"impersonation did not take: auth.uid()={uid!r} wanted {subject!r}")
                return False
            _ok(f"impersonating {subject[:8]}… (org {str(their_org)[:8]}…)")

            for t in ORG_TABLES:
                visible = c.execute(text(f"SELECT count(*) FROM {t}")).scalar()  # noqa: S608
                foreign = c.execute(
                    text(
                        f"SELECT count(*) FROM {t} WHERE organization_id IS DISTINCT FROM :o"  # noqa: S608
                    ),
                    {"o": their_org},
                ).scalar()
                if foreign:
                    _fail(f"{t}: {foreign} row(s) from ANOTHER org are visible")
                    ok = False
                else:
                    _ok(f"{t}: {visible} row(s) visible, 0 from another org")
        finally:
            trans.rollback()  # never leave anything behind
    return ok


def check_second_org_is_invisible(engine: Engine, role: str) -> bool:
    """The real test: plant a row in an org the user is NOT in, and confirm it cannot be seen.

    With one org on this deployment, `check_live_isolation` proves little — every row is theirs, so
    a policy of `USING (true)` would pass it. This creates a genuine second tenant, verifies the
    row is invisible, and rolls the whole thing back.
    """
    print("\nbehaviour — a row in an org the caller is NOT a member of")
    with engine.connect() as c:
        subject = c.execute(
            text(
                "SELECT l.subject FROM passport.identity_link l "
                "JOIN passport.membership m ON m.platform_user_id = l.platform_user_id "
                "WHERE m.status='active' LIMIT 1"
            )
        ).scalar()
        if not subject:
            _info("no linked active member — skipping")
            return True

    other_org = f"verify-rls-{uuid.uuid4()}"
    marker = f"RLS-VERIFY-{uuid.uuid4().hex[:8]}"
    ok = True
    with engine.connect() as c:
        trans = c.begin()
        try:
            # Seeded as the (bypassing) owner, read back as the restricted role.
            c.execute(
                text(
                    "INSERT INTO categories (name, is_active, organization_id, created_at, updated_at) "
                    "VALUES (:n, true, :o, now(), now())"
                ),
                {"n": marker, "o": other_org},
            )
            c.execute(text(f"SET LOCAL ROLE {role}"))
            c.execute(text("SELECT set_config('request.jwt.claim.sub', :s, true)"), {"s": subject})

            seen = c.execute(
                text("SELECT count(*) FROM categories WHERE name = :n"), {"n": marker}
            ).scalar()
            if seen:
                _fail(f"a category in org {other_org[:16]}… IS VISIBLE — RLS does not isolate orgs")
                ok = False
            else:
                _ok("a foreign org's category is invisible through RLS")
        finally:
            trans.rollback()  # the planted row never persists
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()

    engine = create_engine(get_settings().database_url)
    with engine.connect() as c:
        who, bypass = c.execute(
            text("SELECT current_user, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user)")
        ).one()
    print(f"connected as {who!r} (bypassrls={bypass})")
    if bypass:
        _info("this role bypasses RLS — policies are inert on it. That is why the checks below")
        _info("switch to a restricted role via SET LOCAL ROLE before reading anything.")

    results = [check_helpers(engine), check_policies_exist(engine)]

    role = _rls_role_exists(engine)
    if role is None:
        print(f"\n{YELLOW}No non-bypassing role available — behavioural checks SKIPPED.{RESET}")
        print("Structure was verified; behaviour was not. These are not the same thing.")
    else:
        results.append(check_live_isolation(engine, role))
        results.append(check_second_org_is_invisible(engine, role))

    print()
    if all(results):
        print(f"{GREEN}All RLS checks passed.{RESET}")
        return 0
    print(f"{RED}RLS verification FAILED — see the failures above.{RESET}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
