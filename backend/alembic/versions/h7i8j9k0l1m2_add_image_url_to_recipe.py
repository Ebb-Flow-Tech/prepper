"""add image_url to recipe

Revision ID: h7i8j9k0l1m2
Revises: g6h7i8j9k0l1
Create Date: 2026-01-13

Add image_url column to recipes table for storing recipe images.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h7i8j9k0l1m2'
down_revision: Union[str, None] = 'g6h7i8j9k0l1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'recipes',
        sa.Column('image_url', sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('recipes', 'image_url')
