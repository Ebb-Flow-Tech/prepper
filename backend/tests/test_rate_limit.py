"""The AI routes must refuse to spend without bound.

Both agent routes call Anthropic on every request. They are authenticated, so this was never a
leak — but any signed-in user could hold the button down and bill the org for it.

The login buckets below bound something else entirely: enumeration throughput on the
UNAUTHENTICATED front door. Same sliding window, different thing at risk.
"""

import time

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.rate_limit import (
    AI_CALLS_PER_WINDOW,
    LOGIN_ROUTE_EMAIL_PER_MINUTE,
    LOGIN_ROUTE_IP_PER_MINUTE,
    LOGIN_WINDOW_SECONDS,
    PASSPORT_START_IP_PER_MINUTE,
    _hits,
    _reset_for_tests,
    client_ip,
    login_route_limited,
    passport_start_limited,
)
from tests.conftest import ADMIN_USER_ID, create_user, use_user


@pytest.fixture(autouse=True)
def _clean_counters():
    """Counters live in module state for the life of the process, so tests would leak into
    each other — one test's calls would rate-limit the next."""
    _reset_for_tests()
    yield
    _reset_for_tests()


def _stub_agent(monkeypatch) -> None:
    """Replace the agent entirely — both halves of it.

    `BaseAgent.__init__` raises without ANTHROPIC_API_KEY, and the route wraps every exception in a
    500. So stubbing only `categorize_ingredient` left the constructor to fail, the route to return
    500, and the rate-limit gate never to be reached: the test would have "passed" a 429 assertion
    only by accident, and failed the 200 one for a reason that had nothing to do with limiting.
    """

    def _init(self, session, organization_id):  # noqa: ANN001
        self.session = session
        self.organization_id = organization_id

    async def _categorize(self, ingredient_name: str):  # noqa: ANN001
        # Must satisfy CategorizeIngredientResponse — a short return 500s on validation, which
        # looks exactly like the agent failing and tells you nothing about the limiter.
        return {
            "category_id": 1,
            "category_name": "Test",
            "explanation": "stub",
            "success": True,
        }

    monkeypatch.setattr("app.agents.category_agent.CategoryAgent.__init__", _init)
    monkeypatch.setattr(
        "app.agents.category_agent.CategoryAgent.categorize_ingredient", _categorize
    )


def test_the_ai_route_429s_once_the_allowance_is_gone(
    client: TestClient, session: Session, monkeypatch
):
    """The agent itself is stubbed: this is about the gate, not about Anthropic."""
    use_user(client, create_user(session, ADMIN_USER_ID, "admin"))

    _stub_agent(monkeypatch)
    body = {"ingredient_name": "Tomato"}
    ok = [
        client.post("/api/v1/agents/categorize-ingredient", json=body).status_code
        for _ in range(AI_CALLS_PER_WINDOW)
    ]
    assert all(code == 200 for code in ok), f"the allowance must be usable: {ok}"

    blocked = client.post("/api/v1/agents/categorize-ingredient", json=body)
    assert blocked.status_code == 429, "the call past the allowance must be refused"
    assert blocked.headers.get("Retry-After"), "a 429 must say when to come back"


def test_the_limit_is_per_user_not_global(client: TestClient, session: Session, monkeypatch):
    """One user exhausting their allowance must not lock out their colleagues.

    Keyed on the user id for exactly this reason — an IP would put a whole kitchen behind one NAT
    on a single budget.
    """

    _stub_agent(monkeypatch)
    body = {"ingredient_name": "Tomato"}

    use_user(client, create_user(session, "heavy-user", "heavy"))
    for _ in range(AI_CALLS_PER_WINDOW):
        client.post("/api/v1/agents/categorize-ingredient", json=body)
    assert client.post("/api/v1/agents/categorize-ingredient", json=body).status_code == 429

    use_user(client, create_user(session, "other-user", "other"))
    assert (
        client.post("/api/v1/agents/categorize-ingredient", json=body).status_code == 200
    ), "a second user must have their own allowance"


# =============================================================================
# The login front door — two buckets on /auth/resolve-login, one on /passport/start
# =============================================================================


class TestLoginRouteBuckets:
    def test_the_ip_bucket_refuses_the_call_past_the_allowance(self):
        """A distinct email per call, so this can only be the IP bucket biting."""
        allowed = [
            login_route_limited(ip="1.2.3.4", email=f"user{n}@brand.test")
            for n in range(LOGIN_ROUTE_IP_PER_MINUTE)
        ]
        assert not any(allowed), f"the allowance must be usable: {allowed}"
        assert login_route_limited(ip="1.2.3.4", email="one-more@brand.test")

    def test_the_email_bucket_refuses_the_call_past_the_allowance(self):
        """A distinct IP per call, so this can only be the email bucket biting.

        The email bucket is the one that matters: an enumerator spraying one address from a
        botnet defeats the IP bucket entirely, and this is what still bounds them.
        """
        allowed = [
            login_route_limited(ip=f"10.0.0.{n}", email="chef@brand.test")
            for n in range(LOGIN_ROUTE_EMAIL_PER_MINUTE)
        ]
        assert not any(allowed), f"the allowance must be usable: {allowed}"
        assert login_route_limited(ip="10.0.0.99", email="chef@brand.test")

    def test_one_email_exhausting_its_bucket_does_not_lock_out_another(self):
        for _ in range(LOGIN_ROUTE_EMAIL_PER_MINUTE + 1):
            login_route_limited(ip="1.2.3.4", email="chef@brand.test")
        assert not login_route_limited(ip="1.2.3.4", email="other@brand.test")

    def test_an_ip_over_its_limit_does_not_spend_the_email_allowance(self):
        """The IP check short-circuits. Otherwise a single flooding IP would burn every
        address's allowance and lock those people out from their own machines."""
        for n in range(LOGIN_ROUTE_IP_PER_MINUTE + 5):
            login_route_limited(ip="1.2.3.4", email=f"user{n}@brand.test")
        assert not login_route_limited(ip="5.6.7.8", email="user0@brand.test")


