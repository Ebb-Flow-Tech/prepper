"""Create recipe_images table and remove image_url from recipe

Revision ID: n3o4p5q6r7s8
Revises: k0l1m2n3o4p5
Create Date: 2026-01-21

- Create recipe_images table to support multiple images per recipe with ordering
- Remove image_url column from recipes table (images now managed via recipe_images)
- Add description column to recipes table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n3o4p5q6r7s8'
down_revision: Union[str, None] = 'k0l1m2n3o4p5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create recipe_images table
    op.create_table(
        'recipe_images',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipe_id', sa.Integer(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('is_main', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recipe_images_recipe_id'), 'recipe_images', ['recipe_id'], unique=False)

    # Remove image_url from recipes table
    op.drop_column('recipes', 'image_url')

    # Add description to recipes table
    op.add_column(
        'recipes',
        sa.Column('description', sa.String(), nullable=True)
    )


def downgrade() -> None:
    # Remove description from recipes
    op.drop_column('recipes', 'description')

    # Add image_url back to recipes
    op.add_column(
        'recipes',
        sa.Column('image_url', sa.String(), nullable=True)
    )

    # Drop recipe_images table
    op.drop_index(op.f('ix_recipe_images_recipe_id'), table_name='recipe_images')
    op.drop_table('recipe_images')
