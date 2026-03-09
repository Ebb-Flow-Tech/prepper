"""Recipe-tasting session relationship management operations."""

from typing import Optional

from sqlmodel import Session, select

from app.models import (
    Ingredient,
    Recipe,
    RecipeIngredient,
    RecipeTasting,
    RecipeTastingIngredient,
    RecipeTastingRead,
    RecipeTastingCreate,
    RecipeTastingBatchCreate,
    RecipeTastingBatchResult,
    TastingSession,
)


class RecipeTastingService:
    """Service for managing recipe-tasting session relationships."""

    def __init__(self, session: Session):
        self.session = session

    def add_recipe_to_session(
        self, session_id: int, data: RecipeTastingCreate
    ) -> Optional[RecipeTasting]:
        """Add a recipe to a tasting session."""
        # Verify session exists
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        # Verify recipe exists
        recipe = self.session.get(Recipe, data.recipe_id)
        if not recipe:
            return None

        # Check for duplicate
        existing = self.session.exec(
            select(RecipeTasting).where(
                RecipeTasting.tasting_session_id == session_id,
                RecipeTasting.recipe_id == data.recipe_id,
            )
        ).first()

        if existing:
            return None  # Already added

        recipe_tasting = RecipeTasting(
            tasting_session_id=session_id,
            recipe_id=data.recipe_id,
        )
        self.session.add(recipe_tasting)
        self.session.commit()
        self.session.refresh(recipe_tasting)
        return recipe_tasting

    def add_recipes_to_session(
        self, session_id: int, data: RecipeTastingBatchCreate
    ) -> Optional[RecipeTastingBatchResult]:
        """Add multiple recipes to a tasting session. Skips duplicates and invalid IDs."""
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        recipe_ids = data.recipe_ids

        # Batch fetch: all valid recipes in one query
        valid_recipes = set(
            self.session.exec(
                select(Recipe.id).where(Recipe.id.in_(recipe_ids))
            ).all()
        )

        # Batch fetch: all existing links in one query
        existing_links = set(
            self.session.exec(
                select(RecipeTasting.recipe_id).where(
                    RecipeTasting.tasting_session_id == session_id,
                    RecipeTasting.recipe_id.in_(recipe_ids),
                )
            ).all()
        )

        added: list[int] = []
        skipped: list[int] = []

        for recipe_id in recipe_ids:
            if recipe_id not in valid_recipes or recipe_id in existing_links:
                skipped.append(recipe_id)
                continue

            recipe_tasting = RecipeTasting(
                tasting_session_id=session_id,
                recipe_id=recipe_id,
            )
            self.session.add(recipe_tasting)
            added.append(recipe_id)

        if added:
            self.session.commit()

        return RecipeTastingBatchResult(added=added, skipped=skipped)

    def remove_recipe_from_session(self, session_id: int, recipe_id: int) -> bool:
        """Remove a recipe from a tasting session."""
        recipe_tasting = self.session.exec(
            select(RecipeTasting).where(
                RecipeTasting.tasting_session_id == session_id,
                RecipeTasting.recipe_id == recipe_id,
            )
        ).first()

        if not recipe_tasting:
            return False

        self.session.delete(recipe_tasting)
        self.session.commit()
        return True

    def get_recipes_for_session(self, session_id: int) -> list[RecipeTastingRead]:
        """Get all recipe-tasting links for a session, with recipe names and ingredients."""
        # Get recipe-tasting links with recipe names
        statement = (
            select(RecipeTasting, Recipe.name)
            .join(Recipe, RecipeTasting.recipe_id == Recipe.id)
            .where(RecipeTasting.tasting_session_id == session_id)
            .order_by(RecipeTasting.id)
        )
        results = self.session.exec(statement).all()

        if not results:
            return []

        # Batch-load ingredients for all recipe IDs in this session
        recipe_ids = [rt.recipe_id for rt, _ in results]
        ing_rows = self.session.exec(
            select(RecipeIngredient.recipe_id, Ingredient.id, Ingredient.name, Ingredient.base_unit, Ingredient.is_halal)
            .join(Ingredient, RecipeIngredient.ingredient_id == Ingredient.id)
            .where(RecipeIngredient.recipe_id.in_(recipe_ids))
            .order_by(Ingredient.name)
        ).all()

        # Group ingredients by recipe_id
        recipe_ingredients: dict[int, list[RecipeTastingIngredient]] = {}
        for rid, ing_id, ing_name, base_unit, is_halal in ing_rows:
            recipe_ingredients.setdefault(rid, []).append(
                RecipeTastingIngredient(id=ing_id, name=ing_name, base_unit=base_unit, is_halal=is_halal)
            )

        return [
            RecipeTastingRead(
                id=rt.id,
                recipe_id=rt.recipe_id,
                tasting_session_id=rt.tasting_session_id,
                recipe_name=name,
                ingredients=recipe_ingredients.get(rt.recipe_id, []),
                created_at=rt.created_at,
            )
            for rt, name in results
        ]
