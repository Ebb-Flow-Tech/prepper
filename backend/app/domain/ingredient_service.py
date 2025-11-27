"""Ingredient domain operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models import Ingredient, IngredientCreate, IngredientUpdate


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

    def list_ingredients(self, active_only: bool = True) -> list[Ingredient]:
        """List all ingredients, optionally filtering by active status."""
        statement = select(Ingredient)
        if active_only:
            statement = statement.where(Ingredient.is_active == True)
        return list(self.session.exec(statement).all())

    def get_ingredient(self, ingredient_id: int) -> Ingredient | None:
        """Get an ingredient by ID."""
        return self.session.get(Ingredient, ingredient_id)

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
