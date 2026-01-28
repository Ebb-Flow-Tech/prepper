"""Ingredient tasting note management operations."""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from app.models import (
    TastingSession,
    IngredientTastingNote,
    IngredientTastingNoteCreate,
    IngredientTastingNoteUpdate,
    IngredientTastingNoteWithDetails,
    IngredientTastingSummary,
    Ingredient,
)


class IngredientTastingNoteService:
    """Service for ingredient tasting note management."""

    def __init__(self, session: Session):
        self.session = session

    def add(
        self, session_id: int, data: IngredientTastingNoteCreate
    ) -> Optional[IngredientTastingNote]:
        """Add an ingredient tasting note to a session."""
        # Verify session exists
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        # Verify ingredient exists
        ingredient = self.session.get(Ingredient, data.ingredient_id)
        if not ingredient:
            return None

        # Multiple notes per ingredient are allowed (different tasters can provide feedback)
        note = IngredientTastingNote(
            session_id=session_id,
            **data.model_dump(),
        )
        self.session.add(note)
        self.session.commit()
        self.session.refresh(note)
        return note

    def get_for_session(self, session_id: int) -> list[IngredientTastingNote]:
        """Get all ingredient notes for a tasting session."""
        statement = (
            select(IngredientTastingNote)
            .where(IngredientTastingNote.session_id == session_id)
            .order_by(IngredientTastingNote.id)
        )
        return list(self.session.exec(statement).all())

    def get(self, note_id: int) -> Optional[IngredientTastingNote]:
        """Get an ingredient tasting note by ID."""
        return self.session.get(IngredientTastingNote, note_id)

    def update(
        self, note_id: int, data: IngredientTastingNoteUpdate
    ) -> Optional[IngredientTastingNote]:
        """Update an ingredient tasting note."""
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
        """Delete an ingredient tasting note."""
        note = self.get(note_id)
        if not note:
            return False

        self.session.delete(note)
        self.session.commit()
        return True

    def get_for_ingredient(self, ingredient_id: int) -> list[IngredientTastingNoteWithDetails]:
        """Get all tasting notes for an ingredient, with session and ingredient info."""
        statement = (
            select(IngredientTastingNote, TastingSession, Ingredient)
            .join(TastingSession, IngredientTastingNote.session_id == TastingSession.id)
            .join(Ingredient, IngredientTastingNote.ingredient_id == Ingredient.id)
            .where(IngredientTastingNote.ingredient_id == ingredient_id)
            .order_by(TastingSession.date.desc(), IngredientTastingNote.id.desc())
        )
        results = self.session.exec(statement).all()

        notes_with_info = []
        for note, session, ingredient in results:
            note_dict = {
                "id": note.id,
                "session_id": note.session_id,
                "ingredient_id": note.ingredient_id,
                "taste_rating": note.taste_rating,
                "aroma_rating": note.aroma_rating,
                "texture_rating": note.texture_rating,
                "overall_rating": note.overall_rating,
                "feedback": note.feedback,
                "action_items": note.action_items,
                "action_items_done": note.action_items_done,
                "decision": note.decision,
                "taster_name": note.taster_name,
                "created_at": note.created_at,
                "updated_at": note.updated_at,
                "ingredient_name": ingredient.name,
                "session_name": session.name,
                "session_date": session.date,
            }
            notes_with_info.append(IngredientTastingNoteWithDetails(**note_dict))

        return notes_with_info

    def get_ingredient_summary(self, ingredient_id: int) -> IngredientTastingSummary:
        """Get aggregated tasting data for an ingredient."""
        # Get all notes for ingredient
        notes = self.session.exec(
            select(IngredientTastingNote, TastingSession)
            .join(TastingSession, IngredientTastingNote.session_id == TastingSession.id)
            .where(IngredientTastingNote.ingredient_id == ingredient_id)
            .order_by(TastingSession.date.desc())
        ).all()

        if not notes:
            return IngredientTastingSummary(
                ingredient_id=ingredient_id,
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

        return IngredientTastingSummary(
            ingredient_id=ingredient_id,
            total_tastings=len(notes),
            average_overall_rating=round(avg_rating, 1) if avg_rating else None,
            latest_decision=latest_note.decision,
            latest_feedback=latest_note.feedback,
            latest_tasting_date=latest_session.date,
        )
