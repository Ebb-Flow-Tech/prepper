"""D9 — the routing decision is enforced by the API, not merely rendered by the login page.

Three paths can end in an app-native session: `/auth/login`, `/auth/oauth-complete`, and
`/auth/password-reset`, which is a *precursor* to one. A member who still holds a legacy local
password can otherwise reset it and sign in around Passport entirely, taking its MFA, its session
policy and its revocation out of the loop — and the front end refusing to offer them the password
field is not a control, because nothing stops a client posting to the endpoint directly.

D11 is the other half and is asserted just as hard: every one of these refusals is gated on
`sso_active`, so with the kill switch off none of them fire. A break-glass branch that admits
nobody is not a kill switch.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.passport import store
from tests.conftest import ORG_ID, create_user, sso_settings

MEMBER_EMAIL = "chef@brand.test"
STRANGER_EMAIL = "stranger@elsewhere.test"
UNKNOWN_EMAIL = "nobody@nowhere.test"

LOCAL_USER_ID = "u-local"

LOGIN = "/api/v1/auth/login"
OAUTH_COMPLETE = "/api/v1/auth/oauth-complete"
PASSWORD_RESET = "/api/v1/auth/password-reset"


def _member(session: Session, email: str = MEMBER_EMAIL) -> None:
    store.apply_membership(
        session,
        {
            "id": "m-1",
            "organization_id": ORG_ID,
            "platform_user_id": "pu-1",
            "role": "Member",
            "status": "active",
            "version": 1,
            "email": email,
            "display_name": "Chef",
        },
    )


class _RecordingAuthService:
    """Enough of `SupabaseAuthService` for these three routes, and a record of what was asked."""

    def __init__(self, *, email: str = STRANGER_EMAIL) -> None:
        self.recovery_sent: list[str] = []
        self._email = email

    def login(self, email: str, password: str) -> dict:
        return {
            "user_id": LOCAL_USER_ID,
            "access_token": "at",
            "refresh_token": "rt",
            "expires_in": 3600,
        }

    def verify_token(self, token: str) -> str:
        return LOCAL_USER_ID

    def get_user_info(self, token: str) -> dict:
        return {"user_id": LOCAL_USER_ID, "email": self._email, "user_metadata": {}}

    def send_password_recovery(self, email: str) -> None:
        self.recovery_sent.append(email)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    """`/auth/password-reset` shares the login buckets, and `_hits` is process-global.

    Module-scoped rather than on the rate-limit class alone: without it the OTHER password-reset
    tests here silently spend the shared allowance between them — `STRANGER_EMAIL` already lands
    on the email bucket's limit of 5 across this file — so adding one assertion anywhere would
    start 429-ing an unrelated test, in an order-dependent way that reads as a flake.
    """
    from app.api import rate_limit

    rate_limit._reset_for_tests()
    yield
    rate_limit._reset_for_tests()


@pytest.fixture(name="auth_service")
def auth_service_fixture():
    service = _RecordingAuthService()
    with patch("app.api.auth.get_auth_service", return_value=service):
        yield service


def _sso(active: bool = True):
    """Patch the settings `app.api.auth` reads — `sso_active` is flag AND Passport's project URL."""
    return patch(
        "app.api.auth.get_settings",
        return_value=sso_settings(sso_enabled=active),
    )


# =============================================================================
# POST /auth/login
# =============================================================================


