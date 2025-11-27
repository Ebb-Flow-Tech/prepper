"""Ingredient API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import Ingredient, IngredientCreate, IngredientUpdate
from app.domain import IngredientService

router = APIRouter()


@router.post("", response_model=Ingredient, status_code=status.HTTP_201_CREATED)
def create_ingredient(
    data: IngredientCreate,
    session: Session = Depends(get_session),
):
    """Create a new ingredient."""
    service = IngredientService(session)
    return service.create_ingredient(data)


@router.get("", response_model=list[Ingredient])
def list_ingredients(
    active_only: bool = True,
    session: Session = Depends(get_session),
):
    """List all ingredients."""
    service = IngredientService(session)
    return service.list_ingredients(active_only=active_only)


@router.get("/{ingredient_id}", response_model=Ingredient)
def get_ingredient(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get an ingredient by ID."""
    service = IngredientService(session)
    ingredient = service.get_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient


@router.patch("/{ingredient_id}", response_model=Ingredient)
def update_ingredient(
    ingredient_id: int,
    data: IngredientUpdate,
    session: Session = Depends(get_session),
):
    """Update an ingredient."""
    service = IngredientService(session)
    ingredient = service.update_ingredient(ingredient_id, data)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient


@router.patch("/{ingredient_id}/deactivate", response_model=Ingredient)
def deactivate_ingredient(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Deactivate (soft-delete) an ingredient."""
    service = IngredientService(session)
    ingredient = service.deactivate_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient
