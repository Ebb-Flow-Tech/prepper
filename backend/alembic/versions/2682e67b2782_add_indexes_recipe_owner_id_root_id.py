"""add_indexes_recipe_owner_id_root_id

Revision ID: 2682e67b2782
Revises: g2h3i4j5k6l7
Create Date: 2026-03-04 11:39:54.253156

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2682e67b2782'
down_revision: Union[str, None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_recipes_owner_id'), 'recipes', ['owner_id'], unique=False)
    op.create_index(op.f('ix_recipes_root_id'), 'recipes', ['root_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_recipes_root_id'), table_name='recipes')
    op.drop_index(op.f('ix_recipes_owner_id'), table_name='recipes')
