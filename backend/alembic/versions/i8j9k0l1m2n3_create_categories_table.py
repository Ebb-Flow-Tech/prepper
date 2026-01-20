"""create categories table

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-01-19

Create categories table with unique case-insensitive name constraint
and soft delete support via is_active flag.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = 'i8j9k0l1m2n3'
down_revision: Union[str, None] = 'h7i8j9k0l1m2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create categories table
    op.create_table(
        'categories',
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=False)

    # Add category_id column to ingredients table
    op.add_column('ingredients', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_ingredients_category_id'), 'ingredients', ['category_id'], unique=False)
    op.create_foreign_key(
        'fk_ingredients_category_id_categories',
        'ingredients',
        'categories',
        ['category_id'],
        ['id'],
    )


def downgrade() -> None:
    # Remove category_id from ingredients table
    op.drop_constraint('fk_ingredients_category_id_categories', 'ingredients', type_='foreignkey')
    op.drop_index(op.f('ix_ingredients_category_id'), table_name='ingredients')
    op.drop_column('ingredients', 'category_id')

    # Drop categories table
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.drop_table('categories')
