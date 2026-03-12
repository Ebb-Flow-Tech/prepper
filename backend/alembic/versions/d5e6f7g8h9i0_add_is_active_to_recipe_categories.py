"""Add is_active field to recipe_categories table

Revision ID: d5e6f7g8h9i0
Revises: c4d5e6f7g8h9
Create Date: 2026-03-12

- Add is_active boolean column to recipe_categories table with default value true
- Existing rows are backfilled to true
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7g8h9i0'
down_revision: Union[str, None] = 'c4d5e6f7g8h9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active column to recipe_categories table
    op.add_column('recipe_categories', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    # Remove is_active column from recipe_categories table
    op.drop_column('recipe_categories', 'is_active')
