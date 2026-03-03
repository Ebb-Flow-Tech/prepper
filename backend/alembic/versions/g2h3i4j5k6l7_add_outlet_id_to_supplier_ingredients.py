"""Add outlet_id to supplier_ingredients table for per-outlet supplier scoping.

Revision ID: g2h3i4j5k6l7
Revises: f1g2h3i4j5k6
Create Date: 2026-03-03
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "g2h3i4j5k6l7"
down_revision = "f1g2h3i4j5k6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add outlet_id as nullable first (existing rows have no value)
    op.add_column(
        "supplier_ingredients",
        sa.Column("outlet_id", sa.Integer(), nullable=True),
    )

    # 2. Backfill: assign the first available outlet to existing rows
    conn = op.get_bind()
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
        # No outlets exist — remove orphaned rows that can't satisfy the FK
        conn.execute(sa.text("DELETE FROM supplier_ingredients WHERE outlet_id IS NULL"))

    # 3. Make column NOT NULL (after backfill)
    op.alter_column(
        "supplier_ingredients",
        "outlet_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 4. Add FK constraint and index
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

    # 5. Drop old unique constraint if it exists, then add new one including outlet_id
    #    The constraint may not exist (e.g. Supabase-managed Postgres may not have created it)
    conn = op.get_bind()
    result = conn.execute(sa.text("""
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_supplier_ingredient'
        AND conrelid = 'supplier_ingredients'::regclass
    """)).scalar()

    if result:
        op.drop_constraint("uq_supplier_ingredient", "supplier_ingredients", type_="unique")

    op.create_unique_constraint(
        "uq_supplier_ingredient_outlet",
        "supplier_ingredients",
        ["ingredient_id", "supplier_id", "outlet_id"],
    )


def downgrade() -> None:
    # Reverse: drop new constraint, add old one, drop FK/index/column
    op.drop_constraint(
        "uq_supplier_ingredient_outlet", "supplier_ingredients", type_="unique"
    )
    op.create_unique_constraint(
        "uq_supplier_ingredient",
        "supplier_ingredients",
        ["ingredient_id", "supplier_id"],
    )
    op.drop_index("ix_supplier_ingredients_outlet_id", table_name="supplier_ingredients")
    op.drop_constraint(
        "fk_supplier_ingredients_outlet_id",
        "supplier_ingredients",
        type_="foreignkey",
    )
    op.drop_column("supplier_ingredients", "outlet_id")
