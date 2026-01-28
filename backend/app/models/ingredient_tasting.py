"""IngredientTasting model - many-to-many relationship between ingredients and tasting sessions."""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class IngredientTasting(SQLModel, table=True):
    """
    Many-to-many relationship between ingredients and tasting sessions.

    Tracks which ingredients are included in which tasting sessions,
    independent of tasting notes (which capture the actual feedback).
    """

    __tablename__ = "ingredient_tastings"

    id: Optional[int] = Field(default=None, primary_key=True)
    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    tasting_session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class IngredientTastingCreate(SQLModel):
    """Schema for adding an ingredient to a tasting session."""

    ingredient_id: int


# =====================================================================
# IngredientTastingNote
# =====================================================================


class IngredientTastingNoteBase(SQLModel):
    """Shared fields for IngredientTastingNote."""

    # Ratings (1-5 scale) - adapted for ingredients
    taste_rating: Optional[int] = Field(default=None, ge=1, le=5)
    aroma_rating: Optional[int] = Field(default=None, ge=1, le=5, description="Smell/fragrance quality")
    texture_rating: Optional[int] = Field(default=None, ge=1, le=5)
    overall_rating: Optional[int] = Field(default=None, ge=1, le=5)

    # Feedback
    feedback: Optional[str] = Field(default=None, description="Free-form tasting notes")
    action_items: Optional[str] = Field(default=None, description="What needs to change (e.g., new supplier)")
    action_items_done: bool = Field(default=False, description="Whether action items have been completed")

    # Decision
    decision: Optional[str] = Field(
        default=None,
        description="approved, needs_work, or rejected",
    )

    # Taster info
    taster_name: Optional[str] = Field(default=None, max_length=100)


class IngredientTastingNote(IngredientTastingNoteBase, table=True):
    """Feedback for a specific ingredient in a tasting session."""

    __tablename__ = "ingredient_tasting_notes"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IngredientTastingNoteCreate(IngredientTastingNoteBase):
    """Schema for creating an ingredient tasting note."""

    ingredient_id: int


class IngredientTastingNoteUpdate(SQLModel):
    """Schema for updating an ingredient tasting note (all fields optional)."""

    taste_rating: Optional[int] = None
    aroma_rating: Optional[int] = None
    texture_rating: Optional[int] = None
    overall_rating: Optional[int] = None
    feedback: Optional[str] = None
    action_items: Optional[str] = None
    action_items_done: Optional[bool] = None
    decision: Optional[str] = None
    taster_name: Optional[str] = None


class IngredientTastingNoteRead(IngredientTastingNoteBase):
    """IngredientTastingNote for API response (includes IDs and timestamps)."""

    id: int
    session_id: int
    ingredient_id: int
    created_at: datetime
    updated_at: datetime


class IngredientTastingNoteWithDetails(IngredientTastingNoteRead):
    """IngredientTastingNote with ingredient name for ingredient history view."""

    ingredient_name: Optional[str] = None
    session_name: Optional[str] = None
    session_date: Optional[datetime] = None


class IngredientTastingSummary(SQLModel):
    """Aggregated tasting data for an ingredient."""

    ingredient_id: int
    total_tastings: int
    average_overall_rating: Optional[float]
    latest_decision: Optional[str]
    latest_feedback: Optional[str]
    latest_tasting_date: Optional[datetime]
