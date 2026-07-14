"""Rule 7 — retire the `outlets` shadow table; re-key everything onto Passport unit UUIDs.

Revision ID: p2rtunit3k4l
Revises: p1rtaccess1x2y
Create Date: 2026-07-15

`outlets` held facts Passport owns — name, code, type, active flag, parent edge. Two copies of one
fact drift silently: Passport renames a brand and Prepper serves the old name forever, with no error.
Passport now carries the real structure (7 entities, 10 brands, 14 outlets), so the shadow goes and
its dependants point at the projection instead.

THE BRIDGE. Each Prepper outlet was imported into Passport with
``passport_unit.external_ref = 'prepper:<legacy outlets.id>'``. That makes the re-key a total
function — every row resolves, or the migration aborts. It does NOT guess.

WHAT CHANGES

- ``recipe_outlets.outlet_id``             int  -> ``unit_id``  text (a Passport unit UUID)
- ``menu_outlets.outlet_id``               int  -> ``unit_id``  text
- ``outlet_supplier_ingredient.outlet_id`` int  -> ``unit_id``  text   (8,637 rows)
- + ``organization_id`` on each (RULE 9: app-owned rows carry the Passport org UUID; with one org
  today the backfill is a constant, which is exactly why it is cheap to do NOW and expensive later)
- ``users.outlet_id`` dropped (already entirely NULL)
- ``outlets`` DROPPED, with its hierarchy and cycle detection

A foreign key IS declared onto ``passport_unit(id)``. That is safe: units are only ever UPSERTED by
the sync handler (``unit.archived`` sets ``status``; it does not delete), so the FK can never block a
sync write — while an orphan, which is what a missing FK would silently permit, is precisely the bug
this migration exists to prevent.

Junk: outlet 707 ("Outlet X", inactive, unmappable) and the two test menus pointing at it are
removed. Confirmed as throwaway; they are the only rows in the whole database that cannot bridge.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "p2rtunit3k4l"
down_revision: str | Sequence[str] | None = "p1rtaccess1x2y"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, whether the old outlet_id was part of the primary key)
_REKEYED = (
    ("recipe_outlets", True),
    ("menu_outlets", False),
    ("outlet_supplier_ingredient", False),
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        # The suite builds SQLite via create_all; this data migration is Postgres-only.
        return

    bind = op.get_bind()

    # 0. The only rows in the database that cannot bridge: outlet 707 ("Outlet X", inactive, no
    #    external_ref) and the menu_outlets LINKS pointing at it.
    #
    #    Only the LINKS are removed, not the menus. Deleting menus 8/9 as well pulled in
    #    `menu_sections` (ON DELETE NO ACTION) and aborted the entire migration — and it was never
    #    necessary: the re-key only needs every SURVIVING outlet_id to resolve. The two test menus
    #    simply end up with no outlets, which is a state the app already tolerates, and they can be
    #    deleted through the UI like any other menu.
    bind.execute(sa.text("DELETE FROM menu_outlets WHERE outlet_id = 707"))
    bind.execute(sa.text("DELETE FROM outlets WHERE id = 707"))

    # 1. New columns, nullable for now so the backfill can populate them.
    for table, _ in _REKEYED:
        op.add_column(table, sa.Column("unit_id", sa.String(), nullable=True))
        op.add_column(table, sa.Column("organization_id", sa.String(), nullable=True))

    # 2. Backfill through the external_ref bridge. Both the unit AND its org come from the
    #    projection — the org is never assumed, so a second org needs no code change later.
    for table, _ in _REKEYED:
        bind.execute(
            sa.text(
                f"""
                UPDATE {table} t
                SET unit_id = u.id, organization_id = u.organization_id
                FROM passport_unit u
                WHERE u.external_ref = 'prepper:' || t.outlet_id
                """
            )
        )

    # 3. ABORT unless the re-key was total. A partial re-key is worse than none: it silently
    #    strands rows, and the shadow table is about to be dropped, so the mapping is gone forever.
    for table, _ in _REKEYED:
        stranded = bind.execute(
            sa.text(f"SELECT count(*) FROM {table} WHERE unit_id IS NULL")
        ).scalar_one()
        if stranded:
            raise RuntimeError(
                f"{table}: {stranded} row(s) could not resolve to a Passport unit via "
                f"external_ref. Refusing to drop `outlets` while any row would be stranded."
            )

    # 4. Swap the old column out.
    for table, in_pk in _REKEYED:
        op.alter_column(table, "unit_id", nullable=False)
        op.alter_column(table, "organization_id", nullable=False)

        if in_pk:
            # recipe_outlets: PK was (recipe_id, outlet_id).
            op.drop_constraint("recipe_outlets_pkey", table, type_="primary")
        op.drop_column(table, "outlet_id")
        if in_pk:
            op.create_primary_key("recipe_outlets_pkey", table, ["recipe_id", "unit_id"])

        op.create_foreign_key(
            f"fk_{table}_unit_id", table, "passport_unit", ["unit_id"], ["id"]
        )
        op.create_index(f"ix_{table}_unit_id", table, ["unit_id"])
        op.create_index(f"ix_{table}_organization_id", table, ["organization_id"])

    # outlet_supplier_ingredient's uniqueness was (supplier_ingredient_id, outlet_id).
    op.drop_constraint(
        "outlet_supplier_ingredient_supplier_ingredient_id_outlet_id_key",
        "outlet_supplier_ingredient",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_outlet_supplier_ingredient_si_unit",
        "outlet_supplier_ingredient",
        ["supplier_ingredient_id", "unit_id"],
    )

    # 5. The shadow itself. users.outlet_id is already entirely NULL (its holders were purged).
    op.drop_column("users", "outlet_id")
    op.drop_table("outlets")


def downgrade() -> None:
    raise RuntimeError(
        "Irreversible: `outlets` and its serial ids are gone, and the rows now carry Passport "
        "UUIDs. Restore from a backup taken before this migration."
    )
