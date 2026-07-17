# Brand Access and Accounts — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents
> available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Spec:** [`docs/specs/2026-07-17-brand-access-and-accounts-design.md`](../specs/2026-07-17-brand-access-and-accounts-design.md)
— read it first. It carries the reasoning; this carries the steps.

**Goal:** Rename the Brand Roles tab to Brand Access, reshape its roster into a brand-first
expandable table that shows derived Owner/Admin holders as rows, add a collapsible role legend, and
fix the Accounts tab so it lists the org's Passport members instead of only the logged-in user.

**Architecture:** Passport's `roles_at_brands` stays the sole derivation of who holds what at which
brand — the batching in Task 1 changes the query count, never the answer. The roster gains derived
rows in Python (Task 2) rather than merged in TypeScript, so the UI can never disagree with the
permission check. Accounts is re-pointed at a new endpoint whose spine is `passport_membership`
LEFT JOIN'd to local `users` through the identity link (Task 5), and "Add User" becomes an invite
written **up** to Passport via the SDK's already-installed-but-unwired `upsert_membership` (Task 3).

**Tech Stack:** FastAPI, SQLModel, pytest (SQLite in-memory), `passport-client` v1.1.0;
Next.js 15, React, TypeScript, TanStack Query.

---

## Before you start — three traps that have already bitten this design

1. **The ladder is a FLOOR FOR GAPS, not an override.** `roles_at_brands`
   (`passport_client/access.py:68-78`) uses `roles.setdefault(brand_id, "Manager")` *after* applying
   explicit rows. An Owner with an explicit `Staff` row **is `Staff`** at that brand. The first draft
   of the spec asserted the opposite and it propagated into four places. If you find yourself writing
   "Owners are always Manager", stop and re-read.
2. **`source` keys on the presence of a row, never on org role.** `source = 'assigned'` iff an active
   `unit_app_membership` row exists for `(platform_user_id, unit_id)`. Getting this wrong makes a
   real assignment unremovable through the UI.
3. **Never write the Passport projection locally.** Write-back returns the aggregate *and* echoes a
   sync event; the handler applies it. `writeback.py:1-8` forbids suppressing the echo.

**Git:** this repo's rule is that the user owns all git actions (`CLAUDE.md` → Safety). Steps below
end at green tests and say **COMMIT POINT** with a suggested single-line message. Do **not** run
`git commit` — surface the message and let the user run it.

**Run tests from `backend/` with the venv active.** `pytest`, `ruff check .`, `ruff format .`,
`mypy app/`. Frontend type check is `npm run build` from `frontend/`.

---

## Chunk 1: Batched derivation

### Task 1: `access.brand_roles_for_org_members`

Derive every member's brand roles for one org in 4 queries instead of 6-per-member.

**Files:**
- Modify: `backend/app/passport/access.py` (add after `brand_roles_for_platform_user`, which ends at `:180`)
- Test: `backend/tests/test_passport_access.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_passport_access.py`. Reuse the module's existing helpers
(`_membership_values`, `_entitlement_values`, `_link_values`, `_unit_values`) and constants
(`ORG`, `PU`, `SUBJECT`, `BRAND`).

```python
# ============================================================================
# brand_roles_for_org_members — the batched form
#
# It must agree with the single form for EVERY member, always. If the two drift, the roster the
# UI renders disagrees with the check the request path makes — which is the exact failure the
# "SDK is the sole derivation" rule exists to prevent.
# ============================================================================

PU_OWNER = "pu-owner"
PU_MEMBER = "pu-member"
BRAND_2 = "brand-2"


def _seed_two_brand_org(session: Session) -> None:
    """One entitled org, two brands both carrying Prepper."""
    store.apply_entitlement(session, _entitlement_values(version=1))
    store.apply_unit(session, _unit_values(version=1, unit_id=BRAND))
    store.apply_unit(session, _unit_values(version=1, unit_id=BRAND_2))
    store.create_unit_app_access(
        session,
        {"id": "a-1", "organization_id": ORG, "unit_id": BRAND, "app_id": "prepper"},
    )
    store.create_unit_app_access(
        session,
        {"id": "a-2", "organization_id": ORG, "unit_id": BRAND_2, "app_id": "prepper"},
    )


def _member(session: Session, platform_user_id: str, role: str) -> None:
    store.apply_membership(
        session,
        {
            "id": f"m-{platform_user_id}",
            "organization_id": ORG,
            "platform_user_id": platform_user_id,
            "role": role,
            "status": "active",
            "version": 1,
            "email": f"{platform_user_id}@acme.test",
            "display_name": platform_user_id,
        },
    )


def test_batched_derivation_covers_every_active_member(session: Session):
    _seed_two_brand_org(session)
    _member(session, PU_OWNER, "Owner")
    _member(session, PU_MEMBER, "Member")

    roles = access.brand_roles_for_org_members(session, ORG)

    # The Owner gets Manager at BOTH brands via the ladder, with no role rows at all.
    assert roles[PU_OWNER] == {BRAND: "Manager", BRAND_2: "Manager"}
    # A plain Member with no role row derives nothing.
    assert roles[PU_MEMBER] == {}


def test_batched_derivation_ladder_is_a_floor_not_an_override(session: Session):
    """An Owner with an explicit Staff row is STAFF at that brand — the demotion is real.

    `roles_at_brands` applies explicit rows first, then `setdefault`s the ladder into the GAPS.
    Asserting Manager here would encode the inverted-precedence bug the spec was corrected for.
    """
    _seed_two_brand_org(session)
    _member(session, PU_OWNER, "Owner")
    store.apply_unit_app_membership(
        session,
        {
            "id": "uam-1",
            "organization_id": ORG,
            "platform_user_id": PU_OWNER,
            "unit_id": BRAND,
            "app_id": "prepper",
            "role": "Staff",
            "status": "active",
            "version": 1,
        },
    )

    roles = access.brand_roles_for_org_members(session, ORG)

    assert roles[PU_OWNER][BRAND] == "Staff"      # explicit row wins
    assert roles[PU_OWNER][BRAND_2] == "Manager"  # ladder fills the gap


def test_batched_agrees_with_the_single_form_for_every_member(session: Session):
    """The anti-drift guard. This is the most important test in the change."""
    _seed_two_brand_org(session)
    _member(session, PU_OWNER, "Owner")
    _member(session, PU_MEMBER, "Member")
    store.apply_unit_app_membership(
        session,
        {
            "id": "uam-1",
            "organization_id": ORG,
            "platform_user_id": PU_OWNER,
            "unit_id": BRAND,
            "app_id": "prepper",
            "role": "Staff",
            "status": "active",
            "version": 1,
        },
    )
    store.apply_unit_app_membership(
        session,
        {
            "id": "uam-2",
            "organization_id": ORG,
            "platform_user_id": PU_MEMBER,
            "unit_id": BRAND_2,
            "app_id": "prepper",
            "role": "Manager",
            "status": "active",
            "version": 1,
        },
    )

    batched = access.brand_roles_for_org_members(session, ORG)

    for pu in (PU_OWNER, PU_MEMBER):
        assert batched[pu] == access.brand_roles_for_platform_user(session, pu, ORG), pu


def test_batched_derivation_is_empty_when_entitlement_has_not_synced(session: Session):
    """Derive nothing, NOT deny — matches brand_roles_for_platform_user:170-175."""
    store.apply_unit(session, _unit_values(version=1, unit_id=BRAND))
    store.create_unit_app_access(
        session,
        {"id": "a-1", "organization_id": ORG, "unit_id": BRAND, "app_id": "prepper"},
    )
    _member(session, PU_OWNER, "Owner")

    assert access.brand_roles_for_org_members(session, ORG) == {}


def test_batched_derivation_excludes_removed_memberships(session: Session):
    _seed_two_brand_org(session)
    store.apply_membership(
        session,
        {
            "id": "m-gone",
            "organization_id": ORG,
            "platform_user_id": PU_OWNER,
            "role": "Owner",
            "status": "removed",
            "version": 1,
            "email": "gone@acme.test",
            "display_name": "Gone",
        },
    )

    assert PU_OWNER not in access.brand_roles_for_org_members(session, ORG)
```

