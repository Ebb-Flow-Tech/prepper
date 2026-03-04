"""Supplier API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session, get_current_user
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.supplier_ingredient import SupplierIngredientRead
from app.models.user import User, UserType
from app.domain.supplier_service import SupplierService

router = APIRouter()


@router.post("", response_model=Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    session: Session = Depends(get_session),
):
    """Create a new supplier."""
    service = SupplierService(session)
    return service.create_supplier(data)


@router.get("")
def list_suppliers(
    active_only: bool = True,
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """List all suppliers."""
    from app.models.pagination import PaginatedResponse
    service = SupplierService(session)
    offset = (page_number - 1) * page_size
    items = service.list_paginated(offset=offset, limit=page_size, active_only=active_only, search=search)
    total = service.count(active_only=active_only, search=search)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


@router.get("/{supplier_id}", response_model=Supplier)
def get_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
):
    """Get a supplier by ID."""
    service = SupplierService(session)
    supplier = service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return supplier


@router.patch("/{supplier_id}", response_model=Supplier)
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    session: Session = Depends(get_session),
):
    """Update a supplier."""
    service = SupplierService(session)
    supplier = service.update_supplier(supplier_id, data)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return supplier


@router.patch("/{supplier_id}/deactivate", response_model=Supplier)
def deactivate_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
):
    """Soft-delete a supplier by deactivating it."""
    service = SupplierService(session)
    supplier = service.deactivate_supplier(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
):
    """Delete a supplier."""
    service = SupplierService(session)
    deleted = service.delete_supplier(supplier_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )


@router.get("/{supplier_id}/ingredients", response_model=list[SupplierIngredientRead])
def get_supplier_ingredients(
    supplier_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all ingredients associated with a supplier (filtered by user's outlet tree)."""
    service = SupplierService(session)
    # Check if supplier exists
    supplier = service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return service.get_supplier_ingredients(
        supplier_id,
        user_outlet_id=current_user.outlet_id,
        is_admin=current_user.user_type == UserType.ADMIN,
    )
