"""Recipe ingredients API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientUpdate,
    RecipeIngredientReorder,
    RecipeIngredientRead,
)
from app.domain import RecipeService

router = APIRouter()


@router.get("/{recipe_id}/ingredients", response_model=list[RecipeIngredientRead])
def list_recipe_ingredients(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """List all ingredients for a recipe."""
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return service.get_recipe_ingredients(recipe_id)


@router.post(
    "/{recipe_id}/ingredients",
    response_model=RecipeIngredientRead,
    status_code=status.HTTP_201_CREATED,
)
def add_ingredient_to_recipe(
    recipe_id: int,
    data: RecipeIngredientCreate,
    session: Session = Depends(get_session),
):
    """Add an ingredient to a recipe."""
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    result = service.add_ingredient_to_recipe(recipe_id, data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ingredient already exists in recipe",
        )
    return result


@router.patch(
    "/{recipe_id}/ingredients/{ri_id}",
    response_model=RecipeIngredientRead,
)
def update_recipe_ingredient(
    recipe_id: int,
    ri_id: int,
    data: RecipeIngredientUpdate,
    session: Session = Depends(get_session),
):
    """Update a recipe ingredient's quantity or unit."""
    service = RecipeService(session)
    result = service.update_recipe_ingredient(ri_id, data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe ingredient not found",
        )
    return result


@router.delete(
    "/{recipe_id}/ingredients/{ri_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_ingredient_from_recipe(
    recipe_id: int,
    ri_id: int,
    session: Session = Depends(get_session),
):
    """Remove an ingredient from a recipe."""
    service = RecipeService(session)
    success = service.remove_ingredient_from_recipe(ri_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe ingredient not found",
        )


@router.post(
    "/{recipe_id}/ingredients/reorder",
    response_model=list[RecipeIngredientRead],
)
def reorder_recipe_ingredients(
    recipe_id: int,
    data: RecipeIngredientReorder,
    session: Session = Depends(get_session),
):
    """Reorder recipe ingredients."""
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return service.reorder_recipe_ingredients(recipe_id, data.ordered_ids)
