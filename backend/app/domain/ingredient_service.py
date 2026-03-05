"""Ingredient domain operations."""

from collections import deque
from datetime import datetime

from sqlmodel import Session, select

from app.models import (
    Ingredient,
    IngredientCreate,
    IngredientListRead,
    IngredientUpdate,
    FoodCategory,
    IngredientSource,
    Outlet,
    SupplierIngredient,
    SupplierIngredientCreate,
    SupplierIngredientUpdate,
    SupplierIngredientRead,
)
from app.models.supplier import Supplier


def get_accessible_outlet_ids(session: Session, user_outlet_id: int) -> set[int]:
    """Return all outlet IDs in the same tree as `user_outlet_id`.

    Walks up to the root, then BFS down to collect every descendant.
    """
    outlets = list(session.exec(select(Outlet)).all())
    by_id = {o.id: o for o in outlets}

    # Walk up to find the root
    current = user_outlet_id
    while current in by_id and by_id[current].parent_outlet_id is not None:
        current = by_id[current].parent_outlet_id
    root_id = current

    # BFS down from root
    children_map: dict[int, list[int]] = {}
    for o in outlets:
        parent = o.parent_outlet_id
        if parent is not None:
            children_map.setdefault(parent, []).append(o.id)

    result: set[int] = set()
    queue: deque[int] = deque([root_id])
    while queue:
        nid = queue.popleft()
        result.add(nid)
        for child in children_map.get(nid, []):
            queue.append(child)

    return result


