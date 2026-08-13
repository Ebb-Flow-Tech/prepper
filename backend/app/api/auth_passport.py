"""The email-first login router and the Passport hosted-login handoff (Model 3, OAuth 2.1 + PKCE).

Mounted at the same prefix as ``auth.py``, which owns the app-native session paths. Split out
because this is one cohesive concern with one dominant rule of its own:

**No exit from ``/passport/*`` is anything but a redirect.** These routes are reached by top-level
browser navigation, never by fetch, so a raised exception, a JSON 429 or a JSON 403 does not surface
as an error the frontend can render — it surfaces as the entire page. That is why the rate limits are
checked in the handler bodies, why the D10 access refusal is a redirect rather than the 403 the
login-proxy returns, and why the callback wraps its fallible section in a catch-all.

That orchestration — redeem, exchange, verify, resolve, gate, link — now lives in
``app.passport.login_flow`` and hands back a :class:`~app.passport.login_flow.LoginOutcome`. What
is left here is exactly the part that has to be a router: the state cookie, the caps on untrusted
query parameters, and turning every outcome into a redirect.
"""

import logging
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.api import rate_limit
from app.api.deps import get_session
from app.config import Settings, get_settings
from app.models import EMAIL_MAX_LENGTH
from app.passport.gate import resolve_app_id, sso_active
from app.passport.login_flow import (
    ERROR_SSO_FAILED,
    ERROR_UNAVAILABLE,
    LoginOutcome,
    complete_passport_login,
)
from app.passport.login_routing import LoginRoute, resolve_login_route
from app.passport.pkce import ATTEMPT_TTL_SECONDS, generate_pkce_pair, store_verifier

router = APIRouter()

logger = logging.getLogger(__name__)

# Frontend routes, named because they are Next.js pages in another repo directory: renaming
# `app/login/page.tsx` or `app/auth/passport-callback/page.tsx` breaks these silently, with no type
# error and no failing import — the user just lands on a 404 at the end of a successful sign-in.
_FRONTEND_LOGIN_PATH = "/login"
_FRONTEND_CALLBACK_PATH = "/auth/passport-callback"

# RFC 6749 §4.1.2.1. Anything else is logged as a placeholder — see `_safe_error`.
_OAUTH_ERROR_CODES = frozenset(
    {
        "invalid_request",
        "unauthorized_client",
        "access_denied",
        "unsupported_response_type",
        "invalid_scope",
        "server_error",
        "temporarily_unavailable",
    }
)

# Caps on the untrusted query parameters. Each has its OWN reason, and they are not the same one —
# an earlier comment here claimed all three existed "because they reach a log line", which is false
# for two of them and would have justified dropping exactly the cap that is load-bearing:
#
# - `state` is `passport_login_attempt.state`, a varchar(128) this app generates itself, so a
#   longer value can only ever miss the lookup. Bounded to keep the DB parameter small.
# - `code` is NEVER logged. It is bounded because it is forwarded verbatim into the outbound JSON
#   body of the session exchange, so without a cap an attacker sizes a request this app makes.
# - `error` is bounded because it is the one that genuinely does reach a log line.
#
# Enforced by `_capped` INSIDE the handler, deliberately not by `Query(max_length=...)` — see its
# docstring. A framework-level cap would answer a violation with a 422 JSON body, which is the one
# thing no `/passport/*` path may do.
_STATE_MAX_LENGTH = 128
_CODE_MAX_LENGTH = 512
_OAUTH_ERROR_MAX_LENGTH = 64

# The login-CSRF binding (spec §6). Public because the tests assert on it by name, and because a
# renamed cookie silently invalidates every in-flight login rather than failing loudly.
STATE_COOKIE_NAME = "prepper_passport_state"


class ResolveLoginRequest(BaseModel):
    """Deliberately NOT ``EmailStr``.

    Rejecting a malformed address ahead of the routing decision is a different answer for a
    different class of input — a THIRD route in everything but name, and still an oracle. The
    length cap does the bounding that validation would otherwise be doing — and it bounds the
    in-memory rate-limiter key derived from the address, not merely the field.
    """

    email: str = Field(max_length=EMAIL_MAX_LENGTH)


