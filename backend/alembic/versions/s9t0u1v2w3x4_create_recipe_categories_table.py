"""Create recipe_categories table

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-01-23

- Create recipe_categories table for categorizing recipes
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 's9t0u1v2w3x4'
down_revision: Union[str, None] = 'r8s9t0u1v2w3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create recipe_categories table
    op.create_table(
        'recipe_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recipe_categories_name'), 'recipe_categories', ['name'], unique=False)


def downgrade() -> None:
    # Drop recipe_categories table
    op.drop_index(op.f('ix_recipe_categories_name'), table_name='recipe_categories')
    op.drop_table('recipe_categories')
