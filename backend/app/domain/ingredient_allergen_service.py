"""Ingredient-allergen relationship management operations."""

from sqlmodel import Session, select

from app.models import (
    Ingredient,
    Allergen,
    IngredientAllergen,
    IngredientAllergenCreate,
    RecipeIngredient,
)


class IngredientAllergenService:
    """Service for managing ingredient-allergen relationships."""

    def __init__(self, session: Session):
        self.session = session

    def list_all(self) -> list[IngredientAllergen]:
        """Get all ingredient-allergen links."""
        statement = select(IngredientAllergen).order_by(IngredientAllergen.id)
        return list(self.session.exec(statement).all())

    def get_by_allergen(self, allergen_id: int) -> list[IngredientAllergen]:
        """Get all ingredients with a specific allergen."""
        statement = select(IngredientAllergen).where(
            IngredientAllergen.allergen_id == allergen_id
        )
        return list(self.session.exec(statement).all())

    def get_by_ingredient(self, ingredient_id: int) -> list[IngredientAllergen]:
        """Get all allergens for a specific ingredient."""
        statement = select(IngredientAllergen).where(
            IngredientAllergen.ingredient_id == ingredient_id
        )
        return list(self.session.exec(statement).all())

    def create_link(self, data: IngredientAllergenCreate) -> IngredientAllergen | None:
        """Add an allergen to an ingredient.

        Verifies both ingredient and allergen exist and checks for duplicates.
        Returns None if ingredients don't exist or link already exists.
        """
        # Verify ingredient exists
        ingredient = self.session.get(Ingredient, data.ingredient_id)
        if not ingredient:
            return None

        # Verify allergen exists
        allergen = self.session.get(Allergen, data.allergen_id)
        if not allergen:
            return None

        # Check for duplicate
        existing = self.session.exec(
            select(IngredientAllergen).where(
                IngredientAllergen.ingredient_id == data.ingredient_id,
                IngredientAllergen.allergen_id == data.allergen_id,
            )
        ).first()

        if existing:
            return None  # Already added

        link = IngredientAllergen(
            ingredient_id=data.ingredient_id,
            allergen_id=data.allergen_id,
        )
        self.session.add(link)
        self.session.commit()
        self.session.refresh(link)
        return link

    def delete_link(self, link_id: int) -> bool:
        """Delete an ingredient-allergen link."""
        link = self.session.get(IngredientAllergen, link_id)
        if not link:
            return False

        self.session.delete(link)
        self.session.commit()
        return True

    def get_allergens_for_recipe(self, recipe_id: int) -> list[Allergen]:
        """Get unique, consolidated allergens for all ingredients in a recipe.

        Returns only active allergens, sorted by name, with no duplicates.
        """
        statement = (
            select(Allergen)
            .join(IngredientAllergen, IngredientAllergen.allergen_id == Allergen.id)
            .join(RecipeIngredient, RecipeIngredient.ingredient_id == IngredientAllergen.ingredient_id)
            .where(
                RecipeIngredient.recipe_id == recipe_id,
                Allergen.is_active == True,
            )
            .distinct()
            .order_by(Allergen.name)
        )
        return list(self.session.exec(statement).all())

    def get_allergens_for_recipes_batch(self, recipe_ids: list[int]) -> dict[int, list[Allergen]]:
        """Batch version — returns map of recipe_id -> list[Allergen].

        Each recipe maps to its unique, sorted allergens with no duplicates.
        Recipes with no allergens map to empty list.
        """
        # Initialize all requested recipe_ids with empty list
        result: dict[int, list[Allergen]] = {rid: [] for rid in recipe_ids}
        if not recipe_ids:
            return result

        # Build tuples of (recipe_id, Allergen) via JOIN
        statement = (
            select(RecipeIngredient.recipe_id, Allergen)
            .join(IngredientAllergen, IngredientAllergen.allergen_id == Allergen.id)
            .join(RecipeIngredient, RecipeIngredient.ingredient_id == IngredientAllergen.ingredient_id)
            .where(
                RecipeIngredient.recipe_id.in_(recipe_ids),
                Allergen.is_active == True,
            )
        )
        rows = self.session.exec(statement).all()

        # Deduplicate per recipe
        seen: dict[int, set[int]] = {rid: set() for rid in recipe_ids}
        for recipe_id, allergen in rows:
            if allergen.id not in seen[recipe_id]:
                seen[recipe_id].add(allergen.id)
                result[recipe_id].append(allergen)

        # Sort each recipe's list by name
        for rid in result:
            result[rid].sort(key=lambda a: a.name)
        return result
