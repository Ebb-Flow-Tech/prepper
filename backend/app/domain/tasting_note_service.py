"""Tasting note management operations."""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from app.models import (
    TastingSession,
    TastingNote,
    TastingNoteCreate,
    TastingNoteUpdate,
    TastingNoteWithRecipe,
    RecipeTastingSummary,
    Recipe,
)


class TastingNoteService:
    """Service for tasting note management."""

    def __init__(self, session: Session):
        self.session = session

    def add(
        self, session_id: int, data: TastingNoteCreate
    ) -> Optional[TastingNote]:
        """Add a tasting note to a session."""
        # Verify session exists
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        # Verify recipe exists
        recipe = self.session.get(Recipe, data.recipe_id)
        if not recipe:
            return None

        # Multiple notes per recipe are allowed (different tasters can provide feedback)
        note = TastingNote(
            session_id=session_id,
            **data.model_dump(),
        )
        self.session.add(note)
        self.session.commit()
        self.session.refresh(note)
        return note

    def get_for_session(self, session_id: int) -> list[TastingNote]:
        """Get all notes for a tasting session."""
        statement = (
            select(TastingNote)
            .where(TastingNote.session_id == session_id)
            .order_by(TastingNote.id)
        )
        return list(self.session.exec(statement).all())

    def get(self, note_id: int) -> Optional[TastingNote]:
        """Get a tasting note by ID."""
        return self.session.get(TastingNote, note_id)

    def update(
        self, note_id: int, data: TastingNoteUpdate
    ) -> Optional[TastingNote]:
        """Update a tasting note."""
        note = self.get(note_id)
        if not note:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(note, key, value)

        note.updated_at = datetime.utcnow()
        self.session.add(note)
        self.session.commit()
        self.session.refresh(note)
        return note

    def delete(self, note_id: int) -> bool:
        """Delete a tasting note."""
        note = self.get(note_id)
        if not note:
            return False

        self.session.delete(note)
        self.session.commit()
        return True

    def get_for_recipe(self, recipe_id: int) -> list[TastingNoteWithRecipe]:
        """Get all tasting notes for a recipe, with session info."""
        statement = (
            select(TastingNote, TastingSession, Recipe)
            .join(TastingSession, TastingNote.session_id == TastingSession.id)
            .join(Recipe, TastingNote.recipe_id == Recipe.id)
            .where(TastingNote.recipe_id == recipe_id)
            .order_by(TastingSession.date.desc(), TastingNote.id.desc())
        )
        results = self.session.exec(statement).all()

        notes_with_info = []
        for note, session, recipe in results:
            note_dict = {
                "id": note.id,
                "session_id": note.session_id,
                "recipe_id": note.recipe_id,
                "taste_rating": note.taste_rating,
                "presentation_rating": note.presentation_rating,
                "texture_rating": note.texture_rating,
                "overall_rating": note.overall_rating,
                "feedback": note.feedback,
                "action_items": note.action_items,
                "action_items_done": note.action_items_done,
                "decision": note.decision,
                "taster_name": note.taster_name,
                "user_id": note.user_id,
                "created_at": note.created_at,
                "updated_at": note.updated_at,
                "recipe_name": recipe.name,
                "session_name": session.name,
                "session_date": session.date,
            }
            notes_with_info.append(TastingNoteWithRecipe(**note_dict))

        return notes_with_info

    def get_recipes_with_feedback(self, user_id: Optional[str] = None) -> list[Recipe]:
        """Get all unique recipes that have at least one tasting note.

        Only returns recipes that are accessible to the user:
        - Public recipes
        - Recipes owned by the user
        - Recipes accessible via user's outlet hierarchy (location users can see parent brand recipes)

        Filters by rnd_started = False or rnd_started = None (for backward compatibility with old data).

        Args:
            user_id: The user ID to check access for

        Returns:
            List of recipes with tasting feedback that the user can access
        """
        from sqlalchemy import or_
        from app.models import User, RecipeOutlet
        from app.domain.outlet_service import OutletService
        from app.domain.user_service import UserService

        # Get distinct recipe IDs from tasting notes using subquery
        recipe_ids_with_notes = (
            select(TastingNote.recipe_id)
            .distinct()
            .scalar_subquery()
        )

        # Start with base query: recipes with feedback that haven't started R&D
        statement = (
            select(Recipe)
            .where(Recipe.id.in_(recipe_ids_with_notes))
            .where(
                or_(
                    Recipe.rnd_started == False,
                    Recipe.rnd_started == None
                )
            )
        )

        # Get all recipes with feedback first
        all_recipes = list(self.session.exec(statement).all())

        # If no user_id, return only public recipes
        if not user_id:
            return [r for r in all_recipes if r.is_public]

        # Get recipes accessible via user's outlet hierarchy
        outlet_accessible_ids = self._get_outlet_accessible_recipe_ids(user_id, {r.id for r in all_recipes})

        # Filter recipes: public OR owned by user OR accessible via outlet
        filtered_recipes = [
            r for r in all_recipes
            if r.is_public or r.owner_id == user_id or r.id in outlet_accessible_ids
        ]

        return sorted(filtered_recipes, key=lambda r: r.name)

    def _get_outlet_accessible_recipe_ids(self, user_id: str, recipe_ids: set[int]) -> set[int]:
        """Get recipe IDs accessible to user via outlet hierarchy.

        Steps:
        1. Look up user to get their outlet_id
        2. If user has outlet_id, determine outlet type (brand/location)
        3. Build accessible_outlet_ids:
           - Always include user's own outlet
           - If outlet is "location" and has parent_outlet_id, also include parent
           - If outlet is "brand", only include own outlet (no children)
        4. Batch-query RecipeOutlet for recipes in recipe_ids assigned to accessible_outlet_ids
        5. Return set of accessible recipe IDs

        Args:
            user_id: The user ID to check
            recipe_ids: Set of recipe IDs to filter from

        Returns:
            Set of recipe IDs accessible via outlet
        """
        from app.models import User, RecipeOutlet
        from app.domain.outlet_service import OutletService
        from app.domain.user_service import UserService

        # Look up user to get outlet assignment
        user_service = UserService(self.session)
        user = user_service.get_user(user_id)

        # If user not found or has no outlet, return empty set
        if not user or not user.outlet_id:
            return set()

        # Get user's outlet to determine type
        outlet_service = OutletService(self.session)
        user_outlet = outlet_service.get_outlet(user.outlet_id)

        if not user_outlet:
            return set()

        # Build accessible outlet IDs based on hierarchy
        accessible_outlet_ids = {user.outlet_id}

        # Location users can also see recipes from their parent brand
        if user_outlet.outlet_type.value == "location" and user_outlet.parent_outlet_id:
            accessible_outlet_ids.add(user_outlet.parent_outlet_id)
        # Brand users can only see their own outlet (not children)

        # Query RecipeOutlet for recipes in recipe_ids assigned to accessible outlets
        statement = select(RecipeOutlet).where(
            RecipeOutlet.recipe_id.in_(recipe_ids),
            RecipeOutlet.outlet_id.in_(accessible_outlet_ids),
            RecipeOutlet.is_active,
        )
        recipe_outlets = self.session.exec(statement).all()

        return {ro.recipe_id for ro in recipe_outlets if ro.recipe_id is not None}

    def get_recipe_summary(self, recipe_id: int) -> RecipeTastingSummary:
        """Get aggregated tasting data for a recipe."""
        # Get all notes for recipe
        notes = self.session.exec(
            select(TastingNote, TastingSession)
            .join(TastingSession, TastingNote.session_id == TastingSession.id)
            .where(TastingNote.recipe_id == recipe_id)
            .order_by(TastingSession.date.desc())
        ).all()

        if not notes:
            return RecipeTastingSummary(
                recipe_id=recipe_id,
                total_tastings=0,
                average_overall_rating=None,
                latest_decision=None,
                latest_feedback=None,
                latest_tasting_date=None,
            )

        # Calculate average overall rating
        ratings = [n.overall_rating for n, _ in notes if n.overall_rating is not None]
        avg_rating = sum(ratings) / len(ratings) if ratings else None

        # Get latest note info
        latest_note, latest_session = notes[0]

        return RecipeTastingSummary(
            recipe_id=recipe_id,
            total_tastings=len(notes),
            average_overall_rating=round(avg_rating, 1) if avg_rating else None,
            latest_decision=latest_note.decision,
            latest_feedback=latest_note.feedback,
            latest_tasting_date=latest_session.date,
        )
