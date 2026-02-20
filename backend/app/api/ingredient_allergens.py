"""Ingredient-allergen relationship API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import IngredientAllergen, IngredientAllergenCreate
from app.domain.ingredient_allergen_service import IngredientAllergenService


router = APIRouter()


@router.get("", response_model=list[IngredientAllergen])
def list_ingredient_allergens(
    session: Session = Depends(get_session),
):
    """Get all ingredient-allergen links."""
    service = IngredientAllergenService(session)
    return service.list_all()


@router.get("/allergen/{allergen_id}", response_model=list[IngredientAllergen])
def get_ingredients_by_allergen(
    allergen_id: int,
    session: Session = Depends(get_session),
):
    """Get all ingredients that contain a specific allergen."""
    service = IngredientAllergenService(session)
    return service.get_by_allergen(allergen_id)


@router.get("/ingredient/{ingredient_id}", response_model=list[IngredientAllergen])
def get_allergens_by_ingredient(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get all allergens associated with a specific ingredient."""
    service = IngredientAllergenService(session)
    return service.get_by_ingredient(ingredient_id)


@router.post("", response_model=IngredientAllergen, status_code=status.HTTP_201_CREATED)
def add_allergen_to_ingredient(
    data: IngredientAllergenCreate,
    session: Session = Depends(get_session),
):
    """Add an allergen to an ingredient."""
    service = IngredientAllergenService(session)
    link = service.create_link(data)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add allergen. Ingredient or allergen not found, or already linked.",
        )
    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_allergen_from_ingredient(
    link_id: int,
    session: Session = Depends(get_session),
):
    """Remove an allergen from an ingredient."""
    service = IngredientAllergenService(session)
    deleted = service.delete_link(link_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient-allergen link not found.",
        )
    return None
