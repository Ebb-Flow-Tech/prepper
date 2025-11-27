"""Recipe core API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import Recipe, RecipeCreate, RecipeUpdate, RecipeStatus, RecipeStatusUpdate
from app.domain import RecipeService

router = APIRouter()


@router.post("", response_model=Recipe, status_code=status.HTTP_201_CREATED)
def create_recipe(
    data: RecipeCreate,
    session: Session = Depends(get_session),
):
    """Create a new recipe."""
    service = RecipeService(session)
    return service.create_recipe(data)


@router.get("", response_model=list[Recipe])
def list_recipes(
    status: RecipeStatus | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """List all recipes, optionally filtered by status."""
    service = RecipeService(session)
    return service.list_recipes(status=status)


@router.get("/{recipe_id}", response_model=Recipe)
def get_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get a recipe by ID."""
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.patch("/{recipe_id}", response_model=Recipe)
def update_recipe(
    recipe_id: int,
    data: RecipeUpdate,
    session: Session = Depends(get_session),
):
    """Update recipe metadata."""
    service = RecipeService(session)
    recipe = service.update_recipe_metadata(recipe_id, data)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.patch("/{recipe_id}/status", response_model=Recipe)
def update_recipe_status(
    recipe_id: int,
    data: RecipeStatusUpdate,
    session: Session = Depends(get_session),
):
    """Update a recipe's status."""
    service = RecipeService(session)
    recipe = service.set_recipe_status(recipe_id, data.status)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.delete("/{recipe_id}", response_model=Recipe)
def delete_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Soft-delete a recipe (sets status to archived)."""
    service = RecipeService(session)
    recipe = service.soft_delete_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe
