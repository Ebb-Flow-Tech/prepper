"""Supplier domain operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.ingredient import Ingredient


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

    def get_supplier_ingredients(self, supplier_id: int) -> list[dict]:
        """Get all ingredients associated with a supplier.

        Returns a list of dicts containing ingredient info and supplier entry data.
        Each entry includes the ingredient details and the supplier-specific pricing info.
        """
        # Get all active ingredients
        statement = select(Ingredient).where(Ingredient.is_active == True)
        ingredients = self.session.exec(statement).all()

        result = []
        supplier_id_str = str(supplier_id)

        for ingredient in ingredients:
            if not ingredient.suppliers:
                continue

            # Check if this supplier is in the ingredient's suppliers
            for supplier_entry in ingredient.suppliers:
                if supplier_entry.get("supplier_id") == supplier_id_str:
                    result.append({
                        "ingredient_id": ingredient.id,
                        "ingredient_name": ingredient.name,
                        "base_unit": ingredient.base_unit,
                        "supplier_id": supplier_entry.get("supplier_id"),
                        "sku": supplier_entry.get("sku"),
                        "pack_size": supplier_entry.get("pack_size"),
                        "pack_unit": supplier_entry.get("pack_unit"),
                        "price_per_pack": supplier_entry.get("price_per_pack"),
                        "cost_per_unit": supplier_entry.get("cost_per_unit"),
                        "currency": supplier_entry.get("currency", "SGD"),
                        "is_preferred": supplier_entry.get("is_preferred", False),
                        "source": supplier_entry.get("source", "manual"),
                        "last_updated": supplier_entry.get("last_updated"),
                    })
                    break

        return result
