"""add review_ready to recipe

Revision ID: p5q6r7s8t9u0
Revises: o4p5q6r7s8t9
Create Date: 2026-01-21

Add review_ready boolean flag to recipes table for R&D page review workflow.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p5q6r7s8t9u0'
down_revision: Union[str, None] = 'o4p5q6r7s8t9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'recipes',
        sa.Column('review_ready', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('recipes', 'review_ready')
