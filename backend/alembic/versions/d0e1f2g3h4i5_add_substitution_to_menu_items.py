"""Add substitution field to menu_items table

Revision ID: d0e1f2g3h4i5
Revises: aa1b2c3d4e5f
Create Date: 2026-02-26

- Add optional substitution column to menu_items table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0e1f2g3h4i5'
down_revision: Union[str, None] = 'c8d9e0f1g2h3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add substitution column to menu_items table
    op.add_column('menu_items', sa.Column('substitution', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove substitution column from menu_items table
    op.drop_column('menu_items', 'substitution')
