"""add supplier info in columns

Revision ID: 3c49d472ee7f
Revises: 0536665d1982
Create Date: 2026-01-05 16:47:15.082405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '3c49d472ee7f'
down_revision: Union[str, None] = '0536665d1982'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('suppliers', sa.Column('address', sa.String(), nullable=True))
    op.add_column('suppliers', sa.Column('phone_number', sa.String(), nullable=True))
    op.add_column('suppliers', sa.Column('email', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('suppliers', 'email')
    op.drop_column('suppliers', 'phone_number')
    op.drop_column('suppliers', 'address')
