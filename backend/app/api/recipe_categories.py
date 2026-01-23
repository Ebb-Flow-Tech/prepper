"""Recipe category API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models.recipe_category import (
    RecipeCategory,
    RecipeCategoryCreate,
    RecipeCategoryUpdate,
)
from app.domain.recipe_category_service import RecipeCategoryService

router = APIRouter()


@router.post("", response_model=RecipeCategory, status_code=status.HTTP_201_CREATED)
def create_recipe_category(
    data: RecipeCategoryCreate,
    session: Session = Depends(get_session),
):
    """Create a new recipe category."""
    service = RecipeCategoryService(session)
    return service.create_recipe_category(data)


@router.get("", response_model=list[RecipeCategory])
def list_recipe_categories(
    session: Session = Depends(get_session),
):
    """List all recipe categories."""
    service = RecipeCategoryService(session)
    return service.list_recipe_categories()


@router.get("/{category_id}", response_model=RecipeCategory)
def get_recipe_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Get a recipe category by ID."""
    service = RecipeCategoryService(session)
    recipe_category = service.get_recipe_category(category_id)
    if not recipe_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe category not found",
        )
    return recipe_category


@router.patch("/{category_id}", response_model=RecipeCategory)
def update_recipe_category(
    category_id: int,
    data: RecipeCategoryUpdate,
    session: Session = Depends(get_session),
):
    """Update a recipe category."""
    service = RecipeCategoryService(session)
    recipe_category = service.update_recipe_category(category_id, data)
    if not recipe_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe category not found",
        )
    return recipe_category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Delete a recipe category."""
    service = RecipeCategoryService(session)
    deleted = service.delete_recipe_category(category_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe category not found",
        )
