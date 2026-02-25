"""Add tasting_users join table and remove attendees from tasting_sessions.

Revision ID: bb2c3d4e5f6g
Revises: aa1b2c3d4e5f
Create Date: 2026-02-25 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bb2c3d4e5f6g"
down_revision: Union[str, None] = "aa1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tasting_users join table
    op.create_table(
        "tasting_users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "tasting_session_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["tasting_session_id"],
            ["tasting_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tasting_session_id", "user_id", name="uq_tasting_users_session_user"),
    )
    op.create_index(
        "ix_tasting_users_tasting_session_id",
        "tasting_users",
        ["tasting_session_id"],
    )
    op.create_index(
        "ix_tasting_users_user_id",
        "tasting_users",
        ["user_id"],
    )

    # Drop attendees column from tasting_sessions
    op.drop_column("tasting_sessions", "attendees")


def downgrade() -> None:
    # Add attendees column back
    op.add_column(
        "tasting_sessions",
        sa.Column("attendees", sa.JSON(), nullable=True),
    )

    # Drop indexes and constraints before dropping table
    op.drop_index("ix_tasting_users_user_id", table_name="tasting_users")
    op.drop_index(
        "ix_tasting_users_tasting_session_id", table_name="tasting_users"
    )
    op.drop_constraint(
        "uq_tasting_users_session_user",
        "tasting_users",
        type_="unique",
    )

    # Drop table
    op.drop_table("tasting_users")
