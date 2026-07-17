"""Org-scope every RLS policy (org isolation, DB layer).

Revision ID: q4rlsorg5v6w
Revises: q3orgnn3t4u
Create Date: 2026-07-17

The application layer enforces org isolation as of v0.0.65-67. RLS did not — **not one of the 123
policies mentioned `organization_id`**, and 14 of the 32 SELECT policies were `USING (true)`:
`ingredients`, `suppliers`, `categories`, `menus_sketch`, `supplier_ingredients` and the whole
menu-sketch family were readable by any authenticated role. For those tables RLS was not a weakened
second line of defence; it was no line of defence.

`recipes_select` was wrong in a way worth naming: `owner_id = auth.uid() OR is_public = true OR
is_admin()`. That `is_public` had no org predicate under it — the identical bug fixed in
`guards._may_see_recipe` and `RecipeService._build_list_query` in v0.0.65. The app and RLS disagreed,
and RLS was the one that was wrong.

## What RLS can and cannot express here

RLS has **no request context**: no header, no acting org, only `auth.uid()`. So it cannot enforce
"the org you are currently acting in" — that is the application's job, via `get_org_context`. What
RLS can enforce is membership: you may never touch a row in an org you are not a member of, whatever
the application believes. That is the correct division of labour, and it is why the predicates below
use `my_org_ids()` (a set) rather than a single active org.

## Why this is not `DROP FUNCTION`

`is_admin()` and `is_manager_or_admin()` have 29 policies depending on them. `DROP FUNCTION` would
cascade-drop every one of those policies — silently turning RLS off on the tables it is meant to
protect. Everything here is `CREATE OR REPLACE`, and the old helpers are kept (re-pointed at the new
org-aware ones) rather than removed.

## Untestable by the suite

`conftest.py` is SQLite in-memory; RLS is Postgres-only. The 918 tests stay green regardless of what
this migration does. It is verified by `scripts/verify_rls.py`, which connects as a NON-bypassing
role and asserts cross-org reads return nothing — the backend's own role is `service_role`
(BYPASSRLS), so it can never exercise a policy.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "q4rlsorg5v6w"
down_revision: str | Sequence[str] | None = "q3orgnn3t4u"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# --- Helpers -------------------------------------------------------------------------------

# The set of orgs the caller is an ACTIVE member of. Everything else is built on this.
# `STABLE` so Postgres may cache it per-statement; `SECURITY DEFINER` because the projection lives
# in the `passport` schema, which is private to the backend role.
_MY_ORG_IDS = """
    CREATE OR REPLACE FUNCTION public.my_org_ids()
    RETURNS SETOF text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT m.organization_id
        FROM passport.identity_link l
        JOIN passport.membership m ON m.platform_user_id = l.platform_user_id
        WHERE l.subject = auth.uid()::text
          AND m.status = 'active'
    $$
"""

# "Admin of THIS org" — the question `is_admin()` could not ask. The org-less form means "admin of
# ANY of your orgs", which is how an Owner of org B came to administer org A.
_IS_ADMIN_IN = """
    CREATE OR REPLACE FUNCTION public.is_admin_in(p_org text)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1
            FROM passport.identity_link l
            JOIN passport.membership m ON m.platform_user_id = l.platform_user_id
            WHERE l.subject = auth.uid()::text
              AND m.organization_id = p_org
              AND m.status = 'active'
              AND m.role IN ('Owner', 'Admin')
        )
    $$
"""

_IS_MANAGER_OR_ADMIN_IN = """
    CREATE OR REPLACE FUNCTION public.is_manager_or_admin_in(p_org text)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.is_admin_in(p_org) OR EXISTS (
            SELECT 1
            FROM passport.identity_link l
            JOIN passport.unit_app_membership uam
                 ON uam.platform_user_id = l.platform_user_id
            WHERE l.subject = auth.uid()::text
              AND uam.organization_id = p_org
              AND uam.status = 'active'
              AND uam.role = 'Manager'
        )
    $$
