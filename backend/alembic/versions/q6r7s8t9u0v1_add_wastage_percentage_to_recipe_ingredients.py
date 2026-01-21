"""add wastage_percentage to recipe_ingredients

Revision ID: q6r7s8t9u0v1
Revises: p5q6r7s8t9u0
Create Date: 2026-01-21

Add wastage_percentage field to recipe_ingredients table to track ingredient wastage.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'q6r7s8t9u0v1'
down_revision: Union[str, None] = 'p5q6r7s8t9u0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'recipe_ingredients',
        sa.Column('wastage_percentage', sa.Float(), nullable=False, server_default='0')
    )


def downgrade() -> None:
    op.drop_column('recipe_ingredients', 'wastage_percentage')
