"""Shared dependencies for API routes."""

import logging
from collections.abc import Generator
from typing import NamedTuple

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.config import Settings, get_settings
from app.database import engine
from app.domain.supabase_auth_service import get_auth_service
from app.domain.user_service import UserService
from app.models import PassportMembership, User
from app.passport import access
from app.passport.access import is_org_blocked


def get_session() -> Generator[Session, None, None]:
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session


def get_bearer_token(authorization: str | None = Header(None)) -> str:
    """The caller's raw Supabase access token.

    Needed for Passport write-back, which forwards the END USER's own JWT (``X-End-User-Token``)
    so the acting user is proved rather than asserted. Never log this value.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return authorization.replace("Bearer ", "")


def _is_active_member(session: Session, email: str) -> bool:
    """Whether a verified email belongs to an ACTIVE Passport member in the projection.

    Gates SSO-login provisioning: Passport's shared issuer can sign tokens for people who are not
    Prepper members, so a local account is only minted for someone Passport already knows as a
    member here — never for an arbitrary verified email.
    """
    return (
        session.exec(
            select(PassportMembership).where(
                func.lower(PassportMembership.email) == email.lower(),
                PassportMembership.status == "active",
            )
        ).first()
        is not None
    )


def resolve_or_provision_passport_user(
    session: Session, sub: str, email: str
) -> User | None:
    """Map a verified PASSPORT identity onto the local ``users`` row (P3 §5.2).

    Resolves an existing user by the **verified email** — Passport's ``sub`` is not this app's sub,
    and ``platform_user.supabase_id`` is never synced, so email is the only key a consumer holds. If
    no local row exists, provisions one keyed by the Passport ``sub`` — but ONLY for an active
    member, so a valid Passport token for a non-member never mints a local account. Returns ``None``
    when the email is not an active member.

    Shared by BOTH the request-verify path (:func:`get_current_user`) and the SSO login-proxy
    (``/login``) so the two can never drift — a divergence here is an auth bug.
    """
    matches = session.exec(
        select(User).where(func.lower(User.email) == email.lower())
    ).all()
    if len(matches) > 1:
        # `users.email` is case-sensitive-unique with no write-time normalisation, so case-variant
        # rows (`Chef@x` / `chef@x`) can coexist. On a token-minting path we must NOT map to an
        # arbitrary one — fail closed and let the caller 403. TODO: a case-insensitive unique index
        # (citext) + write-time lowercasing makes this unreachable; then collapse back to one row.
        logging.getLogger(__name__).warning(
            "resolve_or_provision: ambiguous case-variant email match (count=%d)", len(matches)
        )
        return None
    if matches:
        return matches[0]
    if _is_active_member(session, email):
        return UserService(session).ensure_user(sub, email, email.split("@", 1)[0])
    return None


def public_routes(settings: Settings) -> frozenset[tuple[str, str]]:
    """The ONLY routes reachable without a JWT. Everything else is denied by default.

    Built from ``settings.api_v1_prefix`` rather than hardcoded: the prefix is a live env knob
    (``API_V1_PREFIX``), and every ``include_router`` derives its prefix from it. A hardcoded
    ``/api/v1`` here would stop matching the moment the prefix changed — and the failure mode is
    that LOGIN returns 401 and nobody can get in. CI would never catch it; it breaks production only.

    ``/health`` is literal because it is registered outside the prefix.

    ``POST {prefix}/passport/sync`` is allowlisted for JWT purposes ONLY — it is authenticated by
    HMAC in ``app.passport.sync_router`` because Passport calls it machine-to-machine. Allowlisted
    is not ungated.
    """
    prefix = settings.api_v1_prefix
    return frozenset(
        {
            ("POST", f"{prefix}/auth/login"),
            ("POST", f"{prefix}/auth/register"),
            ("POST", f"{prefix}/auth/oauth-complete"),
            ("POST", f"{prefix}/auth/refresh-token"),
            ("POST", f"{prefix}/auth/logout"),
            ("POST", f"{prefix}/passport/sync"),
            ("GET", "/health"),
        }
    )


def require_auth(
    request: Request,
    authorization: str | None = Header(None),
    session: Session = Depends(get_session),
) -> User | None:
    """The global gate: authentication is required unless the route is explicitly public.

    Registered once on the app, so a route added tomorrow is protected by default. This inverts the
    codebase's previous posture, where a route was open unless it opted in — 124 of 182 had not.

    Returns ``None`` for public routes; the caller's credentials are NOT inspected there. That
    ordering is the whole design:

    - Resolving credentials BEFORE the allowlist check breaks login. ``_resolve_current_user``
      raises 401 on a missing header, and FastAPI resolves sub-dependencies before the parent body,
      so an allowlist checked afterwards never runs.
    - ``POST /auth/oauth-complete`` carries a SUPABASE token, which this app's JWT path would
      reject. A public route must not have its credentials validated at all.

    Match on ``request.url.path`` (the full path), never ``request.scope["route"].path`` — on
    FastAPI >=0.139 the latter is router-RELATIVE (``/login``), so an allowlist of full paths would
    never match and login would 401.
    """
    if (request.method, request.url.path) in public_routes(get_settings()):
        return None
    return _resolve_current_user(session, authorization)


def get_current_user(user: User | None = Depends(require_auth)) -> User:
    """The acting user. Unchanged contract for every route that already depends on this.

    Shares ``require_auth`` as its dependency, so FastAPI's per-request cache (keyed by callable
    identity) resolves the token ONCE for both the global gate and the route. Verifying
    independently here would cost every already-gated route a second dual-issuer verification and
    a second user lookup.

    ``None`` is only reachable on a public route, which by definition has no acting user.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


