"""Add Passport sync read-model tables.

Revision ID: p0rtsync9m0d1
Revises: b8c9d0e1f2g3
Create Date: 2026-07-07

Creates the local read-model tables projected from the Passport sync webhook feed
(organization, membership, entitlement, identity link). See ``app/models/passport.py`` and
``app/passport/``.

Conformance notes
-----------------
- Primary keys are the Passport UUIDs adopted verbatim, stored as text (like ``users.id``).
- These tables are a **read-only projection**: only the sync backend (Postgres service role,
  which carries BYPASSRLS in Supabase) writes them. RLS is ENABLED **and FORCED** with NO
  client policies — a default-deny that keeps member emails unreachable by the ``anon`` /
  ``authenticated`` roles. All write access is likewise revoked from those roles.
- RLS / GRANT statements are Postgres-only and guarded by dialect so the migration is a
  no-op on SQLite (which the test-suite uses via ``create_all``, not migrations).
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p0rtsync9m0d1"
down_revision: str | Sequence[str] | None = "b8c9d0e1f2g3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TABLES = (
    "passport_organization",
    "passport_membership",
    "passport_entitlement",
    "passport_identity_link",
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "passport_organization",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_passport_organization_slug", "passport_organization", ["slug"]
    )

    op.create_table(
        "passport_membership",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("platform_user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_passport_membership_organization_id",
        "passport_membership",
        ["organization_id"],
    )
    op.create_index(
        "ix_passport_membership_platform_user_id",
        "passport_membership",
        ["platform_user_id"],
    )

    op.create_table(
        "passport_entitlement",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("tier", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_passport_entitlement_organization_id",
        "passport_entitlement",
        ["organization_id"],
    )

    op.create_table(
        "passport_identity_link",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("platform_user_id", sa.String(), nullable=False),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("linked_via", sa.String(), nullable=False),
    )
    op.create_index(
        "ix_passport_identity_link_platform_user_id",
        "passport_identity_link",
        ["platform_user_id"],
    )
    op.create_index(
        "ix_passport_identity_link_subject",
        "passport_identity_link",
        ["subject"],
    )

    if not _is_postgres():
        return

    # Read-only projection: enable + FORCE RLS, no client policies (default-deny), and
    # revoke all direct access from the client roles. Only the BYPASSRLS service role
    # (the sync backend) reads/writes these tables.
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON {table} FROM anon, authenticated")


def downgrade() -> None:
    if _is_postgres():
        for table in _TABLES:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_index("ix_passport_identity_link_subject", "passport_identity_link")
    op.drop_index(
        "ix_passport_identity_link_platform_user_id", "passport_identity_link"
    )
    op.drop_table("passport_identity_link")

    op.drop_index(
        "ix_passport_entitlement_organization_id", "passport_entitlement"
    )
    op.drop_table("passport_entitlement")

    op.drop_index(
        "ix_passport_membership_platform_user_id", "passport_membership"
    )
    op.drop_index(
        "ix_passport_membership_organization_id", "passport_membership"
    )
    op.drop_table("passport_membership")

    op.drop_index("ix_passport_organization_slug", "passport_organization")
    op.drop_table("passport_organization")
