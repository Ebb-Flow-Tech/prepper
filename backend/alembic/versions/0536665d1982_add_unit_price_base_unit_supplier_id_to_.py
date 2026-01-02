"""add unit_price base_unit supplier_id to recipe_ingredients

Revision ID: 0536665d1982
Revises: 623d70ca5a4d
Create Date: 2026-01-02 16:27:57.509249

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '0536665d1982'
down_revision: Union[str, None] = '623d70ca5a4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recipe_ingredients', sa.Column('unit_price', sa.Float(), nullable=True))
    op.add_column('recipe_ingredients', sa.Column('base_unit', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('recipe_ingredients', sa.Column('supplier_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('recipe_ingredients', 'supplier_id')
    op.drop_column('recipe_ingredients', 'base_unit')
    op.drop_column('recipe_ingredients', 'unit_price')