class OrgContext(NamedTuple):
    """The acting user AND the single organisation they are acting in."""

    user: User
    organization_id: str


def _platform_user_for(session: Session, user: User) -> str | None:
    """Resolve a local user to their Passport platform user — link first, then email.

    The email fallback is not optional. ``report_identity_link_safe`` is best-effort and
    ASYNCHRONOUS (``api/auth.py:98-100``): it round-trips through Passport and syncs back, so a
    freshly-logged-in SSO user has no identity link on this request. Without the fallback every one
    of them would 403 on every org-scoped route until sync landed. ``api/auth.py:90`` already
    trusts this exact resolution to decide whether login is allowed at all.
    """
    platform_user_id = access.platform_user_id_for(session, user.id)
    if platform_user_id is not None:
        return platform_user_id
    return access.platform_user_id_for_email(session, user.email)


def get_org_context(
    user: User = Depends(get_current_user),
    x_organization_id: str | None = Header(None),
    session: Session = Depends(get_session),
) -> OrgContext:
    """Which org is this request acting in? The header proposes; the projection disposes.

    Prepper projects every org Passport delivers and a user may belong to several, so an org-scoped
    read cannot be answered without knowing which one. Brand-scoped reads still need no active org
    (``access.brand_roles`` unions safely — a brand id already carries its org); this is for
    everything else.

    The client names an org and it is re-derived against the projection, so a forged header yields
    403 rather than a scope. Never trust a client-supplied tenant id.

    - header names an org the caller belongs to -> that org
    - header names any other org               -> 403
    - no header, caller has exactly one org    -> that org (single-org users never send it)
    - no header, caller has several            -> 400 (no safe default; guessing writes into the
                                                  wrong tenant silently)
    - no Passport identity, or no orgs         -> 403

    This deliberately supersedes the fail-open in ``access.has_prepper_access`` (:238-243), which
    returns ``True`` for an unlinked user so that switching the projection on cannot lock everyone
    out. That is coherent for the boolean "may use Prepper at all"; it cannot survive contact with
    scoping, because there is no org to fail open *into* — a request names exactly one org or scopes
    nothing. The email fallback preserves the intent (don't lock out users Passport knows) without
    inventing an org.
    """
    platform_user_id = _platform_user_for(session, user)
    if platform_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No Passport identity for this user",
        )

    orgs = access.orgs_for_platform_user(session, platform_user_id)
    if not orgs:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not belong to any organization",
        )

    if x_organization_id is not None:
        if x_organization_id not in orgs:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization",
            )
        organization_id = x_organization_id
    elif len(orgs) == 1:
        organization_id = orgs[0]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Organization-Id required: you belong to more than one organization",
        )

    # The kill switch, asked PER ORG. `is_org_blocked` is an any-org question — it blocks only when
    # every org the user belongs to is suspended, so a user in one healthy and one suspended org
    # keeps full access to the suspended one. Acting in a suspended org is blocked, full stop.
    if access.entitlement_status(session, organization_id) not in (None, "active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization access is currently suspended",
        )

    return OrgContext(user=user, organization_id=organization_id)


def _resolve_current_user(
    session: Session,
    authorization: str | None,
) -> User:
    """
    Extract JWT from Authorization header, verify it, and return the user.

    Raises:
        HTTPException: 401 if token is missing or invalid, 403 if the caller's orgs are all
        suspended, 404 if user not found
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.replace("Bearer ", "")
    auth_service = get_auth_service()

    # SSO issuer cutover (P3, dark). If the token is signed by PASSPORT's Supabase project, resolve
    # the local user by its VERIFIED email — the shared issuer's sub is not this app's sub, and
    # `platform_user.supabase_id` is never synced, so email is the only key a consumer holds. This
    # ADDS an accepted issuer; a Prepper-issued token still resolves by the fallback below, so 5.1
    # is safe to ship off and flip on. See passport docs/specs/2026-07-15-sso-issuer-cutover-*.
    user_id: str | None = None
    passport_identity = auth_service.verify_passport_identity(token)
    if passport_identity is not None:
        resolved = resolve_or_provision_passport_user(session, *passport_identity)
        if resolved is not None:
            user_id = resolved.id

    if user_id is None:
        user_id = auth_service.verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Passport org-level kill switch: if the entitlement of every org this user belongs to is
    # synced and not active, block them regardless of their role. Rule 9 — evaluated against the
    # user's OWN orgs, not a configured one. Fails open when the user is not linked yet or
    # entitlements have not synced (see app.passport.access).
    if is_org_blocked(session, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization access is currently suspended",
        )

    # Get user from database
    user_service = UserService(session)
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user
