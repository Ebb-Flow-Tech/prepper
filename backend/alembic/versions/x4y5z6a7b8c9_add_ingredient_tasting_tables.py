"""add ingredient tasting tables

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-01-28

- ingredient_tastings table for many-to-many ingredient-session links
- ingredient_tasting_notes table for ingredient feedback (with aroma rating instead of presentation)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'x4y5z6a7b8c9'
down_revision: Union[str, None] = 'w3x4y5z6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Create ingredient_tastings table (many-to-many link)
    # -------------------------------------------------------------------------
    op.create_table(
        'ingredient_tastings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ingredient_id', sa.Integer(), sa.ForeignKey('ingredients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tasting_session_id', sa.Integer(), sa.ForeignKey('tasting_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_ingredient_tastings_ingredient_id', 'ingredient_tastings', ['ingredient_id'])
    op.create_index('ix_ingredient_tastings_tasting_session_id', 'ingredient_tastings', ['tasting_session_id'])

    # -------------------------------------------------------------------------
    # 2. Create ingredient_tasting_notes table (feedback)
    # -------------------------------------------------------------------------
    op.create_table(
        'ingredient_tasting_notes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('tasting_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ingredient_id', sa.Integer(), sa.ForeignKey('ingredients.id', ondelete='CASCADE'), nullable=False),
        # Ratings (1-5)
        sa.Column('taste_rating', sa.Integer(), nullable=True),
        sa.Column('aroma_rating', sa.Integer(), nullable=True),
        sa.Column('texture_rating', sa.Integer(), nullable=True),
        sa.Column('overall_rating', sa.Integer(), nullable=True),
        # Feedback
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('action_items', sa.Text(), nullable=True),
        sa.Column('action_items_done', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('decision', sa.String(20), nullable=True),
        sa.Column('taster_name', sa.String(100), nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_ingredient_tasting_notes_session_id', 'ingredient_tasting_notes', ['session_id'])
    op.create_index('ix_ingredient_tasting_notes_ingredient_id', 'ingredient_tasting_notes', ['ingredient_id'])

    # Check constraints for ratings (1-5 range)
    op.create_check_constraint(
        'ck_ingredient_tasting_notes_taste_rating',
        'ingredient_tasting_notes',
        'taste_rating >= 1 AND taste_rating <= 5'
    )
    op.create_check_constraint(
        'ck_ingredient_tasting_notes_aroma_rating',
        'ingredient_tasting_notes',
        'aroma_rating >= 1 AND aroma_rating <= 5'
    )
    op.create_check_constraint(
        'ck_ingredient_tasting_notes_texture_rating',
        'ingredient_tasting_notes',
        'texture_rating >= 1 AND texture_rating <= 5'
    )
    op.create_check_constraint(
        'ck_ingredient_tasting_notes_overall_rating',
        'ingredient_tasting_notes',
        'overall_rating >= 1 AND overall_rating <= 5'
    )

    # Check constraint for decision values
    op.create_check_constraint(
        'ck_ingredient_tasting_notes_decision',
        'ingredient_tasting_notes',
        "decision IS NULL OR decision IN ('approved', 'needs_work', 'rejected')"
    )


def downgrade() -> None:
    # Drop check constraints
    op.drop_constraint('ck_ingredient_tasting_notes_decision', 'ingredient_tasting_notes', type_='check')
    op.drop_constraint('ck_ingredient_tasting_notes_overall_rating', 'ingredient_tasting_notes', type_='check')
    op.drop_constraint('ck_ingredient_tasting_notes_texture_rating', 'ingredient_tasting_notes', type_='check')
    op.drop_constraint('ck_ingredient_tasting_notes_aroma_rating', 'ingredient_tasting_notes', type_='check')
    op.drop_constraint('ck_ingredient_tasting_notes_taste_rating', 'ingredient_tasting_notes', type_='check')

    # Drop indexes and tables
    op.drop_index('ix_ingredient_tasting_notes_ingredient_id', table_name='ingredient_tasting_notes')
    op.drop_index('ix_ingredient_tasting_notes_session_id', table_name='ingredient_tasting_notes')
    op.drop_table('ingredient_tasting_notes')

    op.drop_index('ix_ingredient_tastings_tasting_session_id', table_name='ingredient_tastings')
    op.drop_index('ix_ingredient_tastings_ingredient_id', table_name='ingredient_tastings')
    op.drop_table('ingredient_tastings')
