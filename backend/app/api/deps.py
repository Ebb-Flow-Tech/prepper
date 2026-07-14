"""Shared dependencies for API routes."""

from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session

from app.database import engine
from app.domain.supabase_auth_service import get_auth_service
from app.domain.user_service import UserService
from app.models import User
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

    # Verify token and get user ID
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
