"""add fmh fields to suppliers

Revision ID: b3c4d5e6f7g8
Revises: 2682e67b2782
Create Date: 2026-03-11

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7g8"
down_revision: str | None = "2682e67b2782"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("suppliers", sa.Column("shipping_company_name", sa.String(), nullable=True))
    op.add_column("suppliers", sa.Column("code", sa.String(), nullable=True))

    # Remove character limits on name columns so FMH product/supplier names of any length are accepted
    op.alter_column("ingredients", "name", type_=sa.Text(), existing_nullable=False)
    op.alter_column("suppliers", "name", type_=sa.Text(), existing_nullable=False)
    op.alter_column("outlets", "name", type_=sa.Text(), existing_nullable=False)


def downgrade() -> None:
    op.alter_column("outlets", "name", type_=sa.String(length=100), existing_nullable=False)
    op.alter_column("suppliers", "name", type_=sa.String(), existing_nullable=False)
    op.alter_column("ingredients", "name", type_=sa.String(), existing_nullable=False)

    op.drop_column("suppliers", "code")
    op.drop_column("suppliers", "shipping_company_name")
