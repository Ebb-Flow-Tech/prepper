"""Tasting sessions API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    TastingSession,
    TastingSessionCreate,
    TastingSessionUpdate,
)
from app.domain import TastingSessionService

# Import routers from split modules for backwards compatibility
from app.api.tasting_notes import router as notes_router
from app.api.tasting_history import router as recipe_tastings_router


router = APIRouter()

# Include notes router to maintain existing endpoint structure
router.include_router(notes_router)


# -----------------------------------------------------------------------------
# Tasting Sessions
# -----------------------------------------------------------------------------


@router.post("", response_model=TastingSession, status_code=status.HTTP_201_CREATED)
def create_tasting_session(
    data: TastingSessionCreate,
    session: Session = Depends(get_session),
):
    """Create a new tasting session."""
    service = TastingSessionService(session)
    return service.create(data)


@router.get("", response_model=list[TastingSession])
def list_tasting_sessions(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    """List all tasting sessions, ordered by date descending."""
    service = TastingSessionService(session)
    return service.list(limit=limit, offset=offset)


@router.get("/{session_id}", response_model=TastingSession)
def get_tasting_session(
    session_id: int,
    session: Session = Depends(get_session),
):
    """Get a tasting session by ID."""
    service = TastingSessionService(session)
    tasting_session = service.get(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    return tasting_session


@router.get("/{session_id}/stats")
def get_tasting_session_stats(
    session_id: int,
    session: Session = Depends(get_session),
):
    """Get statistics for a tasting session."""
    service = TastingSessionService(session)
    tasting_session = service.get(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    return service.get_stats(session_id)


@router.patch("/{session_id}", response_model=TastingSession)
def update_tasting_session(
    session_id: int,
    data: TastingSessionUpdate,
    session: Session = Depends(get_session),
):
    """Update a tasting session."""
    service = TastingSessionService(session)
    tasting_session = service.update(session_id, data)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    return tasting_session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tasting_session(
    session_id: int,
    session: Session = Depends(get_session),
):
    """Delete a tasting session and all its notes."""
    service = TastingSessionService(session)
    deleted = service.delete(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    return None
