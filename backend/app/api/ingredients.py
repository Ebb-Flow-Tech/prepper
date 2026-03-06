"""Ingredient API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session, get_current_user
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
    User,
    UserType,
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


@router.get("")
def list_ingredients(
    active_only: bool = True,
    category: FoodCategory | None = None,
    source: IngredientSource | None = None,
    master_only: bool = False,
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    category_ids: str | None = Query(default=None),
    units: str | None = Query(default=None),
    allergen_ids: str | None = Query(default=None),
    is_halal: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """List all ingredients with optional filters."""
    from app.models.pagination import PaginatedResponse

    parsed_category_ids = [int(x) for x in category_ids.split(",")] if category_ids else None
    parsed_units = units.split(",") if units else None
    parsed_allergen_ids = [int(x) for x in allergen_ids.split(",")] if allergen_ids else None
    parsed_is_halal = [x.strip().lower() == "true" for x in is_halal.split(",")] if is_halal else None

    service = IngredientService(session)
    offset = (page_number - 1) * page_size
    filter_kwargs = dict(active_only=active_only, category=category, source=source, master_only=master_only, search=search,
                         category_ids=parsed_category_ids, units=parsed_units, allergen_ids=parsed_allergen_ids, is_halal=parsed_is_halal)
    items, total = service.list_paginated_with_count(offset=offset, limit=page_size, **filter_kwargs)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


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
    current_user: User = Depends(get_current_user),
):
    """Get all suppliers for an ingredient (filtered by user's outlet tree)."""
    service = IngredientService(session)
    result = service.get_ingredient_suppliers(
        ingredient_id,
        user_outlet_id=current_user.outlet_id,
        is_admin=current_user.user_type == UserType.ADMIN,
    )
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    """Update a supplier-ingredient link."""
    # Only admins can change the outlet
    if data.outlet_id is not None and current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can change the outlet",
        )
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    """Get the preferred supplier for an ingredient (filtered by user's outlet tree)."""
    service = IngredientService(session)
    ingredient = service.get_ingredient(ingredient_id)
    if not ingredient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient not found",
        )
    return service.get_preferred_supplier(
        ingredient_id,
        user_outlet_id=current_user.outlet_id,
        is_admin=current_user.user_type == UserType.ADMIN,
    )
