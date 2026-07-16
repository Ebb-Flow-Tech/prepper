"""Add a nullable `organization_id` to the per-org domain tables (design 2026-07-16).

Revision ID: q1orgcol9p0q
Revises: p4rtschema7n8o
Create Date: 2026-07-16

Step 1 of 3 in giving Prepper real multi-tenancy. Purely ADDITIVE: nullable columns and their
indexes, nothing backfilled, no query changed, no behaviour changed. Safe to deploy alone and
reversible by dropping the columns.

Why this is needed: `organization_id` exists today on exactly three LINK tables (`recipe_outlets`,
`menu_outlets`, `outlet_supplier_ingredient`) and appears in **no WHERE clause anywhere**. No core
entity has an org column at all, so with several orgs live there is nothing to scope a query by.
`recipe_outlet.py:8` says the column exists "so every query can be org-scoped"; none does.

Sequel: `q2` derives what it can and REPORTS the undecidable count; the rule for those rows is
chosen from real numbers, then `q3` enforces and (only if the count reaches zero) sets NOT NULL.
Nothing destructive runs before a human has seen the numbers.

Deliberately NOT here:

- `allergens` — a global real-world vocabulary (nuts, dairy, gluten), not per-org.
- `users` — org membership is Passport-owned and already projected into `passport.membership`.
  Copying it onto the `users` row would duplicate Passport-owned state (which CLAUDE.md forbids:
  "never projected onto the `users` row") and would be simply wrong for a multi-org user, who has
  no single org. `GET /users` scopes by joining identity_link -> membership instead.
- child tables (`recipe_ingredients`, sections, notes, images...) — a child is reachable only
  through its parent, so it scopes through the parent. An org column on a child is state that can
  disagree with its parent, which is a worse failure than the join.

Postgres-only in effect; the suite builds the schema on SQLite via `create_all` and never runs
alembic.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "q1orgcol9p0q"
down_revision: str | Sequence[str] | None = "p4rtschema7n8o"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The per-org entity tables. Each gets a nullable `organization_id` + an index.
#
# Kept in step with Unit 2 of the design doc and with `two_org_fixture`, which asserts one
# cross-org read per table — so a table added here without a test is visible.
_ORG_SCOPED_TABLES: tuple[str, ...] = (
    "recipes",
    "ingredients",
    "suppliers",
    "categories",
    "tasting_sessions",
    "menus",
    "menus_sketch",
)

# Tables whose list queries always filter on an active/status flag, so the composite index matches
# the real access pattern rather than the org column alone (performance.md: index-aware queries).
_ACTIVE_FLAG_BY_TABLE: dict[str, str] = {
    "ingredients": "is_active",
    "suppliers": "is_active",
    "categories": "is_active",
}


def _index_name(table: str) -> str:
    return f"ix_{table}_organization_id"


def _composite_index_name(table: str) -> str:
    return f"ix_{table}_organization_id_active"


def upgrade() -> None:
    for table in _ORG_SCOPED_TABLES:
        op.add_column(
            table,
            # Nullable on purpose: every existing row starts NULL and `q2` fills in only what is
            # authoritatively derivable. A NOT NULL here would need a default, and any default is a
            # guess that silently assigns real data to an org — the one outcome worth avoiding,
            # because a wrong assignment loses a user access to their own recipe.
            sa.Column("organization_id", sa.String(), nullable=True),
        )
        op.create_index(_index_name(table), table, ["organization_id"])

        active_flag = _ACTIVE_FLAG_BY_TABLE.get(table)
        if active_flag:
            op.create_index(
                _composite_index_name(table), table, ["organization_id", active_flag]
            )


def downgrade() -> None:
    for table in reversed(_ORG_SCOPED_TABLES):
        if table in _ACTIVE_FLAG_BY_TABLE:
            op.drop_index(_composite_index_name(table), table_name=table)
        op.drop_index(_index_name(table), table_name=table)
        op.drop_column(table, "organization_id")
