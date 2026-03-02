"""Refactor supplier-ingredient relationship: create supplier_ingredients table, drop ingredients.suppliers JSONB, drop recipe_ingredients.sort_order.

Revision ID: f1g2h3i4j5k6
Revises: e1f2g3h4i5j6
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f1g2h3i4j5k6"
down_revision = "e1f2g3h4i5j6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create supplier_ingredients join table
    op.create_table(
        "supplier_ingredients",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("sku", sa.String(), nullable=True, unique=True),
        sa.Column("pack_size", sa.Float(), nullable=False),
        sa.Column("pack_unit", sa.String(), nullable=False),
        sa.Column("price_per_pack", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default="SGD"),
        sa.Column("source", sa.String(), nullable=False, server_default="manual"),
        sa.Column("is_preferred", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ingredient_id", "supplier_id", name="uq_supplier_ingredient"),
    )
    op.create_index("ix_supplier_ingredients_ingredient_id", "supplier_ingredients", ["ingredient_id"])
    op.create_index("ix_supplier_ingredients_supplier_id", "supplier_ingredients", ["supplier_id"])

    # 2. Drop suppliers JSONB column from ingredients table
    op.drop_column("ingredients", "suppliers")

    # 3. Drop sort_order column from recipe_ingredients table
    op.drop_column("recipe_ingredients", "sort_order")


def downgrade() -> None:
    # Re-add sort_order to recipe_ingredients
    op.add_column(
        "recipe_ingredients",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    # Re-add suppliers JSONB column to ingredients
    op.add_column(
        "ingredients",
        sa.Column("suppliers", sa.JSON(), nullable=True),
    )

    # Drop supplier_ingredients table
    op.drop_index("ix_supplier_ingredients_supplier_id", table_name="supplier_ingredients")
    op.drop_index("ix_supplier_ingredients_ingredient_id", table_name="supplier_ingredients")
    op.drop_table("supplier_ingredients")