- [ ] **Step 2: Run the tests to verify they fail**

```
pytest tests/test_passport_access.py -k batched -v
```
Expected: 5 × FAIL, `AttributeError: module 'app.passport.access' has no attribute
'brand_roles_for_org_members'`.

- [ ] **Step 3: Implement**

In `backend/app/passport/access.py`, insert immediately after `brand_roles_for_platform_user`
(ends `:180`). `roles_at_brands` is already imported by that function's module; reuse the same
import.

```python
def brand_roles_for_org_members(
    session: Session, org_id: str
) -> dict[str, dict[str, str]]:
    """``{platform_user_id: {brand_id: "Manager" | "Staff"}}`` for every ACTIVE member of ONE org.

    The batched form of :func:`brand_roles_for_platform_user`, for the roster. Same derivation —
    the SDK's ``roles_at_brands``, once per member — but the inputs are read ONCE and sliced in
    memory instead of re-read per member.

    The single form costs SIX queries per member: ``entitlement_status``, then
    ``_derivation_inputs`` re-runs ``unit`` and ``unit_app_access`` (both UNFILTERED full scans),
    the member's app-memberships, ``entitlement_status`` AGAIN, and ``_org_role``. Fifty members is
    ~300 queries and 100 full scans. This is four queries, whatever the member count.

    ``roles_at_brands`` is still the only thing that decides a role. Re-deriving the ladder here —
    or in TypeScript — would let the roster disagree with the request-path check, which is the one
    failure the SDK-derivation rule exists to prevent. Note the ladder is a FLOOR FOR GAPS: an
    explicit row beats it, so an Owner with a ``Staff`` row is ``Staff``.

    Empty when the entitlement has not synced — "derive nothing", NOT "deny", matching the single
    form.
    """
    status = entitlement_status(session, org_id)
    if status is None:
        return {}  # entitlements not synced yet — fail open, derive nothing

    units = session.exec(select(PassportUnit)).all()
    accesses = session.exec(select(PassportUnitAppAccess)).all()

    # Unscoped by org, deliberately — `_derivation_inputs:139-141` passes the user's rows unscoped
    # because the SDK helper applies the org filter itself, and a receiver legitimately holds rows
    # for every org it is entitled to. Scoping here would silently diverge from the single form.
    rows_by_user: dict[str, list[PassportUnitAppMembership]] = {}
    for row in session.exec(select(PassportUnitAppMembership)).all():
        rows_by_user.setdefault(row.platform_user_id, []).append(row)

    members = session.exec(
        select(PassportMembership).where(
            PassportMembership.organization_id == org_id,
            PassportMembership.status == _ACTIVE,
        )
    ).all()

    units_by_id = {u.id: UnitPayload(**u.model_dump()) for u in units}
    app_accesses = [UnitAppAccessPayload(**a.model_dump()) for a in accesses]

    return {
        m.platform_user_id: roles_at_brands(
            org_id=org_id,
            entitlement_status=status,
            org_role=m.role,
            memberships=[
                UnitAppMembershipPayload(**r.model_dump())
                for r in rows_by_user.get(m.platform_user_id, [])
            ],
            units_by_id=units_by_id,
            app_accesses=app_accesses,
        )
        for m in members
    }
```

No new imports needed. `roles_at_brands`, `UnitPayload`, `UnitAppAccessPayload`,
`UnitAppMembershipPayload`, `select`, `col`, `_ACTIVE`, `PassportMembership`, `PassportUnit` and
`PassportUnitAppAccess` are all already at `access.py:29-34` and the surrounding import block.

- [ ] **Step 4: Run the tests to verify they pass**

```
pytest tests/test_passport_access.py -k batched -v
pytest tests/test_passport_access.py -v          # no regressions in the single form
ruff check . && mypy app/passport/access.py
```
Expected: all PASS, no new mypy errors.

- [ ] **Step 5: COMMIT POINT** — do not run git. Suggest to the user:

```
perf(passport): batch brand-role derivation for a whole org — 4 queries, not 6 per member
```

---

## Chunk 2: Derived roster rows

### Task 2: `directory.roster` emits derived rows

**Files:**
- Modify: `backend/app/passport/directory.py:122-175`
- Test: `backend/tests/test_passport_directory.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_passport_directory.py`, reusing its helpers (`_unit`, `_access`,
`_membership`, `_entitlement`, `_role_row`, `_link`, `_seed`) and constants (`ORG`, `PU`, `SUBJECT`,
`BRAND`, `OTHER_BRAND`, `DARK_BRAND`).

