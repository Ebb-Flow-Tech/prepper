"""Recipe-tasting session relationship management operations."""

from typing import Optional

from sqlmodel import Session, select

from app.models import (
    Recipe,
    RecipeTasting,
    RecipeTastingCreate,
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

    def get_recipes_for_session(self, session_id: int) -> list[RecipeTasting]:
        """Get all recipe-tasting links for a session."""
        statement = (
            select(RecipeTasting)
            .where(RecipeTasting.tasting_session_id == session_id)
            .order_by(RecipeTasting.id)
        )
        return list(self.session.exec(statement).all())