"""

# `is_admin()` / `is_manager_or_admin()` are KEPT, not dropped — 29 policies depend on them and a
# DROP would cascade those policies away. They keep their old "in any of my orgs" meaning, which is
# now only ever reached underneath an org predicate, so the union can no longer widen anything.
# Left in place so that a policy this migration missed still fails closed rather than erroring.

# --- Parent-resolving helpers, now org-aware -----------------------------------------------
#
# These are why the 22 child tables (recipe_ingredients, tasting_notes, menu_items, the sketch
# family...) need no bespoke joins: they already delegate here, and each of these queries a table
# that DOES carry organization_id. Fixing the helper fixes every child that uses it.

_CAN_ACCESS_RECIPE = """
    CREATE OR REPLACE FUNCTION public.can_access_recipe(p_recipe_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM recipes r
            WHERE r.id = p_recipe_id
              AND r.organization_id IN (SELECT public.my_org_ids())
              AND (
                    r.owner_id = auth.uid()::text
                 OR r.is_public = true
                 OR public.is_admin_in(r.organization_id)
              )
        )
    $$
"""

_OWNS_RECIPE = """
    CREATE OR REPLACE FUNCTION public.owns_recipe(p_recipe_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM recipes r
            WHERE r.id = p_recipe_id
              AND r.organization_id IN (SELECT public.my_org_ids())
              AND (r.owner_id = auth.uid()::text OR public.is_admin_in(r.organization_id))
        )
    $$
"""

_CAN_ACCESS_MENU = """
    CREATE OR REPLACE FUNCTION public.can_access_menu(p_menu_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM menus m
            WHERE m.id = p_menu_id
              AND m.organization_id IN (SELECT public.my_org_ids())
              AND (
                    m.created_by = auth.uid()::text
                 OR public.is_manager_or_admin_in(m.organization_id)
              )
        )
    $$
"""

_CAN_ACCESS_TASTING_SESSION = """
    CREATE OR REPLACE FUNCTION public.can_access_tasting_session(p_session_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM tasting_sessions ts
            WHERE ts.id = p_session_id
              AND ts.organization_id IN (SELECT public.my_org_ids())
              AND (
                    ts.creator_id = auth.uid()::text
                 OR public.is_admin_in(ts.organization_id)
                 OR EXISTS (
                        SELECT 1 FROM tasting_users tu
                        WHERE tu.tasting_session_id = p_session_id
                          AND tu.user_id = auth.uid()::text
                    )
              )
        )
    $$
"""

_OWNS_TASTING_SESSION = """
    CREATE OR REPLACE FUNCTION public.owns_tasting_session(p_session_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM tasting_sessions ts
            WHERE ts.id = p_session_id
              AND ts.organization_id IN (SELECT public.my_org_ids())
              AND (ts.creator_id = auth.uid()::text OR public.is_admin_in(ts.organization_id))
        )
    $$
"""

# A menu section belongs to a menu; an item to a section. `can_access_menu` covers both, but the
# item policies join through `menu_sections` inline, so they get a helper of their own rather than
# a subquery repeated four times.
_CAN_ACCESS_MENU_SECTION = """
    CREATE OR REPLACE FUNCTION public.can_access_menu_section(p_section_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM menu_sections ms
            WHERE ms.id = p_section_id
              AND public.can_access_menu(ms.menu_id)
        )
    $$
"""

# The menu-sketch family: comment -> item -> section -> sketch -> org. The same chain the API
# guards walk (`api/guards.py`), expressed once here.
_CAN_ACCESS_SKETCH = """
    CREATE OR REPLACE FUNCTION public.can_access_sketch(p_sketch_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM menus_sketch s
            WHERE s.id = p_sketch_id
              AND s.organization_id IN (SELECT public.my_org_ids())
        )
    $$
"""

_CAN_ACCESS_SKETCH_SECTION = """
    CREATE OR REPLACE FUNCTION public.can_access_sketch_section(p_section_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM menu_sketch_section sec
            WHERE sec.id = p_section_id
              AND public.can_access_sketch(sec.menu_sketch_id)
        )
    $$
"""

_CAN_ACCESS_SKETCH_ITEM = """
    CREATE OR REPLACE FUNCTION public.can_access_sketch_item(p_item_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM menu_sketch_section_item i
            WHERE i.id = p_item_id
              AND public.can_access_sketch_section(i.menu_sketch_section_id)
        )
    $$
"""

# An ingredient/supplier link row hangs off an ingredient, which carries the org.
_CAN_ACCESS_INGREDIENT = """
    CREATE OR REPLACE FUNCTION public.can_access_ingredient(p_ingredient_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM ingredients i
            WHERE i.id = p_ingredient_id
              AND i.organization_id IN (SELECT public.my_org_ids())
        )
    $$
