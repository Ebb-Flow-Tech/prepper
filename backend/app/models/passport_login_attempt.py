"""PKCE verifier storage for the Passport hosted-login redirect (Model 3).

Exists between ``GET /auth/passport/start`` (writes a row) and ``GET /auth/passport/callback``
(pops it by ``state``). A Postgres table, not Redis or in-memory: this backend has no Redis,
and Fly does not guarantee the start and callback requests land on the same machine —
``fly.toml`` sets ``min_machines_running = 0`` with auto-start, so scale-out beyond one
machine is routine rather than exceptional. An in-memory store would break silently and
intermittently, which is the worst version of this bug.

**Prepper-owned, so the DEFAULT schema — not ``passport``.** That schema holds the projected
read model, and rule 7 does not reach here: Passport has no notion of an app's PKCE attempt,
so this is not a fact Passport owns.

TTL is enforced at READ time (a row older than 5 minutes is refused), not by an expiry job.
The row is deleted on every pop, and ``/passport/start`` is rate-limited, so stale rows are
bounded single-row noise rather than a correctness or growth concern.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class PassportLoginAttempt(SQLModel, table=True):
    __tablename__ = "passport_login_attempt"

    state: str = Field(primary_key=True, max_length=128)
    code_verifier: str = Field(max_length=256)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC).replace(tzinfo=None),
    )
