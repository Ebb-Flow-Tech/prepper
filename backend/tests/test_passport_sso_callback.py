"""`GET /auth/passport/callback` — the only place Prepper mints a Model 3 session.

Three properties, and every test here serves one of them:

1. **Every refusal is a redirect**, never a status code or a JSON body. That includes the D10
   access gate: a member without derived access gets `?error=passport_no_access`, not the 403 the
   login-proxy returns, because a JSON 403 renders as the whole page.
2. **A `state` is redeemable exactly once** — unknown, expired and replayed are all refused.
3. **The identity link is written from the MEMBERSHIP projection**, never from `claims["sub"]`.
   Those are different UUID spaces, and a link written from the wrong one denies the user every
   brand-scoped check afterwards while the projection still looks populated.
"""

import logging
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.auth_passport import STATE_COOKIE_NAME
from app.models import PassportIdentityLink, PassportLoginAttempt, User
from app.passport import pkce, store

# Captured at import, BEFORE the autouse fixture below replaces the module attribute — the two
# tests that exercise the real exchange put this back.
from app.passport.session_exchange import exchange_session_code as _real_exchange
from tests.conftest import (
    APP_ID,
    MANAGER,
    ORG_ID,
    grant_brand_role,
    seed_brand,
    seed_entitlement,
    sso_settings,
)
from tests.conftest import (
    FRONTEND_URL as FRONTEND,
)
from tests.conftest import (
    PASSPORT_DASHBOARD_URL as DASHBOARD,
)
from tests.conftest import (
    SSO_CALLBACK_URL as CALLBACK,
)

ROUTE = "/api/v1/auth/passport/callback"

SSO_FAILED = f"{FRONTEND}/login?error=passport_sso_failed"
NO_ACCESS = f"{FRONTEND}/login?error=passport_no_access"

MEMBER_EMAIL = "chef@brand.test"
PLATFORM_USER_ID = "pu-chef"
# Passport's own Supabase auth-user id — a DIFFERENT UUID space from the platform user id above.
# Every assertion about the identity link turns on the two never being confused.
PASSPORT_SUB = "S_passport_chef"

ACCESS_TOKEN = "passport-access-token"
REFRESH_TOKEN = "passport-refresh-token"


@pytest.fixture(name="configured", autouse=True)
def configured_fixture():
    """Settings, a verifying token, and a successful exchange — the backdrop each test dents."""
    verified = SimpleNamespace(
        verify_passport_identity=lambda _token: (PASSPORT_SUB, MEMBER_EMAIL)
    )
    with (
        patch("app.api.auth_passport.get_settings", return_value=sso_settings(
            # A trailing slash on purpose: `TestTheExchangeRequest` asserts it is stripped.
            passport_api_url=f"{DASHBOARD}/"
        )),
        patch("app.passport.login_flow.get_auth_service", return_value=verified),
        patch(
            "app.passport.login_flow.exchange_session_code",
            return_value={"access_token": ACCESS_TOKEN, "refresh_token": REFRESH_TOKEN},
        ),
    ):
        yield


def _member(session: Session, *, email: str = MEMBER_EMAIL, platform_user_id: str = PLATFORM_USER_ID) -> None:
    store.apply_membership(
        session,
        {
            "id": f"m-{platform_user_id}",
            "organization_id": ORG_ID,
            "platform_user_id": platform_user_id,
            "role": "Member",
            "status": "active",
            "version": 1,
            "email": email,
            "display_name": "Chef",
        },
    )


def _member_with_access(session: Session) -> None:
    """The full chain: membership, an entitled org, and a brand role that derives access."""
    _member(session)
    seed_entitlement(session)
    grant_brand_role(session, PLATFORM_USER_ID, seed_brand(session), MANAGER)


def _begin(session: Session, state: str = "st-1") -> str:
    pkce.store_verifier(session, state=state, verifier="ver-1")
    return state


