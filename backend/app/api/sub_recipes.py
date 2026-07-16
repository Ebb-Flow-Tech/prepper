"""Sub-recipe API routes for BOM hierarchy management."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.costing import evict_costing_cache
from app.api.deps import get_session
from app.api.guards import require_recipe_access
from app.domain import CycleDetectedError, SubRecipeService
from app.models import (
    Recipe,
    RecipeRecipe,
    RecipeRecipeCreate,
    RecipeRecipeReorder,
    RecipeRecipeUpdate,
)

router = APIRouter()
batch_router = APIRouter()


class SubRecipesBatchRequest(BaseModel):
    recipe_ids: list[int]


@batch_router.post("/sub-recipes/batch", response_model=dict[int, bool])
def get_sub_recipes_batch(
    request: SubRecipesBatchRequest,
    session: Session = Depends(get_session),
):
    """Return which recipes in the list have sub-recipes."""
    service = SubRecipeService(session)
    return service.get_has_sub_recipes_batch(request.recipe_ids)


@router.get("/{recipe_id}/sub-recipes", response_model=list[RecipeRecipe])
def list_sub_recipes(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Get all sub-recipes for a recipe, ordered by position."""
    service = SubRecipeService(session)
    return service.get_sub_recipes(recipe_id)


@router.post(
    "/{recipe_id}/sub-recipes",
    response_model=RecipeRecipe,
    status_code=status.HTTP_201_CREATED,
)
def add_sub_recipe(
    recipe_id: int,
    data: RecipeRecipeCreate,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """
    Add a sub-recipe to a recipe.

    Returns 400 if this would create a circular reference.
    """
    service = SubRecipeService(session)
    try:
        result = service.add_sub_recipe(recipe_id, data)
        evict_costing_cache(recipe_id)
        return result
    except CycleDetectedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{recipe_id}/sub-recipes/{link_id}", response_model=RecipeRecipe)
def update_sub_recipe(
    recipe_id: int,
    link_id: int,
    data: RecipeRecipeUpdate,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Update a sub-recipe link's quantity or unit."""
    service = SubRecipeService(session)
    result = service.update_sub_recipe(link_id, data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-recipe link not found",
        )
    evict_costing_cache(recipe_id)
    return result


@router.delete(
    "/{recipe_id}/sub-recipes/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_sub_recipe(
    recipe_id: int,
    link_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Remove a sub-recipe from a recipe."""
    service = SubRecipeService(session)
    if not service.remove_sub_recipe(link_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-recipe link not found",
        )
    evict_costing_cache(recipe_id)


@router.post("/{recipe_id}/sub-recipes/reorder", response_model=list[RecipeRecipe])
def reorder_sub_recipes(
    recipe_id: int,
    data: RecipeRecipeReorder,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Reorder sub-recipes within a recipe."""
    service = SubRecipeService(session)
    return service.reorder_sub_recipes(recipe_id, data.ordered_ids)


@router.get("/{recipe_id}/used-in", response_model=list[RecipeRecipe])
def get_used_in(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """
    Get all recipes that use this recipe as a sub-recipe.

    This is the reverse lookup: "What recipes include me?"
    """
    service = SubRecipeService(session)
    return service.get_parent_recipes(recipe_id)


@router.get("/{recipe_id}/bom-tree")
def get_bom_tree(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """
    Get the full Bill of Materials tree for a recipe.

    Returns a nested structure showing all sub-recipes recursively.
    """
    service = SubRecipeService(session)
    return service.get_full_bom_tree(recipe_id)
