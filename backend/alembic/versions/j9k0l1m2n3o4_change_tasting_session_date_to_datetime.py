"""change tasting_session date column to datetime

Revision ID: j9k0l1m2n3o4
Revises: i8j9k0l1m2n3
Create Date: 2026-01-19

Change tasting_sessions.date column from DATE to DATETIME to support
time selection when creating tasting sessions.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j9k0l1m2n3o4'
down_revision: Union[str, None] = 'i8j9k0l1m2n3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change the date column from DATE to DATETIME
    # Existing DATE values will be converted to DATETIME with time 00:00:00
    op.alter_column(
        'tasting_sessions',
        'date',
        existing_type=sa.Date(),
        type_=sa.DateTime(),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Revert the date column from DATETIME back to DATE
    # Note: This will lose time information
    op.alter_column(
        'tasting_sessions',
        'date',
        existing_type=sa.DateTime(),
        type_=sa.Date(),
        existing_nullable=False,
    )
