"""add_recipe_extensions

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2024-12-17

Plan 02: Recipe Extensions
- recipe_recipes table for sub-recipe linking (BOM hierarchy)
- outlets table for brand/location management
- recipe_outlets table for recipe-outlet many-to-many
- authorship fields on recipes (created_by, updated_by)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Sub-Recipes: recipe_recipes table
    # -------------------------------------------------------------------------
    op.create_table(
        'recipe_recipes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('parent_recipe_id', sa.Integer(), sa.ForeignKey('recipes.id'), nullable=False),
        sa.Column('child_recipe_id', sa.Integer(), sa.ForeignKey('recipes.id'), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('unit', sa.String(20), nullable=False, server_default='portion'),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_recipe_recipes_parent_recipe_id', 'recipe_recipes', ['parent_recipe_id'])
    op.create_index('ix_recipe_recipes_child_recipe_id', 'recipe_recipes', ['child_recipe_id'])

    # Constraint: prevent self-referential links (A cannot include A)
    op.create_check_constraint(
        'ck_recipe_recipes_no_self_reference',
        'recipe_recipes',
        'parent_recipe_id != child_recipe_id'
    )

    # -------------------------------------------------------------------------
    # 2. Outlets: outlets table
    # -------------------------------------------------------------------------
    op.create_table(
        'outlets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('outlet_type', sa.String(20), nullable=False, server_default='brand'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('parent_outlet_id', sa.Integer(), sa.ForeignKey('outlets.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_outlets_name', 'outlets', ['name'])
    op.create_index('ix_outlets_code', 'outlets', ['code'], unique=True)
    op.create_index('ix_outlets_parent_outlet_id', 'outlets', ['parent_outlet_id'])

    # -------------------------------------------------------------------------
    # 3. Recipe-Outlets: recipe_outlets junction table
    # -------------------------------------------------------------------------
    op.create_table(
        'recipe_outlets',
        sa.Column('recipe_id', sa.Integer(), sa.ForeignKey('recipes.id'), primary_key=True),
        sa.Column('outlet_id', sa.Integer(), sa.ForeignKey('outlets.id'), primary_key=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('price_override', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # -------------------------------------------------------------------------
    # 4. Authorship fields on recipes table
    # -------------------------------------------------------------------------
    op.add_column(
        'recipes',
        sa.Column('created_by', sa.String(100), nullable=True)
    )
    op.add_column(
        'recipes',
        sa.Column('updated_by', sa.String(100), nullable=True)
    )


def downgrade() -> None:
    # Remove authorship fields from recipes
    op.drop_column('recipes', 'updated_by')
    op.drop_column('recipes', 'created_by')

    # Drop recipe_outlets table
    op.drop_table('recipe_outlets')

    # Drop outlets table (indexes dropped automatically)
    op.drop_index('ix_outlets_parent_outlet_id', table_name='outlets')
    op.drop_index('ix_outlets_code', table_name='outlets')
    op.drop_index('ix_outlets_name', table_name='outlets')
    op.drop_table('outlets')

    # Drop recipe_recipes table
    op.drop_constraint('ck_recipe_recipes_no_self_reference', 'recipe_recipes', type_='check')
    op.drop_index('ix_recipe_recipes_child_recipe_id', table_name='recipe_recipes')
    op.drop_index('ix_recipe_recipes_parent_recipe_id', table_name='recipe_recipes')
    op.drop_table('recipe_recipes')
