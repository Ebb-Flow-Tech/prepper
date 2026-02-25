"""Add user_id to tasting_notes and ingredient_tasting_notes.

Revision ID: aa1b2c3d4e5f
Revises: z6a7b8c9d0e1
Create Date: 2026-02-25 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "aa1b2c3d4e5f"
down_revision: Union[str, None] = "z6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add user_id column to tasting_notes and ingredient_tasting_notes tables."""
    op.add_column(
        "tasting_notes",
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasting_notes_user_id", "tasting_notes", ["user_id"])

    op.add_column(
        "ingredient_tasting_notes",
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_ingredient_tasting_notes_user_id", "ingredient_tasting_notes", ["user_id"]
    )


def downgrade() -> None:
    """Remove user_id column from tasting_notes and ingredient_tasting_notes tables."""
    op.drop_index("ix_ingredient_tasting_notes_user_id", table_name="ingredient_tasting_notes")
    op.drop_column("ingredient_tasting_notes", "user_id")
    op.drop_index("ix_tasting_notes_user_id", table_name="tasting_notes")
    op.drop_column("tasting_notes", "user_id")
