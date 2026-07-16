"""Supplier ingredient tags API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.domain import supplier_ingredient_tag_service as svc
from app.models.supplier_ingredient_tag import (
    SupplierIngredientTagCreate,
    SupplierIngredientTagRead,
)

router = APIRouter()


@router.get("", response_model=list[SupplierIngredientTagRead])
def list_tags(session: Session = Depends(get_session)):
    """List all active supplier ingredient tags."""
    return svc.list_tags(session)


@router.post("", response_model=SupplierIngredientTagRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    data: SupplierIngredientTagCreate,
    session: Session = Depends(get_session),
):
    """Create a new supplier ingredient tag. Name must be unique."""
    try:
        return svc.create_tag(session, data.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{tag_id}", response_model=SupplierIngredientTagRead)
def delete_tag(tag_id: int, session: Session = Depends(get_session)):
    """Soft-delete a supplier ingredient tag."""
    tag = svc.delete_tag(session, tag_id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return tag


@router.get(
    "/supplier-ingredient/{si_id}",
    response_model=list[SupplierIngredientTagRead],
)
def get_tags_for_supplier_ingredient(
    si_id: int,
    session: Session = Depends(get_session),
):
    """Get all tags linked to a supplier ingredient."""
    return svc.get_tags_for_supplier_ingredient(session, si_id)


@router.post(
    "/supplier-ingredient/{si_id}/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def add_tag_to_supplier_ingredient(
    si_id: int,
    tag_id: int,
    session: Session = Depends(get_session),
):
    """Link a tag to a supplier ingredient (idempotent)."""
    svc.add_tag_to_supplier_ingredient(session, si_id, tag_id)


@router.delete(
    "/supplier-ingredient/{si_id}/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_tag_from_supplier_ingredient(
    si_id: int,
    tag_id: int,
    session: Session = Depends(get_session),
):
    """Unlink a tag from a supplier ingredient."""
    svc.remove_tag_from_supplier_ingredient(session, si_id, tag_id)
