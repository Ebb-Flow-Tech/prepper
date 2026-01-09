"""Ingredient API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    Ingredient,
    IngredientCreate,
    IngredientUpdate,
    FoodCategory,
    IngredientSource,
    SupplierEntryCreate,
    SupplierEntryUpdate,
)
from app.domain import IngredientService

router = APIRouter()


@router.post("", response_model=Ingredient, status_code=status.HTTP_201_CREATED)
def create_ingredient(
    data: IngredientCreate,
    session: Session = Depends(get_session),
):
    """Create a new ingredient."""
    service = IngredientService(session)
    return service.create_ingredient(data)


@router.get("", response_model=list[Ingredient])
def list_ingredients(
    active_only: bool = True,
    category: FoodCategory | None = None,
    source: IngredientSource | None = None,
    master_only: bool = False,
    session: Session = Depends(get_session),
):
    """List all ingredients with optional filters.

    Query Parameters:
        active_only: If True, only return active ingredients (default: True)
        category: Filter by food category (e.g., "proteins", "vegetables")
        source: Filter by source ("fmh" or "manual")
        master_only: If True, only return master ingredients (no variants)
    """
    service = IngredientService(session)
    return service.list_ingredients(
        active_only=active_only,
        category=category,
        source=source,
        master_only=master_only,
    )


@router.get("/categories", response_model=list[str])
def list_categories():
    """List all available food categories."""
    return [c.value for c in FoodCategory]


@router.get("/{ingredient_id}", response_model=Ingredient)
def get_ingredient(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get an ingredient by ID."""
    service = IngredientService(session)
    ingredient = service.get_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient


@router.get("/{ingredient_id}/variants", response_model=list[Ingredient])
def get_variants(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get all variant ingredients linked to a master ingredient."""
    service = IngredientService(session)

    # Verify the ingredient exists
    ingredient = service.get_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )

    return service.get_variants(ingredient_id)


@router.patch("/{ingredient_id}", response_model=Ingredient)
def update_ingredient(
    ingredient_id: int,
    data: IngredientUpdate,
    session: Session = Depends(get_session),
):
    """Update an ingredient."""
    service = IngredientService(session)
    ingredient = service.update_ingredient(ingredient_id, data)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient


@router.patch("/{ingredient_id}/deactivate", response_model=Ingredient)
def deactivate_ingredient(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Deactivate (soft-delete) an ingredient."""
    service = IngredientService(session)
    ingredient = service.deactivate_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient


# -----------------------------------------------------------------------------
# Supplier Management Endpoints
# -----------------------------------------------------------------------------


@router.post("/{ingredient_id}/suppliers", response_model=Ingredient)
def add_supplier(
    ingredient_id: int,
    data: SupplierEntryCreate,
    session: Session = Depends(get_session),
):
    """Add a supplier entry to an ingredient.

    If a supplier with the same supplier_id already exists, it will be updated instead.
    """
    service = IngredientService(session)
    ingredient = service.add_supplier(ingredient_id, data)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return ingredient


@router.patch("/{ingredient_id}/suppliers/{supplier_id}", response_model=Ingredient)
def update_supplier(
    ingredient_id: int,
    supplier_id: str,
    data: SupplierEntryUpdate,
    session: Session = Depends(get_session),
):
    """Update a supplier entry for an ingredient."""
    service = IngredientService(session)
    ingredient = service.update_supplier(ingredient_id, supplier_id, data)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient or supplier not found",
        )
    return ingredient


@router.delete("/{ingredient_id}/suppliers/{supplier_id}", response_model=Ingredient)
def remove_supplier(
    ingredient_id: int,
    supplier_id: str,
    session: Session = Depends(get_session),
):
    """Remove a supplier entry from an ingredient."""
    service = IngredientService(session)
    ingredient = service.remove_supplier(ingredient_id, supplier_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient or supplier not found",
        )
    return ingredient


@router.get("/{ingredient_id}/suppliers", response_model=list[dict])
def get_suppliers(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get all suppliers for an ingredient.

    Returns the list of all supplier entries for this ingredient.
    """
    service = IngredientService(session)

    suppliers = service.get_suppliers(ingredient_id)
    if suppliers is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )

    return suppliers


@router.get("/{ingredient_id}/suppliers/preferred", response_model=dict | None)
def get_preferred_supplier(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get the preferred supplier for an ingredient.

    Returns the supplier entry marked as preferred, or the first supplier
    if none is marked as preferred, or null if no suppliers exist.
    """
    service = IngredientService(session)

    # Verify the ingredient exists
    ingredient = service.get_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )

    return service.get_preferred_supplier(ingredient_id)
