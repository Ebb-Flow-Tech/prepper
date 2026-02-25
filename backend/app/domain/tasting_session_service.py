"""Tasting session management operations."""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from app.models import (
    TastingSession,
    TastingSessionCreate,
    TastingSessionUpdate,
    TastingSessionRead,
    TastingUser,
    TastingUserRead,
    TastingNote,
    User,
)


class TastingSessionService:
    """Service for tasting session management."""

    def __init__(self, session: Session):
        self.session = session

    def _resolve_attendees_to_users(self, emails: list[str]) -> list[User]:
        """Look up User records by email. Silently skips unregistered emails."""
        users = []
        for email in emails:
            statement = select(User).where(User.email == email)
            user = self.session.exec(statement).first()
            if user:
                users.append(user)
        return users

    def _load_participants(self, session_id: int) -> list[TastingUserRead]:
        """Load all TastingUserRead objects for a session."""
        statement = (
            select(TastingUser, User)
            .join(User, TastingUser.user_id == User.id, isouter=True)
            .where(TastingUser.tasting_session_id == session_id)
        )
        rows = self.session.exec(statement).all()
        result = []
        for tu, user in rows:
            if user:
                result.append(
                    TastingUserRead(
                        id=tu.id,
                        user_id=tu.user_id,
                        email=user.email,
                        username=user.username,
                    )
                )
        return result

    def _build_read(self, tasting_session: TastingSession) -> TastingSessionRead:
        """Compose a TastingSessionRead from a TastingSession row."""
        participants = self._load_participants(tasting_session.id)
        return TastingSessionRead(
            **tasting_session.model_dump(),
            participants=participants,
        )

    def create(self, data: TastingSessionCreate) -> TastingSessionRead:
        """Create a new tasting session with participants."""
        # Exclude attendees from session fields (will be handled separately)
        session_data = data.model_dump(exclude={"attendees"})
        tasting_session = TastingSession(**session_data)
        self.session.add(tasting_session)
        self.session.commit()
        self.session.refresh(tasting_session)

        # Resolve emails to users and create TastingUser rows
        if data.attendees:
            users = self._resolve_attendees_to_users(data.attendees)
            seen_ids = set()
            for user in users:
                if user.id not in seen_ids:
                    tu = TastingUser(
                        tasting_session_id=tasting_session.id,
                        user_id=user.id,
                    )
                    self.session.add(tu)
                    seen_ids.add(user.id)
            self.session.commit()

        return self._build_read(tasting_session)

    def list(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TastingSessionRead]:
        """List all tasting sessions, ordered by date descending."""
        statement = (
            select(TastingSession)
            .order_by(TastingSession.date.desc(), TastingSession.id.desc())
            .offset(offset)
            .limit(limit)
        )
        sessions = list(self.session.exec(statement).all())
        return [self._build_read(s) for s in sessions]

    def get(self, session_id: int) -> Optional[TastingSessionRead]:
        """Get a tasting session by ID."""
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None
        return self._build_read(tasting_session)

    def update(
        self, session_id: int, data: TastingSessionUpdate
    ) -> Optional[TastingSessionRead]:
        """Update a tasting session."""
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        # Exclude attendees from direct update
        update_data = data.model_dump(exclude_unset=True, exclude={"attendees"})
        for key, value in update_data.items():
            setattr(tasting_session, key, value)

        tasting_session.updated_at = datetime.utcnow()
        self.session.add(tasting_session)

        # Handle attendees if explicitly provided in the payload
        if "attendees" in data.model_fields_set:
            # Delete all existing TastingUser rows for this session
            existing_stmt = select(TastingUser).where(
                TastingUser.tasting_session_id == session_id
            )
            for tu in self.session.exec(existing_stmt).all():
                self.session.delete(tu)

            # Re-add from the new list
            if data.attendees:
                users = self._resolve_attendees_to_users(data.attendees)
                seen_ids = set()
                for user in users:
                    if user.id not in seen_ids:
                        tu = TastingUser(
                            tasting_session_id=session_id,
                            user_id=user.id,
                        )
                        self.session.add(tu)
                        seen_ids.add(user.id)

        self.session.commit()
        self.session.refresh(tasting_session)
        return self._build_read(tasting_session)

    def delete(self, session_id: int) -> bool:
        """Delete a tasting session and all its notes (cascade)."""
        tasting_session = self.session.get(TastingSession, session_id)
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
