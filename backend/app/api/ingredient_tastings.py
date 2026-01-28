"""Ingredient-tasting session relationship API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import IngredientTasting, IngredientTastingCreate
from app.domain import IngredientTastingService


router = APIRouter()


@router.get(
    "/{session_id}/ingredients",
    response_model=list[IngredientTasting],
)
def get_session_ingredients(
    session_id: int,
    session: Session = Depends(get_session),
):
    """Get all ingredients associated with a tasting session."""
    service = IngredientTastingService(session)
    return service.get_ingredients_for_session(session_id)


@router.post(
    "/{session_id}/ingredients",
    response_model=IngredientTasting,
    status_code=status.HTTP_201_CREATED,
)
def add_ingredient_to_session(
    session_id: int,
    data: IngredientTastingCreate,
    session: Session = Depends(get_session),
):
    """Add an ingredient to a tasting session."""
    service = IngredientTastingService(session)
    ingredient_tasting = service.add_ingredient_to_session(session_id, data)
    if not ingredient_tasting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add ingredient. Session or ingredient not found, or ingredient already in session.",
        )
    return ingredient_tasting


@router.delete(
    "/{session_id}/ingredients/{ingredient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_ingredient_from_session(
    session_id: int,
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Remove an ingredient from a tasting session."""
    service = IngredientTastingService(session)
    deleted = service.remove_ingredient_from_session(session_id, ingredient_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found in session.",
        )
    return None
