"""Recipe allergens API routes."""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import Allergen, Recipe
from app.domain.ingredient_allergen_service import IngredientAllergenService
from app.domain.recipe_service import RecipeService


class RecipeAllergensBatchRequest(BaseModel):
    """Request body for batch fetching recipe allergens."""

    recipe_ids: list[int]


router = APIRouter()
batch_router = APIRouter()


@router.get("/{recipe_id}/allergens", response_model=list[Allergen])
def get_recipe_allergens(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get all allergens for a specific recipe.

    Returns consolidated, deduplicated allergens from all recipe ingredients.
    Only active allergens are returned, sorted by name.
    """
    # Verify recipe exists
    recipe_service = RecipeService(session)
    recipe = recipe_service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    allergen_service = IngredientAllergenService(session)
    return allergen_service.get_allergens_for_recipe(recipe_id)


@batch_router.post("/allergens/batch", response_model=dict[int, list[Allergen]])
def get_recipe_allergens_batch(
    request: RecipeAllergensBatchRequest,
    session: Session = Depends(get_session),
):
    """Get allergens for multiple recipes in a single batch request.

    Returns a dictionary mapping recipe_id -> list of Allergen records.
    Recipes with no allergens will have empty lists.
    """
    if not request.recipe_ids:
        return {}

    allergen_service = IngredientAllergenService(session)
    result = allergen_service.get_allergens_for_recipes_batch(request.recipe_ids)
    return result
