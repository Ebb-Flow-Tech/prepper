"""Supplier API routes."""

import io

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlmodel import Session

from app.api.deps import get_current_user, get_session
from app.domain.fmh_import_service import FMHImportResult, import_suppliers
from app.domain.storage_service import (
    StorageError,
    StorageService,
    is_storage_configured,
)
from app.domain.supplier_service import SupplierService
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.supplier_ingredient import SupplierIngredientRead
from app.models.user import User
from app.passport import access

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


_XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/fmh-sample-supplier")
async def download_fmh_sample_supplier() -> Response:
    """Download the FMH sample suppliers XLSX template."""
    print("[FMH] GET /fmh-sample-supplier hit")
    print(f"[FMH] storage configured: {is_storage_configured()}")
    if not is_storage_configured():
        raise HTTPException(status_code=503, detail="Storage not configured")
    try:
        data = await StorageService().download_fmh_sample("Suppliers_sample.xlsx")
    except StorageError as e:
        print(f"[FMH] StorageError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=data,
        media_type=_XLSX_CONTENT_TYPE,
        headers={"Content-Disposition": 'attachment; filename="Suppliers_sample.xlsx"'},
    )


@router.get("/fmh-sample-supplier-pricings")
async def download_fmh_sample_supplier_pricings() -> Response:
    """Download the FMH sample sponsored supplier pricings XLSX template."""
    print("[FMH] GET /fmh-sample-supplier-pricings hit")
    print(f"[FMH] storage configured: {is_storage_configured()}")
    if not is_storage_configured():
        raise HTTPException(status_code=503, detail="Storage not configured")
    try:
        data = await StorageService().download_fmh_sample("SponsoredSupplierPricings_sample.xlsx")
    except StorageError as e:
        print(f"[FMH] StorageError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=data,
        media_type=_XLSX_CONTENT_TYPE,
        headers={"Content-Disposition": 'attachment; filename="SponsoredSupplierPricings_sample.xlsx"'},
    )


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


@router.post("/fmh-import", response_model=FMHImportResult)
async def import_suppliers_fmh(
    suppliers_file: UploadFile = File(...),
    pricings_file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Import FMH suppliers and enrich with product codes. Org administrators only.

    Suppliers are org-wide master data — the import touches no single unit, so there is no brand to
    be a `Manager` of and the check falls back to organisation administration.
    """
    if not access.is_org_admin(session, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organisation administrators can import suppliers",
        )
    for f in (suppliers_file, pricings_file):
        if not (f.filename or "").lower().endswith(".xlsx"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File '{f.filename}' must be an .xlsx file",
            )
    suppliers_wb = openpyxl.load_workbook(io.BytesIO(await suppliers_file.read()), read_only=True, data_only=True)
    pricings_wb = openpyxl.load_workbook(io.BytesIO(await pricings_file.read()), read_only=True, data_only=True)
    return import_suppliers(session, suppliers_wb, pricings_wb)


@router.get("/{supplier_id}/ingredients", response_model=list[SupplierIngredientRead])
def get_supplier_ingredients(
    supplier_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all ingredients of a supplier, restricted to the units the caller can see."""
    service = SupplierService(session)
    supplier = service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return service.get_supplier_ingredients(
        supplier_id,
        subject=current_user.id,
    )
