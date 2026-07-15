"""Relocate the Passport projection into a dedicated `passport` schema (design 2026-07-15).

Revision ID: p4rtschema7n8o
Revises: p3rtrls5m6n7
Create Date: 2026-07-15

Moves the eight projected read-model tables out of `public` (where they carried a `passport_` name
prefix) into a dedicated `passport` schema, dropping the prefix: `public.passport_unit` becomes
`passport.unit`, etc. The schema IS the namespace — foreign data reads unmistakably as `passport.*`,
and the projection can be locked read-only at the schema level if the app ever gains a role distinct
from the BYPASSRLS backend.

Postgres-only: the test suite builds the schema on SQLite via `create_all` and never runs alembic; on
SQLite the `passport` schema collapses to the default via a `schema_translate_map` (see
`app/database.py`). This migration is a no-op there.

Two `SECURITY DEFINER` RLS helpers (`public.is_admin`, `public.is_manager_or_admin`, defined in
`p3rtrls5m6n7`) read the projection by unqualified name; after the move those names resolve to
nothing, so they are `CREATE OR REPLACE`d here with `passport.`-qualified references. Table PRIVILEGES,
RLS enabled/forced state, and indexes all move with the table; the new `passport` schema is private to
its owner (the backend role) by default, so no client role can reach it — defense-in-depth is
preserved, not weakened.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "p4rtschema7n8o"
down_revision: str | Sequence[str] | None = "p3rtrls5m6n7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "passport"

# old public table name -> new bare name in the `passport` schema
_TABLES = (
    ("passport_organization", "organization"),
    ("passport_membership", "membership"),
    ("passport_entitlement", "entitlement"),
    ("passport_unit", "unit"),
    ("passport_unit_relation", "unit_relation"),
    ("passport_unit_app_access", "unit_app_access"),
    ("passport_unit_app_membership", "unit_app_membership"),
    ("passport_identity_link", "identity_link"),
)

# Indexes are deliberately NOT renamed. SQLAlchemy's auto-generated index name for a column with
# `index=True` prepends the table's schema, so `passport.unit.type` yields `ix_passport_unit_type` —
# byte-for-byte the SAME name the pre-move `public.passport_unit` table already carried. The indexes
# travel into the `passport` schema with their tables (via SET SCHEMA) and their existing names
# already match the models; renaming them would CREATE autogenerate drift, not remove it.

# RLS helpers re-qualified for the new schema (bodies otherwise identical to p3rtrls5m6n7).
_IS_ADMIN_SCHEMA = """
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT EXISTS (
            SELECT 1
            FROM passport.identity_link l
            JOIN passport.membership m ON m.platform_user_id = l.platform_user_id
            WHERE l.subject = auth.uid()::text
              AND m.status = 'active'
              AND m.role IN ('Owner', 'Admin')
        )
    $$
"""

_IS_MANAGER_OR_ADMIN_SCHEMA = """
    CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
        SELECT public.is_admin() OR EXISTS (
            SELECT 1
            FROM passport.identity_link l
            JOIN passport.unit_app_membership uam
                 ON uam.platform_user_id = l.platform_user_id
            WHERE l.subject = auth.uid()::text
              AND uam.status = 'active'
              AND uam.role = 'Manager'
        )
    $$
"""

# The p3 (pre-move) bodies, for downgrade — unqualified names back in `public`.
_IS_ADMIN_PUBLIC = """
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

_IS_MANAGER_OR_ADMIN_PUBLIC = """
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


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    for old, new in _TABLES:
        op.execute(f"ALTER TABLE public.{old} SET SCHEMA {SCHEMA}")
        op.execute(f"ALTER TABLE {SCHEMA}.{old} RENAME TO {new}")
    # Indexes move with their tables and keep names that already match the models (see note above).
    # Re-point the RLS helpers at the relocated tables.
    op.execute(_IS_ADMIN_SCHEMA)
    op.execute(_IS_MANAGER_OR_ADMIN_SCHEMA)


def downgrade() -> None:
    if not _is_postgres():
        return
    # Order matters: the public-name RLS helpers reference `passport_identity_link` etc., and a
    # LANGUAGE sql body is validated at CREATE time — so the tables must be back in `public` under
    # their prefixed names BEFORE the functions are restored. Move tables, then indexes, then bodies.
    for old, new in _TABLES:
        op.execute(f"ALTER TABLE {SCHEMA}.{new} SET SCHEMA public")
        op.execute(f"ALTER TABLE public.{new} RENAME TO {old}")
    # Indexes were never renamed on the way up, so nothing to restore here — they travel back into
    # `public` with their tables, names unchanged.
    op.execute(_IS_ADMIN_PUBLIC)
    op.execute(_IS_MANAGER_OR_ADMIN_PUBLIC)
    # Leave the empty `passport` schema in place; dropping it is not required for correctness and a
    # stray object would make DROP SCHEMA fail. A follow-up may `DROP SCHEMA passport RESTRICT`.