class ResolveLoginResponse(BaseModel):
    """The routing decision and nothing else — every extra field is disclosure.

    Declared here rather than in ``app.models`` because it names ``LoginRoute``, which lives in
    the passport layer: ``app.models.auth`` importing it would make the model package import
    ``app.passport``, which imports ``app.models`` — a circular import at startup.
    """

    route: LoginRoute


def _state_cookie_is_secure(settings: Settings) -> bool:
    """``Secure`` everywhere except local development.

    Derived from ``debug`` — the same switch that decides whether the docs routes are mounted —
    rather than hardcoded on. A ``Secure`` cookie is simply not stored over plain HTTP, so
    hardcoding it makes every localhost login fail the state check with no clue as to why.
    """
    return not settings.debug


def _set_state_cookie(response: RedirectResponse, settings: Settings, state: str) -> None:
    """Bind this sign-in attempt to THIS browser (spec §6, login CSRF).

    ``SameSite=Lax``, **never** ``Strict``: the callback arrives as a cross-site top-level redirect
    from Passport, and ``Strict`` withholds the cookie on precisely that navigation. The
    safer-looking value breaks every login, and breaks it *after* the user has authenticated.

    ``HttpOnly`` because nothing in the browser needs to read it, and script that could read it
    could forge the binding this exists to prove.
    """
    response.set_cookie(
        STATE_COOKIE_NAME,
        state,
        max_age=ATTEMPT_TTL_SECONDS,
        httponly=True,
        secure=_state_cookie_is_secure(settings),
        samesite="lax",
        path="/",
    )


def _clear_state_cookie(response: RedirectResponse, settings: Settings) -> None:
    """Drop the binding. Called on EVERY terminal outcome, success included.

    A value that outlives its attempt is a value that can authorise a later one it was never
    issued for — which is the hole this whole mechanism closes, reopened one flow later.

    The attributes must match those used to set it, or the browser treats it as a different cookie
    and silently keeps the original.
    """
    response.delete_cookie(
        STATE_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_state_cookie_is_secure(settings),
        samesite="lax",
    )


def _login_error_redirect(settings: Settings, code: str) -> RedirectResponse:
    """Every ``/auth/passport/*`` refusal, in the only form these routes may answer in.

    ``frontend_url`` unset degrades to a relative path rather than the string ``"None/login"``. It
    is a misconfiguration either way, but one of them lands somewhere.

    Clears the state cookie, because every refusal is terminal — including the ones raised by
    ``/passport/start`` itself, where an attempt that never began must not leave a binding behind.
    """
    base = (settings.frontend_url or "").rstrip("/")
    response = RedirectResponse(f"{base}{_FRONTEND_LOGIN_PATH}?error={code}")
    _clear_state_cookie(response, settings)
    return response


def _capped(value: str | None, limit: int, *, name: str) -> str | None:
    """Bound an untrusted query parameter WITHOUT ever refusing the request.

    ``Query(max_length=...)`` would be tidier and is the obvious reach, but FastAPI answers a
    violation with a 422 JSON body — and no ``/passport/*`` path may answer in JSON at all. These
    routes are reached by top-level browser navigation, so that blob renders as the whole login
    page. An over-long parameter arrives only in a hand-crafted URL, which is precisely what an
    attacker sends a victim: the one door left open is the one that gets used, and what comes
    through it is the exact user-visible failure the redirect-only rule exists to prevent.

    Truncating keeps that rule unconditional, which is most of its value — it can be checked by
    inspection, with no per-exit judgement call about whether this one qualifies. Nothing is lost:
    a truncated ``state`` simply misses the lookup and fails through the normal path to
    ``passport_sso_failed``, which is the correct answer for an unknown state anyway.

    **The log line is not decoration.** Silent truncation is survivable for a hand-crafted URL and
    catastrophic for a real one: if Passport ever issues an authorization code longer than the cap,
    EVERY login fails as ``passport_sso_failed`` and the only line written says the session-exchange
    request failed — pointing the investigation at the network, at Passport, at anything except the
    constant that actually did it. The parameter is named; its value never is (``code`` and
    ``state`` are secrets, and ``error`` is attacker-authored — see ``_safe_error``).
    """
    if value is None or len(value) <= limit:
        return value
    logger.warning(
        "passport callback: %s truncated at %d octets — if this is a genuine Passport value, "
        "raise the cap; the sign-in will otherwise fail as an exchange error",
        name,
        limit,
    )
    return value[:limit]


