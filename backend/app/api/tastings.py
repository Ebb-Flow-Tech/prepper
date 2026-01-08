"""Tasting sessions and notes API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    TastingSession,
    TastingSessionCreate,
    TastingSessionUpdate,
    TastingNoteCreate,
    TastingNoteUpdate,
    TastingNoteRead,
    TastingNoteWithRecipe,
    RecipeTastingSummary,
)
from app.domain import TastingSessionService, TastingNoteService


router = APIRouter()
recipe_tastings_router = APIRouter()


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


# -----------------------------------------------------------------------------
# Tasting Notes (nested under sessions)
# -----------------------------------------------------------------------------


@router.get("/{session_id}/notes", response_model=list[TastingNoteRead])
def list_session_notes(
    session_id: int,
    session: Session = Depends(get_session),
):
    """List all notes for a tasting session."""
    session_service = TastingSessionService(session)
    tasting_session = session_service.get(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    note_service = TastingNoteService(session)
    return note_service.get_for_session(session_id)


@router.post(
    "/{session_id}/notes",
    response_model=TastingNoteRead,
    status_code=status.HTTP_201_CREATED,
)
def add_note_to_session(
    session_id: int,
    data: TastingNoteCreate,
    session: Session = Depends(get_session),
):
    """Add a tasting note to a session."""
    service = TastingNoteService(session)
    note = service.add(session_id, data)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add note. Session or recipe not found, or recipe already in session.",
        )
    return note


@router.get("/{session_id}/notes/{note_id}", response_model=TastingNoteRead)
def get_tasting_note(
    session_id: int,
    note_id: int,
    session: Session = Depends(get_session),
):
    """Get a specific tasting note."""
    service = TastingNoteService(session)
    note = service.get(note_id)
    if not note or note.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    return note


@router.patch("/{session_id}/notes/{note_id}", response_model=TastingNoteRead)
def update_tasting_note(
    session_id: int,
    note_id: int,
    data: TastingNoteUpdate,
    session: Session = Depends(get_session),
):
    """Update a tasting note."""
    service = TastingNoteService(session)
    note = service.get(note_id)
    if not note or note.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    updated_note = service.update(note_id, data)
    return updated_note


@router.delete("/{session_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tasting_note(
    session_id: int,
    note_id: int,
    session: Session = Depends(get_session),
):
    """Delete a tasting note from a session."""
    service = TastingNoteService(session)
    note = service.get(note_id)
    if not note or note.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    service.delete(note_id)
    return None


# -----------------------------------------------------------------------------
# Recipe Tasting History (mounted under /recipes)
# -----------------------------------------------------------------------------


@recipe_tastings_router.get(
    "/{recipe_id}/tasting-notes",
    response_model=list[TastingNoteWithRecipe],
)
def get_recipe_tasting_notes(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get all tasting notes for a recipe."""
    service = TastingNoteService(session)
    return service.get_for_recipe(recipe_id)


@recipe_tastings_router.get(
    "/{recipe_id}/tasting-summary",
    response_model=RecipeTastingSummary,
)
def get_recipe_tasting_summary(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get aggregated tasting data for a recipe."""
    service = TastingNoteService(session)
    return service.get_recipe_summary(recipe_id)