```python
# ============================================================================
# Derived rows — the ladder, shown
#
# An Owner/Admin holds Manager at every app-carrying brand with NO row. The old roster showed only
# stored rows, so it could read "nobody has access" while three Owners had everything. These pin
# the fix — and pin that the ladder is a FLOOR FOR GAPS, not an override.
# ============================================================================


def _by_brand(rows: list[dict], unit_id: str) -> list[dict]:
    return [r for r in rows if r["unit_id"] == unit_id]


def test_owner_appears_as_a_derived_row_at_every_app_carrying_brand(session: Session):
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(OTHER_BRAND, name="Beta"))
    store.create_unit_app_access(session, _access("a-1", BRAND))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND))

    rows = directory.roster(session, SUBJECT, ORG)

    assert {r["unit_id"] for r in rows} == {BRAND, OTHER_BRAND}
    for r in rows:
        assert r["role"] == "Manager"
        assert r["source"] == "derived"
        assert r["assignment_id"] is None
        assert r["org_role"] == "Owner"


def test_a_brand_without_app_access_yields_no_rows_even_for_an_owner(session: Session):
    """No `unit_app_access` row => the brand confers access to nobody, ladder included."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(DARK_BRAND, name="Dark"))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    rows = directory.roster(session, SUBJECT, ORG)

    assert _by_brand(rows, DARK_BRAND) == []
    assert len(_by_brand(rows, BRAND)) == 1


def test_explicit_row_beats_the_ladder_and_stays_removable(session: Session):
    """THE case the first spec draft got backwards.

    An Owner with an explicit Staff row is STAFF there — a real demotion — and the row is real, so
    it keeps its assignment_id and `source='assigned'`. Labelling it 'derived' would strip the
    Select and Remove from a live assignment and make it uneditable through the UI forever.
    """
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(OTHER_BRAND, name="Beta"))
    store.create_unit_app_access(session, _access("a-1", BRAND))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND))
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))  # role="Staff"

    rows = directory.roster(session, SUBJECT, ORG)

    demoted = _by_brand(rows, BRAND)[0]
    assert demoted["role"] == "Staff"
    assert demoted["source"] == "assigned"
    assert demoted["assignment_id"] == "uam-1"

    elsewhere = _by_brand(rows, OTHER_BRAND)[0]
    assert elsewhere["role"] == "Manager"
    assert elsewhere["source"] == "derived"
    assert elsewhere["assignment_id"] is None


def test_plain_member_with_a_role_row_is_assigned_not_derived(session: Session):
    _seed(session)  # membership role defaults to "Member"
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))

    rows = directory.roster(session, SUBJECT, ORG)

    assert len(rows) == 1
    assert rows[0]["source"] == "assigned"
    assert rows[0]["assignment_id"] == "uam-1"
    assert rows[0]["role"] == "Staff"


def test_removed_role_row_is_a_tombstone_and_confers_nothing(session: Session):
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND, status="removed"))

    assert directory.roster(session, SUBJECT, ORG) == []


def test_roster_never_leaks_another_orgs_members(session: Session):
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    store.apply_entitlement(session, _entitlement(OTHER_ORG))
    store.apply_membership(session, _membership(OTHER_ORG, role="Owner"))
    store.apply_unit(session, _unit(OTHER_BRAND, OTHER_ORG, name="Rival"))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND, OTHER_ORG))

    rows = directory.roster(session, SUBJECT, ORG)

    # NB: asserting on `organization_id` alone would be tautological — the implementation stamps
    # the argument onto every row. Assert on data that came from the DB instead.
    assert _by_brand(rows, OTHER_BRAND) == []
    assert {r["unit_id"] for r in rows} == {BRAND}
    assert {r["platform_user_id"] for r in rows} == {PU}
```

- [ ] **Step 2: Run to verify they fail**

```
pytest tests/test_passport_directory.py -k "derived or explicit or tombstone or leak or assigned" -v
```
Expected: FAIL on `KeyError: 'source'` and on the Owner producing no rows.

- [ ] **Step 3: Implement**

Replace the body of `roster` in `backend/app/passport/directory.py:122-175`. Keep the two fail-closed
guards verbatim.

```python
def roster(
    session: Session, subject: str, organization_id: str
) -> list[dict[str, object]]:
    """Everyone who can reach each brand in the acting org — assigned AND derived.

    Not "the rows Passport stores". An org Owner/Admin holds ``Manager`` at every app-carrying
    brand with NO ``unit_app_membership`` row (the ladder), so a stored-rows-only roster could show
    an empty brand while three Owners had full access — which is why this page used to carry a
    paragraph apologising for itself. Derived holders are rows now, and the apology is gone.

    ``source`` is ``'assigned'`` iff an active row exists for ``(platform_user_id, unit_id)``,
    else ``'derived'``. It keys on the ROW, never on the org role: the ladder is a floor for gaps,
    so an Owner with an explicit ``Staff`` row is ``Staff`` there — a real demotion, on a real row,
    which must keep its ``assignment_id`` and stay removable. Keying on org role instead strips the
    controls off a live assignment.

    ``role`` always comes from ``access.brand_roles_for_org_members`` — never from the stored row's
    ``role`` — so precedence stays inside the SDK, the one place that decides it.

    ``removed`` rows are tombstones (trap 1) and confer nothing. Email / display name come from
    ``passport_membership``, which EMBEDS them; there is no user aggregate to join.
    """
    platform_user_id = access.platform_user_id_for(session, subject)
    if platform_user_id is None:
        return []

    org_ids = access.orgs_for_platform_user(session, platform_user_id)
    if organization_id not in org_ids:
        # Fail closed on our own rather than trusting the caller. `get_org_context` has already
        # verified the acting org against the projection, so this should be unreachable — but a
        # directory function that returns rows for any org it is handed is one refactor away from
        # being the leak, and the check costs a set membership.
        return []

    derived = access.brand_roles_for_org_members(session, organization_id)

    # Brands that CARRY Prepper — the same predicate `brands_for_user` uses. A brand with no
    # `unit_app_access` row is somewhere nobody can hold a role, ladder included.
    brands = session.exec(
        select(PassportUnit)
        .join(PassportUnitAppAccess, col(PassportUnitAppAccess.unit_id) == PassportUnit.id)
        .where(
            col(PassportUnit.organization_id) == organization_id,
            PassportUnit.type == _BRAND,
            PassportUnit.status == _ACTIVE,
        )
    ).all()

    members = {
        m.platform_user_id: m
        for m in session.exec(
            select(PassportMembership).where(
                col(PassportMembership.organization_id) == organization_id,
                PassportMembership.status == _ACTIVE,
            )
        ).all()
    }

    assignments = {
        (a.platform_user_id, a.unit_id): a
        for a in session.exec(
            select(PassportUnitAppMembership).where(
                col(PassportUnitAppMembership.organization_id) == organization_id,
                PassportUnitAppMembership.status == _ACTIVE,
            )
        ).all()
    }

    rows: list[dict[str, object]] = []
    for unit in sorted(brands, key=lambda u: u.name.casefold()):
        for pu, membership in members.items():
            role = derived.get(pu, {}).get(unit.id)
            if role is None:
                continue
            assignment = assignments.get((pu, unit.id))
            rows.append(
                {
                    "assignment_id": assignment.id if assignment else None,
                    "source": "assigned" if assignment else "derived",
                    "platform_user_id": pu,
                    "email": membership.email,
                    "display_name": membership.display_name,
                    "unit_id": unit.id,
                    "unit_name": unit.name,
                    "role": role,
                    "org_role": membership.role,
                    "organization_id": organization_id,
                }
            )
    return rows
```

No new imports needed — `directory.py:22` already imports `PassportUnitAppAccess`, and
`PassportUnitAppMembership`, `PassportUnit`, `PassportMembership`, `select` and `col` are all in the
same block.

- [ ] **Step 4: Run to verify they pass**

```
pytest tests/test_passport_directory.py -v
pytest tests/test_cross_org_leaks.py -v
ruff check . && mypy app/passport/directory.py
```
Expected: all PASS.

- [ ] **Step 5: COMMIT POINT**

```
feat(passport): show derived Owner/Admin holders in the brand roster, with source and nullable assignment_id
```

---

## Chunk 3: Invite write-back

### Task 3: `writeback.invite_member`

**Files:**
- Modify: `backend/app/passport/writeback.py` (append after `remove_brand_role`, ends `:245`)
- Test: `backend/tests/test_passport_writeback.py`

- [ ] **Step 1: Write the failing tests**

Extend `_FakeClient` in `backend/tests/test_passport_writeback.py` with an `upsert_membership`
recorder, then append the tests.

