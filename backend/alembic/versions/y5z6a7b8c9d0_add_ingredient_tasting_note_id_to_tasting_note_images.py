"""add ingredient_tasting_note_id to tasting_note_images

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Create Date: 2026-01-28

- Add ingredient_tasting_note_id column to tasting_note_images table
- Make tasting_note_id nullable (either tasting_note_id or ingredient_tasting_note_id must be filled)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'y5z6a7b8c9d0'
down_revision: Union[str, None] = 'x4y5z6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ingredient_tasting_note_id column (nullable)
    op.add_column(
        'tasting_note_images',
        sa.Column(
            'ingredient_tasting_note_id',
            sa.Integer(),
            sa.ForeignKey('ingredient_tasting_notes.id', ondelete='CASCADE'),
            nullable=True
        )
    )

    # Add index for ingredient_tasting_note_id
    op.create_index(
        'ix_tasting_note_images_ingredient_tasting_note_id',
        'tasting_note_images',
        ['ingredient_tasting_note_id']
    )

    # Make tasting_note_id nullable
    op.alter_column(
        'tasting_note_images',
        'tasting_note_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False
    )


def downgrade() -> None:
    # Revert tasting_note_id back to NOT NULL
    op.alter_column(
        'tasting_note_images',
        'tasting_note_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True
    )

    # Drop index
    op.drop_index(
        'ix_tasting_note_images_ingredient_tasting_note_id',
        table_name='tasting_note_images'
    )

    # Drop column
    op.drop_column('tasting_note_images', 'ingredient_tasting_note_id')