class IngredientService:
    """Service for ingredient CRUD operations."""

    def __init__(self, session: Session):
        self.session = session
        self._accessible_outlet_ids_cache: dict[int, set[int]] = {}

    def _get_accessible_outlet_ids(self, user_outlet_id: int) -> set[int]:
        """Cached wrapper around get_accessible_outlet_ids (per-request)."""
        if user_outlet_id not in self._accessible_outlet_ids_cache:
            self._accessible_outlet_ids_cache[user_outlet_id] = get_accessible_outlet_ids(
                self.session, user_outlet_id
            )
        return self._accessible_outlet_ids_cache[user_outlet_id]

    def create_ingredient(self, data: IngredientCreate) -> Ingredient:
        """Create a new ingredient."""
        ingredient = Ingredient.model_validate(data)
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def list_ingredients(
        self,
        active_only: bool = True,
        category: FoodCategory | None = None,
        source: IngredientSource | None = None,
        master_only: bool = False,
    ) -> list[Ingredient]:
        """List all ingredients with optional filters.

        Args:
            active_only: If True, only return active ingredients
            category: Filter by food category
            source: Filter by source (fmh or manual)
            master_only: If True, only return ingredients without a master (top-level)
        """
        statement = select(Ingredient)

        if active_only:
            statement = statement.where(Ingredient.is_active == True)

        if category is not None:
            statement = statement.where(Ingredient.category == category)

        if source is not None:
            statement = statement.where(Ingredient.source == source)

        if master_only:
            statement = statement.where(Ingredient.master_ingredient_id == None)

        return list(self.session.exec(statement).all())

    def _build_list_query(self, active_only=True, category=None, source=None, master_only=False, search=None,
                          category_ids=None, units=None, allergen_ids=None, is_halal=None):
        statement = select(Ingredient)
        if active_only:
            statement = statement.where(Ingredient.is_active == True)
        if category is not None:
            statement = statement.where(Ingredient.category == category)
        if source is not None:
            statement = statement.where(Ingredient.source == source)
        if master_only:
            statement = statement.where(Ingredient.master_ingredient_id == None)
        if search:
            statement = statement.where(Ingredient.name.ilike(f"%{search}%"))
        if category_ids:
            statement = statement.where(Ingredient.category_id.in_(category_ids))
        if units:
            statement = statement.where(Ingredient.base_unit.in_(units))
        if is_halal is not None:
            statement = statement.where(Ingredient.is_halal.in_(is_halal))
        if allergen_ids:
            from app.models.ingredient_allergen import IngredientAllergen
            allergen_subquery = select(IngredientAllergen.ingredient_id).where(
                IngredientAllergen.allergen_id.in_(allergen_ids)
            ).distinct()
            statement = statement.where(Ingredient.id.in_(allergen_subquery))
        return statement

    def list_paginated(self, offset: int, limit: int, active_only=True, category=None, source=None, master_only=False, search=None,
                        category_ids=None, units=None, allergen_ids=None, is_halal=None) -> list[IngredientListRead]:
        statement = self._build_list_query(active_only=active_only, category=category, source=source, master_only=master_only, search=search,
                                           category_ids=category_ids, units=units, allergen_ids=allergen_ids, is_halal=is_halal)
        statement = statement.order_by(Ingredient.id.desc()).offset(offset).limit(limit)
        rows = self.session.exec(statement).all()
        return [IngredientListRead.model_validate(r) for r in rows]

    def count(self, active_only=True, category=None, source=None, master_only=False, search=None,
              category_ids=None, units=None, allergen_ids=None, is_halal=None) -> int:
        from sqlalchemy import func
        statement = self._build_list_query(active_only=active_only, category=category, source=source, master_only=master_only, search=search,
                                           category_ids=category_ids, units=units, allergen_ids=allergen_ids, is_halal=is_halal)
        count_stmt = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_stmt).one()

    def get_ingredient(self, ingredient_id: int) -> Ingredient | None:
        """Get an ingredient by ID."""
        return self.session.get(Ingredient, ingredient_id)

    def get_variants(self, master_ingredient_id: int) -> list[Ingredient]:
        """Get all variant ingredients linked to a master ingredient."""
        statement = select(Ingredient).where(
            Ingredient.master_ingredient_id == master_ingredient_id,
            Ingredient.is_active == True,
        )
        return list(self.session.exec(statement).all())

    def update_ingredient(
        self, ingredient_id: int, data: IngredientUpdate
    ) -> Ingredient | None:
        """Update an ingredient's fields."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ingredient, key, value)

        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def update_ingredient_cost(
        self, ingredient_id: int, new_cost: float
    ) -> Ingredient | None:
        """Update an ingredient's cost per base unit."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        ingredient.cost_per_base_unit = new_cost
        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def deactivate_ingredient(self, ingredient_id: int) -> Ingredient | None:
        """Soft-delete an ingredient by setting is_active to False."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        ingredient.is_active = False
        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    # -------------------------------------------------------------------------
    # Supplier Management (via supplier_ingredients table)
    # -------------------------------------------------------------------------

    def _build_supplier_ingredient_read(
        self, si: SupplierIngredient
    ) -> SupplierIngredientRead:
        """Build a SupplierIngredientRead DTO from a SupplierIngredient row."""
        supplier_name = None
        ingredient_name = None
        outlet_name = None
        if si.supplier:
            supplier_name = si.supplier.name
        if si.ingredient:
            ingredient_name = si.ingredient.name
        if si.outlet:
            outlet_name = si.outlet.name

        return SupplierIngredientRead(
            id=si.id,
            ingredient_id=si.ingredient_id,
            supplier_id=si.supplier_id,
            outlet_id=si.outlet_id,
            sku=si.sku,
            pack_size=si.pack_size,
            pack_unit=si.pack_unit,
            price_per_pack=si.price_per_pack,
            currency=si.currency,
            source=si.source,
            is_preferred=si.is_preferred,
            created_at=si.created_at,
            updated_at=si.updated_at,
            supplier_name=supplier_name,
            ingredient_name=ingredient_name,
            outlet_name=outlet_name,
        )

    def get_ingredient_suppliers(
        self,
        ingredient_id: int,
        user_outlet_id: int | None = None,
        is_admin: bool = False,
    ) -> list[SupplierIngredientRead] | None:
        """Get all supplier links for an ingredient.

        Returns None if ingredient not found, empty list if no suppliers.
        Filters by outlet tree when user_outlet_id is provided (non-admin).
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        from sqlalchemy.orm import selectinload

        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.ingredient_id == ingredient_id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet),
            )
        )

        if not is_admin:
            if user_outlet_id is None:
                return []
            accessible = self._get_accessible_outlet_ids(user_outlet_id)
            statement = statement.where(SupplierIngredient.outlet_id.in_(accessible))

        rows = self.session.exec(statement).all()
        return [self._build_supplier_ingredient_read(si) for si in rows]

    def add_ingredient_supplier(
        self, ingredient_id: int, data: SupplierIngredientCreate
    ) -> SupplierIngredientRead | None | str:
        """Add a supplier link to an ingredient.

        Returns:
            SupplierIngredientRead on success, None if ingredient/supplier not found,
            or an error string if a duplicate link or SKU exists.
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        # Verify supplier exists
        supplier = self.session.get(Supplier, data.supplier_id)
        if not supplier:
            return None

        # Check for duplicate (ingredient_id, supplier_id, outlet_id)
        existing = self.session.exec(
            select(SupplierIngredient).where(
                SupplierIngredient.ingredient_id == ingredient_id,
                SupplierIngredient.supplier_id == data.supplier_id,
                SupplierIngredient.outlet_id == data.outlet_id,
            )
        ).first()
        if existing:
            return "Supplier is already linked to this ingredient for this outlet"

        # Check for duplicate SKU
        if data.sku:
            sku_exists = self.session.exec(
                select(SupplierIngredient).where(
                    SupplierIngredient.sku == data.sku,
                )
            ).first()
            if sku_exists:
                return "SKU already exists"

        # If this is marked as preferred, unset preferred on others
        if data.is_preferred:
            self._unset_preferred(ingredient_id)

        si = SupplierIngredient(
            ingredient_id=ingredient_id,
            supplier_id=data.supplier_id,
            outlet_id=data.outlet_id,
            sku=data.sku,
            pack_size=data.pack_size,
            pack_unit=data.pack_unit,
            price_per_pack=data.price_per_pack,
            currency=data.currency,
            source=data.source,
            is_preferred=data.is_preferred,
        )
        self.session.add(si)
        self.session.commit()
        self.session.refresh(si)

        # Reload with relationships
        from sqlalchemy.orm import selectinload

        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.id == si.id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet),
            )
        )
        refreshed = self.session.exec(statement).first()
        return self._build_supplier_ingredient_read(refreshed) if refreshed else None

    def update_ingredient_supplier(
        self, supplier_ingredient_id: int, data: SupplierIngredientUpdate
    ) -> SupplierIngredientRead | None:
        """Update a supplier-ingredient link."""
        si = self.session.get(SupplierIngredient, supplier_ingredient_id)
        if not si:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # If setting as preferred, unset others first
        if update_data.get("is_preferred"):
            self._unset_preferred(si.ingredient_id)

        for key, value in update_data.items():
            setattr(si, key, value)

        si.updated_at = datetime.utcnow()
        self.session.add(si)
        self.session.commit()
        self.session.refresh(si)

        # Reload with relationships
        from sqlalchemy.orm import selectinload

        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.id == si.id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet),
            )
        )
        refreshed = self.session.exec(statement).first()
        return self._build_supplier_ingredient_read(refreshed) if refreshed else None

    def remove_ingredient_supplier(self, supplier_ingredient_id: int) -> bool:
        """Remove a supplier-ingredient link."""
        si = self.session.get(SupplierIngredient, supplier_ingredient_id)
        if not si:
            return False

        self.session.delete(si)
        self.session.commit()
        return True

    def get_preferred_supplier(
        self,
        ingredient_id: int,
        user_outlet_id: int | None = None,
        is_admin: bool = False,
    ) -> SupplierIngredientRead | None:
        """Get the preferred supplier for an ingredient.

        Returns the supplier link marked as preferred, or the first one
        if none is marked, or None if no suppliers exist.
        Filters by outlet tree when user_outlet_id is provided (non-admin).
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        from sqlalchemy.orm import selectinload

        accessible: set[int] | None = None
        if not is_admin:
            if user_outlet_id is None:
                return None
            accessible = self._get_accessible_outlet_ids(user_outlet_id)

        # Try preferred first
        statement = (
            select(SupplierIngredient)
            .where(
                SupplierIngredient.ingredient_id == ingredient_id,
                SupplierIngredient.is_preferred == True,
            )
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet),
            )
        )
        if accessible is not None:
            statement = statement.where(SupplierIngredient.outlet_id.in_(accessible))

        preferred = self.session.exec(statement).first()
        if preferred:
            return self._build_supplier_ingredient_read(preferred)

        # Fall back to first supplier
        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.ingredient_id == ingredient_id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet),
            )
            .limit(1)
        )
        if accessible is not None:
            statement = statement.where(SupplierIngredient.outlet_id.in_(accessible))

        first = self.session.exec(statement).first()
        return self._build_supplier_ingredient_read(first) if first else None

    def _unset_preferred(self, ingredient_id: int) -> None:
        """Unset is_preferred on all supplier links for an ingredient."""
        statement = select(SupplierIngredient).where(
            SupplierIngredient.ingredient_id == ingredient_id,
            SupplierIngredient.is_preferred == True,
        )
        for si in self.session.exec(statement).all():
            si.is_preferred = False
            self.session.add(si)
