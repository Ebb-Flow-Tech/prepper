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
    SupplierIngredientCreate,
    SupplierIngredientUpdate,
    SupplierIngredientRead,
    Category,
)
from app.domain import IngredientService
from app.domain.category_service import CategoryService

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


@router.get("/categories", response_model=list[Category])
def list_categories(
    session: Session = Depends(get_session),
):
    """List all available ingredient categories from the database."""
    service = CategoryService(session)
    return service.list_categories(active_only=True)


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


@router.get("/{ingredient_id}/suppliers", response_model=list[SupplierIngredientRead])
def get_ingredient_suppliers(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get all suppliers for an ingredient."""
    service = IngredientService(session)
    result = service.get_ingredient_suppliers(ingredient_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return result


@router.post(
    "/{ingredient_id}/suppliers",
    response_model=SupplierIngredientRead,
    status_code=status.HTTP_201_CREATED,
)
def add_ingredient_supplier(
    ingredient_id: int,
    data: SupplierIngredientCreate,
    session: Session = Depends(get_session),
):
    """Add a supplier to an ingredient."""
    # Ensure the path ingredient_id matches the body
    data.ingredient_id = ingredient_id
    service = IngredientService(session)
    result = service.add_ingredient_supplier(ingredient_id, data)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient or supplier not found",
        )
    if isinstance(result, str):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result,
        )
    return result


@router.patch(
    "/{ingredient_id}/suppliers/{supplier_ingredient_id}",
    response_model=SupplierIngredientRead,
)
def update_ingredient_supplier(
    ingredient_id: int,
    supplier_ingredient_id: int,
    data: SupplierIngredientUpdate,
    session: Session = Depends(get_session),
):
    """Update a supplier-ingredient link."""
    service = IngredientService(session)
    result = service.update_ingredient_supplier(supplier_ingredient_id, data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier-ingredient link not found",
        )
    return result


@router.delete(
    "/{ingredient_id}/suppliers/{supplier_ingredient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_ingredient_supplier(
    ingredient_id: int,
    supplier_ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Remove a supplier from an ingredient."""
    service = IngredientService(session)
    success = service.remove_ingredient_supplier(supplier_ingredient_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier-ingredient link not found",
        )


@router.get(
    "/{ingredient_id}/suppliers/preferred",
    response_model=SupplierIngredientRead | None,
)
def get_preferred_supplier(
    ingredient_id: int,
    session: Session = Depends(get_session),
):
    """Get the preferred supplier for an ingredient."""
    service = IngredientService(session)
    ingredient = service.get_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return service.get_preferred_supplier(ingredient_id)
