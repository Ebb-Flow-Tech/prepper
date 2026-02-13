"""User API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.domain.user_service import UserService
from app.models.user import UserRead, UserUpdate


router = APIRouter()


@router.get("", response_model=list[UserRead])
def list_users(
    session: Session = Depends(get_session),
):
    """Get all users."""
    service = UserService(session)
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
):
    """Update a user."""
    service = UserService(session)
    try:
        return service.update_user(user_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