def _safe_error(error: str) -> str:
    """The OAuth error code, or a placeholder — never the caller's own string.

    This route is in ``public_routes``, so ``error`` is attacker-controlled: a ``%0A`` in it forges
    whole log entries, which turns the log from evidence into something that cannot be trusted at
    exactly the moment it is being read. An earlier version logged the value verbatim behind a
    comment claiming it was "Passport-defined, not free text" — it is not, because Passport is not
    the only thing that can reach this URL.
    """
    return error if error in _OAUTH_ERROR_CODES else "unrecognised"


@router.post("/resolve-login", response_model=ResolveLoginResponse)
def resolve_login(
    data: ResolveLoginRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> ResolveLoginResponse:
    """Where does this address sign in? Unauthenticated — it runs before anyone has a session.

    Both branches perform the SAME single membership lookup, so the response time does not
    partition the input space that the two-valued body refuses to. That is a property of
    ``resolve_login_route`` having one code path, not of anything this handler does.

    Both rate-limit buckets are checked in the body rather than as a dependency: the email key can
    only be derived from the parsed payload, so a dependency could key on the IP alone.
    """
    email = data.email.strip().lower()
    if rate_limit.login_route_limited(ip=rate_limit.client_ip(request), email=email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again shortly.",
            headers={"Retry-After": str(rate_limit.LOGIN_WINDOW_SECONDS)},
        )

    return ResolveLoginResponse(
        route=resolve_login_route(session, email, sso_active=sso_active(get_settings()))
    )


@router.get("/passport/start")
def passport_login_start(
    request: Request,
    session: Session = Depends(get_session),
) -> RedirectResponse:
    """Hand off to Passport's hosted login: ``302 {dashboard}/authorize`` with a PKCE challenge.

    Every exit is a redirect, including the catch-all below — Prepper's addition, since
    ``geddit-one`` wraps nothing here and a database that is briefly gone surfaces there as a raw
    JSON error rendered as the whole login page.

    The IP bucket is checked here rather than as a dependency for the same reason: a dependency's
    ``HTTPException`` is a JSON 429. It also bounds the unauthenticated row this handler writes on
    every hit — ``passport_login_attempt`` has no sweeper, and stale rows are harmless only while
    the write volume is bounded.
    """
    settings = get_settings()

    if rate_limit.passport_start_limited(rate_limit.client_ip(request)):
        logger.warning("passport start: refused — rate limit exceeded")
        return _login_error_redirect(settings, ERROR_UNAVAILABLE)

    try:
        app_id = resolve_app_id(session)
        if app_id is None:
            logger.warning(
                "passport start: refused — no app id in the entitlement projection "
                "(Passport sync has not landed for any org)"
            )
            return _login_error_redirect(settings, ERROR_UNAVAILABLE)
        if not settings.passport_dashboard_url or not settings.sso_callback_url:
            logger.warning(
                "passport start: refused — PASSPORT_DASHBOARD_URL/SSO_CALLBACK_URL not configured"
            )
            return _login_error_redirect(settings, ERROR_UNAVAILABLE)

        verifier, challenge, state = generate_pkce_pair()
        store_verifier(session, state=state, verifier=verifier)
    except Exception:
        # `exc_info=True` is safe ONLY because the engine sets `hide_parameters=True`
        # (`app/database.py`). Without it, a failed INSERT here writes the code_verifier into the
        # log via `StatementError.__str__`.
        logger.warning("passport start: refused — could not begin the attempt", exc_info=True)
        return _login_error_redirect(settings, ERROR_UNAVAILABLE)

    params = {
        "client_id": app_id,
        "redirect_uri": settings.sso_callback_url,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    response = RedirectResponse(
        f"{settings.passport_dashboard_url.rstrip('/')}/authorize?{urlencode(params)}"
    )
    # The state goes out in TWO places, and both are needed (spec §6). The row proves Prepper
    # issued this state and carries the verifier; the cookie proves it was issued to THIS browser.
    # Without the cookie an attacker runs this route themselves and feeds their own genuine
    # `code` + `state` to a victim's browser, silently signing the victim in AS THE ATTACKER — so
    # every recipe and supplier price the victim then enters lands in the attacker's tenant.
    _set_state_cookie(response, settings, state)
    return response


def _session_redirect(settings: Settings, outcome: LoginOutcome) -> RedirectResponse:
    """Carry a minted session to the frontend callback page.

    A FRAGMENT, not a query string: it is never sent to a server, so the session cannot land in
    an access log or a Referer header on the way to the callback page. Nothing fallible may follow
    the mint — a failure after the tokens exist would hide a session that already exists — which is
    why this does no work beyond formatting a URL and setting one header.
    """
    fragment = urlencode(
        {"access_token": outcome.access_token, "refresh_token": outcome.refresh_token}
    )
    base = (settings.frontend_url or "").rstrip("/")
    response = RedirectResponse(f"{base}{_FRONTEND_CALLBACK_PATH}#{fragment}")
    # Success is terminal too. The attempt is spent, so the binding must not survive to be replayed
    # against a later one. (`delete_cookie` only sets a header — it cannot fail after the tokens.)
    _clear_state_cookie(response, settings)
    return response


@router.get("/passport/callback")
def passport_login_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: Session = Depends(get_session),
) -> RedirectResponse:
    """Exchange a Passport hosted-login code for a Prepper session (Model 3).

    **Every refusal is a redirect**, carrying one of three codes and no detail. The caller learns
    only the category; which check failed is server-side, in this module's log lines — one per
    branch, because a shared line makes the search unsplittable exactly when someone is trying to
    tell two failures apart. No email and no token is ever logged (`security.md`).
    """
    settings = get_settings()

    # Bounded here rather than by the framework, so that no input can make this route answer with
    # anything but a redirect. See `_capped`.
    code = _capped(code, _CODE_MAX_LENGTH, name="code")
    state = _capped(state, _STATE_MAX_LENGTH, name="state")
    error = _capped(error, _OAUTH_ERROR_MAX_LENGTH, name="error")

    if error:
        logger.warning("passport callback: refused — Passport returned error=%s", _safe_error(error))
        return _login_error_redirect(settings, ERROR_SSO_FAILED)

    if not code or not state:
        logger.warning("passport callback: refused — missing code and/or state")
        return _login_error_redirect(settings, ERROR_SSO_FAILED)

    # The login-CSRF binding (spec §6), checked BEFORE `pop_verifier` — deliberately.
    #
    # Redeeming first would let an attacker burn a victim's in-flight attempt simply by making
    # their browser load this URL: the row would be gone, and the victim's own tab would then fail
    # with an unknown state. Refusing first turns that denial of service into a no-op.
    #
    # `compare_digest` because this is a secret-equality test, and the timing of a byte-wise `==`
    # leaks a prefix to anyone who can retry.
    #
    # Compared as BYTES, not str. `compare_digest` raises TypeError on a str containing any
    # non-ASCII character, and BOTH operands are attacker-reachable: `?state=st%C3%A9` reaches it
    # directly, and Starlette decodes cookie headers as latin-1 so a raw client can put non-ASCII
    # in the cookie too. This line sits outside the try below, so that TypeError was an uncaught
    # 500 — rendered, on this route, as the victim's entire login page. Exactly the failure
    # `_capped` exists to prevent, reached through a different door.
    cookie_state = request.cookies.get(STATE_COOKIE_NAME)
    if not cookie_state or not secrets.compare_digest(
        cookie_state.encode("utf-8"), state.encode("utf-8")
    ):
        logger.warning(
            "passport callback: refused — state not bound to this browser (cookie %s)",
            "missing" if not cookie_state else "mismatched",
        )
        return _login_error_redirect(settings, ERROR_SSO_FAILED)

    try:
        outcome = complete_passport_login(session, settings, code=code, state=state)
        if outcome.error_code is not None:
            return _login_error_redirect(settings, outcome.error_code)
        return _session_redirect(settings, outcome)
    except HTTPException:
        # Re-raised, never swallowed. Nothing below raises one today; the guard exists so that
        # turning a future refusal from `return _login_error_redirect(...)` into a `raise` cannot
        # be silently rewritten into this generic one, losing both its status and its own code.
        raise
    except Exception:
        # A raised exception on this route renders as the whole login page. `exc_info=True` is safe
        # ONLY because the engine sets `hide_parameters=True` (`app/database.py`): this section
        # runs `ensure_user`'s `INSERT INTO users (..., email, ...)`, so without it a failure here
        # writes a member's address into the log.
        logger.warning(
            "passport callback: refused — the sign-in could not be completed", exc_info=True
        )
        return _login_error_redirect(settings, ERROR_SSO_FAILED)
