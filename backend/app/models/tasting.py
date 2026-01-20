"""Tasting session and note models for R&D feedback tracking."""

import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import JSON, Column
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
    location: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None)


class TastingSession(TastingSessionBase, table=True):
    """A tasting session event where recipes are evaluated."""

    __tablename__ = "tasting_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    attendees: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class TastingSessionCreate(TastingSessionBase):
    """Schema for creating a new tasting session."""

    attendees: Optional[List[str]] = None


class TastingSessionUpdate(SQLModel):
    """Schema for updating a tasting session (all fields optional)."""

    name: Optional[str] = None
    date: Optional[datetime.datetime] = None
    location: Optional[str] = None
    attendees: Optional[List[str]] = None
    notes: Optional[str] = None


# -----------------------------------------------------------------------------
# TastingNote
# -----------------------------------------------------------------------------


class TastingNoteBase(SQLModel):
    """Shared fields for TastingNote."""

    # Ratings (1-5 scale)
    taste_rating: Optional[int] = Field(default=None, ge=1, le=5)
    presentation_rating: Optional[int] = Field(default=None, ge=1, le=5)
    texture_rating: Optional[int] = Field(default=None, ge=1, le=5)
    overall_rating: Optional[int] = Field(default=None, ge=1, le=5)

    # Feedback
    feedback: Optional[str] = Field(default=None, description="Free-form tasting notes")
    action_items: Optional[str] = Field(default=None, description="What needs to change")
    action_items_done: bool = Field(default=False, description="Whether action items have been completed")

    # Decision
    decision: Optional[str] = Field(
        default=None,
        description="approved, needs_work, or rejected",
    )

    # Taster info
    taster_name: Optional[str] = Field(default=None, max_length=100)


class TastingNote(TastingNoteBase, table=True):
    """Feedback for a specific recipe in a tasting session."""

    __tablename__ = "tasting_notes"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class TastingNoteCreate(TastingNoteBase):
    """Schema for creating a tasting note."""

    recipe_id: int


class TastingNoteUpdate(SQLModel):
    """Schema for updating a tasting note (all fields optional)."""

    taste_rating: Optional[int] = None
    presentation_rating: Optional[int] = None
    texture_rating: Optional[int] = None
    overall_rating: Optional[int] = None
    feedback: Optional[str] = None
    action_items: Optional[str] = None
    action_items_done: Optional[bool] = None
    decision: Optional[str] = None
    taster_name: Optional[str] = None


class TastingNoteRead(TastingNoteBase):
    """TastingNote for API response (includes IDs and timestamps)."""

    id: int
    session_id: int
    recipe_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TastingNoteWithRecipe(TastingNoteRead):
    """TastingNote with recipe name for recipe history view."""

    recipe_name: Optional[str] = None
    session_name: Optional[str] = None
    session_date: Optional[datetime.datetime] = None


# -----------------------------------------------------------------------------
# Recipe Tasting Summary
# -----------------------------------------------------------------------------


class RecipeTastingSummary(SQLModel):
    """Aggregated tasting data for a recipe."""

    recipe_id: int
    total_tastings: int
    average_overall_rating: Optional[float]
    latest_decision: Optional[str]
    latest_feedback: Optional[str]
    latest_tasting_date: Optional[datetime.datetime]
