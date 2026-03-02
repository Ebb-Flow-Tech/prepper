"""Add creator_id and remove attendees from tasting_sessions table

Revision ID: e1f2g3h4i5j6
Revises: d0e1f2g3h4i5
Create Date: 2026-03-02

- Add optional creator_id column (FK to users.id) to tasting_sessions
- Drop legacy attendees JSON column (replaced by tasting_users join table)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e1f2g3h4i5j6"
down_revision: Union[str, None] = "d0e1f2g3h4i5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasting_sessions",
        sa.Column("creator_id", sa.String(), nullable=True),
    )
    op.create_index(
        op.f("ix_tasting_sessions_creator_id"),
        "tasting_sessions",
        ["creator_id"],
    )
    op.create_foreign_key(
        "fk_tasting_sessions_creator_id_users",
        "tasting_sessions",
        "users",
        ["creator_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Drop legacy attendees column if it still exists
    try:
        op.drop_column("tasting_sessions", "attendees")
    except Exception:
        pass  # Already removed by bb2c3d4e5f6g


def downgrade() -> None:
    # Restore attendees column
    op.add_column(
        "tasting_sessions",
        sa.Column("attendees", sa.JSON(), nullable=True),
    )

    op.drop_constraint(
        "fk_tasting_sessions_creator_id_users",
        "tasting_sessions",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_tasting_sessions_creator_id"),
        table_name="tasting_sessions",
    )
    op.drop_column("tasting_sessions", "creator_id")