```python
    async def upsert_membership(self, org_id, **kwargs):
        if self._raises:
            raise self._raises
        _FakeClient.calls.append(("upsert_membership", org_id, kwargs))
        return {"id": "m-new", "organization_id": org_id, **kwargs}
```

```python
# ============================================================================
# invite_member — org membership, written UP
#
# The ORG vocabulary (Owner|Admin|Member), NOT the brand one (Manager|Staff). Conflating them is
# what models/passport.py:164-186 warns about, and the two tuples look identical at a glance.
# ============================================================================

INVITEE = "newchef@acme.test"


def _admin_actor(session: Session) -> User:
    user = User(id=ACTOR, email="boss@acme.test", username="boss")
    session.add(user)
    session.commit()
    link_identity(session, ACTOR, ACTOR_PU)
    grant_org_role(session, ACTOR_PU, "Admin", org_id=ORG)
    return user


def _plain_actor(session: Session) -> User:
    user = User(id=ACTOR, email="cook@acme.test", username="cook")
    session.add(user)
    session.commit()
    link_identity(session, ACTOR, ACTOR_PU)
    grant_org_role(session, ACTOR_PU, "Member", org_id=ORG)
    return user


def test_invite_member_forwards_the_end_user_token(session: Session):
    actor = _admin_actor(session)
    _FakeClient.calls = []

    with _configured(), patch.object(writeback, "_client", lambda *a, **k: _FakeClient()):
        asyncio.run(
            writeback.invite_member(
                session,
                actor=actor,
                organization_id=ORG,
                email=INVITEE,
                display_name="New Chef",
                role="Member",
                end_user_token=TOKEN,
            )
        )

    kind, org_id, kwargs = _FakeClient.calls[0]
    assert kind == "upsert_membership"
    assert org_id == ORG
    assert kwargs["end_user_token"] == TOKEN
    assert kwargs["email"] == INVITEE
    assert kwargs["role"] == "Member"
    # Exactly one identifier — the SDK raises ValueError if both are given.
    assert kwargs.get("platform_user_id") is None


def test_invite_member_refuses_a_non_admin_before_calling_passport(session: Session):
    actor = _plain_actor(session)
    _FakeClient.calls = []

    with _configured(), patch.object(writeback, "_client", lambda *a, **k: _FakeClient()):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.invite_member(
                    session, actor=actor, organization_id=ORG, email=INVITEE,
                    display_name=None, role="Member", end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 403
    assert _FakeClient.calls == []  # never reached the SDK


@pytest.mark.parametrize("bad_role", ["Manager", "Staff", "owner", "", "Superuser"])
def test_invite_member_rejects_the_brand_vocabulary(session: Session, bad_role: str):
    """Manager/Staff are BRAND roles. An org membership takes Owner|Admin|Member."""
    actor = _admin_actor(session)
    _FakeClient.calls = []

    with _configured(), patch.object(writeback, "_client", lambda *a, **k: _FakeClient()):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.invite_member(
                    session, actor=actor, organization_id=ORG, email=INVITEE,
                    display_name=None, role=bad_role, end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 422
    assert _FakeClient.calls == []


def test_invite_member_writes_nothing_locally(session: Session):
    """Prepper NEVER writes the projection. The echo does it."""
    from app.models import PassportMembership

    actor = _admin_actor(session)
    before = len(session.exec(select(PassportMembership)).all())

    with _configured(), patch.object(writeback, "_client", lambda *a, **k: _FakeClient()):
        asyncio.run(
            writeback.invite_member(
                session, actor=actor, organization_id=ORG, email=INVITEE,
                display_name=None, role="Member", end_user_token=TOKEN,
            )
        )

    assert len(session.exec(select(PassportMembership)).all()) == before


def test_invite_member_surfaces_passports_verdict_verbatim(session: Session):
    actor = _admin_actor(session)
    err = PassportAPIError(status_code=403, detail="actor may not grant Owner")

    with _configured(), patch.object(writeback, "_client", lambda *a, **k: _FakeClient(raises=err)):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.invite_member(
                    session, actor=actor, organization_id=ORG, email=INVITEE,
                    display_name=None, role="Owner", end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 403
    assert "may not grant Owner" in str(exc.value.detail)
    assert TOKEN not in str(exc.value.detail)  # never echo the token
```

Add `from sqlmodel import select` and `from app.models import User` to the imports if not present.

- [ ] **Step 2: Run to verify they fail**

```
pytest tests/test_passport_writeback.py -k invite -v
```
Expected: FAIL, `AttributeError: module 'app.passport.writeback' has no attribute 'invite_member'`.

- [ ] **Step 3: Implement**

In `backend/app/passport/writeback.py`, add the org-role constants beside the brand ones at `:49-51`:

```python
MANAGER = "Manager"
STAFF = "Staff"
_ROLES = (MANAGER, STAFF)          # BRAND-app vocabulary

OWNER = "Owner"
ADMIN = "Admin"
MEMBER = "Member"
_ORG_ROLES = (OWNER, ADMIN, MEMBER)  # ORG vocabulary — a DIFFERENT ladder. Never mix the two.
```

Add the guard beside `_require_role` (`:156-161`):

```python
def _require_org_role(role: str) -> None:
    """The ORG vocabulary. `_require_role` is the BRAND one — passing a role to the wrong guard
    gets you a 422 that reads correct, which is why they are two functions and not one."""
    if role not in _ORG_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"role must be one of {', '.join(_ORG_ROLES)}",
        )
```

Append after `remove_brand_role`:

```python
async def invite_member(
    session: Session,
    *,
    actor: User,
    organization_id: str,
    email: str,
    display_name: str | None,
    role: str,
    end_user_token: str,
) -> Any:
    """Invite someone into the org — or update their org role if Passport already knows them.

    ``role`` is the ORG vocabulary: ``Owner`` | ``Admin`` | ``Member``. NOT ``Manager``/``Staff``.

    Passing ``email`` for someone Passport has never seen is what CREATES the platform user; the
    SDK has no separate ``create_user``. Exactly one of email / platform_user_id may be sent — the
    SDK raises ``ValueError`` otherwise — and this only ever sends email.

    Writes NOTHING locally. The call returns the aggregate AND Passport echoes a ``membership.*``
    event that the version-guarded handler applies. Writing the returned aggregate into the
    projection here is the suppressed-echo mistake this module's header forbids: it would make
    delivery scope smaller than snapshot scope and nightly reconcile would report phantom drift.

    Unlike ``_require_local_authority``, this asks the ORG-SCOPED admin question. That helper's
    org-less ``is_org_admin`` call (``:81``) is a sanctioned exception only because Passport
    re-checks against the verified end user — there is no reason to inherit it when the caller has
    an acting org in hand.
    """
    base_url, api_key = _require_configured()
    if not access.is_org_admin(session, actor.id, organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted to manage members of this organisation",
        )
    _require_org_role(role)

    try:
        async with _client(base_url, api_key) as pc:
            return await pc.upsert_membership(
                organization_id,
                email=email,
                display_name=display_name,
                role=role,
                end_user_token=end_user_token,
            )
    except PassportAPIError as exc:
        raise _reraise(exc) from exc
```

- [ ] **Step 4: Run to verify they pass**

```
pytest tests/test_passport_writeback.py -v
ruff check . && mypy app/passport/writeback.py
```

