"""Tasting session and note models for R&D feedback tracking."""

import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class TastingDecision(str, Enum):
    """Decision made after tasting a recipe."""

    APPROVED = "approved"
    NEEDS_WORK = "needs_work"
    REJECTED = "rejected"


# -----------------------------------------------------------------------------
# TastingSession
# -----------------------------------------------------------------------------


class TastingSessionBase(SQLModel):
    """Shared fields for TastingSession."""

    name: str = Field(max_length=200, description="e.g. 'December Menu Tasting'")
    date: datetime.datetime
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None)


class TastingSession(TastingSessionBase, table=True):
    """A tasting session event where recipes are evaluated."""

    __tablename__ = "tasting_sessions"

    # Passport org UUID (rule 9) — a scope pointer, not a Passport fact. Nullable until the
    # backfill lands: existing rows have no org and any default would be a guess. See
    # alembic q1orgcol9p0q.
    organization_id: str | None = Field(default=None, nullable=False, index=True)
    # NOT NULL in the database (`q3orgnn3t4u`) but Optional in Python: the create path is
    # `model_validate(data)` — where `data` is a Create schema that deliberately has no org
    # field — followed by stamping it from the acting org. A required field would break that
    # at validation. `nullable=False` is what keeps the model honest about the column, so
    # autogenerate does not offer to make it nullable again and SQLite tests fail on an
    # unstamped insert the same way Postgres would.

    id: int | None = Field(default=None, primary_key=True)
    creator_id: str | None = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class TastingSessionCreate(TastingSessionBase):
    """Schema for creating a new tasting session."""

    participant_ids: list[str] | None = None


class TastingSessionUpdate(SQLModel):
    """Schema for updating a tasting session (all fields optional)."""

    name: str | None = None
    date: datetime.datetime | None = None
    location: str | None = None
    participant_ids: list[str] | None = None
    notes: str | None = None


# -----------------------------------------------------------------------------
# TastingUser (join table for participants)
# -----------------------------------------------------------------------------


class TastingUser(SQLModel, table=True):
    """Join table linking registered users as participants of a tasting session."""

    __tablename__ = "tasting_users"

    id: int | None = Field(default=None, primary_key=True)
    tasting_session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    user_id: str | None = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class TastingUserRead(SQLModel):
    """Participant summary embedded in TastingSessionRead responses."""

    id: int
    user_id: str | None
    email: str
    username: str
    phone_number: str | None = None


class TastingSessionRead(TastingSessionBase):
    """TastingSession for API responses — includes resolved participant list."""

    id: int
    creator_id: str | None = None
    # The org this session belongs to. Carried so an admin bypass can be scoped to it rather
    # than asking the org-less "admin of ANY of your orgs" question. Nullable until the backfill.
    organization_id: str | None = None
    participants: list[TastingUserRead] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime


# -----------------------------------------------------------------------------
# TastingNote
# -----------------------------------------------------------------------------


class TastingNoteBase(SQLModel):
    """Shared fields for TastingNote."""

    # Ratings (1-5 scale)
    taste_rating: int | None = Field(default=None, ge=1, le=5)
    presentation_rating: int | None = Field(default=None, ge=1, le=5)
    texture_rating: int | None = Field(default=None, ge=1, le=5)
    overall_rating: int | None = Field(default=None, ge=1, le=5)

    # Feedback
    feedback: str | None = Field(default=None, description="Free-form tasting notes")
    action_items: str | None = Field(default=None, description="What needs to change")
    action_items_done: bool = Field(default=False, description="Whether action items have been completed")

    # Decision
    decision: str | None = Field(
        default=None,
        description="approved, needs_work, or rejected",
    )

    # Taster info
    taster_name: str | None = Field(default=None, max_length=100)


class TastingNote(TastingNoteBase, table=True):
    """Feedback for a specific recipe in a tasting session."""

    __tablename__ = "tasting_notes"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    user_id: str | None = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class TastingNoteCreate(TastingNoteBase):
    """Schema for creating a tasting note."""

    recipe_id: int
    user_id: str | None = None


class TastingNoteUpdate(SQLModel):
    """Schema for updating a tasting note (all fields optional)."""

    taste_rating: int | None = None
    presentation_rating: int | None = None
    texture_rating: int | None = None
    overall_rating: int | None = None
    feedback: str | None = None
    action_items: str | None = None
    action_items_done: bool | None = None
    decision: str | None = None
    taster_name: str | None = None


class TastingNoteRead(TastingNoteBase):
    """TastingNote for API response (includes IDs and timestamps)."""

    id: int
    session_id: int
    recipe_id: int
    user_id: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TastingNoteWithRecipe(TastingNoteRead):
    """TastingNote with recipe name for recipe history view."""

    recipe_name: str | None = None
    session_name: str | None = None
    session_date: datetime.datetime | None = None


# -----------------------------------------------------------------------------
# Recipe Tasting Summary
# -----------------------------------------------------------------------------


class RecipeTastingSummary(SQLModel):
    """Aggregated tasting data for a recipe."""

    recipe_id: int
    total_tastings: int
    average_overall_rating: float | None
    latest_decision: str | None
    latest_feedback: str | None
    latest_tasting_date: datetime.datetime | None
