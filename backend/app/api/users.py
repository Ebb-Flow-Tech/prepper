"""User API routes."""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_current_user, get_session
from app.domain.user_service import UserService
from app.models.user import User, UserRead, UserUpdate

router = APIRouter()


@router.get("", response_model=list[UserRead])
def list_users(
    email: str | None = Query(None),
    session: Session = Depends(get_session),
):
    """Get all users or search by email. Returns empty list if email not found."""
    service = UserService(session)
    if email:
        user = service.get_user_by_email(email)
        return [user] if user else []
    return service.get_all_users()


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    session: Session = Depends(get_session),
):
    """Get a user by ID."""
    service = UserService(session)
    user = service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a user. A user may only update themselves.

    403 rather than 404: the caller is authenticated and the row's existence is not a secret from
    them — they simply may not write to it.

    This route is deliberately NOT org-scoped. A brand-new registrant has no Passport identity
    link or membership yet, so no org context can be established for them, and
    `register/page.tsx` calls this immediately after login to set a phone number. It edits your
    own user row, which is org-agnostic by nature.
    """
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own account",
        )

    service = UserService(session)
    try:
        return service.update_user(user_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