- [ ] **Step 5: COMMIT POINT**

```
feat(passport): wire upsert_membership — invite org members from Prepper via write-back
```

### Task 4: `POST /passport/brand-roles/members`

**Files:**
- Modify: `backend/app/api/passport_roles.py` (add after `list_members`, `:78-86`)
- Test: `backend/tests/test_passport_writeback.py`

- [ ] **Step 1: Install `email-validator` FIRST — `EmailStr` without it kills the whole suite**

`pydantic`'s `EmailStr` raises at **import time** if `email-validator` is absent:

```
ImportError: email-validator is not installed, run `pip install 'pydantic[email]'`
```

`app/main.py` imports this router, so every `pytest` run dies — not just the invite tests. It is not
declared in `backend/pyproject.toml:9-37`. Add it to the dependencies list:

```toml
    "pydantic[email]>=2.0",
```

Then:

```
pip install -e ".[dev]"
python -c "from pydantic import EmailStr; print('ok')"
```
Expected: `ok`. If you skip this step, Step 2's gate fails for a reason that has nothing to do with
your code.

- [ ] **Step 2: Add the request model and route**

Beside `AssignRoleRequest` (`:33-38`):

```python
class InviteMemberRequest(BaseModel):
    """The ORG vocabulary — ``Owner`` | ``Admin`` | ``Member``. NOT the brand one."""

    email: EmailStr
    display_name: str | None = None
    role: str = "Member"
```

Add `from pydantic import BaseModel, EmailStr` to `:17`.

After `list_members` (`:86`):

```python
@router.post("/members", status_code=201)
async def invite_member(
    data: InviteMemberRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
    token: str = Depends(get_bearer_token),
) -> Any:
    """Invite someone into the ACTING org, or update their org role if already a member.

    Returns Passport's aggregate. The member does NOT appear in the projection until the
    ``membership.*`` echo lands — the client must say so rather than insert optimistically.

    Ordering matters across the UI: ``assign_unit_app_role`` 409s if the target holds no active org
    membership, so a brand role cannot bootstrap a member. Invite here first, assign second.
    """
    return await writeback.invite_member(
        session,
        actor=current_user,
        organization_id=org.organization_id,
        email=data.email,
        display_name=data.display_name,
        role=data.role,
        end_user_token=token,
    )
```

- [ ] **Step 3: Run the auth-gate suites**

```
pytest tests/test_default_deny_auth.py tests/test_route_auth_census.py tests/test_route_order.py -v
```
Expected: PASS — the route takes `get_org_context` and consults it, so the census's
declared-but-unused check is satisfied honestly.

- [ ] **Step 4: COMMIT POINT**

```
feat(api): POST /passport/brand-roles/members — invite an org member
```

---

## Chunk 4: Accounts endpoint

### Task 5: `user_service.list_org_member_accounts`

**Files:**
- Modify: `backend/app/domain/user_service.py` (add after `list_users_paginated`, ends `:220`)
- Test: `backend/tests/test_users.py`

- [ ] **Step 1: Give `create_user` a phone number**

`conftest.create_user` (`tests/conftest.py:196-215`) is
`create_user(session, user_id, username="user", email=None)` — **the first positional is the user
id, not an email**, and it never sets a phone. Task 5 needs one, so extend the fixture:

```python
def create_user(
    session: Session,
    user_id: str,
    username: str = "user",
    email: str | None = None,
    phone_number: str | None = None,
) -> User:
    """A local Prepper account, carrying NO role — roles live in Passport."""
    existing = session.exec(select(User).where(User.id == user_id)).first()
    if existing:
        return existing

    user = User(
        id=user_id,
        email=email or f"{username}@test.com",
        username=username,
        phone_number=phone_number,
    )
    ...
```

Confirm `User` has a `phone_number` field before adding the kwarg.

- [ ] **Step 2: Write the failing tests**

Note every call passes an **id** first and an explicit `email=`. Passing an email as the id leaves
the row's real email as the default `"user@test.com"`, which makes the
`test_local_user_with_no_membership_does_not_appear` assertion pass even when the code is broken.

```python
# ============================================================================
# /users/accounts — the org roster, from Passport, joined to local accounts
#
# `users` has no organization_id and must not get one. Membership is the spine; the local row is a
# LEFT JOIN through the identity link. Someone who has never signed in has no link and therefore no
# local row — they still belong in this list, which is the whole point.
# ============================================================================


def _caller(session: Session) -> User:
    user = create_user(session, "caller", "caller", email="caller@acme.test")
    link_identity(session, user.id, "pu-caller")
    grant_org_role(session, "pu-caller", "Admin")
    return user


def test_member_who_never_signed_in_appears_with_no_local_account(session: Session):
    caller = _caller(session)
    grant_org_role(session, "pu-ghost", "Member")  # no identity link, no users row

    rows, total = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    ghost = next(r for r in rows if r["platform_user_id"] == "pu-ghost")
    assert ghost["user_id"] is None
    assert ghost["phone_number"] is None
    assert ghost["email"] == "pu-ghost@test.com"   # from the membership, which embeds it
    assert ghost["org_role"] == "Member"
    assert total == 2


def test_local_user_with_no_membership_does_not_appear(session: Session):
    caller = _caller(session)
    create_user(session, "stranger", "stranger", email="stranger@acme.test")

    rows, _ = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    assert "stranger@acme.test" not in {r["email"] for r in rows}
    assert "stranger" not in {r["user_id"] for r in rows}


def test_linked_member_carries_their_local_account(session: Session):
    caller = _caller(session)
    chef = create_user(
        session, "chef", "chef", email="chef@acme.test", phone_number="+61400000000"
    )
    link_identity(session, chef.id, "pu-chef")
    grant_org_role(session, "pu-chef", "Member")

    rows, _ = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    row = next(r for r in rows if r["platform_user_id"] == "pu-chef")
    assert row["user_id"] == chef.id
    assert row["phone_number"] == "+61400000000"


def test_accounts_never_leak_another_org(session: Session):
    caller = _caller(session)
    grant_org_role(session, "pu-rival", "Owner", org_id="org-b")

    rows, _ = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    assert "pu-rival" not in {r["platform_user_id"] for r in rows}


def test_accounts_fail_closed_for_an_org_that_is_not_the_callers(session: Session):
    """A forged org id returns NOBODY, not everybody."""
    caller = _caller(session)

    rows, total = UserService(session).list_org_member_accounts(
        caller.id, "org-not-mine", offset=0, limit=30
    )

    assert rows == []
    assert total == 0


def test_accounts_fail_closed_for_an_unlinked_caller(session: Session):
    caller = create_user(session, "loner", "loner", email="loner@acme.test")  # no link
    grant_org_role(session, "pu-other", "Member")

    rows, total = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    assert rows == []
    assert total == 0
```

Import `create_user`, `link_identity`, `grant_org_role`, `ORG_ID` and `User` from `tests.conftest` /
`app.models`.

- [ ] **Step 3: Run to verify they fail**

```
pytest tests/test_users.py -k accounts -v
```
Expected: FAIL, `AttributeError: 'UserService' object has no attribute
'list_org_member_accounts'`.