"""

_CAN_ACCESS_SUPPLIER_INGREDIENT = """
    CREATE OR REPLACE FUNCTION public.can_access_supplier_ingredient(p_si_id integer)
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM supplier_ingredients si
            WHERE si.id = p_si_id
              AND public.can_access_ingredient(si.ingredient_id)
        )
    $$
"""

_NEW_FUNCTIONS = (
    _MY_ORG_IDS,
    _IS_ADMIN_IN,
    _IS_MANAGER_OR_ADMIN_IN,
    _CAN_ACCESS_RECIPE,
    _OWNS_RECIPE,
    _CAN_ACCESS_MENU,
    _CAN_ACCESS_MENU_SECTION,
    _CAN_ACCESS_TASTING_SESSION,
    _OWNS_TASTING_SESSION,
    _CAN_ACCESS_SKETCH,
    _CAN_ACCESS_SKETCH_SECTION,
    _CAN_ACCESS_SKETCH_ITEM,
    _CAN_ACCESS_INGREDIENT,
    _CAN_ACCESS_SUPPLIER_INGREDIENT,
)


# --- Policies ------------------------------------------------------------------------------
#
# (table, org-carrying?) -> the tables that can self-scope. Their four policies are rebuilt to the
# same shape: membership gates the read, and the write verbs additionally require the org's own
# manager/admin. `USING (true)` on SELECT is what these had; it is what this replaces.
# Only the tables whose policies were org-BLIND in their own right: a bare `USING (true)` read and
# `is_admin()` / `is_manager_or_admin()` writes.
#
# `recipe_outlets`, `menu_outlets` and `tasting_sessions` are deliberately ABSENT. They already
# delegate to `can_access_recipe` / `can_access_menu` / `can_access_tasting_session` / `owns_*`,
# and those helpers are org-aware as of this migration — so those tables inherit the fix and need
# no policy change at all. Rewriting them cost real precision the first time this was attempted:
# `tasting_sessions_select` became plain org membership, which let a non-participant read any
# session in their org (breaking the participants-only invariant in CLAUDE.md), and
# `owns_tasting_session` was replaced by `is_admin_in`, which took away the creator's right to
# update their own session. The RLS integration tests caught all three.
#
# (table, insert/update gate, delete gate) — the split is preserved from the originals: writing an
# ingredient is a Manager's job, deleting one is an Admin's.
_ORG_TABLE_POLICIES: tuple[tuple[str, str, str], ...] = (
    ("ingredients", "public.is_manager_or_admin_in", "public.is_admin_in"),
    ("suppliers", "public.is_manager_or_admin_in", "public.is_admin_in"),
    ("categories", "public.is_manager_or_admin_in", "public.is_admin_in"),
    ("outlet_supplier_ingredient", "public.is_manager_or_admin_in", "public.is_admin_in"),
    # menus_sketch let a Manager delete; that is its own rule, not an oversight.
    ("menus_sketch", "public.is_manager_or_admin_in", "public.is_manager_or_admin_in"),
)


def _drop_existing(table: str, cmd: str | None = None) -> None:
    """Drop the policies that ACTUALLY exist on ``table``, by querying the catalogue.

    **Never guess policy names.** `supplier_ingredient_supplier_ingredient_tags` names its policies
    `sit_join_*`, not `<table>_select` — so a `DROP POLICY IF EXISTS "<table>_select"` silently
    no-ops, the new policy is ADDED BESIDE the old one, and because every policy here is PERMISSIVE
    they OR together: the old `USING (true)` keeps letting everything through while the table looks
    freshly locked down. A rename anywhere else would reintroduce that silently.

    ``cmd`` limits the drop to one verb (pg_policies.cmd is 'SELECT'/'INSERT'/...); None drops all.
    """
    conn = op.get_bind()
    sql = "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = :t"
    params: dict[str, str] = {"t": table}
    if cmd is not None:
        # Built conditionally rather than `(:cmd::text IS NULL OR cmd = :cmd)` — SQLAlchemy reads
        # `:cmd::text` as a bind param named `cmd:` and the statement fails to parse.
        sql += " AND cmd = :cmd"
        params["cmd"] = cmd
    for (name,) in conn.execute(sa.text(sql), params).all():
        op.execute(f'DROP POLICY "{name}" ON {table}')


def _rebuild_org_table(table: str, write_fn: str, delete_fn: str) -> None:
    """Four policies for a table whose old ones were org-blind in their own right.

    SELECT becomes membership alone — replacing `USING (true)`. RLS has no acting org, so it cannot
    express the finer rule the application applies, and it should not try: its job is that you never
    reach an org you are not a member of. Narrowing further here would diverge from the app and
    silently break reads the app allows.

    The write gates keep each table's original role split (Manager writes, Admin deletes); only the
    org predicate is new.
    """
    member = "organization_id IN (SELECT public.my_org_ids())"
    write_pred = f"({member} AND {write_fn}(organization_id))"
    delete_pred = f"({member} AND {delete_fn}(organization_id))"

    _drop_existing(table)

    op.execute(f'CREATE POLICY "{table}_select" ON {table} FOR SELECT USING ({member})')
    op.execute(f'CREATE POLICY "{table}_insert" ON {table} FOR INSERT WITH CHECK {write_pred}')
    op.execute(
        f'CREATE POLICY "{table}_update" ON {table} FOR UPDATE '
        f"USING {write_pred} WITH CHECK {write_pred}"
    )
    op.execute(f'CREATE POLICY "{table}_delete" ON {table} FOR DELETE USING {delete_pred}')


def _rebuild_menus() -> None:
    """`menus` keeps its creator-or-manager rule, under an org predicate.

    Its policies were already more precise than a role check (`created_by = uid OR
    is_manager_or_admin()`), so only the org test is added.
    """
    member = "organization_id IN (SELECT public.my_org_ids())"
    pred = (
        f"({member} AND (created_by = auth.uid()::text "
        f"OR public.is_manager_or_admin_in(organization_id)))"
    )
    _drop_existing("menus")
    op.execute(f'CREATE POLICY "menus_select" ON menus FOR SELECT USING {pred}')
    op.execute(f'CREATE POLICY "menus_insert" ON menus FOR INSERT WITH CHECK {pred}')
    op.execute(
        f'CREATE POLICY "menus_update" ON menus FOR UPDATE USING {pred} WITH CHECK {pred}'
    )
    op.execute(f'CREATE POLICY "menus_delete" ON menus FOR DELETE USING {pred}')


def _rebuild_recipes() -> None:
    """`recipes` keeps its owner/public rule — under an org predicate this time.

    The old SELECT was `owner_id = uid OR is_public OR is_admin()`: `is_public` with nothing above
    it, so every tenant's public recipes were readable by everyone at the DB layer, exactly as they
    were at the API layer until v0.0.65.
    """
    member = "organization_id IN (SELECT public.my_org_ids())"
    visible = (
        f"({member} AND (owner_id = auth.uid()::text OR is_public = true "
        f"OR public.is_admin_in(organization_id)))"
    )
    writable = f"({member} AND (owner_id = auth.uid()::text OR public.is_admin_in(organization_id)))"

    _drop_existing("recipes")

    op.execute(f'CREATE POLICY "recipes_select" ON recipes FOR SELECT USING {visible}')
    op.execute(f'CREATE POLICY "recipes_insert" ON recipes FOR INSERT WITH CHECK {writable}')
    op.execute(
        f'CREATE POLICY "recipes_update" ON recipes FOR UPDATE '
        f"USING {writable} WITH CHECK {writable}"
    )
    op.execute(f'CREATE POLICY "recipes_delete" ON recipes FOR DELETE USING {writable}')


# Child tables whose SELECT was `USING (true)` and which resolve through a parent helper. Only the
# SELECT is rebuilt here; their write policies already route through the (now org-aware) helpers.
_SELECT_VIA_HELPER: tuple[tuple[str, str], ...] = (
    ("menu_sketch_section", "public.can_access_sketch(menu_sketch_id)"),
    ("menu_sketch_section_item", "public.can_access_sketch_section(menu_sketch_section_id)"),
    (
        "menu_sketch_section_item_comments",
        "public.can_access_sketch_item(menu_sketch_section_item_id)",
    ),
    ("supplier_ingredients", "public.can_access_ingredient(ingredient_id)"),
    (
        "supplier_ingredient_supplier_ingredient_tags",
        "public.can_access_supplier_ingredient(supplier_ingredient_id)",
    ),
    ("ingredient_allergens", "public.can_access_ingredient(ingredient_id)"),
    ("recipe_categories", "TRUE"),  # see note in upgrade(): genuine global reference data
    ("allergens", "TRUE"),
    ("supplier_ingredient_tags", "TRUE"),
)


# --- Tables that must keep their own, more precise policies ---------------------------------
#
# These three delegate to `can_access_*` / `owns_*`, which this migration makes org-aware — so they
# are already fixed and need no new predicate. They are (re)asserted rather than skipped because an
# earlier iteration of this migration rewrote them into crude role checks
# (`tasting_sessions_select` became `USING (true)`, opening every session in the org to
# non-participants) and its downgrade "restored" those wrong bodies rather than the originals. A
# migration that states the policies it depends on cannot be silently undone by a bad neighbour.
#
# On a database that never saw that, this drops and recreates identical policies: a no-op with a
# comment attached.
_HELPER_DELEGATING: tuple[tuple[str, str, str, str, str], ...] = (
    # (table, select_using, insert_check, update_using_and_check, delete_using)
    (
        "recipe_outlets",
        "public.can_access_recipe(recipe_id)",
        "public.owns_recipe(recipe_id)",
        "public.owns_recipe(recipe_id)",
        "public.owns_recipe(recipe_id)",
    ),
    (
        "menu_outlets",
        "public.can_access_menu(menu_id)",
        "public.can_access_menu(menu_id)",
        "public.can_access_menu(menu_id)",
        "public.can_access_menu(menu_id)",
    ),
    (
        "tasting_sessions",
        "public.can_access_tasting_session(id)",
        "(creator_id = auth.uid()::text OR public.is_admin())",
        "public.owns_tasting_session(id)",
        "public.owns_tasting_session(id)",
    ),
)


def _reassert_helper_delegating() -> None:
    """Restore each table's original, helper-based policies verbatim."""
    for table, sel, ins, upd, dele in _HELPER_DELEGATING:
        _drop_existing(table)
        op.execute(f'CREATE POLICY "{table}_select" ON {table} FOR SELECT USING ({sel})')
        op.execute(f'CREATE POLICY "{table}_insert" ON {table} FOR INSERT WITH CHECK ({ins})')
        op.execute(
            f'CREATE POLICY "{table}_update" ON {table} FOR UPDATE '
            f"USING ({upd}) WITH CHECK ({upd})"
        )
        op.execute(f'CREATE POLICY "{table}_delete" ON {table} FOR DELETE USING ({dele})')


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return  # SQLite builds the schema via create_all and never runs alembic.

    for fn in _NEW_FUNCTIONS:
        op.execute(fn)

    _rebuild_recipes()
    _rebuild_menus()
    _reassert_helper_delegating()
    for table, write_fn, delete_fn in _ORG_TABLE_POLICIES:
        _rebuild_org_table(table, write_fn, delete_fn)

    # Child SELECTs that were `USING (true)`.
    #
    # `allergens`, `recipe_categories` and `supplier_ingredient_tags` STAY `TRUE` and keep it
    # deliberately: they are global reference vocabularies (a peanut allergen is not a tenant's
    # secret), they carry no org column, and `security.md` explicitly permits `USING (true)` on
    # SELECT for reference data. Their WRITES remain admin-gated. This is the one case where the
    # wide-open read is the right answer rather than an oversight.
    for table, pred in _SELECT_VIA_HELPER:
        _drop_existing(table, cmd="SELECT")
        op.execute(f'CREATE POLICY "{table}_select" ON {table} FOR SELECT USING ({pred})')

    # `users` is not org-columned and must not become so — a multi-org person has no single org.
    # Membership is the test, via the projection, mirroring `user_service._org_scoped_user_query`.
    _drop_existing("users", cmd="SELECT")
    op.execute(
        """
        CREATE POLICY "users_select" ON users FOR SELECT USING (
            id::text = auth.uid()::text
            OR EXISTS (
                SELECT 1
                FROM passport.identity_link l
                JOIN passport.membership m ON m.platform_user_id = l.platform_user_id
                WHERE l.subject = users.id::text
                  AND m.status = 'active'
                  AND m.organization_id IN (SELECT public.my_org_ids())
            )
        )
        """
    )


