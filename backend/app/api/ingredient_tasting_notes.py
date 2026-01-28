"""Ingredient tasting notes API routes (nested under sessions)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    IngredientTastingNoteCreate,
    IngredientTastingNoteUpdate,
    IngredientTastingNoteRead,
    IngredientTastingNoteWithDetails,
)
from app.domain import TastingSessionService, IngredientTastingNoteService


router = APIRouter()


@router.get("/{session_id}/ingredient-notes", response_model=list[IngredientTastingNoteRead])
def list_session_ingredient_notes(
    session_id: int,
    session: Session = Depends(get_session),
):
    """List all ingredient notes for a tasting session."""
    session_service = TastingSessionService(session)
    tasting_session = session_service.get(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )
    note_service = IngredientTastingNoteService(session)
    return note_service.get_for_session(session_id)


@router.post(
    "/{session_id}/ingredient-notes",
    response_model=IngredientTastingNoteRead,
    status_code=status.HTTP_201_CREATED,
)
def add_ingredient_note_to_session(
    session_id: int,
    data: IngredientTastingNoteCreate,
    session: Session = Depends(get_session),
):
    """Add an ingredient tasting note to a session."""
    service = IngredientTastingNoteService(session)
    note = service.add(session_id, data)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add note. Session or ingredient not found.",
        )
    return note


@router.get("/{session_id}/ingredient-notes/{note_id}", response_model=IngredientTastingNoteRead)
def get_ingredient_tasting_note(
    session_id: int,
    note_id: int,
    session: Session = Depends(get_session),
):
    """Get a specific ingredient tasting note."""
    service = IngredientTastingNoteService(session)
    note = service.get(note_id)
    if not note or note.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient tasting note not found",
        )
    return note


@router.patch("/{session_id}/ingredient-notes/{note_id}", response_model=IngredientTastingNoteRead)
def update_ingredient_tasting_note(
    session_id: int,
    note_id: int,
    data: IngredientTastingNoteUpdate,
    session: Session = Depends(get_session),
):
    """Update an ingredient tasting note."""
    service = IngredientTastingNoteService(session)
    note = service.get(note_id)
    if not note or note.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient tasting note not found",
        )
    updated_note = service.update(note_id, data)
    return updated_note


@router.delete("/{session_id}/ingredient-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ingredient_tasting_note(
    session_id: int,
    note_id: int,
    session: Session = Depends(get_session),
):
    """Delete an ingredient tasting note from a session."""
    service = IngredientTastingNoteService(session)
    note = service.get(note_id)
    if not note or note.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient tasting note not found",
        )
    service.delete(note_id)
    return None


@router.get("/ingredients/{ingredient_id}/tasting-history", response_model=list[IngredientTastingNoteWithDetails])
def get_ingredient_tasting_history(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get tasting history for a specific ingredient."""
    service = IngredientTastingNoteService(session)
    return service.get_for_ingredient(ingredient_id)
