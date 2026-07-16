"""Backfill `organization_id` on the per-org domain tables (design 2026-07-16).

Revision ID: q2orgfill1r2s
Revises: q1orgcol9p0q
Create Date: 2026-07-16

Step 2 of 3. `q1orgcol9p0q` added the nullable columns; this fills them. Step 3 will enforce
(query predicates, child-router parent checks, RLS).

**It refuses to run rather than guess.** The rule below assigns every row that cannot be derived
from the data to THE founding org, and that is only sound while exactly one org has data. If a
second org has appeared, the assumption is dead and this aborts — assigning "everything belongs to
the one org" to a database that has since acquired a second is the precise failure the whole
report-and-decide checkpoint exists to prevent.

Rule, in order of authority:

1. **Unit link.** `recipes` and `menus` take the org from `recipe_outlets` / `menu_outlets`, and
   `suppliers` from `supplier_ingredients -> outlet_supplier_ingredient`. The link carries the org
   of a unit the row is actually served at, so it is authoritative. A row linked to more than one
   org is a conflict and is left for the founding-org rule rather than resolved to an arbitrary
   match.
2. **Founding org.** Everything else. Measured on staging, that is ~96% of rows: `ingredients`,
   `categories` and `menus_sketch` have NO owner column and NO unit link, so nothing in the data
   says which org they belong to — they were a globally-shared pool. No ownership rule can help,
   because there is no ownership.

The owner->membership derivation the report models is deliberately NOT used here. It only changes
which rows land in bucket 1 vs bucket 2, and with one org both buckets resolve to the same id — so
it would add a projection dependency and a failure mode for no behavioural difference. Re-derive it
if the founding-org rule is ever replaced.

**This does NOT set `NOT NULL`, and that ordering is load-bearing.** An earlier version did, and it
broke every write on staging within seconds: the column became mandatory in the database while the
application still had no code that populates it on insert, so every `INSERT` failed with
`NotNullViolation` (verified — `INSERT INTO categories` 500s). `NOT NULL` cannot land before the
write path sets the column, so it belongs with step 3's enforcement, alongside the create paths
that stamp `organization_id` from the acting org context. Backfilling EXISTING rows and constraining
FUTURE ones are different changes and must ship in that order.

Consequence: the column stays nullable after this runs, but every existing row has a value. That is
the honest state — populated, not yet enforced.

Raw SQL and self-contained by convention: a migration is a historical record, and importing app
models would break it the moment they move (as `p3rtrls5m6n7`'s helpers did).

Postgres-only in effect; the suite builds the schema via `create_all` and never runs alembic.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "q2orgfill1r2s"
down_revision: str | Sequence[str] | None = "q1orgcol9p0q"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ORG_SCOPED_TABLES: tuple[str, ...] = (
    "recipes",
    "ingredients",
    "suppliers",
    "categories",
    "tasting_sessions",
    "menus",
    "menus_sketch",
)

# (table, link table, fk column) — the authoritative derivations.
_LINK_DERIVATIONS: tuple[tuple[str, str, str], ...] = (
    ("recipes", "recipe_outlets", "recipe_id"),
    ("menus", "menu_outlets", "menu_id"),
)

_SUPPLIER_FROM_LINK = """
UPDATE suppliers s SET organization_id = (
    SELECT MIN(osi.organization_id)
    FROM supplier_ingredients si
    JOIN outlet_supplier_ingredient osi ON osi.supplier_ingredient_id = si.id
    WHERE si.supplier_id = s.id
)
WHERE s.organization_id IS NULL
  AND (
    SELECT COUNT(DISTINCT osi.organization_id)
    FROM supplier_ingredients si
    JOIN outlet_supplier_ingredient osi ON osi.supplier_ingredient_id = si.id
    WHERE si.supplier_id = s.id
  ) = 1
"""

_FROM_LINK = """
UPDATE {table} t SET organization_id = (
    SELECT MIN(l.organization_id) FROM {link} l WHERE l.{fk} = t.id
)
WHERE t.organization_id IS NULL
  AND (SELECT COUNT(DISTINCT l.organization_id) FROM {link} l WHERE l.{fk} = t.id) = 1
"""


def _founding_org(conn: sa.Connection) -> str | None:
    """The single org that owns everything here, or None when there are no rows to assign.

    Raises when more than one org exists: the founding-org rule is not sound then, and there is no
    correct answer this migration could pick.
    """
    org_ids = [
        row[0] for row in conn.execute(sa.text("SELECT id FROM passport.organization"))
    ]

    if len(org_ids) == 1:
        return org_ids[0]

    if not org_ids:
        # Nothing projected yet — a fresh environment. Only safe if there is nothing to assign.
        unassigned = sum(
            conn.execute(
                sa.text(f"SELECT COUNT(*) FROM {table} WHERE organization_id IS NULL")
            ).scalar_one()
            for table in _ORG_SCOPED_TABLES
        )
        if unassigned == 0:
            return None
        raise RuntimeError(
            f"{unassigned} row(s) need an organization_id but no org is projected. "
            "Run `python -m app.passport.reconcile` first."
        )

    raise RuntimeError(
        f"Refusing to backfill: {len(org_ids)} orgs are projected, so 'everything belongs to the "
        "founding org' is no longer true and there is no correct org to assign. "
        "Run `python -m scripts.org_backfill_report` and choose a rule for the undecidable rows "
        "before re-running this migration."
    )


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Authoritative: the org of a unit the row is actually served at.
    for table, link, fk in _LINK_DERIVATIONS:
        conn.execute(sa.text(_FROM_LINK.format(table=table, link=link, fk=fk)))
    conn.execute(sa.text(_SUPPLIER_FROM_LINK))

    # 2. Everything else -> the founding org. Aborts if that is no longer a single org.
    founding = _founding_org(conn)
    if founding is not None:
        for table in _ORG_SCOPED_TABLES:
            conn.execute(
                sa.text(
                    f"UPDATE {table} SET organization_id = :org WHERE organization_id IS NULL"
                ),
                {"org": founding},
            )

    # 3. Assert the rule was total. It leaves nothing NULL by construction, so a leftover is a bug
    #    in the rule and must surface loudly rather than become a silent permanent special case.
    #
    #    This ASSERTS but does not constrain: `NOT NULL` waits for step 3. See the module docstring
    #    — making the column mandatory before the write path populates it breaks every INSERT.
    for table in _ORG_SCOPED_TABLES:
        remaining = conn.execute(
            sa.text(f"SELECT COUNT(*) FROM {table} WHERE organization_id IS NULL")
        ).scalar_one()
        if remaining:
            raise RuntimeError(
                f"{table}: {remaining} row(s) still have no organization_id after backfill"
            )


def downgrade() -> None:
    # Clear what this migration set. The columns themselves belong to `q1orgcol9p0q` and stay
    # nullable throughout, so there is no constraint to drop.
    #
    # This clears EVERY value, not just the ones this wrote — the two are indistinguishable
    # afterwards, and the alternative (leave them) would make a re-run see a half-filled table and
    # skip rows it should own. Downgrading to a state where nothing is assigned is the honest
    # inverse of a migration that assigns everything.
    for table in _ORG_SCOPED_TABLES:
        op.execute(f"UPDATE {table} SET organization_id = NULL")
