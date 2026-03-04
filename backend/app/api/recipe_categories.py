"""Recipe category API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
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


@router.get("")
def list_recipe_categories(
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """List all recipe categories."""
    from app.models.pagination import PaginatedResponse
    service = RecipeCategoryService(session)
    offset = (page_number - 1) * page_size
    items = service.list_paginated(offset=offset, limit=page_size, search=search)
    total = service.count(search=search)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


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
