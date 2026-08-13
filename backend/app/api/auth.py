"""Authentication API endpoints — the APP-NATIVE session paths.

Sign-in against Prepper's own Supabase project, the Google/OAuth bridge, password recovery,
sign-out and user info. The email-first router and the Passport hosted-login handoff live in
``auth_passport.py``, mounted at the same prefix.

**D9: all three of the paths that can lead to an app-native session refuse an active Passport
member**, and the refusal is server-side rather than a decision the login page is trusted to make.
A member holding a legacy local password could otherwise reset it and sign in here, taking
Passport's MFA, session policy and revocation out of the loop entirely. Every one of those checks
is gated on :func:`gate.sso_active` (D11) — with the kill switch off none of them refuse, or the
break-glass branch would admit nobody, which is the opposite of a kill switch.
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.api import rate_limit
from app.api.deps import get_current_user, get_session
from app.config import get_settings
from app.domain.supabase_auth_service import get_auth_service
from app.domain.user_service import UserService
from app.models import (
    EMAIL_MAX_LENGTH,
    LoginRequest,
    LoginResponse,
    User,
    UserCreate,
    UserRead,
)
from app.passport import gate
from app.passport.identity import report_identity_link_safe

router = APIRouter()

logger = logging.getLogger(__name__)

# What an active member is told instead of being signed in. It names the remedy, because the user
# has done nothing wrong and the only useful thing to say is where their front door is.
_HOSTED_LOGIN_DETAIL = (
    "This account signs in through Passport. Use the hosted login instead of a password here."
)

# The ONE thing `/auth/password-reset` ever answers, on every branch. See the route.
_PASSWORD_RESET_ACCEPTED = (
    "If that address can sign in with a password, a reset link is on its way."
)


def _is_passport_member(session: Session, email: str) -> bool:
    """Does the hosted login own this address — and is the handoff actually switched on?

    D11 is the ``sso_active`` half: with the kill switch off this is False for everyone, so no
    endpoint refuses and the app behaves exactly as it did before Model 3. Both halves matter —
    a refusal that outlives the switch strands every member on a login they cannot use.

    Same helper as ``login_routing.resolve_login_route``'s, deliberately: the router's decision
    and the API's enforcement must be one implementation, or the UI and the server disagree and
    the disagreement is a bypass.

    The address needs no normalising here: ``is_active_member`` trims and lowercases internally,
    which is where that has to live — this helper is only one of its callers, and the routing
    decision goes through :func:`login_routing.resolve_login_route` instead.
    """
    return gate.sso_active(get_settings()) and gate.is_active_member(session, email)


def _refuse_active_member(session: Session, email: str) -> None:
    """403 an active member on an app-native session path (D9)."""
    if _is_passport_member(session, email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_HOSTED_LOGIN_DETAIL,
        )


class PasswordResetRequest(BaseModel):
    """Deliberately NOT ``EmailStr``, for the same reason as ``ResolveLoginRequest``.

    Rejecting a malformed address is a different answer for a different class of input, and this
    route exists precisely to have exactly one answer.
    """

    email: str = Field(max_length=EMAIL_MAX_LENGTH)


class PasswordResetResponse(BaseModel):
    """One field, one constant value — there is nothing here to read a decision out of."""

    message: str


@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> LoginResponse:
    """Sign in against PREPPER's own project — the ``app-native`` branch of the email-first router.

    The login-proxy that used to sit here is gone: it replayed the user's PASSPORT password through
    this backend, so a Prepper compromise harvested credentials valid for every app on the platform,
    and a non-interactive ``sign_in_with_password`` structurally cannot present MFA.

    D9 is the first thing that happens after the rate limit, ahead of even resolving the auth
    service: an active member must be refused whether or not Prepper's own project is configured,
    and a 503 would tell them to retry something that is never going to work for them.

    **The IP limit comes before D9**, because D9's own answer is the disclosure being bounded —
    403 for a member, 400 for everyone else, which is the same membership question
    ``/auth/resolve-login`` answers. Rate-limiting after it would leave the oracle readable right
    up to the refusal. The shared bucket also means this route is not a fresh allowance an
    enumerator can switch to mid-sweep. IP only, not email — see :func:`rate_limit.login_ip_limited`
    for why applying the email bucket here would be a targeted account-lockout DoS.
    """
    if rate_limit.login_ip_limited(rate_limit.client_ip(request)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again shortly.",
            headers={"Retry-After": str(rate_limit.LOGIN_WINDOW_SECONDS)},
        )

    _refuse_active_member(session, data.email)

    try:
        auth_service = get_auth_service()
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_service = UserService(session)

    try:
        auth_result = auth_service.login(data.email, data.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    # Get user from database
    user = user_service.get_user(auth_result["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database",
        )

    # Report the identity link to Passport (best-effort, no-op if unconfigured). Forwards the
    # end user's own token — Passport takes sub + email from the verified claims.
    report_identity_link_safe(auth_result["access_token"])

    return LoginResponse(
        user=UserRead.model_validate(user),
        access_token=auth_result["access_token"],
        refresh_token=auth_result["refresh_token"],
        expires_in=auth_result["expires_in"],
    )


@router.post("/oauth-complete", response_model=UserRead)
def oauth_complete(
    authorization: str | None = Header(None),
    session: Session = Depends(get_session),
) -> UserRead:
    """
    Complete an OAuth sign-in (e.g. Google via Supabase) by resolving or
    provisioning the local `users` row that corresponds to the Supabase user.

    Client flow: after `supabase.auth.exchangeCodeForSession(code)`, the
    browser holds a Supabase access_token. It calls this endpoint with
    `Authorization: Bearer <access_token>`. We verify the JWT, fetch the
    user's Supabase profile (email + `user_metadata`) and either return
    the existing DB row or create one seeded from the Google profile.

    A new row carries no role and no unit — Passport owns both, and they are read per-brand at
    the point of the check. Username is taken from `user_metadata.full_name`,
    `user_metadata.name`, or the email local-part — in that order.

    D9 applies here too, on BOTH exits. This is a fourth session-minting path and it consulted
    membership nowhere: a member who signed in with Google got an app-native session with no
    Passport session policy behind it, which is the same bypass the password path had. The check
    runs twice rather than once because the fast path deliberately never fetches the Supabase
    profile — hoisting it would put a network round trip on every already-provisioned sign-in.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.replace("Bearer ", "")

    try:
        auth_service = get_auth_service()
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_id = auth_service.verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_service = UserService(session)

    # Fast path: user already provisioned.
    existing = user_service.get_user(user_id)
    if existing:
        # `users.email` is safe to key on here only because `UserUpdate` refuses to set it — the
        # same property `deps._platform_user_for` already depends on. If it ever becomes writable,
        # this must resolve from the verified profile instead.
        _refuse_active_member(session, existing.email)
        report_identity_link_safe(token)
        return UserRead.model_validate(existing)

    # Fetch Supabase profile for email + Google-supplied metadata.
    try:
        info = auth_service.get_user_info(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    email = info.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider did not supply an email address",
        )

    _refuse_active_member(session, email)

    # Guard: a different Supabase user already owns this email locally.
    if user_service.get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    metadata = info.get("user_metadata") or {}
    username = (
        metadata.get("full_name")
        or metadata.get("name")
        or email.split("@", 1)[0]
    )

    try:
        user = user_service.create_user(
            UserCreate(
                id=user_id,
                email=email,
                username=username,
            )
        )
    except ValueError:
        # Race: someone else provisioned between our checks.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Report the identity link to Passport (best-effort, no-op if unconfigured). Forwards the
    # end user's own token — Passport takes sub + email from the verified claims.
    report_identity_link_safe(token)

    return UserRead.model_validate(user)


