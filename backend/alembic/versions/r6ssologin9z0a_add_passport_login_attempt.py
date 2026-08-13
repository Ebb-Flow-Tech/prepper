"""Add passport_login_attempt (PKCE state store for the Passport hosted-login redirect).

Revision ID: r6ssologin9z0a
Revises: q5rlswrite7x8y
Create Date: 2026-08-12

Holds the PKCE ``state -> code_verifier`` pair between ``GET /auth/passport/start`` and
``GET /auth/passport/callback``. Postgres rather than memory because Fly does not guarantee
the two requests hit the same machine.

**Prepper-owned, so the DEFAULT schema, not ``passport``** — that one is the projected read
model, and Passport has no notion of an app's PKCE attempt.

RLS block copied verbatim from geddit-one's equivalent migration. No client — authenticated
or anon — ever touches this table; only the backend's own ``service_role`` connection, which
bypasses RLS entirely. The deny-all policy is therefore NOT a functional no-op: it makes the
"no client access, ever" intent visible in the migration rather than leaving it implied by the
absence of a GRANT. ``security.md`` requires at least one explicit policy alongside the ENABLE.

Deliberately NOT using ``h1i2j3k4l5m6``'s ``current_user_id()`` / ``is_admin()`` helpers: they
are meaningless on a table written before anyone has authenticated.
"""

import sqlalchemy as sa

from alembic import op

revision = "r6ssologin9z0a"
down_revision = "q5rlswrite7x8y"
branch_labels = None
depends_on = None

TABLE = "passport_login_attempt"
POLICY = f"{TABLE}_no_client_access"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("state", sa.String(length=128), primary_key=True, nullable=False),
        sa.Column("code_verifier", sa.String(length=256), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # RLS per security.md — enabled on every new table, WITH at least one explicit policy in
    # the same migration.
    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"GRANT ALL ON {TABLE} TO service_role")
    op.execute(f"REVOKE ALL ON {TABLE} FROM authenticated")
    op.execute(f"REVOKE ALL ON {TABLE} FROM anon")
    op.execute(
        f"CREATE POLICY {POLICY} ON {TABLE} "
        "FOR ALL TO authenticated, anon USING (false)"
    )


def downgrade() -> None:
    # Drop by the EXACT policy name. A guessed name silently no-ops, and PERMISSIVE policies
    # OR — so a stale one left behind would keep granting while the table looked locked down.
    op.execute(f"DROP POLICY IF EXISTS {POLICY} ON {TABLE}")
    op.drop_table(TABLE)