- [ ] **Step 4: Implement**

Append to `UserService` in `backend/app/domain/user_service.py`:

```python
    def list_org_member_accounts(
        self, subject: str, organization_id: str, *, offset: int, limit: int
    ) -> tuple[list[dict[str, object]], int]:
        """The acting org's Passport members, with their local account where one exists.

        `GET /users` scopes local `users` rows THROUGH the identity link, so it shows only people
        who have signed in via Passport SSO — on a fresh org, that is the caller and nobody else.
        That scoping is correct and stays; it is simply the wrong QUESTION for a roster. The
        authoritative list of people in an org is Passport's membership, which embeds email,
        display name and role for everyone, signed in or not.

        Membership is the spine; `users` is a LEFT JOIN through the link:

            membership.platform_user_id = identity_link.platform_user_id
            identity_link.subject       = users.id

        Note the pair — `identity_link.subject` holds the LOCAL `users.id`, `platform_user_id`
        holds Passport's. Joining the wrong two matches nothing and silently returns empty.

        `user_id is None` means "never signed in": no link, so no local row. They still belong in
        the list. Email comes from the membership, not the local row — Passport is identity truth.

        Fails CLOSED: an unresolvable caller, or an org that is not theirs, sees nobody.
        """
        from app.models import PassportIdentityLink, PassportMembership

        platform_user_id = access.platform_user_id_for(self.session, subject)
        if platform_user_id is None:
            return [], 0

        if organization_id not in access.orgs_for_platform_user(self.session, platform_user_id):
            return [], 0

        statement = (
            select(PassportMembership, User)
            .outerjoin(
                PassportIdentityLink,
                col(PassportIdentityLink.platform_user_id)
                == col(PassportMembership.platform_user_id),
            )
            .outerjoin(User, col(User.id) == col(PassportIdentityLink.subject))
            .where(
                col(PassportMembership.organization_id) == organization_id,
                PassportMembership.status == "active",
            )
            .order_by(col(PassportMembership.email))
        )

        total = self.session.exec(
            select(func.count()).select_from(statement.subquery())
        ).one()
        rows = self.session.exec(statement.offset(offset).limit(limit)).all()

        return [
            {
                "platform_user_id": m.platform_user_id,
                "email": m.email,
                "display_name": m.display_name,
                "org_role": m.role,
                "user_id": u.id if u else None,
                "username": u.username if u else None,
                "phone_number": u.phone_number if u else None,
            }
            for m, u in rows
        ], int(total)
```

- [ ] **Step 5: Run to verify they pass**

```
pytest tests/test_users.py -v
ruff check . && mypy app/domain/user_service.py
```

- [ ] **Step 6: COMMIT POINT**

```
feat(users): list_org_member_accounts — the org roster from Passport, joined to local accounts
```

### Task 6: `GET /users/accounts`

**Files:**
- Modify: `backend/app/api/users.py` (insert between `list_users` `:44` and `get_user` `:47`)
- Test: `backend/tests/test_users.py`, `backend/tests/test_route_order.py`

- [ ] **Step 1: Write the failing route-order test**

`GET /users/accounts` must not be swallowed by `GET /users/{user_id}`. Match the existing style in
`tests/test_route_order.py`.

```python
def test_users_accounts_is_not_shadowed_by_the_by_id_route(client: TestClient):
    """`/users/accounts` must be DECLARED before `/users/{user_id}`.

    FastAPI matches in declaration order. Declared after, this path binds `user_id="accounts"`,
    finds no such user and 404s — a failure that reads like a missing route rather than a routing
    bug, which is why it gets its own test.
    """
    response = client.get("/api/v1/users/accounts")

    assert response.status_code == 200, response.json()
    assert "items" in response.json()
```

- [ ] **Step 2: Run to verify it fails**

```
pytest tests/test_route_order.py -k accounts -v
```
Expected: FAIL with 404 "User not found" — `{user_id}` swallowed it.

- [ ] **Step 3: Implement**

Insert into `backend/app/api/users.py` **between** `list_users` and `get_user` — the position is the
fix, not a style choice.

```python
@router.get("/accounts")
def list_member_accounts(
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """The acting org's people, from Passport's membership, with their local account if linked.

    DECLARED BEFORE `/{user_id}` on purpose: FastAPI matches in declaration order, and below it
    this path resolves as `user_id="accounts"` and 404s. `tests/test_route_order.py` pins it.

    Distinct from `GET /users`, which lists local `users` rows and is scoped through the identity
    link — correct for tasting participants (who need a real account), wrong for a roster. Both
    exist; neither replaces the other.
    """
    from app.models.pagination import PaginatedResponse

    service = UserService(session)
    offset = (page_number - 1) * page_size
    items, total = service.list_org_member_accounts(
        current_user.id, org.organization_id, offset=offset, limit=page_size
    )
    return PaginatedResponse.create(
        items=items,
        total_count=total,
        page_number=page_number,
        page_size=page_size,
    )
```

- [ ] **Step 4: Run the full gate**

```
pytest tests/test_route_order.py tests/test_users.py tests/test_default_deny_auth.py tests/test_route_auth_census.py -v
pytest
```
Expected: all PASS.

- [ ] **Step 5: COMMIT POINT**

```
feat(api): GET /users/accounts — the org roster, declared ahead of the by-id route
```

---

## Chunk 5: Brand Access tab

### Task 7: Types and the rename

**Files:**
- Modify: `frontend/src/types/index.ts:982-990` (add `BrandRoleSource`) and `:1015-1023` (`PassportBrandRole`)
- Modify: `frontend/src/app/settings/page.tsx:4,9,15,54-56`
- Rename: `frontend/src/components/admin/BrandRolesTab.tsx` → `BrandAccessTab.tsx`
- Modify: `frontend/src/components/admin/index.ts`

- [ ] **Step 1: Extend the types**

In `frontend/src/types/index.ts`, beside `BrandRole` (`:990`):

```ts
/**
 * Where a brand role came from.
 *
 * `assigned` — an active `unit_app_membership` row exists: editable, removable.
 * `derived`  — no row; the holder is an org Owner/Admin and the ladder gives them Manager here.
 *
 * Keys on the ROW, never on org role. The ladder is a floor for GAPS — an Owner with an explicit
 * `Staff` row is `Staff`, and that row is real and must stay editable.
 */
export type BrandRoleSource = 'assigned' | 'derived';
```

The roster row type is **`PassportBrandRole`** (`types/index.ts:1015-1023`). Change:

```ts
  /** null for a derived holder — the ladder gives them the role, so there is no row. */
  assignment_id: string | null;
  source: BrandRoleSource;
```

- [ ] **Step 2: Rename the tab**

`frontend/src/app/settings/page.tsx`:
- `:4` — the import: `import { UserManagementTab, BrandAccessTab } from '@/components/admin';`
- `:9` — `'brand-roles'` → `'brand-access'` in the `SettingsTab` union
- `:15` — label `'Brand Roles'` → `'Brand Access'`
- `:54-56` — the panel's `value` and `<BrandRolesTab />` → `<BrandAccessTab />`

