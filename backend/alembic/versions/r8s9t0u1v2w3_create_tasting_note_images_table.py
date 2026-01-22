"""Create tasting_note_images table

Revision ID: r8s9t0u1v2w3
Revises: q6r7s8t9u0v1
Create Date: 2026-01-22

- Create tasting_note_images table to support multiple images per tasting note
- Store image URLs from Supabase Storage
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r8s9t0u1v2w3'
down_revision: Union[str, None] = 'q6r7s8t9u0v1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tasting_note_images table
    op.create_table(
        'tasting_note_images',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tasting_note_id', sa.Integer(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tasting_note_id'], ['tasting_notes.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tasting_note_images_tasting_note_id'), 'tasting_note_images', ['tasting_note_id'], unique=False)


def downgrade() -> None:
    # Drop tasting_note_images table
    op.drop_index(op.f('ix_tasting_note_images_tasting_note_id'), table_name='tasting_note_images')
    op.drop_table('tasting_note_images')
