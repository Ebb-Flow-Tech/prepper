"""Org-scope the child-table WRITE policies (org isolation, DB layer, 2/2).

Revision ID: q5rlswrite7x8y
Revises: q4rlsorg5v6w
Create Date: 2026-07-17

`q4rlsorg5v6w` closed the READ side. This closes the WRITE side, where 38 policies still asked the
org-less question — `is_admin()` / `is_manager_or_admin()`, i.e. "are you an admin ANYWHERE", the
same defect removed from the application layer in v0.0.65.

Two of them are worth naming, because they had no parent check at all:

* `menu_sketch_section` INSERT/UPDATE/DELETE were a bare `is_manager_or_admin()`. A Manager at any
  brand of any org could add, rename or delete sections on **any** sketch in the deployment.
* `supplier_ingredients` INSERT/UPDATE were the same, so supplier pricing on any org's ingredient
  could be rewritten. (The API-layer twin of this was fixed in v0.0.64; the DB never was.)

The rest already checked the parent (`can_access_*`, now org-aware via q4) and only OR'd in the
org-less admin bypass — narrower, but still "an Admin of org B may write org A's row".

## The org-returning helpers

A child row knows its parent, not its org, so `is_manager_or_admin_in(...)` needs the org looked up.
`<thing>_org(id)` does that in one place per family, rather than a correlated subquery repeated
across four policies.

## What deliberately keeps the org-less form

`allergens`, `recipe_categories` and `supplier_ingredient_tags` are GLOBAL reference vocabularies —
one shared list, no `organization_id`, `USING (true)` on SELECT by design (`security.md` permits
this for reference data). Their writes stay `is_admin()`: "an admin may edit the shared vocabulary"
is the intended rule, not an oversight. They are the only survivors, and they are listed explicitly
below so the exemption is a decision rather than a gap.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "q5rlswrite7x8y"
down_revision: str | Sequence[str] | None = "q4rlsorg5v6w"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# --- org-returning helpers -----------------------------------------------------------------

_ORG_FUNCS = (
    """
    CREATE OR REPLACE FUNCTION public.sketch_org(p_sketch_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT organization_id FROM menus_sketch WHERE id = p_sketch_id
    $$
    """,
    """
    CREATE OR REPLACE FUNCTION public.sketch_section_org(p_section_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.sketch_org(menu_sketch_id) FROM menu_sketch_section WHERE id = p_section_id
    $$
    """,
    """
    CREATE OR REPLACE FUNCTION public.sketch_item_org(p_item_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.sketch_section_org(menu_sketch_section_id)
        FROM menu_sketch_section_item WHERE id = p_item_id
    $$
    """,
    """
    CREATE OR REPLACE FUNCTION public.ingredient_org(p_ingredient_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT organization_id FROM ingredients WHERE id = p_ingredient_id
    $$
    """,
    """
    CREATE OR REPLACE FUNCTION public.supplier_ingredient_org(p_si_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.ingredient_org(ingredient_id) FROM supplier_ingredients WHERE id = p_si_id
    $$
    """,
    """
    CREATE OR REPLACE FUNCTION public.tasting_session_org(p_session_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT organization_id FROM tasting_sessions WHERE id = p_session_id
    $$
    """,
    """
    CREATE OR REPLACE FUNCTION public.tasting_note_org(p_note_id integer)
    RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.tasting_session_org(session_id) FROM tasting_notes WHERE id = p_note_id
    $$
    """,
)


def _drop_existing(table: str, cmd: str | None = None) -> None:
    """Drop the policies that ACTUALLY exist, by name from the catalogue — never by guess.

    `supplier_ingredient_supplier_ingredient_tags` names its policies `sit_join_*`. A guessed
    `DROP POLICY IF EXISTS "<table>_insert"` silently no-ops there, and because policies are
    PERMISSIVE the old one keeps granting alongside the new one.
    """
    conn = op.get_bind()
    sql = "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = :t"
    params: dict[str, str] = {"t": table}
    if cmd is not None:
        sql += " AND cmd = :cmd"
        params["cmd"] = cmd
    for (name,) in conn.execute(sa.text(sql), params).all():
        op.execute(f'DROP POLICY "{name}" ON {table}')


def _write_policies(table: str, write_pred: str, delete_pred: str) -> None:
    """Replace INSERT/UPDATE/DELETE, leaving SELECT (owned by q4) alone."""
    for cmd in ("INSERT", "UPDATE", "DELETE"):
        _drop_existing(table, cmd=cmd)
    op.execute(f'CREATE POLICY "{table}_insert" ON {table} FOR INSERT WITH CHECK ({write_pred})')
    op.execute(
        f'CREATE POLICY "{table}_update" ON {table} FOR UPDATE '
        f"USING ({write_pred}) WITH CHECK ({write_pred})"
    )
    op.execute(f'CREATE POLICY "{table}_delete" ON {table} FOR DELETE USING ({delete_pred})')


# (table, parent-reachability check, org expression) — write = reachable AND manager/admin of the
# row's OWN org; delete keeps whatever the table's original delete role was.
_CHILD_WRITES: tuple[tuple[str, str, str, str], ...] = (
    (
        "menu_sketch_section",
        "public.can_access_sketch(menu_sketch_id)",
        "public.sketch_org(menu_sketch_id)",
        "manager",
    ),
    (
        "menu_sketch_section_item",
        "public.can_access_sketch_section(menu_sketch_section_id)",
        "public.sketch_section_org(menu_sketch_section_id)",
        "manager",
    ),
    (
        "menu_sketch_section_item_comments",
        "public.can_access_sketch_item(menu_sketch_section_item_id)",
        "public.sketch_item_org(menu_sketch_section_item_id)",
        "manager",
    ),
    (
        "supplier_ingredients",
        "public.can_access_ingredient(ingredient_id)",
        "public.ingredient_org(ingredient_id)",
        "admin",
    ),
    (
        "supplier_ingredient_supplier_ingredient_tags",
        "public.can_access_supplier_ingredient(supplier_ingredient_id)",
        "public.supplier_ingredient_org(supplier_ingredient_id)",
        "admin",
    ),
    (
        "ingredient_allergens",
        "public.can_access_ingredient(ingredient_id)",
        "public.ingredient_org(ingredient_id)",
        "admin",
    ),
)


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return  # SQLite builds the schema via create_all and never runs alembic.

    for fn in _ORG_FUNCS:
        op.execute(fn)

    for table, reachable, org_expr, delete_role in _CHILD_WRITES:
        write = f"{reachable} AND public.is_manager_or_admin_in({org_expr})"
        delete_fn = "is_admin_in" if delete_role == "admin" else "is_manager_or_admin_in"
        delete = f"{reachable} AND public.{delete_fn}({org_expr})"
        _write_policies(table, write, delete)

    # `tasting_notes`: your own note, or an admin OF THAT NOTE'S ORG. The INSERT already checked
    # the session; UPDATE/DELETE did not, so an admin of any org could edit anyone's feedback.
    _write_policies(
        "tasting_notes",
        "public.can_access_tasting_session(session_id) AND "
        "(user_id = auth.uid()::text OR public.is_admin_in(public.tasting_session_org(session_id)))",
        "user_id = auth.uid()::text OR "
        "public.is_admin_in(public.tasting_session_org(session_id))",
    )

    # `tasting_sessions` INSERT was `creator_id = uid OR is_admin()`; the org must be one of yours,
    # and the admin bypass must be about THAT org.
    _drop_existing("tasting_sessions", cmd="INSERT")
    op.execute(
        """
        CREATE POLICY "tasting_sessions_insert" ON tasting_sessions FOR INSERT WITH CHECK (
            organization_id IN (SELECT public.my_org_ids())
            AND (creator_id = auth.uid()::text OR public.is_admin_in(organization_id))
        )
        """
    )

    # `tasting_note_images`: SELECT already routes through the org-aware
    # `can_access_tasting_session`; INSERT/DELETE used a bare `is_admin()`.
    for cmd in ("INSERT", "DELETE"):
        _drop_existing("tasting_note_images", cmd=cmd)
    image_pred = """
        (
            tasting_note_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM tasting_notes tn
                WHERE tn.id = tasting_note_images.tasting_note_id
                  AND public.can_access_tasting_session(tn.session_id)
                  AND (
                        tn.user_id = auth.uid()::text
                     OR public.is_admin_in(public.tasting_session_org(tn.session_id))
                  )
            )
        )
        OR (
            ingredient_tasting_note_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM ingredient_tasting_notes itn
                WHERE itn.id = tasting_note_images.ingredient_tasting_note_id
                  AND itn.user_id = auth.uid()::text
            )
        )
    """
    op.execute(
        f'CREATE POLICY "tasting_note_images_insert" ON tasting_note_images '
        f"FOR INSERT WITH CHECK ({image_pred})"
    )
    op.execute(
        f'CREATE POLICY "tasting_note_images_delete" ON tasting_note_images '
        f"FOR DELETE USING ({image_pred})"
    )

    # `ingredient_tasting_notes`: your own note, or an admin — but an ingredient tasting note has
    # no session and no org column, so there is nothing to scope the bypass by. Dropping the bypass
    # entirely is the honest answer: the row's author can always reach it, and the API layer
    # (`guards.require_ingredient_note_access`) is what admins go through.
    _write_policies(
        "ingredient_tasting_notes",
        "user_id = auth.uid()::text",
        "user_id = auth.uid()::text",
    )

    # `users`: no org column, and a person may belong to several orgs. "An admin of an org this
    # user is actually a member of" is the closest correct statement.
    _drop_existing("users", cmd="UPDATE")
    _drop_existing("users", cmd="DELETE")
    admin_of_their_org = """
        EXISTS (
            SELECT 1
            FROM passport.identity_link l
            JOIN passport.membership m ON m.platform_user_id = l.platform_user_id
            WHERE l.subject = users.id::text
              AND m.status = 'active'
              AND public.is_admin_in(m.organization_id)
        )
    """
    op.execute(
        f'CREATE POLICY "users_update" ON users FOR UPDATE '
        f"USING (id::text = auth.uid()::text OR {admin_of_their_org}) "
        f"WITH CHECK (id::text = auth.uid()::text OR {admin_of_their_org})"
    )
    op.execute(
        f'CREATE POLICY "users_delete" ON users FOR DELETE USING ({admin_of_their_org})'
    )

    # allergens / recipe_categories / supplier_ingredient_tags keep `is_admin()` on writes — global
    # reference vocabularies, see the module docstring.


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return

    for table, _reachable, _org, delete_role in _CHILD_WRITES:
        old_delete = "public.is_admin()" if delete_role == "admin" else "public.is_manager_or_admin()"
        _write_policies(table, "public.is_manager_or_admin()", old_delete)

    _write_policies(
        "tasting_notes",
        "public.can_access_tasting_session(session_id) AND "
        "(user_id = auth.uid()::text OR public.is_admin())",
        "user_id = auth.uid()::text OR public.is_admin()",
    )

    _drop_existing("tasting_sessions", cmd="INSERT")
    op.execute(
        'CREATE POLICY "tasting_sessions_insert" ON tasting_sessions FOR INSERT '
        "WITH CHECK (creator_id = auth.uid()::text OR public.is_admin())"
    )

    for cmd in ("INSERT", "DELETE"):
        _drop_existing("tasting_note_images", cmd=cmd)
    old_image = """
        (
            tasting_note_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM tasting_notes tn
                WHERE tn.id = tasting_note_images.tasting_note_id
                  AND (tn.user_id = auth.uid()::text OR public.is_admin())
            )
        )
        OR (
            ingredient_tasting_note_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM ingredient_tasting_notes itn
                WHERE itn.id = tasting_note_images.ingredient_tasting_note_id
                  AND (itn.user_id = auth.uid()::text OR public.is_admin())
            )
        )
    """
    op.execute(
        f'CREATE POLICY "tasting_note_images_insert" ON tasting_note_images '
        f"FOR INSERT WITH CHECK ({old_image})"
    )
    op.execute(
        f'CREATE POLICY "tasting_note_images_delete" ON tasting_note_images '
        f"FOR DELETE USING ({old_image})"
    )

    _write_policies(
        "ingredient_tasting_notes",
        "user_id = auth.uid()::text OR public.is_admin()",
        "user_id = auth.uid()::text OR public.is_admin()",
    )

    _drop_existing("users", cmd="UPDATE")
    _drop_existing("users", cmd="DELETE")
    op.execute(
        'CREATE POLICY "users_update" ON users FOR UPDATE '
        "USING (id::text = auth.uid()::text OR public.is_admin()) "
        "WITH CHECK (id::text = auth.uid()::text OR public.is_admin())"
    )
    op.execute('CREATE POLICY "users_delete" ON users FOR DELETE USING (public.is_admin())')
