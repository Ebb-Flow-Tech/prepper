"""Recipe-tasting session relationship API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import RecipeTasting, RecipeTastingCreate
from app.domain import RecipeTastingService


router = APIRouter()


@router.get(
    "/{session_id}/recipes",
    response_model=list[RecipeTasting],
)
def get_session_recipes(
    session_id: int,
    session: Session = Depends(get_session),
):
    """Get all recipes associated with a tasting session."""
    service = RecipeTastingService(session)
    return service.get_recipes_for_session(session_id)


@router.post(
    "/{session_id}/recipes",
    response_model=RecipeTasting,
    status_code=status.HTTP_201_CREATED,
)
def add_recipe_to_session(
    session_id: int,
    data: RecipeTastingCreate,
    session: Session = Depends(get_session),
):
    """Add a recipe to a tasting session."""
    service = RecipeTastingService(session)
    recipe_tasting = service.add_recipe_to_session(session_id, data)
    if not recipe_tasting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add recipe. Session or recipe not found, or recipe already in session.",
        )
    return recipe_tasting


@router.delete(
    "/{session_id}/recipes/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_recipe_from_session(
    session_id: int,
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Remove a recipe from a tasting session."""
    service = RecipeTastingService(session)
    deleted = service.remove_recipe_from_session(session_id, recipe_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found in session.",
        )
    return None
