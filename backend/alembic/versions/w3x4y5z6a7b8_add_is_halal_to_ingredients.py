"""Add is_halal field to ingredients table

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-01-28

- Add is_halal boolean column to ingredients table with default value false
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'w3x4y5z6a7b8'
down_revision: Union[str, None] = 'v2w3x4y5z6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_halal column to ingredients table
    op.add_column('ingredients', sa.Column('is_halal', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove is_halal column from ingredients table
    op.drop_column('ingredients', 'is_halal')
