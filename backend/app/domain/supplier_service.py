"""Supplier domain operations."""

from datetime import datetime

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.domain.org_scope import org_scope
from app.models.passport import PassportUnit
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.supplier_ingredient import SupplierIngredient, SupplierIngredientRead
from app.passport import access


class SupplierService:
    """Service for supplier CRUD operations."""

    def __init__(self, session: Session, organization_id: str):
        """``organization_id`` is required and has no default — see `CategoryService.__init__`."""
        self.session = session
        self.organization_id = organization_id

    def create_supplier(self, data: SupplierCreate) -> Supplier:
        """Create a new supplier, stamped with the acting org.

        The org comes from the acting org context, never from the request body — the Create
        schemas deliberately have no such field. A tenant id a client can assert is not a
        tenant id, for the same reason `owner_id` and `users.email` are not.
        """
        supplier = Supplier.model_validate(data)
        supplier.organization_id = self.organization_id
        self.session.add(supplier)
        self.session.commit()
        self.session.refresh(supplier)
        return supplier

    def list_suppliers(self, active_only: bool = True) -> list[Supplier]:
        """List this org's suppliers.

        Args:
            active_only: If True, only return active suppliers (is_active=True)
        """
        statement = select(Supplier).where(org_scope(Supplier, self.organization_id))
        if active_only:
            statement = statement.where(Supplier.is_active == True)
        return list(self.session.exec(statement).all())

    def _build_list_query(self, active_only=True, search=None):
        statement = select(Supplier).where(org_scope(Supplier, self.organization_id))
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
        """Get a supplier by ID, within this org.

        `update_supplier` and the soft-delete resolve through here, so this predicate is what
        stops a cross-org write as well as a cross-org read.
        """
        return self.session.exec(
            select(Supplier).where(
                Supplier.id == supplier_id,
                org_scope(Supplier, self.organization_id),
            )
        ).first()

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

    def _unit_names(self, unit_ids: set[str]) -> dict[str, str]:
        """``{unit_id: name}`` for the given units, in one query.

        A unit's name is Passport's, held in the projection — the link row carries only the
        UUID, so names are batch-loaded rather than traversed per row (N+1).
        """
        if not unit_ids:
            return {}
        rows = self.session.exec(
            select(PassportUnit.id, PassportUnit.name).where(
                col(PassportUnit.id).in_(unit_ids)
            )
        ).all()
        return {unit_id: name for unit_id, name in rows}

    def get_supplier_ingredients(
        self, supplier_id: int, subject: str
    ) -> list[SupplierIngredientRead]:
        """Get all ingredients associated with a supplier via the supplier_ingredients table.

        Org admins see every link. Everyone else sees only links attached to a unit in
        ``access.accessible_unit_ids`` — Passport's brand->outlet structure decides the
        scope; Prepper no longer walks an outlet hierarchy of its own.
        """
        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.supplier_id == supplier_id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet_links),
            )
        )

        # No org-admin bypass: `accessible_unit_ids` already covers an org admin via the Passport
        # ladder, so the branch only ever skipped the filter for OTHER orgs — `is_org_admin`
        # without an org means "admin of ANY of your orgs".
        accessible = access.accessible_unit_ids(self.session, subject)
        if not accessible:
            return []

        statement = statement.where(
            col(SupplierIngredient.id).in_(
                select(OutletSupplierIngredient.supplier_ingredient_id).where(
                    col(OutletSupplierIngredient.unit_id).in_(accessible)
                )
            )
        )

        rows = list(self.session.exec(statement).all())
        unit_names = self._unit_names(
            {link.unit_id for si in rows for link in si.outlet_links}
        )

        result = []
        for si in rows:
            unit_id = si.outlet_links[0].unit_id if si.outlet_links else None
            result.append(
                SupplierIngredientRead(
                    id=si.id,
                    ingredient_id=si.ingredient_id,
                    supplier_id=si.supplier_id,
                    unit_id=unit_id,
                    sku=si.sku,
                    pack_size=si.pack_size,
                    pack_unit=si.pack_unit,
                    price_per_pack=si.price_per_pack,
                    currency=si.currency,
                    source=si.source,
                    is_preferred=si.is_preferred,
                    created_at=si.created_at,
                    updated_at=si.updated_at,
                    supplier_name=si.supplier.name if si.supplier else None,
                    ingredient_name=si.ingredient.name if si.ingredient else None,
                    unit_name=unit_names.get(unit_id) if unit_id else None,
                )
            )
        return result
