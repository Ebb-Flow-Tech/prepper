"""Tasting session management operations."""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from app.models import (
    TastingSession,
    TastingSessionCreate,
    TastingSessionUpdate,
    TastingNote,
)


class TastingSessionService:
    """Service for tasting session management."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, data: TastingSessionCreate) -> TastingSession:
        """Create a new tasting session."""
        tasting_session = TastingSession.model_validate(data)
        self.session.add(tasting_session)
        self.session.commit()
        self.session.refresh(tasting_session)
        return tasting_session

    def list(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TastingSession]:
        """List all tasting sessions, ordered by date descending."""
        statement = (
            select(TastingSession)
            .order_by(TastingSession.date.desc(), TastingSession.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.session.exec(statement).all())

    def get(self, session_id: int) -> Optional[TastingSession]:
        """Get a tasting session by ID."""
        return self.session.get(TastingSession, session_id)

    def update(
        self, session_id: int, data: TastingSessionUpdate
    ) -> Optional[TastingSession]:
        """Update a tasting session."""
        tasting_session = self.get(session_id)
        if not tasting_session:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tasting_session, key, value)

        tasting_session.updated_at = datetime.utcnow()
        self.session.add(tasting_session)
        self.session.commit()
        self.session.refresh(tasting_session)
        return tasting_session

    def delete(self, session_id: int) -> bool:
        """Delete a tasting session and all its notes (cascade)."""
        tasting_session = self.get(session_id)
        if not tasting_session:
            return False

        self.session.delete(tasting_session)
        self.session.commit()
        return True

    def get_stats(self, session_id: int) -> dict:
        """Get statistics for a tasting session."""
        statement = (
            select(TastingNote)
            .where(TastingNote.session_id == session_id)
            .order_by(TastingNote.id)
        )
        notes = list(self.session.exec(statement).all())

        decision_counts = {"approved": 0, "needs_work": 0, "rejected": 0}
        for note in notes:
            if note.decision in decision_counts:
                decision_counts[note.decision] += 1

        return {
            "recipe_count": len(notes),
            "approved_count": decision_counts["approved"],
            "needs_work_count": decision_counts["needs_work"],
            "rejected_count": decision_counts["rejected"],
        }
