"""`POST /auth/resolve-login` — the unauthenticated front door.

The routing decision itself is covered by `test_passport_login_routing.py`. This module owns the
things only the ROUTE can get wrong: that the body carries the decision and nothing else, that a
malformed address is not answered differently from a well-formed one, and that both buckets bite.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.rate_limit import (
    LOGIN_ROUTE_EMAIL_PER_MINUTE,
    LOGIN_ROUTE_IP_PER_MINUTE,
    _reset_for_tests,
)
from app.models import PassportMembership
from tests.conftest import sso_settings

ROUTE = "/api/v1/auth/resolve-login"
MEMBER = "chef@brand.test"


@pytest.fixture(autouse=True)
def _clean_counters():
    _reset_for_tests()
    yield
    _reset_for_tests()


@pytest.fixture(name="sso_on")
def sso_on_fixture():
    with patch("app.api.auth_passport.get_settings", return_value=sso_settings()):
        yield


def _member(session: Session, email: str) -> None:
    session.add(
        PassportMembership(
            id=f"m-{email}",
            organization_id="org-1",
            platform_user_id=f"pu-{email}",
            role="Member",
            status="active",
            version=1,
            email=email,
        )
    )
    session.commit()


class TestRouting:
    def test_active_member_routes_to_passport(
        self, client: TestClient, session: Session, sso_on
    ) -> None:
        _member(session, MEMBER)
        response = client.post(ROUTE, json={"email": MEMBER})
        assert response.status_code == 200
        assert response.json() == {"route": "passport"}

    def test_non_member_and_unknown_address_are_byte_identical(
        self, client: TestClient, session: Session, sso_on
    ) -> None:
        """The enumeration property, asserted on the wire rather than on the helper.

        A field added "just for the client" — `exists`, `reason`, a message — reopens the oracle
        the two-valued router exists to close, and would still pass every routing unit test.
        """
        _member(session, MEMBER)
        non_member = client.post(ROUTE, json={"email": "outsider@x.test"})
        never_existed = client.post(ROUTE, json={"email": "nobody@nowhere.test"})

        assert non_member.status_code == never_existed.status_code == 200
        assert non_member.content == never_existed.content
        assert non_member.json() == {"route": "app-native"}

    def test_the_body_carries_the_route_and_nothing_else(
        self, client: TestClient, session: Session, sso_on
    ) -> None:
        _member(session, MEMBER)
        assert set(client.post(ROUTE, json={"email": MEMBER}).json()) == {"route"}

    def test_kill_switch_routes_a_member_app_native(
        self, client: TestClient, session: Session
    ) -> None:
        """D11 through the route: with SSO off nobody is sent to a Passport handoff that the
        operator has just switched off."""
        _member(session, MEMBER)
        with patch("app.api.auth_passport.get_settings", return_value=sso_settings(sso_enabled=False)):
            assert client.post(ROUTE, json={"email": MEMBER}).json() == {"route": "app-native"}


class TestInputHandling:
    def test_a_malformed_address_still_routes(
        self, client: TestClient, session: Session, sso_on
    ) -> None:
        """Deliberately NOT `EmailStr`. A 422 for "not an email" is a THIRD answer, and it
        partitions the input space the two-valued body refuses to."""
        response = client.post(ROUTE, json={"email": "not-an-email"})
        assert response.status_code == 200
        assert response.json() == {"route": "app-native"}

    def test_an_over_long_address_is_refused(
        self, client: TestClient, session: Session, sso_on
    ) -> None:
        """RFC 5321 caps a path at 320 octets. The cap bounds the in-memory rate-limiter key,
        not just the field — an unbounded string is an unbounded dict key."""
        response = client.post(ROUTE, json={"email": "a" * 400 + "@brand.test"})
        assert response.status_code == 422

    def test_case_and_whitespace_do_not_open_a_second_bucket(
        self, client: TestClient, session: Session, sso_on
    ) -> None:
        """Otherwise `Chef@…`, ` chef@…` and `CHEF@…` are three separate email allowances for
        one address, and the email bucket is decorative."""
        for n in range(LOGIN_ROUTE_EMAIL_PER_MINUTE):
            variant = f"{'  ' if n % 2 else ''}{MEMBER.upper() if n % 3 else MEMBER}"
            assert client.post(ROUTE, json={"email": variant}).status_code == 200
        assert client.post(ROUTE, json={"email": MEMBER}).status_code == 429


class TestRateLimits:
    def test_the_ip_bucket_429s(self, client: TestClient, session: Session, sso_on) -> None:
        codes = [
            client.post(ROUTE, json={"email": f"user{n}@brand.test"}).status_code
            for n in range(LOGIN_ROUTE_IP_PER_MINUTE)
        ]
        assert codes == [200] * LOGIN_ROUTE_IP_PER_MINUTE
        assert client.post(ROUTE, json={"email": "one-more@brand.test"}).status_code == 429

    def test_the_email_bucket_429s(self, client: TestClient, session: Session, sso_on) -> None:
        codes = [
            client.post(ROUTE, json={"email": MEMBER}).status_code
            for n in range(LOGIN_ROUTE_EMAIL_PER_MINUTE)
        ]
        assert codes == [200] * LOGIN_ROUTE_EMAIL_PER_MINUTE
        assert client.post(ROUTE, json={"email": MEMBER}).status_code == 429


def test_the_route_needs_no_token(session: Session) -> None:
    """It runs BEFORE anyone has a session, so it must be on the default-deny allowlist."""
    from app.api.deps import public_routes
    from app.config import get_settings

    assert ("POST", ROUTE) in public_routes(get_settings())