def downgrade() -> None:
    """Restore the pre-org policies and helper bodies.

    Deliberately does NOT drop `my_org_ids`, `is_admin_in`, `is_manager_or_admin_in` or the new
    `can_access_*` helpers: a DROP cascades to any policy still referencing them, which is the
    failure mode this whole migration is written to avoid. Leaving unused functions behind is
    harmless; dropping a function that a policy still depends on silently disables RLS.
    """
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.can_access_recipe(p_recipe_id integer)
        RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT (
                EXISTS (
                    SELECT 1 FROM recipes
                    WHERE id = p_recipe_id
                      AND (owner_id = auth.uid()::text OR is_public = true)
                ) OR public.is_admin()
            )
        $$
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.owns_recipe(p_recipe_id integer)
        RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT (
                EXISTS (
                    SELECT 1 FROM recipes WHERE id = p_recipe_id AND owner_id = auth.uid()::text
                ) OR public.is_admin()
            )
        $$
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.can_access_menu(p_menu_id integer)
        RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT (
                EXISTS (
                    SELECT 1 FROM menus WHERE id = p_menu_id AND created_by = auth.uid()::text
                ) OR public.is_manager_or_admin()
            )
        $$
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.can_access_tasting_session(p_session_id integer)
        RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT (
                EXISTS (
                    SELECT 1 FROM tasting_sessions
                    WHERE id = p_session_id AND creator_id = auth.uid()::text
                )
                OR EXISTS (
                    SELECT 1 FROM tasting_users
                    WHERE tasting_session_id = p_session_id AND user_id = auth.uid()::text
                )
                OR public.is_admin()
            )
        $$
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.owns_tasting_session(p_session_id integer)
        RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT (
                EXISTS (
                    SELECT 1 FROM tasting_sessions
                    WHERE id = p_session_id AND creator_id = auth.uid()::text
                ) OR public.is_admin()
            )
        $$
        """
    )

    _drop_existing("recipes")
    op.execute(
        'CREATE POLICY "recipes_select" ON recipes FOR SELECT USING '
        "(owner_id = auth.uid()::text OR is_public = true OR public.is_admin())"
    )
    op.execute(
        'CREATE POLICY "recipes_insert" ON recipes FOR INSERT WITH CHECK '
        "(owner_id = auth.uid()::text OR public.is_admin())"
    )
    op.execute(
        'CREATE POLICY "recipes_update" ON recipes FOR UPDATE USING '
        "(owner_id = auth.uid()::text OR public.is_admin()) WITH CHECK "
        "(owner_id = auth.uid()::text OR public.is_admin())"
    )
    op.execute(
        'CREATE POLICY "recipes_delete" ON recipes FOR DELETE USING '
        "(owner_id = auth.uid()::text OR public.is_admin())"
    )

    for table, _fn, delete_fn in _ORG_TABLE_POLICIES:
        _drop_existing(table)
        op.execute(f'CREATE POLICY "{table}_select" ON {table} FOR SELECT USING (true)')
        op.execute(
            f'CREATE POLICY "{table}_insert" ON {table} FOR INSERT '
            "WITH CHECK (public.is_manager_or_admin())"
        )
        op.execute(
            f'CREATE POLICY "{table}_update" ON {table} FOR UPDATE '
            "USING (public.is_manager_or_admin()) WITH CHECK (public.is_manager_or_admin())"
        )
        old_delete = (
            "public.is_manager_or_admin()"
            if delete_fn.endswith("is_manager_or_admin_in")
            else "public.is_admin()"
        )
        op.execute(
            f'CREATE POLICY "{table}_delete" ON {table} FOR DELETE USING ({old_delete})'
        )

    _reassert_helper_delegating()  # unchanged by this migration in either direction

    _drop_existing("menus")
    menus_pred = "(created_by = auth.uid()::text OR public.is_manager_or_admin())"
    op.execute(f'CREATE POLICY "menus_select" ON menus FOR SELECT USING {menus_pred}')
    op.execute(f'CREATE POLICY "menus_insert" ON menus FOR INSERT WITH CHECK {menus_pred}')
    op.execute(
        f'CREATE POLICY "menus_update" ON menus FOR UPDATE '
        f"USING {menus_pred} WITH CHECK {menus_pred}"
    )
    op.execute(f'CREATE POLICY "menus_delete" ON menus FOR DELETE USING {menus_pred}')

    for table, _pred in _SELECT_VIA_HELPER:
        _drop_existing(table, cmd="SELECT")
        op.execute(f'CREATE POLICY "{table}_select" ON {table} FOR SELECT USING (true)')

    _drop_existing("users", cmd="SELECT")
    op.execute(
        'CREATE POLICY "users_select" ON users FOR SELECT USING '
        "(id::text = auth.uid()::text OR public.is_admin())"
    )
