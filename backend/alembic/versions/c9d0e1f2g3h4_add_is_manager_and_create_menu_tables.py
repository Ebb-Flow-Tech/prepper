"""Add is_manager to users and create menu tables

Revision ID: c9d0e1f2g3h4
Revises: a7b8c9d0e1f2
Create Date: 2026-02-24

- Add is_manager column to users table with default False
- Create menus table with id, name, created_by, is_published, version_no, is_active, created_at, updated_at
- Create menu_sections table with id, name, menu_id, order_no, created_at, updated_at
- Create menu_items table with id, recipe_id, section_id, order_no, display_price, additional_info, key_highlights, created_at, updated_at
- Create menu_outlets table with id, menu_id, outlet_id, created_at
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2g3h4'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_manager to users table
    op.add_column('users', sa.Column('is_manager', sa.Boolean(), nullable=False, server_default='false'))

    # Create menus table
    op.create_table(
        'menus',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('version_no', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_menus_name'), 'menus', ['name'], unique=False)
    op.create_index(op.f('ix_menus_created_by'), 'menus', ['created_by'], unique=False)

    # Create menu_sections table
    op.create_table(
        'menu_sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('menu_id', sa.Integer(), nullable=False),
        sa.Column('order_no', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['menu_id'], ['menus.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_menu_sections_menu_id'), 'menu_sections', ['menu_id'], unique=False)

    # Create menu_items table
    op.create_table(
        'menu_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipe_id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.Integer(), nullable=False),
        sa.Column('order_no', sa.Integer(), nullable=False),
        sa.Column('display_price', sa.Float(), nullable=True),
        sa.Column('additional_info', sa.String(), nullable=True),
        sa.Column('key_highlights', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['menu_sections.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_menu_items_section_id'), 'menu_items', ['section_id'], unique=False)

    # Create menu_outlets table
    op.create_table(
        'menu_outlets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('menu_id', sa.Integer(), nullable=False),
        sa.Column('outlet_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['menu_id'], ['menus.id'], ),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_menu_outlets_menu_id'), 'menu_outlets', ['menu_id'], unique=False)
    op.create_index(op.f('ix_menu_outlets_outlet_id'), 'menu_outlets', ['outlet_id'], unique=False)


def downgrade() -> None:
    # Drop menu_outlets table
    op.drop_index(op.f('ix_menu_outlets_outlet_id'), table_name='menu_outlets')
    op.drop_index(op.f('ix_menu_outlets_menu_id'), table_name='menu_outlets')
    op.drop_table('menu_outlets')

    # Drop menu_items table
    op.drop_index(op.f('ix_menu_items_section_id'), table_name='menu_items')
    op.drop_table('menu_items')

    # Drop menu_sections table
    op.drop_index(op.f('ix_menu_sections_menu_id'), table_name='menu_sections')
    op.drop_table('menu_sections')

    # Drop menus table
    op.drop_index(op.f('ix_menus_created_by'), table_name='menus')
    op.drop_index(op.f('ix_menus_name'), table_name='menus')
    op.drop_table('menus')

    # Drop is_manager from users table
    op.drop_column('users', 'is_manager')
