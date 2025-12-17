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
            for supplier in ingredient.suppliers:
                supplier["is_preferred"] = False

        ingredient.suppliers.append(supplier_entry)
        ingredient.updated_at = datetime.utcnow()

        # Force SQLAlchemy to detect the change in JSONB
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

        # Find the supplier entry
        supplier_found = False
        for i, supplier in enumerate(ingredient.suppliers):
            if supplier.get("supplier_id") == supplier_id:
                supplier_found = True
                update_data = data.model_dump(exclude_unset=True)

                # If setting as preferred, unset others first
                if update_data.get("is_preferred"):
                    for s in ingredient.suppliers:
                        s["is_preferred"] = False

                for key, value in update_data.items():
                    supplier[key] = value

                supplier["last_updated"] = datetime.utcnow().isoformat()
                break

        if not supplier_found:
            return None

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
