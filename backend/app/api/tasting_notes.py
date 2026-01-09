"""Tasting notes API routes (nested under sessions)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    TastingNoteCreate,
    TastingNoteUpdate,
    TastingNoteRead,
)
from app.domain import TastingSessionService, TastingNoteService


router = APIRouter()


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
            detail="Could not add note. Session or recipe not found.",
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
