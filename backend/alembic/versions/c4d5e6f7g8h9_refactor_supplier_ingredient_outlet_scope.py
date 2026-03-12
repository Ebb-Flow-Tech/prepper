"""Refactor supplier_ingredient outlet scope: create outlet_supplier_ingredient table, remove outlet_id from supplier_ingredients.

Revision ID: c4d5e6f7g8h9
Revises: b3c4d5e6f7g8
Create Date: 2026-03-12

Changes:
- Create outlet_supplier_ingredient join table (supplier_ingredient_id, outlet_id)
- Migrate existing outlet_id data from supplier_ingredients into the new table
- Drop uq_supplier_ingredient_outlet unique constraint (ingredient_id, supplier_id, outlet_id)
- Drop FK, index, and outlet_id column from supplier_ingredients
- SKU unique constraint on supplier_ingredients remains unchanged
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7g8h9"
down_revision: str | None = "b3c4d5e6f7g8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 0. Drop outlet_supplier_ingredient if it already exists (e.g. from a prior manual creation)
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS outlet_supplier_ingredient CASCADE"))

    # 1. Create outlet_supplier_ingredient table
    op.create_table(
        "outlet_supplier_ingredient",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("supplier_ingredient_id", sa.Integer(), nullable=False),
        sa.Column("outlet_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["supplier_ingredient_id"],
            ["supplier_ingredients.id"],
            name="fk_osi_supplier_ingredient_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["outlet_id"],
            ["outlets.id"],
            name="fk_osi_outlet_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "supplier_ingredient_id", "outlet_id",
            name="uq_outlet_supplier_ingredient",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_osi_supplier_ingredient_id",
        "outlet_supplier_ingredient",
        ["supplier_ingredient_id"],
    )
    op.create_index(
        "ix_osi_outlet_id",
        "outlet_supplier_ingredient",
        ["outlet_id"],
    )

    # 2. Migrate existing outlet_id data into the new table
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO outlet_supplier_ingredient (supplier_ingredient_id, outlet_id, created_at)
        SELECT id, outlet_id, created_at
        FROM supplier_ingredients
        WHERE outlet_id IS NOT NULL
    """))

    # 3. Drop the compound unique constraint (includes outlet_id)
    #    Guard for environments where it may not exist
    result = conn.execute(sa.text("""
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_supplier_ingredient_outlet'
          AND conrelid = 'supplier_ingredients'::regclass
    """)).scalar()
    if result:
        op.drop_constraint(
            "uq_supplier_ingredient_outlet",
            "supplier_ingredients",
            type_="unique",
        )

    # 4. Drop FK constraint and index on outlet_id
    fk_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_supplier_ingredients_outlet_id'
          AND conrelid = 'supplier_ingredients'::regclass
    """)).scalar()
    if fk_result:
        op.drop_constraint(
            "fk_supplier_ingredients_outlet_id",
            "supplier_ingredients",
            type_="foreignkey",
        )

    ix_result = conn.execute(sa.text("""
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'ix_supplier_ingredients_outlet_id'
          AND tablename = 'supplier_ingredients'
    """)).scalar()
    if ix_result:
        op.drop_index(
            "ix_supplier_ingredients_outlet_id",
            table_name="supplier_ingredients",
        )

    # 5. Drop outlet_id column from supplier_ingredients
    op.drop_column("supplier_ingredients", "outlet_id")

    # 6. Make outlets.code nullable (FMH outlets don't require a code)
    op.alter_column("outlets", "code", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # 1. Re-add outlet_id as nullable (existing rows have no value)
    op.add_column(
        "supplier_ingredients",
        sa.Column("outlet_id", sa.Integer(), nullable=True),
    )

    # 2. Backfill outlet_id from outlet_supplier_ingredient (first link per row)
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE supplier_ingredients si
        SET outlet_id = osi.outlet_id
        FROM (
            SELECT DISTINCT ON (supplier_ingredient_id)
                supplier_ingredient_id,
                outlet_id
            FROM outlet_supplier_ingredient
            ORDER BY supplier_ingredient_id, id
        ) osi
        WHERE si.id = osi.supplier_ingredient_id
    """))

    # 3. For rows still without an outlet, assign the first available outlet
    first_outlet = conn.execute(
        sa.text("SELECT id FROM outlets ORDER BY id LIMIT 1")
    ).scalar()
    if first_outlet is not None:
        conn.execute(
            sa.text(
                "UPDATE supplier_ingredients SET outlet_id = :oid WHERE outlet_id IS NULL"
            ),
            {"oid": first_outlet},
        )
    else:
        conn.execute(
            sa.text("DELETE FROM supplier_ingredients WHERE outlet_id IS NULL")
        )

    # 4. Make column NOT NULL, add FK, index, and compound unique constraint
    op.alter_column(
        "supplier_ingredients",
        "outlet_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_supplier_ingredients_outlet_id",
        "supplier_ingredients",
        "outlets",
        ["outlet_id"],
        ["id"],
    )
    op.create_index(
        "ix_supplier_ingredients_outlet_id",
        "supplier_ingredients",
        ["outlet_id"],
    )
    op.create_unique_constraint(
        "uq_supplier_ingredient_outlet",
        "supplier_ingredients",
        ["ingredient_id", "supplier_id", "outlet_id"],
    )

    # 5. Drop outlet_supplier_ingredient table
    op.drop_index("ix_osi_outlet_id", table_name="outlet_supplier_ingredient")
    op.drop_index(
        "ix_osi_supplier_ingredient_id", table_name="outlet_supplier_ingredient"
    )
    op.drop_table("outlet_supplier_ingredient")

    # 6. Revert outlets.code to NOT NULL
    op.alter_column("outlets", "code", existing_type=sa.String(), nullable=False)
