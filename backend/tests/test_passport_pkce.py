"""PKCE pair generation and the single-use verifier store.

The security property under test is that a `state` can be redeemed exactly ONCE. That is why
`pop_verifier` is a single atomic DELETE rather than a SELECT followed by a DELETE: with the
two-step form, two concurrent callbacks for one state can both observe the row present, and
the replay protection is gone in exactly the case it exists for.
"""

import base64
import hashlib
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.models import PassportLoginAttempt
from app.passport import pkce


class TestGeneratePkcePair:
    def test_challenge_is_unpadded_base64url_sha256_of_verifier(self) -> None:
        verifier, challenge, _state = pkce.generate_pkce_pair()
        expected = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        assert challenge == expected
        assert "=" not in challenge, "padding must be stripped — RFC 7636 requires base64url"

    def test_verifier_length_within_rfc7636_bounds(self) -> None:
        verifier, _c, _s = pkce.generate_pkce_pair()
        assert 43 <= len(verifier) <= 128

    def test_each_attempt_gets_a_fresh_pair(self) -> None:
        """A fixed verifier is a shared secret sitting in the source."""
        first = pkce.generate_pkce_pair()
        second = pkce.generate_pkce_pair()
        assert first[0] != second[0]
        assert first[2] != second[2]


class TestPopVerifier:
    def test_round_trip(self, session: Session) -> None:
        pkce.store_verifier(session, state="st-1", verifier="ver-1")
        assert pkce.pop_verifier(session, state="st-1") == "ver-1"

    def test_is_single_use(self, session: Session) -> None:
        pkce.store_verifier(session, state="st-1", verifier="ver-1")
        assert pkce.pop_verifier(session, state="st-1") == "ver-1"
        assert pkce.pop_verifier(session, state="st-1") is None

    def test_unknown_state(self, session: Session) -> None:
        assert pkce.pop_verifier(session, state="never-issued") is None

    def test_expired_row_is_refused_and_removed(self, session: Session) -> None:
        """TTL is enforced at read time. An expired row must be BOTH refused and gone —
        refusing while leaving it behind would let it accumulate."""
        stale = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=10)
        session.add(
            PassportLoginAttempt(state="st-old", code_verifier="ver-old", created_at=stale)
        )
        session.commit()

        assert pkce.pop_verifier(session, state="st-old") is None
        remaining = session.exec(
            select(PassportLoginAttempt).where(PassportLoginAttempt.state == "st-old")
        ).first()
        assert remaining is None

    def test_popping_one_state_leaves_others(self, session: Session) -> None:
        pkce.store_verifier(session, state="st-a", verifier="ver-a")
        pkce.store_verifier(session, state="st-b", verifier="ver-b")
        assert pkce.pop_verifier(session, state="st-a") == "ver-a"
        assert pkce.pop_verifier(session, state="st-b") == "ver-b"
