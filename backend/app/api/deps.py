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

    # Passport org-level kill switch: if the org's entitlement is synced and not active,
    # block the whole org regardless of the user's role. Fails open when Passport is not
    # configured or entitlements are not yet synced (see app.passport.access).
    if is_org_blocked(session):
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