Rename the file and its export; update `frontend/src/components/admin/index.ts`. Change the
`PageHeader` title (`:108`) to `"Brand access"` and its description to:

```
"Who can reach each brand. Managed in Passport — a person may hold a different role at each brand."
```

- [ ] **Step 3: Narrow the two call sites that now break**

Making `assignment_id` nullable breaks exactly two lines, and **not** the React key — React's `key`
accepts `string | null`, so `key={r.assignment_id}` type-checks fine and fails silently at runtime
instead. The real errors are:

- `BrandRolesTab.tsx:210` — `assignmentId: r.assignment_id` (`useSetBrandRole` takes
  `assignmentId: string`, `usePassportRoles.ts:78`)
- `BrandRolesTab.tsx:222` — `remove.mutate(r.assignment_id)` (`useRemoveBrandRole` takes
  `assignmentId: string`, `usePassportRoles.ts:86`)

Both live inside the table body that Task 9 replaces wholesale, where a `source === 'assigned'`
branch narrows `assignment_id` to `string` naturally. **Do not paper over them with `!` here.**

> **Expect a red `npm run build` until Task 10.** Tasks 7-9 are one refactor split for reviewability:
> the types change first, the components that satisfy them land last. Do not chase green in between,
> and do not add casts to force it.

### Task 8: `RoleLegend`

**Files:**
- Create: `frontend/src/components/admin/RoleLegend.tsx`

- [ ] **Step 1: Write it**

Native `<details>` — accessible, zero dependencies, no new `ui/` primitive for a first occurrence.

```tsx
'use client';

/**
 * The two role vocabularies, and the ladder.
 *
 * This page shows four role words from TWO different vocabularies, and nothing on screen used to
 * say which was which. `models/passport.py:164-186`: "a DIFFERENT vocabulary from the org
 * membership's Owner | Admin | Member. Do not conflate them."
 */
export function RoleLegend() {
  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        What do these roles mean?
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Brand roles — who can do what at one brand</p>
          <ul className="mt-1 space-y-1">
            <li>
              <span className="font-medium text-foreground">Manager</span> — manages the brand and
              can give <span className="font-medium text-foreground">Staff</span> a role there.
            </li>
            <li>
              <span className="font-medium text-foreground">Staff</span> — works at the brand.
            </li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-foreground">
            Organisation roles — who governs the organisation
          </p>
          <p className="mt-1">
            <span className="font-medium text-foreground">Owner</span>,{' '}
            <span className="font-medium text-foreground">Admin</span> and{' '}
            <span className="font-medium text-foreground">Member</span> are a separate vocabulary,
            set in Passport. They are not brand roles.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Why some rows say “auto”</p>
          <p className="mt-1">
            Owners and Admins get <span className="font-medium text-foreground">Manager</span> at
            every brand automatically, without being given a role — those rows are marked{' '}
            <span className="font-medium text-foreground">auto</span> and cannot be edited here.
            Give one of them an explicit role and it <em>overrides</em> the automatic Manager, so an
            Owner can be set to Staff at a single brand.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Passport has the final say</p>
          <p className="mt-1">
            Roles live in Passport; Prepper only asks. A refusal here is Passport applying its own
            rules — a Manager may give someone Staff, but not change an existing role.
          </p>
        </div>
      </div>
    </details>
  );
}
```

### Task 9: `BrandAccessTable`

**Files:**
- Create: `frontend/src/components/admin/BrandAccessTable.tsx`

- [ ] **Step 1: Write it**

Props: `brands`, `roster`, `pending`, `onSetRole`, `onRemove`. Group with `useMemo`; expansion in
local `useState<Set<string>>`.

Non-negotiables:
- **React key is `` `${r.platform_user_id}:${r.unit_id}` ``**, never `assignment_id` — it is null on
  every derived row.
- `source === 'derived'` → static `{role} · auto`, no `Select`, no `Remove`.
- `source === 'assigned'` → `Select` + `Remove`, **including for an Owner/Admin** — their explicit
  row is real and beats the ladder.
- Toggle is a `<button aria-expanded={open} aria-controls={...}>`; children are sibling `TableRow`s
  in a keyed `Fragment`.
- Header: Brand · People · Your role. The people count is `roster.filter(r => r.unit_id === b.id)`
  — derived rows included, so a brand with only Owners reads 3, not 0.

- [ ] **Step 2: No build gate here**

Still red until Task 10 wires the new components in — see the note in Task 7 Step 3.

### Task 10: `BrandAccessTab` wiring

**Files:**
- Modify: `frontend/src/components/admin/BrandAccessTab.tsx`

- [ ] **Step 1: Fix the assign-bar filter**

`BrandRolesTab.tsx:69-76` builds `taken` from every roster row at the selected brand. With derived
rows present that Set now contains **every Owner and Admin at every app-carrying brand** — they
would vanish from the Person dropdown everywhere and could never be given an explicit role again.
Guard on `source`:

```ts
  // `source === 'assigned'` ONLY. A derived holder has no row, so there is nothing to duplicate —
  // and assigning them Staff is a legitimate, observable act: the explicit row beats the ladder and
  // demotes them at that brand. Dropping them from this list would make that impossible.
  const assignable = useMemo(() => {
    if (!members) return [];
    if (!unitId) return members;
    const taken = new Set(
      (roster ?? [])
        .filter((r) => r.unit_id === unitId && r.source === 'assigned')
        .map((r) => r.platform_user_id)
    );
    return members.filter((m) => !taken.has(m.platform_user_id));
  }, [members, roster, unitId]);
```

- [ ] **Step 2: Delete the apology, mount the new parts**

- Delete the ladder paragraph (`:161-168`) — derived rows make it false.
- Replace the flat `Table` (`:171-232`) with `<BrandAccessTable ... />`.
- Insert `<RoleLegend />` between the assign bar and the table.
- Empty state loses its "Owners and Admins still hold Manager everywhere" caveat — if the table is
  empty now, it is genuinely empty.
- Keep the `!brands?.length` short-circuit (`:92-103`) verbatim. It is correct and well-explained.
- Update the module docstring (`:27-42`): the second "looks like a bug but is not" is now shown on
  screen as `· auto` rows, so replace it with the ladder-precedence rule.

- [ ] **Step 3: Verify**

```
cd frontend && npm run build && npm run lint
```
Confirm each file is under 500 lines (`performance.md`).

- [ ] **Step 4: COMMIT POINT**

```
feat(settings): rename Brand Roles to Brand Access — brand-first expandable roster, derived holders as rows, collapsible legend
```

---

## Chunk 6: Accounts tab

### Task 11: API + hook

**Files:**
- Modify: `frontend/src/lib/api.ts` (beside `getUsers`, `:1430-1452`; and beside the passport role mutations, `:1795+`)
- Modify: `frontend/src/lib/hooks/useUsers.ts`
- Modify: `frontend/src/lib/hooks/usePassportRoles.ts`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Type**

```ts
/** A person in the org, from Passport's membership, with their local account if they have one. */
export interface MemberAccount {
  platform_user_id: string;
  email: string;
  display_name: string | null;
  org_role: 'Owner' | 'Admin' | 'Member';
  /** null => never signed in via Passport, so no local row and no phone to edit. */
  user_id: string | null;
  username: string | null;
  phone_number: string | null;
}
```

