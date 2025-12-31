"""Supplier API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
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


@router.get("", response_model=list[Supplier])
def list_suppliers(
    session: Session = Depends(get_session),
):
    """List all suppliers."""
    service = SupplierService(session)
    return service.list_suppliers()


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
