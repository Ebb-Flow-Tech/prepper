"""add summary_feedback to recipe

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
Create Date: 2026-01-20

Add summary_feedback column to recipes table for storing recipe feedback.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k0l1m2n3o4p5'
down_revision: Union[str, None] = 'j9k0l1m2n3o4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'recipes',
        sa.Column('summary_feedback', sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('recipes', 'summary_feedback')
