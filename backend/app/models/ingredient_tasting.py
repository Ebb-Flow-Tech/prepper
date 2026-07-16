"""IngredientTasting model - many-to-many relationship between ingredients and tasting sessions."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class IngredientTasting(SQLModel, table=True):
    """
    Many-to-many relationship between ingredients and tasting sessions.

    Tracks which ingredients are included in which tasting sessions,
    independent of tasting notes (which capture the actual feedback).
    """

    __tablename__ = "ingredient_tastings"

    id: int | None = Field(default=None, primary_key=True)
    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    tasting_session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class IngredientTastingRead(SQLModel):
    """IngredientTasting for API response (includes ingredient name)."""

    id: int
    ingredient_id: int
    tasting_session_id: int
    ingredient_name: str | None = None
    created_at: datetime


class IngredientTastingCreate(SQLModel):
    """Schema for adding an ingredient to a tasting session."""

    ingredient_id: int


class IngredientTastingBatchCreate(SQLModel):
    """Schema for adding multiple ingredients to a tasting session."""

    ingredient_ids: list[int]


class IngredientTastingBatchResult(SQLModel):
    """Result of a batch add operation."""

    added: list[int]
    skipped: list[int]


# =====================================================================
# IngredientTastingNote
# =====================================================================


class IngredientTastingNoteBase(SQLModel):
    """Shared fields for IngredientTastingNote."""

    # Ratings (1-5 scale) - adapted for ingredients
    taste_rating: int | None = Field(default=None, ge=1, le=5)
    aroma_rating: int | None = Field(default=None, ge=1, le=5, description="Smell/fragrance quality")
    texture_rating: int | None = Field(default=None, ge=1, le=5)
    overall_rating: int | None = Field(default=None, ge=1, le=5)

    # Feedback
    feedback: str | None = Field(default=None, description="Free-form tasting notes")
    action_items: str | None = Field(default=None, description="What needs to change (e.g., new supplier)")
    action_items_done: bool = Field(default=False, description="Whether action items have been completed")

    # Decision
    decision: str | None = Field(
        default=None,
        description="approved, needs_work, or rejected",
    )

    # Taster info
    taster_name: str | None = Field(default=None, max_length=100)


class IngredientTastingNote(IngredientTastingNoteBase, table=True):
    """Feedback for a specific ingredient in a tasting session."""

    __tablename__ = "ingredient_tasting_notes"

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    user_id: str | None = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IngredientTastingNoteCreate(IngredientTastingNoteBase):
    """Schema for creating an ingredient tasting note."""

    ingredient_id: int
    user_id: str | None = None


class IngredientTastingNoteUpdate(SQLModel):
    """Schema for updating an ingredient tasting note (all fields optional)."""

    taste_rating: int | None = None
    aroma_rating: int | None = None
    texture_rating: int | None = None
    overall_rating: int | None = None
    feedback: str | None = None
    action_items: str | None = None
    action_items_done: bool | None = None
    decision: str | None = None
    taster_name: str | None = None


class IngredientTastingNoteRead(IngredientTastingNoteBase):
    """IngredientTastingNote for API response (includes IDs and timestamps)."""

    id: int
    session_id: int
    ingredient_id: int
    user_id: str | None = None
    created_at: datetime
    updated_at: datetime


class IngredientTastingNoteWithDetails(IngredientTastingNoteRead):
    """IngredientTastingNote with ingredient name for ingredient history view."""

    ingredient_name: str | None = None
    session_name: str | None = None
    session_date: datetime | None = None


class IngredientTastingSummary(SQLModel):
    """Aggregated tasting data for an ingredient."""

    ingredient_id: int
    total_tastings: int
    average_overall_rating: float | None
    latest_decision: str | None
    latest_feedback: str | None
    latest_tasting_date: datetime | None
