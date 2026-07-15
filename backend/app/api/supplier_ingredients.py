"""Supplier ingredients listing API — cross-supplier product view."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.api.deps import get_current_user, get_session
from app.models.ingredient import Ingredient
from app.models.pagination import PaginatedResponse
from app.models.supplier import Supplier
from app.models.supplier_ingredient import SupplierIngredient
from app.models.user import User
from app.passport import access

router = APIRouter()

# Sentinel id that no row can carry — the "see nothing" filter for a user scoped to no unit.
_MATCHES_NOTHING = -1


class SupplierIngredientItem(BaseModel):
    """Flattened view of a supplier-ingredient entry for the Products tab."""

    id: int
    ingredient_id: int
    ingredient_name: str | None
    category_name: str | None
    sku: str | None
    supplier_id: int
    supplier_name: str | None
    unit: str
    price_per_pack: float


def _build_query(search: str | None, user: User, session: Session):
    """Build the base SELECT with joins, scoped to the Passport units the caller can see.

    `accessible_unit_ids` is empty for a user who holds a role at no brand, and an empty scope
    means "sees nothing" — fail closed. Org Owners/Admins hold a role at every brand, so their
    scope already covers every unit and needs no bypass branch.
    """
    from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

    stmt = (
        select(
            SupplierIngredient.id,
            SupplierIngredient.ingredient_id,
            Ingredient.name.label("ingredient_name"),
            SupplierIngredient.supplier_id,
            Supplier.name.label("supplier_name"),
            SupplierIngredient.sku,
            SupplierIngredient.pack_unit,
            SupplierIngredient.price_per_pack,
        )
        .join(Ingredient, SupplierIngredient.ingredient_id == Ingredient.id, isouter=True)
        .join(Supplier, SupplierIngredient.supplier_id == Supplier.id, isouter=True)
    )

    if search:
        stmt = stmt.where(
            Ingredient.name.ilike(f"%{search}%") | SupplierIngredient.sku.ilike(f"%{search}%")
        )

    accessible_unit_ids = access.accessible_unit_ids(session, user.id)
    if not accessible_unit_ids:
        return stmt.where(SupplierIngredient.id == _MATCHES_NOTHING)

    return stmt.where(
        col(SupplierIngredient.id).in_(
            select(OutletSupplierIngredient.supplier_ingredient_id).where(
                col(OutletSupplierIngredient.unit_id).in_(accessible_unit_ids)
            )
        )
    )


@router.get("", response_model=PaginatedResponse[SupplierIngredientItem])
def list_supplier_ingredients(
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all supplier-ingredient entries across all suppliers (paginated)."""
    from app.models.category import Category

    base_stmt = _build_query(search=search, user=current_user, session=session)

    # Count
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = session.exec(count_stmt).one()

    # Paginate
    offset = (page_number - 1) * page_size
    rows = session.exec(base_stmt.offset(offset).limit(page_size)).all()

    # Fetch category names in one pass
    ingredient_ids = [r.ingredient_id for r in rows if r.ingredient_id]
    category_map: dict[int, str] = {}
    if ingredient_ids:
        ing_rows = session.exec(
            select(Ingredient.id, Ingredient.category_id).where(Ingredient.id.in_(ingredient_ids))
        ).all()
        category_ids = [r.category_id for r in ing_rows if r.category_id]
        ing_to_cat = {r.id: r.category_id for r in ing_rows if r.category_id}
        if category_ids:
            cat_rows = session.exec(
                select(Category.id, Category.name).where(Category.id.in_(category_ids))
            ).all()
            cat_id_to_name = {r.id: r.name for r in cat_rows}
            for ing_id, cat_id in ing_to_cat.items():
                category_map[ing_id] = cat_id_to_name.get(cat_id, "")

    items = [
        SupplierIngredientItem(
            id=r.id,
            ingredient_id=r.ingredient_id,
            ingredient_name=r.ingredient_name,
            category_name=category_map.get(r.ingredient_id),
            sku=r.sku,
            supplier_id=r.supplier_id,
            supplier_name=r.supplier_name,
            unit=r.pack_unit,
            price_per_pack=r.price_per_pack,
        )
        for r in rows
    ]

    return PaginatedResponse.create(
        items=items,
        total_count=total,
        page_number=page_number,
        page_size=page_size,
    )
