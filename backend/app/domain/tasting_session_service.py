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

    def _add_participants(
        self, session_id: int, user_ids: list[str]
    ) -> None:
        """Create TastingUser rows for the given user IDs (deduped)."""
        seen: set[str] = set()
        for uid in user_ids:
            if uid not in seen:
                self.session.add(
                    TastingUser(tasting_session_id=session_id, user_id=uid)
                )
                seen.add(uid)

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
                        phone_number=user.phone_number,
                    )
                )
        return result

    def _load_participants_batch(
        self, session_ids: list[int]
    ) -> dict[int, list[TastingUserRead]]:
        """Load all TastingUserRead objects for multiple sessions in a single query."""
        if not session_ids:
            return {}
        statement = (
            select(TastingUser, User)
            .join(User, TastingUser.user_id == User.id, isouter=True)
            .where(TastingUser.tasting_session_id.in_(session_ids))
        )
        rows = self.session.exec(statement).all()
        result: dict[int, list[TastingUserRead]] = {sid: [] for sid in session_ids}
        for tu, user in rows:
            if user:
                result[tu.tasting_session_id].append(
                    TastingUserRead(
                        id=tu.id,
                        user_id=tu.user_id,
                        email=user.email,
                        username=user.username,
                        phone_number=user.phone_number,
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

    def _build_read_with_participants(
        self, tasting_session: TastingSession, participants: list[TastingUserRead]
    ) -> TastingSessionRead:
        """Compose a TastingSessionRead with pre-loaded participants."""
        return TastingSessionRead(
            **tasting_session.model_dump(),
            participants=participants,
        )

    def create(
        self, data: TastingSessionCreate, creator_id: str | None = None
    ) -> TastingSessionRead:
        """Create a new tasting session with participants."""
        session_data = data.model_dump(exclude={"participant_ids"})
        if creator_id is not None:
            session_data["creator_id"] = creator_id
        tasting_session = TastingSession(**session_data)
        self.session.add(tasting_session)
        self.session.commit()
        self.session.refresh(tasting_session)

        if data.participant_ids:
            self._add_participants(tasting_session.id, data.participant_ids)
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
        session_ids = [s.id for s in sessions]
        participants_map = self._load_participants_batch(session_ids)
        return [
            self._build_read_with_participants(s, participants_map.get(s.id, []))
            for s in sessions
        ]

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

        update_data = data.model_dump(exclude_unset=True, exclude={"participant_ids"})
        for key, value in update_data.items():
            setattr(tasting_session, key, value)

        tasting_session.updated_at = datetime.utcnow()
        self.session.add(tasting_session)

        # Replace participants if explicitly provided in the payload
        if "participant_ids" in data.model_fields_set:
            # Delete all existing TastingUser rows for this session
            existing_stmt = select(TastingUser).where(
                TastingUser.tasting_session_id == session_id
            )
            for tu in self.session.exec(existing_stmt).all():
                self.session.delete(tu)

            if data.participant_ids:
                self._add_participants(session_id, data.participant_ids)

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
