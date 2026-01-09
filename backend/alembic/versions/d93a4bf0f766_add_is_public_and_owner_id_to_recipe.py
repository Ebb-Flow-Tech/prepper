"""add is_public and owner_id to recipe

Revision ID: d93a4bf0f766
Revises: 3c49d472ee7f
Create Date: 2026-01-06 17:19:23.069541

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd93a4bf0f766'
down_revision: Union[str, None] = '3c49d472ee7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recipes', sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('recipes', sa.Column('owner_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('recipes', 'owner_id')
    op.drop_column('recipes', 'is_public')