@router.post("/password-reset", response_model=PasswordResetResponse)
def password_reset(
    data: PasswordResetRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> PasswordResetResponse:
    """Start app-native password recovery — for the people who actually have one (D9).

    Recovery is a *precursor* to a session, so leaving it client-side reopens exactly the bypass
    the other two checks close: a member resets the legacy local password they still hold, then
    signs in around Passport with it.

    **The response BODY is byte-identical on every branch** — member, non-member, and an address
    this deployment has never seen. Anything else rebuilds, in the recovery flow, the enumeration
    oracle that ``/auth/resolve-login`` is carefully built to refuse; and it would be a *better*
    oracle, because the answer here is "is this person a Passport member" rather than merely "does
    this address exist". That is also why the send failure below is swallowed rather than
    surfaced: an error body is an answer, and this route has only one.

    **Body-identical is NOT timing-identical, and that is stated rather than implied.** Only the
    non-member branch makes the outbound mail call, so wall time still partitions the input space:
    a member's request returns measurably sooner. §6 property 6 asserts equal timing for the
    ROUTER, where both branches run the same single lookup — it does not extend to here, and
    closing this would mean either sending mail for a member (defeating the point) or faking the
    latency of a network call whose real duration varies anyway. Accepted, and written down so the
    next reader does not mistake the body guarantee for a total one.

    **It shares ``/auth/resolve-login``'s rate-limit buckets, deliberately.** The two routes are
    the same surface — unauthenticated, take an email, answer non-committally — so the ceilings
    must not be able to drift apart, and a shared key means an enumerator cannot buy a fresh
    allowance by switching routes half way through a sweep. The limit matters here for a second
    reason the router does not have: this route SENDS MAIL, so an unlimited version is a
    mail-bombing primitive pointed at whichever address the caller names.

    The 429 is raised before the membership lookup, so the limit cannot become the oracle either.
    """
    email = data.email.strip().lower()

    if rate_limit.login_route_limited(ip=rate_limit.client_ip(request), email=email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again shortly.",
            headers={"Retry-After": str(rate_limit.LOGIN_WINDOW_SECONDS)},
        )

    if not _is_passport_member(session, email):
        try:
            get_auth_service().send_password_recovery(email)
        except Exception as exc:  # noqa: BLE001 — a differing response IS the disclosure (above)
            # The exception TYPE only, never the message and never `exc_info`. GoTrue echoes the
            # address it rejected back in its error text, so the obvious `exc_info=True` would put
            # a named person into the log on the one route whose whole purpose is to name nobody.
            logger.warning(
                "password reset: recovery mail could not be sent (%s)", type(exc).__name__
            )

    return PasswordResetResponse(message=_PASSWORD_RESET_ACCEPTED)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(authorization: str | None = Header(None)) -> None:
    """
    Sign out the current user.

    Requires JWT in Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.replace("Bearer ", "")

    try:
        auth_service = get_auth_service()
        auth_service.logout(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except RuntimeError as exc:
        # Type only, never the message: `SupabaseAuthService.logout` wraps GoTrue's own error text
        # verbatim (`f"Supabase error: {e}"`), which on an auth route can carry the address or the
        # token that provoked it. This was a bare `print(e)` writing that to stdout.
        logger.warning("logout: auth service unavailable (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )


@router.get("/me", response_model=UserRead)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """
    Get current authenticated user's information.

    Requires JWT in Authorization header.
    """
    return UserRead.model_validate(current_user)
