"""Recipe allergens API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import OrgContext, get_current_user, get_org_context, get_session
from app.api.guards import require_recipe_access, visible_recipe_ids
from app.domain.ingredient_allergen_service import IngredientAllergenService
from app.domain.recipe_service import RecipeService
from app.models import Allergen, Recipe, User


class RecipeAllergensBatchRequest(BaseModel):
    """Request body for batch fetching recipe allergens."""

    recipe_ids: list[int]


router = APIRouter()
batch_router = APIRouter()


@router.get("/{recipe_id}/allergens", response_model=list[Allergen])
def get_recipe_allergens(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
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
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Get allergens for multiple recipes in a single batch request.

    Returns a dictionary mapping recipe_id -> list of Allergen records.
    Recipes with no allergens will have empty lists.

    The ids come from the BODY, so no dependency can guard them — the route filters instead. A
    recipe the caller cannot see is absent from the map rather than present-and-empty.
    """
    recipe_ids = sorted(
        visible_recipe_ids(session, current_user, org.organization_id, request.recipe_ids)
    )
    if not recipe_ids:
        return {}

    allergen_service = IngredientAllergenService(session)
    result = allergen_service.get_allergens_for_recipes_batch(recipe_ids)
    return result
