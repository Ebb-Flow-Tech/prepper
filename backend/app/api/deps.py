"""Shared dependencies for API routes."""

from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.database import engine
from app.domain.supabase_auth_service import get_auth_service
from app.domain.user_service import UserService
from app.models import PassportMembership, User
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


def get_current_user(
    authorization: str | None = Header(None),
    session: Session = Depends(get_session),
) -> User:
    """
    Extract JWT from Authorization header, verify it, and return the user.

    Raises:
        HTTPException: 401 if token is missing or invalid, 404 if user not found
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
        passport_sub, passport_email = passport_identity
        matched = session.exec(
            select(User).where(func.lower(User.email) == passport_email.lower())
        ).first()
        if matched is not None:
            user_id = matched.id
        elif _is_active_member(session, passport_email):
            # SSO login (§5.2): a verified Passport MEMBER with no local row yet — provision it,
            # keyed by the Passport sub (the new user has no pre-existing content to translate to).
            # Gated on active membership so a token for a non-member never mints a local account.
            provisioned = UserService(session).ensure_user(
                passport_sub, passport_email, passport_email.split("@", 1)[0]
            )
            user_id = provisioned.id

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