def _callback(client: TestClient, **params):
    """Drive the callback with the login-CSRF state cookie ALREADY matching (spec §6).

    These tests seed the verifier straight into the table rather than going through
    `/passport/start`, so nothing would have set the cookie. Supplying a matching one here keeps
    every test below exercising the thing it was written for — an unknown state must be refused
    because the TABLE does not know it, not because the browser binding is missing.

    The binding itself is owned by `tests/test_passport_login_csrf.py`, which is the only place
    that varies it.
    """
    state = params.get("state")
    if state is not None:
        client.cookies.set(STATE_COOKIE_NAME, state)
    return client.get(ROUTE, params=params, follow_redirects=False)


class TestStateIsRedeemableOnce:
    def test_unknown_state_is_refused(self, anon_client: TestClient, session: Session) -> None:
        _member_with_access(session)
        assert _callback(anon_client, code="c", state="never-issued").headers["location"] == SSO_FAILED

    def test_expired_state_is_refused(self, anon_client: TestClient, session: Session) -> None:
        _member_with_access(session)
        session.add(
            PassportLoginAttempt(
                state="st-old",
                code_verifier="ver-old",
                created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=10),
            )
        )
        session.commit()
        assert _callback(anon_client, code="c", state="st-old").headers["location"] == SSO_FAILED

    def test_a_replayed_state_is_refused(self, anon_client: TestClient, session: Session) -> None:
        """The atomic DELETE, observed through the route. A stolen callback URL replayed after
        the real one must not mint a second session."""
        _member_with_access(session)
        state = _begin(session)

        first = _callback(anon_client, code="c", state=state)
        assert first.headers["location"].startswith(f"{FRONTEND}/auth/passport-callback#")

        replay = _callback(anon_client, code="c", state=state)
        assert replay.headers["location"] == SSO_FAILED


class TestRefusalsBeforeTheExchange:
    def test_passport_returned_an_error(self, anon_client: TestClient, session: Session) -> None:
        _member_with_access(session)
        state = _begin(session)
        response = _callback(anon_client, error="access_denied", state=state)
        assert response.headers["location"] == SSO_FAILED

    @pytest.mark.parametrize("params", [{"code": "c"}, {"state": "st-1"}, {}])
    def test_missing_code_or_state(
        self, anon_client: TestClient, session: Session, params: dict
    ) -> None:
        _member_with_access(session)
        _begin(session)
        assert _callback(anon_client, **params).headers["location"] == SSO_FAILED


