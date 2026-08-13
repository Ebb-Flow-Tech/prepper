"""Login CSRF — binding the OAuth `state` to the browser that started the flow (spec §6).

Without this, `state` proves only that Prepper issued it, never that it was issued to *this*
browser. An attacker completes `/passport/start` themselves, captures their own `code` + `state`,
and forces a victim's browser to load the callback. The victim is silently signed in **as the
attacker** — note the direction: not account takeover of the victim, but the victim working inside
the attacker's org without noticing, so every recipe, costing and supplier price they enter lands
in the attacker's tenant.

The cookie **adds to** the server-side table, it does not replace it:

- the table proves the state was issued by us, and carries the `code_verifier`;
- the cookie proves it was issued to this browser.

Neither closes the hole alone, which is why both tests below exist: one kills the cookie check, one
kills the table check, and each must still refuse.

A deliberate deviation from `geddit-one`, which does not bind state to the browser.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.auth_passport import STATE_COOKIE_NAME
from app.api.rate_limit import _reset_for_tests
from app.passport import pkce
from tests.conftest import (
    FRONTEND_URL as FRONTEND,
)
from tests.conftest import (
    seed_entitlement,
    sso_settings,
)
from tests.test_passport_sso_callback import (
    ACCESS_TOKEN,
    MEMBER_EMAIL,
    PASSPORT_SUB,
    REFRESH_TOKEN,
    _member_with_access,
)

START = "/api/v1/auth/passport/start"
CALLBACK = "/api/v1/auth/passport/callback"
SSO_FAILED = f"{FRONTEND}/login?error=passport_sso_failed"


@pytest.fixture(autouse=True)
def _clean_counters():
    _reset_for_tests()
    yield
    _reset_for_tests()


@pytest.fixture(name="configured")
def configured_fixture():
    with patch("app.api.auth_passport.get_settings", return_value=sso_settings()):
        yield


@pytest.fixture(name="exchange")
def exchange_fixture():
    """Everything DOWNSTREAM of the binding, wired to SUCCEED — and this is load-bearing.

    Without it these tests were worthless. The real `exchange_session_code` fails in the test
    environment and produces the *identical* `?error=passport_sso_failed` redirect, so
    `assert location == SSO_FAILED` could not tell "refused by the binding" from "refused by the
    next thing along". Three of the four tests below survived deleting the binding entirely —
    including the one named for the actual attack, which is the worst possible test to have
    passing for the wrong reason, because it stops anyone looking again.

    With the downstream succeeding, a passing binding yields the SUCCESS redirect. A refusal is
    therefore attributable to the binding and to nothing else — and the returned mock lets each
    test additionally assert the code was never redeemed.
    """
    verified = SimpleNamespace(
        verify_passport_identity=lambda _token: (PASSPORT_SUB, MEMBER_EMAIL)
    )
    succeeds = MagicMock(
        return_value={"access_token": ACCESS_TOKEN, "refresh_token": REFRESH_TOKEN}
    )
    with (
        patch("app.passport.login_flow.get_auth_service", return_value=verified),
        patch("app.passport.login_flow.exchange_session_code", succeeds),
    ):
        yield succeeds


def _issued_state(response) -> str:
    return dict(
        param.split("=", 1)
        for param in urlparse(response.headers["location"]).query.split("&")
    )["state"]


class TestStartIssuesTheCookie:
    def test_the_cookie_carries_the_same_state_as_the_redirect(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        seed_entitlement(session)

        response = anon_client.get(START, follow_redirects=False)

        assert response.cookies[STATE_COOKIE_NAME] == _issued_state(response)

    def test_the_cookie_is_httponly_and_samesite_lax(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        """`Lax`, NOT `Strict`. The callback arrives as a cross-site top-level redirect from
        Passport, and `Strict` withholds the cookie on exactly that navigation — so the
        safer-LOOKING value breaks every login, and breaks it *after* the user has already
        authenticated, which is the worst possible place to find out.

        `HttpOnly` because script has no reason to read it, and an XSS that could would be able
        to forge the very binding this exists to prove.
        """
        seed_entitlement(session)

        header = anon_client.get(START, follow_redirects=False).headers["set-cookie"]

        assert "httponly" in header.lower()
        assert "samesite=lax" in header.lower()
        assert "samesite=strict" not in header.lower()
        assert "path=/" in header.lower()

    def test_a_failed_start_leaves_no_cookie_behind(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        """No entitlement projected, so `/start` refuses. A stale cookie surviving a failure
        could authorise a later attempt it was never issued for."""
        response = anon_client.get(START, follow_redirects=False)

        assert response.headers["location"].endswith("error=passport_unavailable")
        assert not response.cookies.get(STATE_COOKIE_NAME)


class TestSecureIsEnvironmentDerived:
    """`Secure` on plain-HTTP localhost means the cookie is never stored, so every local login
    fails with a mismatch. Derived from `debug`, the same switch that decides whether the docs
    routes are mounted — not hardcoded on."""

    @pytest.mark.parametrize("debug,expect_secure", [(False, True), (True, False)])
    def test_secure_follows_the_environment(
        self,
        anon_client: TestClient,
        session: Session,
        debug: bool,
        expect_secure: bool,
    ) -> None:
        seed_entitlement(session)

        with patch(
            "app.api.auth_passport.get_settings", return_value=sso_settings(debug=debug)
        ):
            header = anon_client.get(START, follow_redirects=False).headers["set-cookie"]

        assert ("secure" in header.lower()) is expect_secure


class TestCallbackRequiresTheCookie:
    """Every test here runs with the downstream exchange SUCCEEDING (see the `exchange` fixture),
    so a refusal can only have come from the binding."""

    def _begin(self, client: TestClient, session: Session) -> str:
        _member_with_access(session)  # so a passing binding really would sign in
        response = client.get(START, follow_redirects=False)
        return _issued_state(response)

    def test_the_control_a_matching_cookie_signs_in(
        self, anon_client: TestClient, session: Session, configured, exchange
    ) -> None:
        """The control that makes every refusal below mean something.

        Same setup, correct cookie: the login completes. So when the identical request with a
        missing or wrong cookie lands on `passport_sso_failed`, the binding is the only thing
        that changed.
        """
        state = self._begin(anon_client, session)
        anon_client.cookies.set(STATE_COOKIE_NAME, state)

        response = anon_client.get(
            CALLBACK, params={"code": "c", "state": state}, follow_redirects=False
        )

        assert response.headers["location"].startswith(f"{FRONTEND}/auth/passport-callback#")
        exchange.assert_called_once()

    def test_the_forged_callback_is_refused(
        self, anon_client: TestClient, session: Session, configured, exchange
    ) -> None:
        """THE attack. The attacker runs `/start` in their own browser, so the table row exists
        and the state is genuine — it is simply not this browser's."""
        attacker_state = self._begin(anon_client, session)
        anon_client.cookies.clear()  # the victim's browser never called /start

        response = anon_client.get(
            CALLBACK,
            params={"code": "attacker-code", "state": attacker_state},
            follow_redirects=False,
        )

        assert response.headers["location"] == SSO_FAILED
        # The attacker's code must never be redeemed — refusal precedes the exchange.
        exchange.assert_not_called()

    def test_a_mismatched_cookie_is_refused(
        self, anon_client: TestClient, session: Session, configured, exchange
    ) -> None:
        """A victim mid-flow in their own tab is the realistic version: they hold a cookie, just
        not the attacker's one."""
        attacker_state = self._begin(anon_client, session)
        anon_client.cookies.set(STATE_COOKIE_NAME, "some-other-attempt")

        response = anon_client.get(
            CALLBACK,
            params={"code": "attacker-code", "state": attacker_state},
            follow_redirects=False,
        )

        assert response.headers["location"] == SSO_FAILED
        exchange.assert_not_called()

    def test_a_non_ascii_state_redirects_rather_than_500ing(
        self, anon_client: TestClient, session: Session, configured, exchange
    ) -> None:
        """`secrets.compare_digest` raises TypeError on a str holding any non-ASCII character, and
        this comparison sits outside the handler's try — so `?state=sté` was an uncaught 500,
        rendered on this route as the victim's whole login page. Both operands are reachable:
        the query string directly, and the cookie because Starlette decodes cookie headers as
        latin-1. Compared as bytes now, which `compare_digest` accepts with any content.

        The non-ASCII goes in the QUERY parameter, not the cookie: httpx refuses to send a
        non-ASCII cookie, which is precisely why no existing test caught this. One non-ASCII
        operand is enough — `compare_digest("ascii", "sté")` raises just the same.
        """
        self._begin(anon_client, session)
        anon_client.cookies.set(STATE_COOKIE_NAME, "an-ascii-cookie")

        response = anon_client.get(
            CALLBACK, params={"code": "c", "state": "sté"}, follow_redirects=False
        )

        assert response.status_code == 307, "a 500 body would render as the whole page"
        assert response.headers["location"] == SSO_FAILED

    def test_the_cookie_check_precedes_redeeming_the_state(
        self, anon_client: TestClient, session: Session, configured, exchange
    ) -> None:
        """The row must SURVIVE a forged callback.

        If the cookie were checked after `pop_verifier`, an attacker could burn a victim's
        in-flight attempt by making them load the callback — the victim's own tab would then fail
        with an unknown state. Refusing first turns that denial of service back into a no-op.
        """
        state = self._begin(anon_client, session)
        anon_client.cookies.clear()

        anon_client.get(
            CALLBACK, params={"code": "c", "state": state}, follow_redirects=False
        )

        assert pkce.pop_verifier(session, state=state) is not None, "the attempt was consumed"

    def test_the_cookie_alone_is_not_enough(
        self, anon_client: TestClient, session: Session, configured, exchange
    ) -> None:
        """The other half of "neither closes the hole alone". A matching cookie with no table row
        is still refused — the cookie proves the browser, never that we issued the state."""
        _member_with_access(session)
        anon_client.cookies.set(STATE_COOKIE_NAME, "never-issued")

        response = anon_client.get(
            CALLBACK,
            params={"code": "c", "state": "never-issued"},
            follow_redirects=False,
        )

        assert response.headers["location"] == SSO_FAILED
        exchange.assert_not_called()


