"""Add the Passport unit / unit-app read-model tables (the derived-access model).

Revision ID: p1rtaccess1x2y
Revises: p0rtsync9m0d1
Create Date: 2026-07-14

Completes the Passport projection. The original read model (``p0rtsync9m0d1``) covered only
organization / membership / entitlement / identity link, which predates Passport's derived
access model. App access is DERIVED from four facts — the entitlement, the org role (the
Owner/Admin ladder), the brand-app switch (``unit_app_access``) and the (user, brand, app)
role row (``unit_app_membership``) — so without these tables no role is ever projected and
access can never be granted.

Creates:
- ``passport_unit``               — mutable, version-guarded (brands/outlets/entities).
- ``passport_unit_relation``      — IMMUTABLE, no ``version`` (structure edges).
- ``passport_unit_app_access``    — IMMUTABLE, no ``version`` (the brand-app switch).
- ``passport_unit_app_membership``— mutable, version-guarded; ``removed`` is a KEPT tombstone.
- ``outlets.passport_unit_id``    — links a Prepper outlet to its Passport brand.

Conformance notes
-----------------
- Primary keys are the Passport UUIDs adopted verbatim, stored as text.
- ``outlets`` is a TOOL-LOCAL table and is NOT re-keyed: it keeps its serial int PK, its
  hierarchy and its cycle detection. The new column is a nullable LINK, resolved by matching
  ``passport_unit.external_ref`` against ``outlets.code``. Nullable because the link only
  exists once Passport actually carries the ref — until then no outlet scope is derived and
  existing local grants are untouched.
- The projected tables are a **read-only projection**: only the sync backend (Postgres service
  role, which carries BYPASSRLS in Supabase) writes them. RLS is ENABLED **and FORCED** with
  NO client policies — a default-deny — and all access is revoked from ``anon`` /
  ``authenticated``.
- RLS / GRANT statements are Postgres-only and guarded by dialect, so the migration is a no-op
  on SQLite (the test-suite uses ``create_all``, not migrations).
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p1rtaccess1x2y"
down_revision: str | Sequence[str] | None = "p0rtsync9m0d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TABLES = (
    "passport_unit",
    "passport_unit_relation",
    "passport_unit_app_access",
    "passport_unit_app_membership",
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "passport_unit",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),  # brand | outlet | entity
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("external_ref", sa.String(), nullable=True),  # -> outlets.code
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_passport_unit_organization_id", "passport_unit", ["organization_id"]
    )
    op.create_index("ix_passport_unit_type", "passport_unit", ["type"])
    op.create_index("ix_passport_unit_external_ref", "passport_unit", ["external_ref"])

    op.create_table(
        "passport_unit_relation",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("from_unit_id", sa.String(), nullable=False),
        sa.Column("to_unit_id", sa.String(), nullable=False),
        sa.Column("relation", sa.String(), nullable=False),
    )
    op.create_index(
        "ix_passport_unit_relation_organization_id",
        "passport_unit_relation",
        ["organization_id"],
    )
    op.create_index(
        "ix_passport_unit_relation_from_unit_id",
        "passport_unit_relation",
        ["from_unit_id"],
    )
    op.create_index(
        "ix_passport_unit_relation_to_unit_id",
        "passport_unit_relation",
        ["to_unit_id"],
    )

    op.create_table(
        "passport_unit_app_access",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("unit_id", sa.String(), nullable=False),  # always a BRAND
        sa.Column("app_id", sa.String(), nullable=False),
    )
    op.create_index(
        "ix_passport_unit_app_access_organization_id",
        "passport_unit_app_access",
        ["organization_id"],
    )
    op.create_index(
        "ix_passport_unit_app_access_unit_id",
        "passport_unit_app_access",
        ["unit_id"],
    )

    op.create_table(
        "passport_unit_app_membership",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("platform_user_id", sa.String(), nullable=False),
        sa.Column("unit_id", sa.String(), nullable=False),  # always a BRAND
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),  # Manager | Staff
        sa.Column("status", sa.String(), nullable=False),  # active | removed (tombstone)
        sa.Column("version", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_passport_unit_app_membership_organization_id",
        "passport_unit_app_membership",
        ["organization_id"],
    )
    op.create_index(
        "ix_passport_unit_app_membership_platform_user_id",
        "passport_unit_app_membership",
        ["platform_user_id"],
    )
    op.create_index(
        "ix_passport_unit_app_membership_unit_id",
        "passport_unit_app_membership",
        ["unit_id"],
    )

    # Tool-local table: a nullable LINK to the projected brand, never a re-key.
    op.add_column(
        "outlets", sa.Column("passport_unit_id", sa.String(), nullable=True)
    )
    op.create_index(
        "ix_outlets_passport_unit_id", "outlets", ["passport_unit_id"]
    )

    if not _is_postgres():
        return

    # Read-only projection: enable + FORCE RLS, no client policies (default-deny), and revoke
    # all direct access from the client roles. Only the BYPASSRLS service role (the sync
    # backend) reads/writes these tables.
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON {table} FROM anon, authenticated")


def downgrade() -> None:
    if _is_postgres():
        for table in _TABLES:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_index("ix_outlets_passport_unit_id", "outlets")
    op.drop_column("outlets", "passport_unit_id")

    op.drop_index(
        "ix_passport_unit_app_membership_unit_id", "passport_unit_app_membership"
    )
    op.drop_index(
        "ix_passport_unit_app_membership_platform_user_id",
        "passport_unit_app_membership",
    )
    op.drop_index(
        "ix_passport_unit_app_membership_organization_id",
        "passport_unit_app_membership",
    )
    op.drop_table("passport_unit_app_membership")

    op.drop_index("ix_passport_unit_app_access_unit_id", "passport_unit_app_access")
    op.drop_index(
        "ix_passport_unit_app_access_organization_id", "passport_unit_app_access"
    )
    op.drop_table("passport_unit_app_access")

    op.drop_index("ix_passport_unit_relation_to_unit_id", "passport_unit_relation")
    op.drop_index("ix_passport_unit_relation_from_unit_id", "passport_unit_relation")
    op.drop_index(
        "ix_passport_unit_relation_organization_id", "passport_unit_relation"
    )
    op.drop_table("passport_unit_relation")

    op.drop_index("ix_passport_unit_external_ref", "passport_unit")
    op.drop_index("ix_passport_unit_type", "passport_unit")
    op.drop_index("ix_passport_unit_organization_id", "passport_unit")
    op.drop_table("passport_unit")
