"""Category API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)
from app.domain.category_service import CategoryService

router = APIRouter()


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    session: Session = Depends(get_session),
):
    """Create a new category.

    Category names must be unique (case-insensitive).
    """
    service = CategoryService(session)
    try:
        return service.create_category(data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("", response_model=list[Category])
def list_categories(
    active_only: bool = True,
    session: Session = Depends(get_session),
):
    """List all categories.

    By default, only active (non-deleted) categories are returned.
    Set active_only=false to include soft-deleted categories.
    """
    service = CategoryService(session)
    return service.list_categories(active_only=active_only)


@router.get("/{category_id}", response_model=Category)
def get_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Get a category by ID."""
    service = CategoryService(session)
    category = service.get_category(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.patch("/{category_id}", response_model=Category)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    session: Session = Depends(get_session),
):
    """Update a category.

    Category names must be unique (case-insensitive).
    """
    service = CategoryService(session)
    try:
        category = service.update_category(category_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.delete("/{category_id}", response_model=Category)
def delete_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Soft-delete a category by setting is_active to False.

    The category is not physically removed from the database.
    """
    service = CategoryService(session)
    category = service.soft_delete_category(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category
