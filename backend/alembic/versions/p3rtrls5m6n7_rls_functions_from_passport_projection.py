"""Redefine the RLS helper functions to derive admin/manager from the Passport projection.

Revision ID: p3rtrls5m6n7
Revises: p2rtunit3k4l
Create Date: 2026-07-15

`p2rtunit3k4l` dropped `users.user_type` and `users.is_manager` (rule 8), but the RLS helpers from
`h1i2j3k4l5m6` still read them: `is_admin()` does `WHERE user_type = 'admin'`, `is_manager_or_admin()`
reads both columns. Postgres does NOT dependency-check function BODIES, so the column drop succeeded
and left both functions referencing gone columns — every RLS-gated query then errors with
`column "user_type" does not exist`.

The backend connects as the BYPASSRLS `postgres` role, so the app path never evaluates these and kept
working — but that is exactly why the breakage was invisible. RLS is defense-in-depth (`security.md`),
and it is currently broken: a non-service connection (a leaked `authenticated` JWT hitting Postgres
directly) would error rather than be safely scoped. This restores it.

Roles now live in Passport, projected locally, so the helpers derive from the projection instead of a
user column. This is coarse by design — per-brand scoping is the APP's job (`app.passport.access`);
at the RLS layer we only need a sound defense-in-depth grant:

- `is_admin()`            : the user holds an active org `Owner`/`Admin` membership.
- `is_manager_or_admin()` : the above (the ladder), OR holds an active `Manager` role at any brand.

Both stay `SECURITY DEFINER` — they read the projection tables, which are RLS-forced default-deny, so
they must run as the function owner (BYPASSRLS), not the querying role. The bridge from the local user
to Passport is `passport_identity_link.subject = users.id (= auth.uid())`.

Idempotent (`CREATE OR REPLACE`) and Postgres-only; a no-op on SQLite (the suite uses `create_all`).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "p3rtrls5m6n7"
down_revision: str | Sequence[str] | None = "p2rtunit3k4l"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


_IS_ADMIN_FROM_PROJECTION = """
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1
            FROM passport_identity_link l
            JOIN passport_membership m ON m.platform_user_id = l.platform_user_id
            WHERE l.subject = auth.uid()::text
              AND m.status = 'active'
              AND m.role IN ('Owner', 'Admin')
        )
    $$
"""

_IS_MANAGER_OR_ADMIN_FROM_PROJECTION = """
    CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.is_admin() OR EXISTS (
            SELECT 1
            FROM passport_identity_link l
            JOIN passport_unit_app_membership uam
                 ON uam.platform_user_id = l.platform_user_id
            WHERE l.subject = auth.uid()::text
              AND uam.status = 'active'
              AND uam.role = 'Manager'
        )
    $$
"""

# The pre-rule-8 definitions (read the now-dropped user columns) — for downgrade only.
_IS_ADMIN_LEGACY = """
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text AND LOWER(user_type::text) = 'admin'
        )
    $$
"""

_IS_MANAGER_OR_ADMIN_LEGACY = """
    CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
              AND (LOWER(user_type::text) = 'admin' OR is_manager = true)
        )
    $$
"""


def upgrade() -> None:
    if not _is_postgres():
        return
    op.execute(_IS_ADMIN_FROM_PROJECTION)
    op.execute(_IS_MANAGER_OR_ADMIN_FROM_PROJECTION)


def downgrade() -> None:
    if not _is_postgres():
        return
    # Restores the legacy bodies — only valid if `users.user_type`/`is_manager` are also restored
    # (i.e. after p2rtunit3k4l is itself downgraded, which it refuses). Present for symmetry.
    op.execute(_IS_ADMIN_LEGACY)
    op.execute(_IS_MANAGER_OR_ADMIN_LEGACY)
