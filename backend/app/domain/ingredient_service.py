"""Ingredient domain operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models import (
    Ingredient,
    IngredientCreate,
    IngredientUpdate,
    FoodCategory,
    IngredientSource,
    SupplierEntryCreate,
    SupplierEntryUpdate,
)


class IngredientService:
    """Service for ingredient CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

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
    # Supplier Management
    # -------------------------------------------------------------------------

    def add_supplier(
        self, ingredient_id: int, data: SupplierEntryCreate
    ) -> Ingredient | None:
        """Add a supplier entry to an ingredient."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        # Initialize suppliers list if None
        if ingredient.suppliers is None:
            ingredient.suppliers = []

        # Check if supplier_id already exists
        for supplier in ingredient.suppliers:
            if supplier.get("supplier_id") == data.supplier_id:
                # Update existing supplier instead
                return self.update_supplier(ingredient_id, data.supplier_id, data)

        # Build supplier entry dict
        supplier_entry = data.model_dump()
        supplier_entry["last_updated"] = datetime.utcnow().isoformat()

        # If this is marked as preferred, unset preferred on others
        if data.is_preferred:
            updated_suppliers = [{**s, "is_preferred": False} for s in ingredient.suppliers]
        else:
            updated_suppliers = list(ingredient.suppliers)

        # Create a new list to force SQLAlchemy to detect the change in JSON column
        ingredient.suppliers = updated_suppliers + [supplier_entry]
        ingredient.updated_at = datetime.utcnow()

        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def update_supplier(
        self, ingredient_id: int, supplier_id: str, data: SupplierEntryUpdate
    ) -> Ingredient | None:
        """Update a supplier entry for an ingredient."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient or not ingredient.suppliers:
            return None

        update_data = data.model_dump(exclude_unset=True)
        supplier_found = False
        updated_suppliers = []

        for supplier in ingredient.suppliers:
            if supplier.get("supplier_id") == supplier_id:
                supplier_found = True
                # Create updated supplier entry
                updated_supplier = {**supplier}

                # If setting as preferred, we'll unset others below
                for key, value in update_data.items():
                    updated_supplier[key] = value

                updated_supplier["last_updated"] = datetime.utcnow().isoformat()
                updated_suppliers.append(updated_supplier)
            else:
                # If we're setting this supplier as preferred, unset others
                if update_data.get("is_preferred"):
                    updated_suppliers.append({**supplier, "is_preferred": False})
                else:
                    updated_suppliers.append({**supplier})

        if not supplier_found:
            return None

        # Reassign list to force SQLAlchemy to detect the change
        ingredient.suppliers = updated_suppliers
        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def remove_supplier(
        self, ingredient_id: int, supplier_id: str
    ) -> Ingredient | None:
        """Remove a supplier entry from an ingredient."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient or not ingredient.suppliers:
            return None

        # Find and remove the supplier entry
        original_length = len(ingredient.suppliers)
        ingredient.suppliers = [
            s for s in ingredient.suppliers if s.get("supplier_id") != supplier_id
        ]

        if len(ingredient.suppliers) == original_length:
            # Supplier not found
            return None

        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def get_suppliers(self, ingredient_id: int) -> list[dict] | None:
        """Get all suppliers for an ingredient.

        Returns the list of supplier entries, or None if ingredient not found.
        Returns an empty list if the ingredient has no suppliers.
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        return ingredient.suppliers or []

    def get_preferred_supplier(self, ingredient_id: int) -> dict | None:
        """Get the preferred supplier for an ingredient.

        Returns the supplier entry marked as preferred, or the first supplier
        if none is marked as preferred, or None if no suppliers exist.
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient or not ingredient.suppliers:
            return None

        # Find preferred supplier
        for supplier in ingredient.suppliers:
            if supplier.get("is_preferred"):
                return supplier

        # Fall back to first supplier
        return ingredient.suppliers[0] if ingredient.suppliers else None
