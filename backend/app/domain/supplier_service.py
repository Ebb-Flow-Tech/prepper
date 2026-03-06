"""Supplier domain operations."""

from datetime import datetime

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.domain.outlet_service import OutletService
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.supplier_ingredient import SupplierIngredient, SupplierIngredientRead


class SupplierService:
    """Service for supplier CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_supplier(self, data: SupplierCreate) -> Supplier:
        """Create a new supplier."""
        supplier = Supplier.model_validate(data)
        self.session.add(supplier)
        self.session.commit()
        self.session.refresh(supplier)
        return supplier

    def list_suppliers(self, active_only: bool = True) -> list[Supplier]:
        """List all suppliers.

        Args:
            active_only: If True, only return active suppliers (is_active=True)
        """
        statement = select(Supplier)
        if active_only:
            statement = statement.where(Supplier.is_active == True)
        return list(self.session.exec(statement).all())

    def _build_list_query(self, active_only=True, search=None):
        statement = select(Supplier)
        if active_only:
            statement = statement.where(Supplier.is_active == True)
        if search:
            statement = statement.where(Supplier.name.ilike(f"%{search}%"))
        return statement

    def list_paginated(self, offset: int, limit: int, active_only=True, search=None) -> list[Supplier]:
        statement = self._build_list_query(active_only=active_only, search=search)
        statement = statement.offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def count(self, active_only=True, search=None) -> int:
        from sqlalchemy import func
        statement = self._build_list_query(active_only=active_only, search=search)
        count_stmt = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_stmt).one()

    def get_supplier(self, supplier_id: int) -> Supplier | None:
        """Get a supplier by ID."""
        return self.session.get(Supplier, supplier_id)

    def update_supplier(
        self, supplier_id: int, data: SupplierUpdate
    ) -> Supplier | None:
        """Update a supplier's fields."""
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(supplier, key, value)

        supplier.updated_at = datetime.utcnow()
        self.session.add(supplier)
        self.session.commit()
        self.session.refresh(supplier)
        return supplier

    def deactivate_supplier(self, supplier_id: int) -> Supplier | None:
        """Soft-delete a supplier by setting is_active to False."""
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return None

        supplier.is_active = False
        supplier.updated_at = datetime.utcnow()
        self.session.add(supplier)
        self.session.commit()
        self.session.refresh(supplier)
        return supplier

    def delete_supplier(self, supplier_id: int) -> bool:
        """Delete a supplier by ID."""
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return False

        self.session.delete(supplier)
        self.session.commit()
        return True

    def get_supplier_ingredients(
        self,
        supplier_id: int,
        user_outlet_id: int | None = None,
        is_admin: bool = False,
    ) -> list[SupplierIngredientRead]:
        """Get all ingredients associated with a supplier via the supplier_ingredients table.

        Filters by outlet tree when user_outlet_id is provided (non-admin).
        """
        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.supplier_id == supplier_id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet),
            )
        )

        if not is_admin:
            if user_outlet_id is None:
                return []
            accessible = OutletService(self.session).get_accessible_outlet_ids(user_outlet_id)
            statement = statement.where(SupplierIngredient.outlet_id.in_(accessible))

        rows = self.session.exec(statement).all()

        result = []
        for si in rows:
            supplier_name = si.supplier.name if si.supplier else None
            ingredient_name = si.ingredient.name if si.ingredient else None
            outlet_name = si.outlet.name if si.outlet else None
            result.append(
                SupplierIngredientRead(
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
            )
        return result
