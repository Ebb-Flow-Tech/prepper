"""add rnd_started to recipe

Revision ID: o4p5q6r7s8t9
Revises: n3o4p5q6r7s8
Create Date: 2026-01-21

Add rnd_started boolean flag to recipes table for R&D workflow tracking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o4p5q6r7s8t9'
down_revision: Union[str, None] = 'n3o4p5q6r7s8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'recipes',
        sa.Column('rnd_started', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('recipes', 'rnd_started')
