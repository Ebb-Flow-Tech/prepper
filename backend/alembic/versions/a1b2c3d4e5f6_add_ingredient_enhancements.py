"""add_ingredient_enhancements

Revision ID: a1b2c3d4e5f6
Revises: db480a186284
Create Date: 2024-12-17

Adds to ingredients table:
- suppliers (JSONB) - array of supplier entries with pricing
- master_ingredient_id (FK to ingredients.id) - for canonical ingredient linking
- category (VARCHAR) - food category enum
- source (VARCHAR) - "fmh" or "manual" tracking
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'db480a186284'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add suppliers JSONB column for multi-supplier pricing
    # Structure: [{"supplier_id": "...", "supplier_name": "...", "price_per_pack": ..., ...}]
    op.add_column(
        'ingredients',
        sa.Column('suppliers', sa.JSON(), nullable=True)
    )

    # Add master_ingredient_id for canonical ingredient linking (self-referential FK)
    op.add_column(
        'ingredients',
        sa.Column('master_ingredient_id', sa.Integer(), nullable=True)
    )
    op.create_index(
        op.f('ix_ingredients_master_ingredient_id'),
        'ingredients',
        ['master_ingredient_id'],
        unique=False
    )
    op.create_foreign_key(
        'fk_ingredients_master_ingredient',
        'ingredients',
        'ingredients',
        ['master_ingredient_id'],
        ['id']
    )

    # Add category for food category classification
    # Values: proteins, vegetables, fruits, dairy, grains, spices, oils_fats, sauces_condiments, beverages, other
    op.add_column(
        'ingredients',
        sa.Column('category', sa.String(50), nullable=True)
    )

    # Add source for tracking origin (fmh sync vs manual entry)
    # Default to 'manual' for existing ingredients
    op.add_column(
        'ingredients',
        sa.Column('source', sa.String(20), nullable=False, server_default='manual')
    )


def downgrade() -> None:
    # Remove source column
    op.drop_column('ingredients', 'source')

    # Remove category column
    op.drop_column('ingredients', 'category')

    # Remove master_ingredient_id FK, index, and column
    op.drop_constraint('fk_ingredients_master_ingredient', 'ingredients', type_='foreignkey')
    op.drop_index(op.f('ix_ingredients_master_ingredient_id'), table_name='ingredients')
    op.drop_column('ingredients', 'master_ingredient_id')

    # Remove suppliers column
    op.drop_column('ingredients', 'suppliers')
