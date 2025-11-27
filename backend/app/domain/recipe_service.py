"""Recipe lifecycle and ingredient management operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models import (
    Recipe,
    RecipeCreate,
    RecipeUpdate,
    RecipeStatus,
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientUpdate,
)


class RecipeService:
    """Service for recipe lifecycle and ingredient management."""

    def __init__(self, session: Session):
        self.session = session

    # --- Recipe Lifecycle Operations ---

    def create_recipe(self, data: RecipeCreate) -> Recipe:
        """Create a new recipe."""
        recipe = Recipe.model_validate(data)
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def list_recipes(self, status: RecipeStatus | None = None) -> list[Recipe]:
        """List all recipes, optionally filtering by status."""
        statement = select(Recipe)
        if status:
            statement = statement.where(Recipe.status == status)
        return list(self.session.exec(statement).all())

    def get_recipe(self, recipe_id: int) -> Recipe | None:
        """Get a recipe by ID."""
        return self.session.get(Recipe, recipe_id)

    def update_recipe_metadata(
        self, recipe_id: int, data: RecipeUpdate
    ) -> Recipe | None:
        """Update recipe metadata fields."""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(recipe, key, value)

        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def set_recipe_status(
        self, recipe_id: int, status: RecipeStatus
    ) -> Recipe | None:
        """Update a recipe's status."""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return None

        recipe.status = status
        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def soft_delete_recipe(self, recipe_id: int) -> Recipe | None:
        """Soft-delete a recipe by setting status to archived."""
        return self.set_recipe_status(recipe_id, RecipeStatus.ARCHIVED)

    # --- Recipe Ingredient Management ---

    def get_recipe_ingredients(self, recipe_id: int) -> list[RecipeIngredient]:
        """Get all ingredients for a recipe, ordered by sort_order."""
        statement = (
            select(RecipeIngredient)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.sort_order)
        )
        return list(self.session.exec(statement).all())

    def add_ingredient_to_recipe(
        self, recipe_id: int, data: RecipeIngredientCreate
    ) -> RecipeIngredient | None:
        """Add an ingredient to a recipe (no duplicates allowed)."""
        # Check for duplicates
        existing = self.session.exec(
            select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe_id,
                RecipeIngredient.ingredient_id == data.ingredient_id,
            )
        ).first()

        if existing:
            return None  # Duplicate not allowed

        # Get max sort_order for this recipe
        max_order_result = self.session.exec(
            select(RecipeIngredient.sort_order)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.sort_order.desc())
        ).first()
        next_order = (max_order_result or 0) + 1

        recipe_ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            ingredient_id=data.ingredient_id,
            quantity=data.quantity,
            unit=data.unit,
            sort_order=next_order,
        )
        self.session.add(recipe_ingredient)
        self.session.commit()
        self.session.refresh(recipe_ingredient)
        return recipe_ingredient

    def update_recipe_ingredient(
        self, recipe_ingredient_id: int, data: RecipeIngredientUpdate
    ) -> RecipeIngredient | None:
        """Update a recipe ingredient's quantity or unit."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ri, key, value)

        self.session.add(ri)
        self.session.commit()
        self.session.refresh(ri)
        return ri

    def remove_ingredient_from_recipe(self, recipe_ingredient_id: int) -> bool:
        """Remove an ingredient from a recipe."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return False

        self.session.delete(ri)
        self.session.commit()
        return True

    def reorder_recipe_ingredients(
        self, recipe_id: int, ordered_ids: list[int]
    ) -> list[RecipeIngredient]:
        """Reorder recipe ingredients based on provided ID order."""
        for index, ri_id in enumerate(ordered_ids):
            ri = self.session.get(RecipeIngredient, ri_id)
            if ri and ri.recipe_id == recipe_id:
                ri.sort_order = index
                self.session.add(ri)

        self.session.commit()
        return self.get_recipe_ingredients(recipe_id)
