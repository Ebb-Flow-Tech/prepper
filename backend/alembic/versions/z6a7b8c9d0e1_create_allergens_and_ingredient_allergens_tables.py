"""Create allergens and ingredient_allergens tables

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Create Date: 2026-02-20

- Create allergens table with id, name, description, is_active, created_at, updated_at
- Create ingredient_allergens table with id, ingredient_id, allergen_id, created_at
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'z6a7b8c9d0e1'
down_revision: Union[str, None] = 'y5z6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create allergens table
    op.create_table(
        'allergens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_allergens_name'), 'allergens', ['name'], unique=False)

    # Create ingredient_allergens table
    op.create_table(
        'ingredient_allergens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ingredient_id', sa.Integer(), nullable=False),
        sa.Column('allergen_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['ingredient_id'], ['ingredients.id'], ),
        sa.ForeignKeyConstraint(['allergen_id'], ['allergens.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ingredient_allergens_allergen_id'), 'ingredient_allergens', ['allergen_id'], unique=False)
    op.create_index(op.f('ix_ingredient_allergens_ingredient_id'), 'ingredient_allergens', ['ingredient_id'], unique=False)


def downgrade() -> None:
    # Drop ingredient_allergens table
    op.drop_index(op.f('ix_ingredient_allergens_ingredient_id'), table_name='ingredient_allergens')
    op.drop_index(op.f('ix_ingredient_allergens_allergen_id'), table_name='ingredient_allergens')
    op.drop_table('ingredient_allergens')

    # Drop allergens table
    op.drop_index(op.f('ix_allergens_name'), table_name='allergens')
    op.drop_table('allergens')