class TestRefusalsDuringTheExchange:
    def test_a_failed_exchange_is_refused(
        self, anon_client: TestClient, session: Session
    ) -> None:
        _member_with_access(session)
        state = _begin(session)
        with patch("app.passport.login_flow.exchange_session_code", return_value=None):
            assert _callback(anon_client, code="c", state=state).headers["location"] == SSO_FAILED

    @pytest.mark.parametrize(
        "payload", [{}, {"access_token": ACCESS_TOKEN}, {"refresh_token": REFRESH_TOKEN}]
    )
    def test_an_incomplete_session_is_refused(
        self, anon_client: TestClient, session: Session, payload: dict
    ) -> None:
        """A 200 carrying half a session is still a failure — never a half-signed-in browser."""
        _member_with_access(session)
        state = _begin(session)
        with patch("app.passport.login_flow.exchange_session_code", return_value=payload):
            assert _callback(anon_client, code="c", state=state).headers["location"] == SSO_FAILED

    def test_a_token_that_does_not_verify_is_refused(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """The exchange is a trusted server-to-server call, but the token it returns is still
        verified through the SAME path every request already uses. Trusting the transport instead
        would accept anything a compromised or misconfigured exchange handed back."""
        _member_with_access(session)
        state = _begin(session)
        with patch(
            "app.passport.login_flow.get_auth_service",
            return_value=SimpleNamespace(verify_passport_identity=lambda _t: None),
        ):
            assert _callback(anon_client, code="c", state=state).headers["location"] == SSO_FAILED


class TestAccessGate:
    def test_a_non_member_is_refused_by_redirect_not_by_403(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """D10. A valid Passport token proves who you are, never that you may be here — the
        shared issuer signs tokens for people who are not members of this app at all."""
        response = _callback(anon_client, code="c", state=_begin(session))
        assert response.status_code == 307
        assert response.headers["location"] == NO_ACCESS

    def test_a_member_without_derived_access_is_refused(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """Membership is not access. An entitled org with no brand carrying the Prepper switch
        derives nothing, and this is the only place a Model 3 session is minted."""
        _member(session)
        seed_entitlement(session)  # entitled, but no brand and no role
        response = _callback(anon_client, code="c", state=_begin(session))
        assert response.headers["location"] == NO_ACCESS

    def test_a_member_before_entitlements_sync_is_admitted(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """Fails OPEN while Passport is not yet authoritative, matching the request-path
        derivation — turning the projection on must not lock out every real member."""
        _member(session)  # no entitlement projected at all
        response = _callback(anon_client, code="c", state=_begin(session))
        assert response.headers["location"].startswith(f"{FRONTEND}/auth/passport-callback#")


class TestSuccess:
    def test_the_session_crosses_in_the_url_fragment(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """A fragment, not a query string: it is never sent to a server and never lands in an
        access log or a Referer header."""
        _member_with_access(session)
        response = _callback(anon_client, code="c", state=_begin(session))

        assert response.status_code == 307
        target = urlparse(response.headers["location"])
        assert f"{target.scheme}://{target.netloc}{target.path}" == (
            f"{FRONTEND}/auth/passport-callback"
        )
        assert target.query == "", "the tokens must not be in the query string"
        assert parse_qs(target.fragment) == {
            "access_token": [ACCESS_TOKEN],
            "refresh_token": [REFRESH_TOKEN],
        }

    def test_provisions_the_local_user_keyed_by_the_passport_sub(
        self, anon_client: TestClient, session: Session
    ) -> None:
        _member_with_access(session)
        _callback(anon_client, code="c", state=_begin(session))

        user = session.exec(select(User).where(User.email == MEMBER_EMAIL)).one()
        assert user.id == PASSPORT_SUB

    def test_writes_the_identity_link_from_the_membership_not_the_token_sub(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """`claims["sub"]` is Passport's Supabase auth-user id; `platform_user_id` is Passport's
        own internal id. Writing the former produces a link that resolves to nobody, and every
        brand-scoped check then denies the user silently."""
        _member_with_access(session)
        _callback(anon_client, code="c", state=_begin(session))

        link = session.exec(select(PassportIdentityLink)).one()
        assert link.platform_user_id == PLATFORM_USER_ID
        assert link.platform_user_id != PASSPORT_SUB
        assert link.subject == PASSPORT_SUB
        assert link.app_id == APP_ID

    def test_relinking_the_same_user_is_idempotent(
        self, anon_client: TestClient, session: Session
    ) -> None:
        _member_with_access(session)
        _callback(anon_client, code="c", state=_begin(session, "st-a"))
        _callback(anon_client, code="c", state=_begin(session, "st-b"))

        assert len(session.exec(select(PassportIdentityLink)).all()) == 1

    def test_a_link_naming_a_different_platform_user_is_replaced(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """Self-healing. Identity-link rows are immutable per row, so an earlier wrong write is
        replaced rather than updated — otherwise a link written from the token sub before this
        was understood would deny the user forever."""
        _member_with_access(session)
        store.create_identity_link(
            session,
            {
                "id": "link-wrong",
                "platform_user_id": PASSPORT_SUB,  # the wrong UUID space
                "app_id": APP_ID,
                "subject": PASSPORT_SUB,
                "linked_via": "manual",
            },
        )

        _callback(anon_client, code="c", state=_begin(session))

        links = session.exec(select(PassportIdentityLink)).all()
        assert len(links) == 1
        assert links[0].platform_user_id == PLATFORM_USER_ID
        assert links[0].id != "link-wrong", "replaced, not updated in place"

    def test_does_not_report_the_identity_link_to_passport(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """`report_identity_link_safe` verifies the forwarded token against PREPPER's registered
        issuer. A Passport-issued token has the wrong issuer, so the call is a guaranteed no-op —
        a network round trip on the login path that can only ever fail.

        Asserted against the module itself rather than by patching: the point is that the call is
        not reachable from here at all, and a patch-and-assert-not-called would go green again the
        moment someone reintroduced it behind a condition this test does not exercise.
        """
        import app.passport.login_flow as module

        _member_with_access(session)
        _callback(anon_client, code="c", state=_begin(session))

        assert not hasattr(module, "report_identity_link_safe")


class TestNothingRaisesThroughToTheBrowser:
    """A raised exception here renders as the entire login page, not as an error the app can show.

    `/passport/start` had a catch-all from the first draft; this route did not, and making
    `pop_verifier` or `resolve_or_provision_passport_user` raise produced a bare
    `500 Internal Server Error` body — verified by execution before the fix.
    """

    @pytest.mark.parametrize(
        "target,expected",
        [
            ("app.passport.login_flow.pop_verifier", SSO_FAILED),
            ("app.passport.login_flow.resolve_or_provision_passport_user", SSO_FAILED),
            # A link failure is deliberately NOT a refusal — see the decision comment on the
            # `bind_identity_link` call. The user is already verified and already entitled; the
            # link is an optimisation that `deps._platform_user_for`'s email fallback covers.
            ("app.passport.login_flow.bind_identity_link", "success"),
        ],
    )
    def test_an_exception_redirects_rather_than_500ing(
        self, anon_client: TestClient, session: Session, target: str, expected: str
    ) -> None:
        _member_with_access(session)
        state = _begin(session)

        with patch(target, side_effect=RuntimeError("the database is gone")):
            response = _callback(anon_client, code="c", state=state)

        assert response.status_code == 307, "a 500 body would render as the whole page"
        if expected == "success":
            assert response.headers["location"].startswith(f"{FRONTEND}/auth/passport-callback#")
        else:
            assert response.headers["location"] == expected

    def test_a_genuinely_poisoned_session_still_redirects_and_keeps_the_user(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """The `session.rollback()` in the link handler is NOT redundant, and only this shows it.

        The parametrised case above patches `bind_identity_link` with a mocked `side_effect`, so
        the exception is raised INSTEAD of the commit and the session it unwinds is always clean —
        the decision comment's claim that "the failed commit leaves the session unusable" is never
        actually exercised there, and deleting the rollback would keep that test green.

        Here the commit really fails, on a primary-key collision, and SQLAlchemy really does put
        the session into a state where the next statement raises `PendingRollbackError`. Without
        the rollback this route 500s — which, on a top-level navigation, is the entire login page.
        """
        _member_with_access(session)
        colliding_id = "link-collision"

        # A decoy that already OWNS the id the handler is about to mint. Its subject differs, so
        # the idempotency lookup misses it and the INSERT is genuinely attempted and genuinely
        # rejected — rather than the write being skipped as a no-op.
        store.create_identity_link(
            session,
            {
                "id": colliding_id,
                "platform_user_id": "pu-someone-else",
                "app_id": APP_ID,
                "subject": "S_someone_else",
                "linked_via": "manual",
            },
        )

        with patch("app.passport.identity.uuid4", return_value=colliding_id):
            response = _callback(anon_client, code="c", state=_begin(session))

        assert response.status_code == 307, "a 500 body would render as the whole page"
        assert response.headers["location"].startswith(f"{FRONTEND}/auth/passport-callback#")

        # `ensure_user` committed before the link was attempted, so the rollback must unwind the
        # failed INSERT and nothing else. A member provisioned and then silently discarded would
        # sign in to an account that does not exist.
        provisioned = session.exec(select(User).where(User.email == MEMBER_EMAIL)).one()
        assert provisioned.id == PASSPORT_SUB

    def test_the_catch_all_does_not_rewrite_a_deliberate_refusal(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """The refusal codes must survive the wrapper. A catch-all that swallowed a refusal's
        own `return` would turn every `passport_no_access` into `passport_sso_failed`, and the
        one distinction an operator has left would be gone."""
        _member(session)
        seed_entitlement(session)  # a member, but no derived access
        assert _callback(anon_client, code="c", state=_begin(session)).headers["location"] == (
            NO_ACCESS
        )

    def test_an_http_exception_is_re_raised_not_converted(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """Nothing raises one today. The guard exists so that a future refusal rewritten from
        `return _login_error_redirect(...)` to `raise HTTPException(...)` fails loudly here rather
        than being silently absorbed into the generic redirect."""
        from fastapi import HTTPException

        _member_with_access(session)
        with patch(
            "app.passport.login_flow.pop_verifier",
            side_effect=HTTPException(status_code=418, detail="deliberate"),
        ):
            response = _callback(anon_client, code="c", state=_begin(session))

        assert response.status_code == 418


class TestUntrustedQueryParameters:
    def test_a_forged_error_code_is_not_written_to_the_log(
        self, anon_client: TestClient, session: Session, caplog
    ) -> None:
        """This route is in `public_routes`, so `error` is attacker-controlled — not, as an
        earlier comment claimed, "Passport-defined, not free text". A newline in it forges whole
        log entries, which is how a log stops being usable evidence."""
        caplog.set_level(logging.WARNING)
        _callback(
            anon_client,
            error="access_denied\nWARNING  root:forged an entry that never happened",
            state="s",
        )

        assert "forged an entry" not in caplog.text
        assert "unrecognised" in caplog.text

    def test_a_real_oauth_error_code_is_still_logged_verbatim(
        self, anon_client: TestClient, session: Session, caplog
    ) -> None:
        """Sanitising must not cost the operator the one detail worth having."""
        caplog.set_level(logging.WARNING)
        _callback(anon_client, error="access_denied", state="s")
        assert "access_denied" in caplog.text

    @pytest.mark.parametrize(
        "params",
        [
            {"code": "c", "state": "s" * 129},
            {"code": "c" * 513, "state": "s"},
            {"error": "e" * 65, "state": "s"},
            {"code": "c", "state": "s" * 10_000},
        ],
    )
    def test_an_over_long_parameter_redirects_rather_than_answering_in_json(
        self, anon_client: TestClient, session: Session, params: dict
    ) -> None:
        """The cap is enforced IN THE HANDLER, specifically so that no `/passport/*` path can
        answer with JSON.

        `Query(max_length=...)` would bound the same values but answer a violation with a 422
        body — and on a route reached by top-level navigation that renders as the victim's whole
        login page. An over-long parameter only ever arrives in a hand-crafted URL, which is
        exactly what an attacker sends someone. Truncating instead keeps the redirect-only rule
        unconditional, and a truncated `state` just misses the lookup and fails through normally.
        """
        response = _callback(anon_client, **params)

        assert response.status_code == 307
        assert response.headers["location"] == SSO_FAILED

    @pytest.mark.parametrize(
        "params,expected_name,over_long",
        [
            ({"code": "c" * 513, "state": "s"}, "code", "c" * 513),
            ({"code": "c", "state": "s" * 129}, "state", "s" * 129),
            ({"error": "e" * 65, "state": "s"}, "error", "e" * 65),
        ],
    )
    def test_truncation_says_so_in_the_log(
        self,
        anon_client: TestClient,
        session: Session,
        caplog,
        params: dict,
        expected_name: str,
        over_long: str,
    ) -> None:
        """Truncating silently is fine for a hand-crafted URL and catastrophic for a real one.

        If Passport ever issues an authorization code longer than `_CODE_MAX_LENGTH`, EVERY login
        fails as `passport_sso_failed` and the only line written says the session-exchange request
        failed — sending the investigation to the network, to Passport, to anywhere but the
        constant that actually did it. The parameter is named; its value never is.
        """
        caplog.set_level(logging.WARNING)
        _callback(anon_client, **params)

        assert "truncated" in caplog.text
        assert expected_name in caplog.text
        # Neither the full value nor its surviving prefix: `code` and `state` are secrets, and
        # `error` is attacker-authored (see `_safe_error`).
        assert over_long not in caplog.text
        assert over_long[:32] not in caplog.text

    def test_a_value_at_the_cap_is_not_reported_as_truncated(
        self, anon_client: TestClient, session: Session, caplog
    ) -> None:
        """Off-by-one: `len == limit` fits. A warning here would cry wolf on every real login."""
        caplog.set_level(logging.WARNING)
        _callback(anon_client, code="c" * 512, state="s" * 128)

        assert "truncated" not in caplog.text

    def test_an_over_long_error_is_still_bounded_in_the_log(
        self, anon_client: TestClient, session: Session, caplog
    ) -> None:
        """Truncating instead of refusing must not hand the log an unbounded string."""
        caplog.set_level(logging.WARNING)
        _callback(anon_client, error="e" * 10_000, state="s")

        assert "unrecognised" in caplog.text
        assert "e" * 1_000 not in caplog.text


class TestTheExchangeRequest:
    def test_posts_the_code_verifier_and_redirect_uri_with_the_app_key(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """`redirect_uri` is re-sent at the token request per RFC 6749 §4.1.3 — not redundant:
        it is what stops a code issued for one registered callback being redeemed against
        another. The API url is `rstrip("/")`-ed, or a trailing slash yields `//api/v1/...`.
        """
        _member_with_access(session)
        state = _begin(session)

        captured = {}

        class _Response:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict:
                return {"access_token": ACCESS_TOKEN, "refresh_token": REFRESH_TOKEN}

        def _post(url, **kwargs):
            captured["url"] = url
            captured.update(kwargs)
            return _Response()

        with (
            patch("app.passport.login_flow.exchange_session_code", _real_exchange),
            patch("app.passport.session_exchange.httpx.post", _post),
        ):
            _callback(anon_client, code="the-code", state=state)

        assert captured["url"] == f"{DASHBOARD}/api/v1/apps/me/session-exchange"
        assert captured["headers"] == {"X-API-Key": "app-key"}
        assert captured["json"] == {
            "code": "the-code",
            "code_verifier": "ver-1",
            "redirect_uri": CALLBACK,
        }


class TestLogging:
    @pytest.mark.parametrize(
        "case", ["unknown-state", "no-access", "exchange-failed", "verify-failed"]
    )
    def test_no_email_or_token_is_ever_logged(
        self, anon_client: TestClient, session: Session, caplog, case: str
    ) -> None:
        """`security.md`: no PII in logs. The failure CATEGORY is what an operator acts on; the
        address only tells them who was trying, which they must not learn from a log file."""
        _member(session)
        seed_entitlement(session)
        state = _begin(session)

        caplog.set_level(logging.WARNING)
        if case == "unknown-state":
            _callback(anon_client, code="c", state="never-issued")
        elif case == "no-access":
            _callback(anon_client, code="c", state=state)
        elif case == "exchange-failed":
            # The REAL exchange, so the log line under test is the one that actually ships.
            with (
                patch("app.passport.login_flow.exchange_session_code", _real_exchange),
                patch("app.passport.session_exchange.httpx.post", side_effect=httpx.ConnectError("boom")),
            ):
                _callback(anon_client, code="c", state=state)
        else:
            with patch(
                "app.passport.login_flow.get_auth_service",
                return_value=SimpleNamespace(verify_passport_identity=lambda _t: None),
            ):
                _callback(anon_client, code="c", state=state)

        assert caplog.text, "a refusal with no log line is unsearchable"
        for secret in (MEMBER_EMAIL, ACCESS_TOKEN, REFRESH_TOKEN, "ver-1"):
            assert secret not in caplog.text

    def test_each_refusal_branch_has_its_own_line(
        self, anon_client: TestClient, session: Session, caplog
    ) -> None:
        """One shared user-facing message is correct; one shared LOG line is not — it makes the
        search unsplittable exactly when someone is trying to tell two failures apart."""
        _member_with_access(session)
        caplog.set_level(logging.WARNING)

        messages = set()
        for call in (
            lambda: _callback(anon_client, error="access_denied", state="s"),
            lambda: _callback(anon_client, state="s"),
            lambda: _callback(anon_client, code="c", state="never-issued"),
        ):
            caplog.clear()
            call()
            messages.add(caplog.text.strip())

        assert len(messages) == 3


def test_the_route_needs_no_token() -> None:
    from app.api.deps import public_routes
    from app.config import get_settings

    assert ("GET", ROUTE) in public_routes(get_settings())
