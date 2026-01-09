"""add version and root_id to recipe

Revision ID: e4f5a6b7c8d9
Revises: d93a4bf0f766
Create Date: 2026-01-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd93a4bf0f766'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recipes', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('recipes', sa.Column('root_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_recipes_root_id',
        'recipes',
        'recipes',
        ['root_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_recipes_root_id', 'recipes', type_='foreignkey')
    op.drop_column('recipes', 'root_id')
    op.drop_column('recipes', 'version')
