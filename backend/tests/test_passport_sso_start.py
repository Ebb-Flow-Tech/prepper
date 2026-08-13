"""`GET /auth/passport/start` — the hand-off to Passport's hosted login.

One property dominates every test here: **this route has no failure mode that is not a redirect.**
It is reached only by a top-level browser navigation, so a raised exception or a JSON 429 does not
surface as an error the frontend can render — it surfaces as the whole page. Unconfigured,
rate-limited and infra-broken therefore all look the same from the outside, and differ only in the
server-side log line.
"""

import logging
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, select

from app.api.rate_limit import PASSPORT_START_IP_PER_MINUTE, _reset_for_tests
from app.models import PassportLoginAttempt
from tests.conftest import (
    FRONTEND_URL as FRONTEND,
)
from tests.conftest import (
    PASSPORT_DASHBOARD_URL as DASHBOARD,
)
from tests.conftest import (
    SSO_CALLBACK_URL as CALLBACK,
)
from tests.conftest import seed_entitlement, sso_settings

ROUTE = "/api/v1/auth/passport/start"
UNAVAILABLE = f"{FRONTEND}/login?error=passport_unavailable"
VERIFIER = "the-secret-code-verifier"


@pytest.fixture(autouse=True)
def _clean_counters():
    _reset_for_tests()
    yield
    _reset_for_tests()


@pytest.fixture(name="configured")
def configured_fixture():
    with patch("app.api.auth_passport.get_settings", return_value=sso_settings()):
        yield


def _start(client: TestClient):
    return client.get(ROUTE, follow_redirects=False)


class TestHappyPath:
    def test_redirects_to_passports_authorize_with_a_pkce_challenge(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        seed_entitlement(session)

        response = _start(anon_client)

        assert response.status_code == 307
        target = urlparse(response.headers["location"])
        assert f"{target.scheme}://{target.netloc}{target.path}" == f"{DASHBOARD}/authorize"

        params = parse_qs(target.query)
        assert params["client_id"] == ["prepper"]
        assert params["redirect_uri"] == [CALLBACK]
        assert params["code_challenge_method"] == ["S256"], (
            "plain would let anyone who sees the challenge mint the verifier"
        )
        assert params["code_challenge"][0]
        assert params["state"][0]

    def test_stores_exactly_one_verifier_against_the_state_it_sent(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        """The verifier must stay server-side — the challenge is what travels."""
        seed_entitlement(session)

        response = _start(anon_client)
        state = parse_qs(urlparse(response.headers["location"]).query)["state"][0]

        rows = session.exec(select(PassportLoginAttempt)).all()
        assert len(rows) == 1
        assert rows[0].state == state
        assert rows[0].code_verifier not in response.headers["location"]


class TestEveryFailureIsARedirect:
    def test_an_unsynced_entitlement_projection_redirects(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        """A fresh environment whose sync has not landed has no app id to send as `client_id`.

        `resolve_app_id` returns None rather than raising precisely so this is a redirect. Pinned
        explicitly because it is the state every new deployment starts in.
        """
        response = _start(anon_client)
        assert response.status_code == 307
        assert response.headers["location"] == UNAVAILABLE
        assert session.exec(select(PassportLoginAttempt)).all() == []

    @pytest.mark.parametrize("missing", ["passport_dashboard_url", "sso_callback_url"])
    def test_missing_configuration_redirects(
        self, anon_client: TestClient, session: Session, missing: str
    ) -> None:
        seed_entitlement(session)
        with patch("app.api.auth_passport.get_settings", return_value=sso_settings(**{missing: None})):
            response = _start(anon_client)
        assert response.headers["location"] == UNAVAILABLE

    def test_the_rate_limit_redirects_rather_than_429ing(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        """A JSON 429 body would render as the entire page. This is the reason the bucket is
        checked in the handler instead of being a dependency."""
        seed_entitlement(session)
        for _ in range(PASSPORT_START_IP_PER_MINUTE):
            assert _start(anon_client).headers["location"].startswith(f"{DASHBOARD}/authorize")

        blocked = _start(anon_client)
        assert blocked.status_code == 307
        assert blocked.headers["location"] == UNAVAILABLE

    def test_an_exception_while_storing_the_verifier_redirects(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        """The catch-all `geddit-one` does not have. A dead database on this route must not
        answer with a raw `{"detail": ...}` page."""
        seed_entitlement(session)
        with patch("app.api.auth_passport.store_verifier", side_effect=RuntimeError("db is gone")):
            response = _start(anon_client)
        assert response.status_code == 307
        assert response.headers["location"] == UNAVAILABLE

    def test_an_exception_while_resolving_the_app_id_redirects(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        with patch("app.api.auth_passport.resolve_app_id", side_effect=RuntimeError("db is gone")):
            response = _start(anon_client)
        assert response.headers["location"] == UNAVAILABLE

    def test_a_failed_insert_never_logs_the_code_verifier(
        self, anon_client: TestClient, session: Session, configured, caplog
    ) -> None:
        """The catch-all logs with `exc_info=True`, and `store_verifier` is inside it.

        SQLAlchemy appends a failed statement's BOUND PARAMETERS to `StatementError.__str__`, so
        without `hide_parameters=True` on the engine an INSERT failure here writes
        `[parameters: ('st-x', '<the verifier>', ...)]` into the log at WARNING. `pkce.py` says the
        verifier must never reach the browser; a log aggregator is the same disclosure with longer
        retention. The redirect assertions above all pass while that leak is live — only this sees it.
        """
        seed_entitlement(session)
        session.execute(text("DROP TABLE passport_login_attempt"))
        session.commit()

        caplog.set_level(logging.WARNING)
        with patch(
            "app.api.auth_passport.generate_pkce_pair",
            return_value=(VERIFIER, "the-challenge", "st-x"),
        ):
            response = _start(anon_client)

        assert response.headers["location"] == UNAVAILABLE
        assert caplog.text, "the failure must still be searchable"
        assert VERIFIER not in caplog.text
        assert "[parameters:" not in caplog.text, "no bound parameters may reach a log line"

    def test_an_unset_frontend_url_still_lands_somewhere(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """Misconfigured either way, but `None/login?error=...` is not a URL."""
        with patch("app.api.auth_passport.get_settings", return_value=sso_settings(frontend_url=None)):
            response = _start(anon_client)
        assert response.headers["location"] == "/login?error=passport_unavailable"


def test_the_route_needs_no_token() -> None:
    from app.api.deps import public_routes
    from app.config import get_settings

    assert ("GET", ROUTE) in public_routes(get_settings())
