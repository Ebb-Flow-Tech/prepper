"""Tasting notes API routes (nested under sessions)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.domain import TastingNoteService, TastingSessionService
from app.models import (
    RecipeOutlet,
    TastingNoteCreate,
    TastingNoteRead,
    TastingNoteUpdate,
    User,
    UserType,
)


router = APIRouter()


@router.get("/{session_id}/notes", response_model=list[TastingNoteRead])
def list_session_notes(
    session_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all notes for a tasting session.

    Access control:
    - Admin users: can access any tasting session notes
    - Other users: can access notes if they have access to the recipes in the session
      based on ownership, public status, or outlet hierarchy
    """
    session_service = TastingSessionService(session)
    tasting_session = session_service.get(session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )

    note_service = TastingNoteService(session)
    notes = note_service.get_for_session(session_id)

    # Non-admin users: filter notes based on recipe access
    if current_user.user_type != UserType.ADMIN:
        from app.domain.outlet_service import OutletService
        from app.domain.recipe_service import RecipeService

        recipe_service = RecipeService(session)
        filtered_notes = []

        for note in notes:
            if not note.recipe_id:
                # If note doesn't have recipe_id, include it
                filtered_notes.append(note)
                continue

            recipe = recipe_service.get_recipe(note.recipe_id)
            if not recipe:
                continue

            can_access = False

            # User's own recipe
            if recipe.owner_id == current_user.id:
                can_access = True
            # Public recipe
            elif recipe.is_public:
                can_access = True
            # Recipe from user's outlet
            elif current_user.outlet_id:
                outlet_service = OutletService(session)
                user_outlet = outlet_service.get_outlet(current_user.outlet_id)
                if user_outlet:
                    accessible_outlet_ids = {current_user.outlet_id}
                    # Location users can also see recipes from their parent brand
                    # Brand users can ONLY see their own outlet's recipes (not children)
                    if user_outlet.outlet_type.value == "location" and user_outlet.parent_outlet_id:
                        accessible_outlet_ids.add(user_outlet.parent_outlet_id)

                    # Check if recipe is assigned to any accessible outlet
                    statement = select(RecipeOutlet).where(
                        RecipeOutlet.recipe_id == recipe.id,
                        RecipeOutlet.outlet_id.in_(accessible_outlet_ids),
                        RecipeOutlet.is_active,
                    )
                    can_access = bool(session.exec(statement).first())

            if can_access:
                filtered_notes.append(note)

        return filtered_notes

    return notes


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
