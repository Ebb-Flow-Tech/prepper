"""PKCE for the Passport hosted-login redirect (Model 3, OAuth 2.1 + RFC 7636).

The ``code_verifier`` must NEVER reach the browser — not in a JS-readable cookie, not in
``localStorage``, not in a query param. It lives server-side against the ``state``, and that
is the entire point of PKCE: Passport does not have it and must not, which is why no
Passport-side link can mint a code directly.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlmodel import Session, col

from app.models import PassportLoginAttempt

# RFC 7636 allows 43..128 characters. token_urlsafe(64) yields ~86.
_VERIFIER_BYTES = 64
_STATE_BYTES = 32

# A sign-in round trip is a browser redirect and a login form — minutes, not hours. Short
# enough that an abandoned attempt cannot be resumed later from a leaked URL.
_TTL = timedelta(minutes=5)

# The same lifetime, for the login-CSRF state cookie's `Max-Age` (`api/auth_passport.py`). Derived
# rather than restated so the two halves of one attempt cannot expire at different times: a cookie
# outliving its row is a value the browser keeps sending for an attempt that can no longer succeed.
ATTEMPT_TTL_SECONDS = int(_TTL.total_seconds())


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def generate_pkce_pair() -> tuple[str, str, str]:
    """A fresh ``(verifier, challenge, state)`` for ONE sign-in attempt.

    Fresh per attempt, never reused: a fixed verifier is a shared secret in the source. The
    challenge is base64url of the verifier's SHA-256 with padding stripped — the stripping is
    mandatory, not cosmetic, and a padded value is rejected downstream.
    """
    verifier = secrets.token_urlsafe(_VERIFIER_BYTES)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .decode()
        .rstrip("=")
    )
    state = secrets.token_urlsafe(_STATE_BYTES)
    return verifier, challenge, state


def store_verifier(session: Session, *, state: str, verifier: str) -> None:
    """Persist the verifier against the state, server-side."""
    session.add(PassportLoginAttempt(state=state, code_verifier=verifier))
    session.commit()


def pop_verifier(session: Session, *, state: str) -> str | None:
    """Redeem a state exactly once. ``None`` when unknown, already used, or expired.

    **The DELETE is the atomic single-use check.** A SELECT-then-DELETE would let two
    concurrent callbacks for the same state both see the row present — losing replay
    protection in precisely the raced case it exists for, while still passing a sequential
    test. The TTL is applied to the returned row rather than in the WHERE clause, so an
    expired row is deleted as well as refused instead of accumulating.
    """
    row = session.execute(
        delete(PassportLoginAttempt)
        .where(col(PassportLoginAttempt.state) == state)
        .returning(
            col(PassportLoginAttempt.code_verifier),
            col(PassportLoginAttempt.created_at),
        )
    ).first()
    session.commit()

    if row is None:
        return None

    verifier, created_at = row
    if created_at < _now() - _TTL:
        return None
    return str(verifier)
