"""Tasting session management operations."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import or_
from sqlmodel import Session, select

from app.domain.org_scope import org_scope
from app.models import (
    TastingNote,
    TastingSession,
    TastingSessionCreate,
    TastingSessionRead,
    TastingSessionUpdate,
    TastingUser,
    TastingUserRead,
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
        self,
        data: TastingSessionCreate,
        creator_id: str | None = None,
        organization_id: str | None = None,
    ) -> TastingSessionRead:
        """Create a new tasting session with participants, stamped with the acting org.

        ``organization_id`` comes from the acting org context, never the request body — the Create
        schemas have no such field. A tenant id a client can assert is not a tenant id.
        """
        session_data = data.model_dump(exclude={"participant_ids"})
        session_data["organization_id"] = organization_id
        if creator_id is not None:
            session_data["creator_id"] = creator_id
        tasting_session = TastingSession(**session_data)
        self.session.add(tasting_session)
        self.session.commit()
        self.session.refresh(tasting_session)

        participant_ids: list[str] = list(data.participant_ids or [])
        if creator_id and creator_id not in participant_ids:
            participant_ids.insert(0, creator_id)
        if participant_ids:
            self._add_participants(tasting_session.id, participant_ids)
            self.session.commit()

        return self._build_read(tasting_session)

    def _build_list_query(
        self,
        organization_id: str,
        user_id: str,
        search=None,
        is_org_admin: bool = False,
    ):
        """Sessions the caller may list, within the org they are acting in.

        `user_id` scopes to participation. `is_org_admin` widens that to every session in the org —
        an org admin is expected to see sessions they were not invited to.

        Both are needed together. Passing `user_id=None` to mean "admin, show everything" is what
        this used to do, and it showed every session in the DEPLOYMENT, across every tenant.

        `is_org_admin` is a bool about the ACTIVE org, not the `admin_org_ids` set it replaced.
        That set was the union of every org the caller administers, so an Admin of both ORG_A and
        ORG_B saw ORG_B's sessions while acting in ORG_A — every check passing, the answer still
        wrong. Under `org_scope` the union could only ever widen past the active org.

        `user_id` is required and no longer defaults to None. The None branch meant "apply no
        participation filter", which is the exact shape of the bug above: the only caller always
        passes a real id, so the default existed solely to be got wrong later.
        """
        statement = select(TastingSession).where(
            org_scope(TastingSession, organization_id)
        )
        if search:
            statement = statement.where(TastingSession.name.ilike(f"%{search}%"))

        if is_org_admin:
            return statement

        participant_subquery = select(TastingUser.tasting_session_id).where(
            TastingUser.user_id == user_id
        )
        return statement.where(
            or_(
                TastingSession.creator_id == user_id,
                TastingSession.id.in_(participant_subquery),
            )
        )

    def list_paginated_with_count(
        self,
        organization_id: str,
        user_id: str,
        offset: int,
        limit: int,
        search=None,
        is_org_admin: bool = False,
    ) -> tuple[list[TastingSessionRead], int]:
        """Return paginated items and total count, reusing the same base filter.

        The sole list entry point. `list()`, `list_paginated()` and `count()` sat beside it with no
        callers: `list()` selected every session in the deployment unfiltered, and `count()` took
        no admin argument, so had anyone wired it up an admin's total would have disagreed with
        their own rows. Deleted rather than carried — an unscoped query with no caller is a leak
        that has not happened yet.
        """
        from sqlalchemy import func
        base = self._build_list_query(
            organization_id, user_id, search=search, is_org_admin=is_org_admin
        )
        total = self.session.exec(select(func.count()).select_from(base.subquery())).one()
        stmt = base.order_by(TastingSession.date.desc(), TastingSession.id.desc()).offset(offset).limit(limit)
        sessions = list(self.session.exec(stmt).all())
        session_ids = [s.id for s in sessions]
        participants_map = self._load_participants_batch(session_ids)
        items = [self._build_read_with_participants(s, participants_map.get(s.id, [])) for s in sessions]
        return items, total

    def get_raw(self, session_id: int) -> TastingSession | None:
        """Get a raw TastingSession model by ID (no participant loading)."""
        return self.session.get(TastingSession, session_id)

    def is_participant(self, session_id: int, user_id: str) -> bool:
        """Check if a user is a participant in a session (lightweight query)."""
        statement = select(TastingUser.id).where(
            TastingUser.tasting_session_id == session_id,
            TastingUser.user_id == user_id,
        ).limit(1)
        return self.session.exec(statement).first() is not None

    def get(self, session_id: int) -> TastingSessionRead | None:
        """Get a tasting session by ID."""
        tasting_session = self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None
        return self._build_read(tasting_session)

    def update(
        self, session_id: int, data: TastingSessionUpdate, existing: TastingSession | None = None
    ) -> TastingSessionRead | None:
        """Update a tasting session."""
        tasting_session = existing or self.session.get(TastingSession, session_id)
        if not tasting_session:
            return None

        update_data = data.model_dump(exclude_unset=True, exclude={"participant_ids"})
        for key, value in update_data.items():
            setattr(tasting_session, key, value)

        tasting_session.updated_at = datetime.now(UTC)
        self.session.add(tasting_session)

        # Replace participants if explicitly provided in the payload
        if "participant_ids" in data.model_fields_set:
            # Delete all existing TastingUser rows for this session
            existing_stmt = select(TastingUser).where(
                TastingUser.tasting_session_id == session_id
            )
            for tu in self.session.exec(existing_stmt).all():
                self.session.delete(tu)
            self.session.flush()

            if data.participant_ids:
                self._add_participants(session_id, data.participant_ids)

        self.session.commit()
        self.session.refresh(tasting_session)
        return self._build_read(tasting_session)

    def delete(self, session_id: int, existing: TastingSession | None = None) -> bool:
        """Delete a tasting session and all its notes (cascade)."""
        tasting_session = existing or self.session.get(TastingSession, session_id)
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
