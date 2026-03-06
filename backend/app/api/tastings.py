"""Tasting sessions API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session, get_current_user
from app.models import (
    TastingSessionRead,
    TastingSessionCreate,
    TastingSessionUpdate,
    User,
    UserType,
)
from app.domain import TastingSessionService

# Import routers from split modules for backwards compatibility
from app.api.tasting_notes import router as notes_router
from app.api.tasting_history import router as recipe_tastings_router


router = APIRouter()

# Include notes router to maintain existing endpoint structure
router.include_router(notes_router)


def _check_session_access(
    tasting_session: TastingSessionRead, current_user: User
) -> None:
    """Raise 403 if a non-admin user is neither the creator nor a participant."""
    if current_user.user_type == UserType.ADMIN:
        return
    if tasting_session.creator_id == current_user.id:
        return
    participant_ids = {p.user_id for p in tasting_session.participants}
    if current_user.id in participant_ids:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


def _check_session_access_raw(
    tasting_session, current_user: User, service: TastingSessionService
) -> None:
    """Lightweight access check using raw TastingSession (no full participant load)."""
    if current_user.user_type == UserType.ADMIN:
        return
    if tasting_session.creator_id == current_user.id:
        return
    if service.is_participant(tasting_session.id, current_user.id):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


def _check_creator_only(
    tasting_session, current_user: User
) -> None:
    """Raise 403 unless the current user is the session creator."""
    if tasting_session.creator_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the session creator can perform this action",
    )


# -----------------------------------------------------------------------------
# Tasting Sessions
# -----------------------------------------------------------------------------


@router.post("", response_model=TastingSessionRead, status_code=status.HTTP_201_CREATED)
def create_tasting_session(
    data: TastingSessionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new tasting session."""
    service = TastingSessionService(session)
    return service.create(data, creator_id=current_user.id)


@router.get("")
def list_tasting_sessions(
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all tasting sessions, ordered by date descending."""
    from app.models.pagination import PaginatedResponse
    service = TastingSessionService(session)
    offset = (page_number - 1) * page_size
    items, total = service.list_paginated_with_count(offset=offset, limit=page_size, search=search)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


@router.get("/{session_id}", response_model=TastingSessionRead)
def get_tasting_session(
    session_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a tasting session by ID.

    Non-admin users can only access sessions they created or participate in.
    """
    service = TastingSessionService(session)
    tasting_session = service.get(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )

    _check_session_access(tasting_session, current_user)
    return tasting_session


@router.get("/{session_id}/stats")
def get_tasting_session_stats(
    session_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get statistics for a tasting session.

    Non-admin users can only access sessions they created or participate in.
    """
    service = TastingSessionService(session)
    tasting_session = service.get_raw(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )

    _check_session_access_raw(tasting_session, current_user, service)
    return service.get_stats(session_id)


@router.patch("/{session_id}", response_model=TastingSessionRead)
def update_tasting_session(
    session_id: int,
    data: TastingSessionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a tasting session.

    Only the session creator can update the session.
    """
    service = TastingSessionService(session)
    tasting_session = service.get_raw(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )

    _check_creator_only(tasting_session, current_user)

    updated_session = service.update(session_id, data, existing=tasting_session)
    if not updated_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    return updated_session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tasting_session(
    session_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a tasting session and all its notes.

    Only the session creator can delete the session.
    """
    service = TastingSessionService(session)
    tasting_session = service.get_raw(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )

    _check_creator_only(tasting_session, current_user)

    deleted = service.delete(session_id, existing=tasting_session)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    return None
