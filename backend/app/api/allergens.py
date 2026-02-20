"""Allergen API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models.allergen import (
    Allergen,
    AllergenCreate,
    AllergenUpdate,
)
from app.domain.allergen_service import AllergenService

router = APIRouter()


@router.post("", response_model=Allergen, status_code=status.HTTP_201_CREATED)
def create_allergen(
    data: AllergenCreate,
    session: Session = Depends(get_session),
):
    """Create a new allergen.

    Allergen names must be unique (case-insensitive).
    """
    service = AllergenService(session)
    try:
        return service.create_allergen(data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("", response_model=list[Allergen])
def list_allergens(
    active_only: bool = True,
    session: Session = Depends(get_session),
):
    """List all allergens.

    By default, only active (non-deleted) allergens are returned.
    Set active_only=false to include soft-deleted allergens.
    """
    service = AllergenService(session)
    return service.list_allergens(active_only=active_only)


@router.get("/{allergen_id}", response_model=Allergen)
def get_allergen(
    allergen_id: int,
    session: Session = Depends(get_session),
):
    """Get an allergen by ID."""
    service = AllergenService(session)
    allergen = service.get_allergen(allergen_id)
    if not allergen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allergen not found",
        )
    return allergen


@router.patch("/{allergen_id}", response_model=Allergen)
def update_allergen(
    allergen_id: int,
    data: AllergenUpdate,
    session: Session = Depends(get_session),
):
    """Update an allergen.

    Allergen names must be unique (case-insensitive).
    """
    service = AllergenService(session)
    try:
        allergen = service.update_allergen(allergen_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    if not allergen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allergen not found",
        )
    return allergen


@router.delete("/{allergen_id}", response_model=Allergen)
def delete_allergen(
    allergen_id: int,
    session: Session = Depends(get_session),
):
    """Soft-delete an allergen by setting is_active to False.

    The allergen is not physically removed from the database.
    """
    service = AllergenService(session)
    allergen = service.soft_delete_allergen(allergen_id)
    if not allergen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allergen not found",
        )
    return allergen
