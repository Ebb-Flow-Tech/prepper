"""add recipe_tastings table

Revision ID: f5g6h7i8j9k0
Revises: e4f5a6b7c8d9
Create Date: 2026-01-08

Many-to-many relationship between recipes and tasting sessions.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5g6h7i8j9k0'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'recipe_tastings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('recipe_id', sa.Integer(), sa.ForeignKey('recipes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tasting_session_id', sa.Integer(), sa.ForeignKey('tasting_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_recipe_tastings_recipe_id', 'recipe_tastings', ['recipe_id'])
    op.create_index('ix_recipe_tastings_tasting_session_id', 'recipe_tastings', ['tasting_session_id'])


def downgrade() -> None:
    op.drop_index('ix_recipe_tastings_tasting_session_id', table_name='recipe_tastings')
    op.drop_index('ix_recipe_tastings_recipe_id', table_name='recipe_tastings')
    op.drop_table('recipe_tastings')
