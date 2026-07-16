"""Category API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import OrgContext, get_org_context, get_session
from app.domain.category_service import CategoryService
from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)

router = APIRouter()


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
):
    """Create a new category.

    Category names must be unique (case-insensitive).
    """
    service = CategoryService(session, org.organization_id)
    try:
        return service.create_category(data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("")
def list_categories(
    active_only: bool = True,
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=500),
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
):
    """List categories with pagination.

    By default, only active (non-deleted) categories are returned.
    Set active_only=false to include soft-deleted categories.
    """
    from app.models.pagination import PaginatedResponse
    service = CategoryService(session, org.organization_id)
    offset = (page_number - 1) * page_size
    items = service.list_paginated(offset=offset, limit=page_size, active_only=active_only, search=search)
    total = service.count(active_only=active_only, search=search)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


@router.get("/{category_id}", response_model=Category)
def get_category(
    category_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
):
    """Get a category by ID."""
    service = CategoryService(session, org.organization_id)
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
    org: OrgContext = Depends(get_org_context),
):
    """Update a category.

    Category names must be unique (case-insensitive).
    """
    service = CategoryService(session, org.organization_id)
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
    org: OrgContext = Depends(get_org_context),
):
    """Soft-delete a category by setting is_active to False.

    The category is not physically removed from the database.
    """
    service = CategoryService(session, org.organization_id)
    category = service.soft_delete_category(category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category