class TestPassportStartBucket:
    def test_refuses_the_call_past_the_allowance(self):
        allowed = [passport_start_limited("9.9.9.9") for _ in range(PASSPORT_START_IP_PER_MINUTE)]
        assert not any(allowed), f"the allowance must be usable: {allowed}"
        assert passport_start_limited("9.9.9.9")

    def test_does_not_share_a_bucket_with_the_login_router(self):
        """Both are 10/minute from one IP, which is exactly why a shared key would go
        unnoticed: the numbers match, so only a cross-route test can see the collision."""
        for _ in range(PASSPORT_START_IP_PER_MINUTE):
            passport_start_limited("9.9.9.9")
        assert not login_route_limited(ip="9.9.9.9", email="chef@brand.test")


class TestClientIp:
    """Every limit in this module keys on this, and it is the one function whose behaviour
    differs between the test process and production."""

    @staticmethod
    def _request(headers: list[tuple[bytes, bytes]] | None = None, client=("1.2.3.4", 1234)):
        from fastapi import Request

        return Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": headers or [],
                "query_string": b"",
                "client": client,
            }
        )

    def test_prefers_the_fly_header(self):
        """In production `request.client.host` is fly-proxy's own mesh address for EVERY request,
        so trusting it would put the entire internet in one bucket."""
        request = self._request([(b"fly-client-ip", b"203.0.113.9")])
        assert client_ip(request) == "203.0.113.9"

    def test_falls_back_to_the_peer_when_the_header_is_absent(self):
        """Local and non-Fly environments, including this test suite."""
        assert client_ip(self._request()) == "1.2.3.4"

    def test_a_missing_peer_does_not_crash(self):
        """Some ASGI transports report no peer. One shared bucket over-limits rather than
        under-limits, which is the right way round for a failure nobody will notice."""
        assert client_ip(self._request(client=None)) == "unknown"


class TestKeyEviction:
    def test_stale_keys_are_evicted_rather_than_accumulating(self, monkeypatch):
        """`_hits` never shrank: pruning only ever touched the key being checked, and that key was
        immediately re-populated. Near-harmless while keys were authenticated user ids — a bounded
        set of real people. The login buckets key on an unauthenticated, caller-supplied email of
        up to 320 octets, which makes it memory an anonymous caller can grow at will.
        """
        for n in range(50):
            login_route_limited(ip=f"10.0.0.{n}", email=f"user{n}@brand.test")
        assert len(_hits) == 100, "one key per bucket per caller"

        later = time.monotonic() + LOGIN_WINDOW_SECONDS + 1
        monkeypatch.setattr(time, "monotonic", lambda: later)

        # Any call triggers the amortised sweep; this one's own key is the only survivor.
        passport_start_limited("9.9.9.9")

        assert set(_hits) == {"passport-start-ip:9.9.9.9"}

    def test_the_sweep_does_not_evict_a_live_bucket(self, monkeypatch):
        """An eviction that dropped keys still inside their window would reset the allowance of
        whoever it touched — a rate limiter that forgets on a schedule is not one."""
        for _ in range(LOGIN_ROUTE_EMAIL_PER_MINUTE):
            login_route_limited(ip="1.2.3.4", email="chef@brand.test")

        later = time.monotonic() + (LOGIN_WINDOW_SECONDS / 2)
        monkeypatch.setattr(time, "monotonic", lambda: later)

        assert login_route_limited(ip="1.2.3.4", email="chef@brand.test"), (
            "the bucket was still live and must still be refusing"
        )


def test_reset_clears_the_login_buckets_too():
    """`_reset_for_tests` is the only thing stopping one test rate-limiting the next; it has
    to cover every bucket, not just the AI one it was written for."""
    for n in range(LOGIN_ROUTE_IP_PER_MINUTE + 1):
        login_route_limited(ip="1.2.3.4", email=f"user{n}@brand.test")
    for _ in range(PASSPORT_START_IP_PER_MINUTE + 1):
        passport_start_limited("1.2.3.4")
    assert login_route_limited(ip="1.2.3.4", email="fresh@brand.test")
    assert passport_start_limited("1.2.3.4")

    _reset_for_tests()

    assert not login_route_limited(ip="1.2.3.4", email="fresh@brand.test")
    assert not passport_start_limited("1.2.3.4")
