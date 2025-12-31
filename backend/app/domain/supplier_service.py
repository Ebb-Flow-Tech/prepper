"""Supplier domain operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)


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

    def list_suppliers(self) -> list[Supplier]:
        """List all suppliers."""
        statement = select(Supplier)
        return list(self.session.exec(statement).all())

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

    def delete_supplier(self, supplier_id: int) -> bool:
        """Delete a supplier by ID."""
        supplier = self.get_supplier(supplier_id)
        if not supplier:
            return False

        self.session.delete(supplier)
        self.session.commit()
        return True