class TestLogin:
    def test_an_active_member_is_refused_and_pointed_at_hosted_login(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        _member(session)
        with _sso():
            response = anon_client.post(
                LOGIN, json={"email": MEMBER_EMAIL, "password": "whatever"}
            )

        assert response.status_code == 403
        assert "passport" in response.json()["detail"].lower()

    def test_the_refusal_precedes_the_password_check(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """A member must be refused whether or not the credentials would have worked, and whether
        or not Prepper's own project is even configured — a 503 would tell them to retry something
        that is never going to succeed for them."""
        _member(session)
        with (
            _sso(),
            patch(
                "app.api.auth.get_auth_service",
                side_effect=ValueError("Supabase credentials not configured"),
            ),
        ):
            response = anon_client.post(LOGIN, json={"email": MEMBER_EMAIL, "password": "pw"})

        assert response.status_code == 403, "not the 503 an unconfigured service would give"

    def test_a_non_member_still_signs_in(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        _member(session)  # someone else is a member; this caller is not
        create_user(session, LOCAL_USER_ID, "stranger", email=STRANGER_EMAIL)

        with _sso():
            response = anon_client.post(LOGIN, json={"email": STRANGER_EMAIL, "password": "pw"})

        assert response.status_code == 200

    def test_the_kill_switch_admits_the_member_again(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """D11. With SSO off the router sends everyone `app-native`, so a refusal here would
        strand every member on a login the deployment no longer offers."""
        _member(session)
        create_user(session, LOCAL_USER_ID, "chef", email=MEMBER_EMAIL)

        with _sso(active=False):
            response = anon_client.post(LOGIN, json={"email": MEMBER_EMAIL, "password": "pw"})

        assert response.status_code == 200


# =============================================================================
# POST /auth/oauth-complete — the fourth session-minting path
# =============================================================================


class TestOauthComplete:
    """It consulted membership NOWHERE: a member signing in with Google got an app-native session
    with no Passport session policy behind it — the password bypass, via a different door."""

    def test_an_already_provisioned_member_is_refused(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        _member(session)
        create_user(session, LOCAL_USER_ID, "chef", email=MEMBER_EMAIL)

        with _sso():
            response = anon_client.post(
                OAUTH_COMPLETE, headers={"Authorization": "Bearer google"}
            )

        assert response.status_code == 403

    def test_a_member_with_no_local_row_yet_is_refused_before_provisioning(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """The check has to exist on BOTH exits. The fast path never fetches the Supabase profile,
        so the provisioning path is the only one that knows the verified email — and it is exactly
        the path a member signing in for the first time takes."""
        from app.models import User

        _member(session)
        service = _RecordingAuthService(email=MEMBER_EMAIL)
        with _sso(), patch("app.api.auth.get_auth_service", return_value=service):
            response = anon_client.post(
                OAUTH_COMPLETE, headers={"Authorization": "Bearer google"}
            )

        assert response.status_code == 403
        assert session.get(User, LOCAL_USER_ID) is None, "refused, and provisioned nothing"

    def test_a_non_member_still_completes(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        _member(session)
        with _sso():
            response = anon_client.post(
                OAUTH_COMPLETE, headers={"Authorization": "Bearer google"}
            )

        assert response.status_code == 200
        assert response.json()["email"] == STRANGER_EMAIL

    def test_the_kill_switch_admits_the_member_again(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        _member(session)
        create_user(session, LOCAL_USER_ID, "chef", email=MEMBER_EMAIL)

        with _sso(active=False):
            response = anon_client.post(
                OAUTH_COMPLETE, headers={"Authorization": "Bearer google"}
            )

        assert response.status_code == 200


# =============================================================================
# POST /auth/password-reset
# =============================================================================


class TestPasswordReset:
    def test_the_response_is_identical_for_member_non_member_and_unknown_address(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """The property that matters most here, and the reason the route exists at all.

        `/auth/resolve-login` is carefully built to refuse this oracle; rebuilding it in the
        recovery flow would give an attacker a BETTER one, because the question answered here is
        "is this address a Passport member", not merely "does it exist".
        """
        _member(session)
        create_user(session, LOCAL_USER_ID, "stranger", email=STRANGER_EMAIL)

        with _sso():
            answers = {
                email: anon_client.post(PASSWORD_RESET, json={"email": email})
                for email in (MEMBER_EMAIL, STRANGER_EMAIL, UNKNOWN_EMAIL)
            }

        distinct = {(r.status_code, r.content) for r in answers.values()}
        assert len(distinct) == 1, f"the response partitions the input space: {answers}"
        assert next(iter(distinct))[0] == 200

    def test_recovery_mail_goes_only_to_a_non_member(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        _member(session)
        with _sso():
            anon_client.post(PASSWORD_RESET, json={"email": MEMBER_EMAIL})
            anon_client.post(PASSWORD_RESET, json={"email": STRANGER_EMAIL})

        assert auth_service.recovery_sent == [STRANGER_EMAIL]

    def test_the_kill_switch_sends_recovery_mail_to_a_member_again(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """D11. With SSO off a member's only way in is the local password, so recovery must work
        for them — otherwise the break-glass branch cannot be broken into."""
        _member(session)
        with _sso(active=False):
            anon_client.post(PASSWORD_RESET, json={"email": MEMBER_EMAIL})

        assert auth_service.recovery_sent == [MEMBER_EMAIL]

    def test_a_send_failure_does_not_change_the_response(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """An error body is an answer, and this route has only one. A GoTrue outage must not
        become a signal about which addresses it was asked about."""
        _member(session)
        healthy = _RecordingAuthService()
        broken = _RecordingAuthService()
        broken.send_password_recovery = lambda _e: (_ for _ in ()).throw(  # type: ignore[method-assign]
            RuntimeError("gotrue is down")
        )

        with _sso(), patch("app.api.auth.get_auth_service", return_value=healthy):
            ok = anon_client.post(PASSWORD_RESET, json={"email": STRANGER_EMAIL})
        with _sso(), patch("app.api.auth.get_auth_service", return_value=broken):
            failed = anon_client.post(PASSWORD_RESET, json={"email": STRANGER_EMAIL})

        assert (ok.status_code, ok.content) == (failed.status_code, failed.content)

    def test_no_address_reaches_the_log_when_a_send_fails(
        self, anon_client: TestClient, session: Session, caplog
    ) -> None:
        """`security.md`: no PII in logs. The obvious `exc_info=True` would put the address there,
        because GoTrue echoes the one it rejected back in its error text."""
        import logging

        broken = _RecordingAuthService()
        broken.send_password_recovery = lambda e: (_ for _ in ()).throw(  # type: ignore[method-assign]
            RuntimeError(f"Unable to validate email address: {e}")
        )

        caplog.set_level(logging.WARNING)
        with _sso(), patch("app.api.auth.get_auth_service", return_value=broken):
            anon_client.post(PASSWORD_RESET, json={"email": STRANGER_EMAIL})

        assert caplog.text, "a swallowed failure with no log line is invisible"
        assert STRANGER_EMAIL not in caplog.text

    def test_an_over_long_address_is_refused_before_the_lookup(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """Capped at RFC 5321's 320 octets, the same bound `/auth/resolve-login` uses. A 422 for a
        400-octet string is not an oracle: no real address can reach it."""
        with _sso():
            response = anon_client.post(
                PASSWORD_RESET, json={"email": "a" * 300 + "@" + "b" * 30 + ".test"}
            )

        assert response.status_code == 422

    def test_the_route_needs_no_token(self) -> None:
        from app.api.deps import public_routes
        from app.config import get_settings

        assert ("POST", PASSWORD_RESET) in public_routes(get_settings())


def test_whitespace_around_the_address_does_not_evade_the_refusal(
    anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
) -> None:
    """A leading space must not be a bypass.

    `is_active_member` lowercases both sides, so case was already handled — but nothing trimmed,
    and GoTrue normalises the address before authenticating. A member posting `" chef@..."` would
    therefore miss the membership lookup here and still sign in successfully, which is the exact
    control D9 exists to be. Normalisation lives in `_is_passport_member`, so no call site can
    forget it.
    """
    _member(session)
    with _sso():
        for variant in (f" {MEMBER_EMAIL}", f"{MEMBER_EMAIL} ", MEMBER_EMAIL.upper()):
            response = anon_client.post(LOGIN, json={"email": variant, "password": "pw"})
            assert response.status_code == 403, variant


class TestPasswordResetIsRateLimited:
    """`security.md` requires a limit on unauthenticated, enumeration-adjacent routes — and this
    one also SENDS MAIL, so an unlimited version is a mail-bombing primitive aimed at whichever
    address the attacker names. That is the worse of the two risks.

    It shares `/auth/resolve-login`'s buckets DELIBERATELY. The two routes are the same surface
    (unauthenticated, take an email, answer non-committally), so the ceilings should not be able
    to drift apart — and a shared key means an attacker sweeping addresses cannot buy a fresh
    allowance by switching routes half way through.
    """

    def test_the_email_bucket_refuses_the_sixth_attempt(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        from app.api.rate_limit import LOGIN_ROUTE_EMAIL_PER_MINUTE

        with _sso():
            codes = [
                anon_client.post(
                    PASSWORD_RESET,
                    json={"email": STRANGER_EMAIL},
                    # A fresh IP each time, so the EMAIL bucket is what bites.
                    headers={"Fly-Client-IP": f"10.0.0.{n}"},
                ).status_code
                for n in range(LOGIN_ROUTE_EMAIL_PER_MINUTE + 1)
            ]

        assert codes[:-1] == [200] * LOGIN_ROUTE_EMAIL_PER_MINUTE
        assert codes[-1] == 429
        assert len(auth_service.recovery_sent) == LOGIN_ROUTE_EMAIL_PER_MINUTE

    def test_the_ip_bucket_refuses_the_eleventh_attempt(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        from app.api.rate_limit import LOGIN_ROUTE_IP_PER_MINUTE

        with _sso():
            codes = [
                anon_client.post(
                    PASSWORD_RESET,
                    # A fresh address each time, so the IP bucket is what bites.
                    json={"email": f"user{n}@elsewhere.test"},
                    headers={"Fly-Client-IP": "10.0.0.1"},
                ).status_code
                for n in range(LOGIN_ROUTE_IP_PER_MINUTE + 1)
            ]

        assert codes[-1] == 429

    def test_the_bucket_is_shared_with_resolve_login(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """Switching routes must not buy a fresh allowance. Spend the IP bucket on
        `/auth/resolve-login`, then find `/auth/password-reset` already closed."""
        from app.api.rate_limit import LOGIN_ROUTE_IP_PER_MINUTE

        headers = {"Fly-Client-IP": "10.0.0.7"}
        with _sso():
            for n in range(LOGIN_ROUTE_IP_PER_MINUTE):
                anon_client.post(
                    "/api/v1/auth/resolve-login",
                    json={"email": f"user{n}@elsewhere.test"},
                    headers=headers,
                )
            spillover = anon_client.post(
                PASSWORD_RESET, json={"email": STRANGER_EMAIL}, headers=headers
            )

        assert spillover.status_code == 429
        assert auth_service.recovery_sent == [], "refused before any mail was sent"

    def test_the_refusal_still_reveals_nothing(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """A 429 must arrive for a member and a stranger alike, or the limit itself becomes the
        oracle the route is built to refuse."""
        _member(session)
        from app.api.rate_limit import LOGIN_ROUTE_IP_PER_MINUTE

        headers = {"Fly-Client-IP": "10.0.0.9"}
        answers = {}
        with _sso():
            for email in (MEMBER_EMAIL, STRANGER_EMAIL):
                for _ in range(LOGIN_ROUTE_IP_PER_MINUTE + 1):
                    response = anon_client.post(
                        PASSWORD_RESET, json={"email": email}, headers=headers
                    )
                answers[email] = (response.status_code, response.content)

        assert answers[MEMBER_EMAIL] == answers[STRANGER_EMAIL]
        assert answers[MEMBER_EMAIL][0] == 429


class TestLoginIsRateLimited:
    """`/auth/login` answers 403 for a member and 400 for everyone else, so it makes the same
    membership disclosure `/auth/resolve-login` deliberately makes. Not a new leak in class — but
    an UNLIMITED one, which made it the fresh allowance an enumerator buys by switching routes,
    the exact thing the shared bucket exists to prevent.

    IP bucket only, deliberately — see `test_a_mistyped_password_does_not_lock_the_account_out`.
    """

    def test_the_ip_bucket_is_shared_with_the_rest_of_the_front_door(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """Spend the allowance on `/auth/resolve-login`, then find `/auth/login` already closed."""
        from app.api.rate_limit import LOGIN_ROUTE_IP_PER_MINUTE

        _member(session)
        headers = {"Fly-Client-IP": "10.0.0.3"}
        with _sso():
            for n in range(LOGIN_ROUTE_IP_PER_MINUTE):
                anon_client.post(
                    "/api/v1/auth/resolve-login",
                    json={"email": f"user{n}@elsewhere.test"},
                    headers=headers,
                )
            spillover = anon_client.post(
                LOGIN, json={"email": MEMBER_EMAIL, "password": "pw"}, headers=headers
            )

        assert spillover.status_code == 429

    def test_the_sweep_is_bounded(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        from app.api.rate_limit import LOGIN_ROUTE_IP_PER_MINUTE

        _member(session)
        headers = {"Fly-Client-IP": "10.0.0.4"}
        with _sso():
            codes = [
                anon_client.post(
                    LOGIN,
                    json={"email": f"user{n}@elsewhere.test", "password": "pw"},
                    headers=headers,
                ).status_code
                for n in range(LOGIN_ROUTE_IP_PER_MINUTE + 1)
            ]

        assert codes[-1] == 429

    def test_the_limit_precedes_the_membership_check(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """A 429 must arrive for a member and a stranger alike, or the limit becomes the oracle
        the limit was added to bound."""
        from app.api.rate_limit import LOGIN_ROUTE_IP_PER_MINUTE

        _member(session)
        headers = {"Fly-Client-IP": "10.0.0.5"}
        answers = {}
        with _sso():
            for email in (MEMBER_EMAIL, STRANGER_EMAIL):
                for _ in range(LOGIN_ROUTE_IP_PER_MINUTE + 1):
                    response = anon_client.post(
                        LOGIN, json={"email": email, "password": "pw"}, headers=headers
                    )
                answers[email] = (response.status_code, response.content)

        assert answers[MEMBER_EMAIL] == answers[STRANGER_EMAIL]
        assert answers[MEMBER_EMAIL][0] == 429

    def test_a_mistyped_password_does_not_lock_the_account_out(
        self, anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
    ) -> None:
        """Why the EMAIL bucket is deliberately not applied here.

        It is 5/minute and shared with `/auth/resolve-login`, so adding it would mean (a) a real
        user fumbling their password six times is locked out of their own account, and worse (b)
        an attacker could burn any chosen victim's allowance from anywhere, unauthenticated and
        without a password, purely by posting that address to `/auth/resolve-login` — turning a
        rate limit into a targeted account-lockout DoS. That is the same trap the IP
        short-circuit inside `login_route_limited` already documents.

        The IP bucket bounds the sweep, which is the thing actually being defended against.
        """
        from app.api.rate_limit import LOGIN_ROUTE_EMAIL_PER_MINUTE

        create_user(session, LOCAL_USER_ID, "stranger", email=STRANGER_EMAIL)
        with _sso():
            for _ in range(LOGIN_ROUTE_EMAIL_PER_MINUTE + 1):
                anon_client.post(
                    "/api/v1/auth/resolve-login", json={"email": STRANGER_EMAIL}
                )
            after = anon_client.post(
                LOGIN, json={"email": STRANGER_EMAIL, "password": "pw"}
            )

        assert after.status_code == 200, "burning the email bucket must not bar the owner"


def test_an_over_long_email_is_capped_like_every_other_front_door_route(
    anon_client: TestClient, session: Session, auth_service: _RecordingAuthService
) -> None:
    """`EMAIL_MAX_LENGTH`'s docstring says it is shared by every unauthenticated route that takes
    an address. `LoginRequest` was the one that made that untrue: a 5000-octet string reached the
    membership lookup and came back 400 rather than 422."""
    with _sso():
        response = anon_client.post(
            LOGIN, json={"email": "a" * 5000 + "@x.test", "password": "pw"}
        )

    assert response.status_code == 422
