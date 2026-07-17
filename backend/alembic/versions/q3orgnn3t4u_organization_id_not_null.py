"""Make `organization_id` NOT NULL on the seven per-org tables (org isolation 3/3).

Revision ID: q3orgnn3t4u
Revises: q2orgfill1r2s
Create Date: 2026-07-17

`q1orgcol9p0q` added the column, `q2orgfill1r2s` backfilled it, and v0.0.65 made every create stamp
it from the acting org. This closes the loop.

**This is the migration that failed before.** An early version of `q2orgfill1r2s` set NOT NULL while
the create path still inserted NULLs; every write on staging raised `NotNullViolation` within
seconds of deploy. It is safe NOW, and only now, because creates populate the column — the
prerequisite, not a detail.

Why it matters beyond tidiness: `domain/org_scope.py` admits `organization_id IS NULL` as a
transitional arm, which means an un-backfilled row is visible to **every** org. That arm is a
standing cross-org hole, and it cannot be removed while a NULL is still representable. NOT NULL is
what retires it.

**Defensive backfill first.** `q2` ran at some earlier point; any row inserted between then and now
by a version that did not yet stamp would still be NULL, and `SET NOT NULL` would fail the whole
deploy on it. So we re-run the same founding-org rule for stragglers rather than assume `q2` caught
everything. On a database where `q2` did its job this updates zero rows.

**Deploy-window hazard, documented deliberately.** `fly.toml` runs `alembic upgrade head` as a
release_command: migrations complete BEFORE the new version serves, which means the OLD version is
still accepting writes while this runs. If the currently-deployed version predates create-stamping
(v0.0.65), any insert in that window fails. The rule is therefore: **do not deploy this to an
environment running below v0.0.65.** Staging was on v0.0.65 with 0 NULLs across 15,974 rows when
this was written.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "q3orgnn3t4u"
down_revision: str | Sequence[str] | None = "q2orgfill1r2s"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The seven per-org tables. `recipe_outlets`, `menu_outlets` and `outlet_supplier_ingredient` also
# carry the column but are stamped from their unit rather than the acting org, and are left alone
# here — they were never part of the create-path change, so their invariant is not yet established.
TABLES = (
    "recipes",
    "ingredients",
    "suppliers",
    "categories",
    "tasting_sessions",
    "menus",
    "menus_sketch",
)


def _founding_org(conn) -> str | None:
    """The single org this deployment belongs to, or None if that is not answerable.

    Same rule as `q2orgfill1r2s`: with exactly one org projected there is no ambiguity about whose
    the pre-org data is. With more than one, guessing would silently hand one tenant's rows to
    another — so we refuse and let the deploy fail loudly instead.
    """
    orgs = [
        r[0]
        for r in conn.execute(
            sa.text(
                "SELECT DISTINCT organization_id FROM passport.membership "
                "WHERE status = 'active'"
            )
        )
    ]
    if len(orgs) != 1:
        return None
    return orgs[0]


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return  # SQLite builds the schema via create_all and never runs alembic.

    stragglers = {
        t: conn.execute(
            sa.text(f"SELECT count(*) FROM {t} WHERE organization_id IS NULL")  # noqa: S608
        ).scalar()
        for t in TABLES
    }
    remaining = {t: n for t, n in stragglers.items() if n}

    if remaining:
        org = _founding_org(conn)
        if org is None:
            raise RuntimeError(
                "Cannot set organization_id NOT NULL: rows still carry NULL "
                f"({remaining}) and this deployment has 0 or >1 projected orgs, so there is no "
                "unambiguous owner to assign them to. Backfill them deliberately, then re-run."
            )
        for table, count in remaining.items():
            conn.execute(
                sa.text(
                    f"UPDATE {table} SET organization_id = :org "  # noqa: S608
                    "WHERE organization_id IS NULL"
                ),
                {"org": org},
            )
            print(f"  q3: backfilled {count} straggler row(s) in {table} -> {org}")

    for table in TABLES:
        op.alter_column(table, "organization_id", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    for table in TABLES:
        op.alter_column(table, "organization_id", existing_type=sa.String(), nullable=True)
