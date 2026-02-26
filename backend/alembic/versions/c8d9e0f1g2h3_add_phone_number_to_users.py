"""Add phone_number to users table

Revision ID: c8d9e0f1g2h3
Revises: c9d0e1f2g3h4
Create Date: 2026-02-26

- Add optional phone_number column to users table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1g2h3'
down_revision: Union[str, None] = 'c9d0e1f2g3h4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add phone_number column (nullable)
    op.add_column('users', sa.Column('phone_number', sa.String(), nullable=True))


def downgrade() -> None:
    # Drop phone_number column
    op.drop_column('users', 'phone_number')