- [ ] **Step 2: `getMemberAccounts`**

Takes **no argument** and walks all pages internally, exactly like `getUsers` (`:1430-1452`),
including `USERS_MAX_PAGES` and its over-cap warning. Do not add a `page` parameter.

- [ ] **Step 3: `useMemberAccounts`**

Query key `['member-accounts']`, `staleTime` 30s to match `useUsers` (`useUsers.ts:14-20`). Leave
`useUsers` untouched — `ParticipantPicker.tsx:23` depends on it.

- [ ] **Step 4: The invite write path — `inviteMember` + `useInviteMember`**

Task 12's modal needs both, and neither exists. `frontend.md` is explicit: *"Use the typed fetch
wrapper in `src/lib/api.ts` — don't call `fetch()` directly"* and *"All server data flows through
TanStack Query hooks"*. So:

```ts
// types/index.ts
export interface InviteMemberRequest {
  email: string;
  display_name?: string | null;
  /** The ORG vocabulary — NOT Manager/Staff. */
  role: 'Owner' | 'Admin' | 'Member';
}
```

```ts
// api.ts — beside the other passport role mutations (:1795+)
export async function invitePassportMember(data: InviteMemberRequest): Promise<void>
//   POST /passport/brand-roles/members
```

**Return `void`, not `PassportMember`.** The route returns Passport's `MembershipRead` **aggregate**
(`{id, role, status, version, ...}`), which is a different shape from `PassportMember`
(`types/index.ts:1028-1034` — `{platform_user_id, email, display_name, org_role, organization_id}`,
what `directory.assignable_members` returns). Typing it as `PassportMember` compiles and is a lie:
there is no runtime validation to catch it. Nothing consumes the body — the member arrives via the
sync echo, not this response — so `void` is honest. Add a real aggregate type only if a caller ever
needs the fields.

```ts
// hooks/usePassportRoles.ts — beside useAssignBrandRole
export function useInviteMember()
```

On success invalidate **three** keys:
- `['member-accounts']` — the Accounts roster (Task 11 Step 3)
- `MEMBERS_KEY` (`usePassportRoles.ts:20`) — the assign dropdown's source
  (`usePassportMembers`, `:42-49`). **Easy to miss and the most visible if you do:** its `staleTime`
  is 5 minutes (`:47`), so a freshly invited person is absent from Brand Access's Person dropdown
  for five minutes with no way to force it.
- the roles keys — reuse the module-private `useInvalidateRoles` (`:59-65`); it invalidates by
  prefix, so the `[KEY, userId]` keys match.

None of this makes the member appear on its own — see Task 12 Step 4. The projection is only written
by Passport's echo; invalidation just stops a stale cache from hiding them once it lands.

### Task 12: `UserManagementTab`

**Files:**
- Modify: `frontend/src/components/admin/UserManagementTab.tsx`
- Modify: `frontend/src/components/admin/AddUserModal.tsx`

- [ ] **Step 1: Re-point and migrate to the `Table` primitive**

`useUsers()` → `useMemberAccounts()`. Replace the hand-rolled `<table>` (`:99-163`) with the `Table`
primitives — `Table.tsx:6-12` records it was extracted for this file and never migrated.

Columns: Person (display name + email) · Org role (`Badge`) · Status · Phone.

**Fix the search filter in the same step.** `:19-28` filters on `user.username.toLowerCase()`, and
`MemberAccount.username` is `string | null` — a member who has never signed in has no local row and
therefore no username, so this is both a TS error and the wrong field to search. Filter on the
Passport-owned identity instead:

```ts
const haystack = `${row.display_name ?? ''} ${row.email}`.toLowerCase();
return haystack.includes(search.toLowerCase());
```

- [ ] **Step 2: Phone edits on your own row only**

`UserManagementTab` has no `currentUser` binding — identity comes from `useAppState()`:

```tsx
// PATCH /users/{user_id} refuses to edit anyone but the caller (api/users.py:86-090). This tab only
// got away with inline editing because it showed one person — you. With the whole roster, every
// other row's edit would 403, so other rows are read-only. Widening that PATCH to org admins is a
// new write capability on PII and belongs in its own change.
const { userId } = useAppState();
const isSelf = row.user_id !== null && row.user_id === userId;
```

Editable iff `isSelf`. Everything else renders read-only. Confirm the field name `useAppState()`
exposes for the signed-in user id before writing this.

- [ ] **Step 3: Status column**

`user_id === null` → `<Badge variant="secondary">Not signed in</Badge>`, phone shows `—`, no edit
affordance. Otherwise blank.

- [ ] **Step 4: The invite modal**

`AddUserModal` posts to `POST /passport/brand-roles/members`: email, display name, org role
(`Owner | Admin | Member` — the **org** vocabulary; do not offer Manager/Staff).

On success:
- **Do not insert a row optimistically.** Prepper never writes the projection; the member appears
  when the `membership.*` echo lands.
- Toast: `"Invited — they'll appear here once Passport syncs."`
- Invalidate `['member-accounts']`.
- Surface Passport's error verbatim; a `403` is a normal outcome.

Rewrite the `PageHeader` description (`:60`) to point at **Brand Access**, and note that invitees
appear once Passport syncs.

- [ ] **Step 5: Delete `useCreateUser` if it is now orphaned**

`AddUserModal.tsx:18` is its only consumer (`useUsers.ts:34-43`); `register/page.tsx:65` calls
`registerUser` directly and is unaffected. Once the modal invites through Passport, the hook is dead
code — `general.md`: *"No dead or commented-out code. Delete it — git history is the archive."*

Confirm with a grep before deleting:

```
cd frontend && grep -rn "useCreateUser" src/
```
If `AddUserModal` is the only hit, delete the hook. If anything else uses it, leave it and say so.

- [ ] **Step 6: Verify**

```
cd frontend && npm run build && npm run lint
```

- [ ] **Step 7: COMMIT POINT**

```
feat(settings): Accounts lists the org's Passport members; Add User invites via write-back
```

---

## Final verification

- [ ] `cd backend && pytest` — all green
- [ ] `cd backend && ruff check . && ruff format --check . && mypy app/`
- [ ] `cd frontend && npm run build && npm run lint`
- [ ] No file over 500 lines among those touched (`performance.md`)
- [ ] **Manual, against staging** — the one thing tests cannot see:
  - Accounts lists more than one person.
  - A member who has never signed in shows "Not signed in" and no phone edit.
  - Brand Access expands a brand and shows Owners as `Manager · auto` with no controls.
  - An Owner still appears in the assign dropdown, and giving them `Staff` at one brand demotes
    them **there only** — the other brands still read `Manager · auto`.
- [ ] **Before merging, settle Risk 1**: count `passport.identity_link` against
      `passport.membership WHERE status='active'` on staging. If many members are linked, the
      Accounts diagnosis was wrong and Chunk 4 needs re-examining.
- [ ] RLS untouched — no new tables, no policy changes, so `scripts/verify_rls.py` is not implicated.
      Stated so a reviewer does not go looking.
- [ ] `/update-context` if the tab rename should land in `CLAUDE.md`'s component list.
