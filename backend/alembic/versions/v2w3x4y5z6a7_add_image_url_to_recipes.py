"""Add image_url to recipes table

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-01-27

- Add image_url column to recipes table to store the URL of the selected image
- This denormalizes the main image URL for performance optimization
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'v2w3x4y5z6a7'
down_revision: Union[str, None] = 'u1v2w3x4y5z6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add image_url column to recipes table
    op.add_column('recipes', sa.Column('image_url', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove image_url column from recipes table
    op.drop_column('recipes', 'image_url')
