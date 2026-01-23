"""Create recipe_recipe_categories table

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-01-23

- Create recipe_recipe_categories table for many-to-many relationship between recipes and recipe categories
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 't0u1v2w3x4y5'
down_revision: Union[str, None] = 's9t0u1v2w3x4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create recipe_recipe_categories table
    op.create_table(
        'recipe_recipe_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipe_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['recipe_categories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recipe_recipe_categories_recipe_id'), 'recipe_recipe_categories', ['recipe_id'], unique=False)
    op.create_index(op.f('ix_recipe_recipe_categories_category_id'), 'recipe_recipe_categories', ['category_id'], unique=False)


def downgrade() -> None:
    # Drop recipe_recipe_categories table
    op.drop_index(op.f('ix_recipe_recipe_categories_category_id'), table_name='recipe_recipe_categories')
    op.drop_index(op.f('ix_recipe_recipe_categories_recipe_id'), table_name='recipe_recipe_categories')
    op.drop_table('recipe_recipe_categories')
