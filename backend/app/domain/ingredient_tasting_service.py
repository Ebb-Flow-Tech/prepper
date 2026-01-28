"""Ingredient-tasting session relationship management operations."""

from typing import Optional

from sqlmodel import Session, select

from app.models import (
    Ingredient,
    IngredientTasting,
    IngredientTastingCreate,
    TastingSession,
)


class IngredientTastingService:
    """Service for managing ingredient-tasting session relationships."""

    def __init__(self, session: Session):
        self.session = session

    def add_ingredient_to_session(
        self, session_id: int, data: IngredientTastingCreate
    ) -> Optional[IngredientTasting]:
        """Add an ingredient to a tasting session."""
        # Verify session exists
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        # Verify ingredient exists
        ingredient = self.session.get(Ingredient, data.ingredient_id)
        if not ingredient:
            return None

        # Check for duplicate
        existing = self.session.exec(
            select(IngredientTasting).where(
                IngredientTasting.tasting_session_id == session_id,
                IngredientTasting.ingredient_id == data.ingredient_id,
            )
        ).first()

        if existing:
            return None  # Already added

        ingredient_tasting = IngredientTasting(
            tasting_session_id=session_id,
            ingredient_id=data.ingredient_id,
        )
        self.session.add(ingredient_tasting)
        self.session.commit()
        self.session.refresh(ingredient_tasting)
        return ingredient_tasting

    def remove_ingredient_from_session(self, session_id: int, ingredient_id: int) -> bool:
        """Remove an ingredient from a tasting session."""
        ingredient_tasting = self.session.exec(
            select(IngredientTasting).where(
                IngredientTasting.tasting_session_id == session_id,
                IngredientTasting.ingredient_id == ingredient_id,
            )
        ).first()

        if not ingredient_tasting:
            return False

        self.session.delete(ingredient_tasting)
        self.session.commit()
        return True

    def get_ingredients_for_session(self, session_id: int) -> list[IngredientTasting]:
        """Get all ingredient-tasting links for a session."""
        statement = (
            select(IngredientTasting)
            .where(IngredientTasting.tasting_session_id == session_id)
            .order_by(IngredientTasting.id)
        )
        return list(self.session.exec(statement).all())