class TestTheCookieIsClearedOnEveryTerminalOutcome:
    """A stale value must never be able to authorise a later attempt."""

    def test_cleared_on_refusal(
        self, anon_client: TestClient, session: Session, configured
    ) -> None:
        seed_entitlement(session)
        anon_client.get(START, follow_redirects=False)

        response = anon_client.get(
            CALLBACK, params={"code": "c", "state": "wrong"}, follow_redirects=False
        )

        assert not response.cookies.get(STATE_COOKIE_NAME)
        assert "set-cookie" in response.headers, "the browser must be told to drop it"

    def test_cleared_on_success(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """The only full `/start` -> `/callback` round trip in the suite, cookie jar and all.

        `debug=True` is load-bearing, and finding out why was the point. The test client speaks
        plain HTTP, so with `Secure` set the browser-equivalent jar refuses to STORE the cookie at
        all and the callback then fails the binding check — the exact way a developer's localhost
        login breaks if `Secure` is hardcoded on. Running this leg in the dev configuration both
        makes the round trip work and demonstrates the reason `Secure` is environment-derived.
        """
        from types import SimpleNamespace

        from tests.test_passport_sso_callback import (
            ACCESS_TOKEN,
            REFRESH_TOKEN,
            _member_with_access,
        )

        _member_with_access(session)
        verified = SimpleNamespace(
            verify_passport_identity=lambda _t: ("S_passport_chef", "chef@brand.test")
        )
        with (
            patch(
                "app.api.auth_passport.get_settings",
                return_value=sso_settings(debug=True),
            ),
            patch("app.passport.login_flow.get_auth_service", return_value=verified),
            patch(
                "app.passport.login_flow.exchange_session_code",
                return_value={"access_token": ACCESS_TOKEN, "refresh_token": REFRESH_TOKEN},
            ),
        ):
            state = _issued_state(anon_client.get(START, follow_redirects=False))
            response = anon_client.get(
                CALLBACK, params={"code": "c", "state": state}, follow_redirects=False
            )

        assert response.headers["location"].startswith(f"{FRONTEND}/auth/passport-callback#")
        # BOTH lines are needed. `not response.cookies.get(...)` alone is satisfied just as well
        # by emitting no `Set-Cookie` at all, so on its own it passes with the clearing removed —
        # which is exactly the property whose absence "reopens one flow later".
        assert "set-cookie" in response.headers, "the browser must be told to drop it"
        assert not response.cookies.get(STATE_COOKIE_NAME)
