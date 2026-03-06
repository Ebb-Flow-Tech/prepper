"""RecipeTasting model - many-to-many relationship between recipes and tasting sessions."""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class RecipeTasting(SQLModel, table=True):
    """
    Many-to-many relationship between recipes and tasting sessions.

    Tracks which recipes are included in which tasting sessions,
    independent of tasting notes (which capture the actual feedback).
    """

    __tablename__ = "recipe_tastings"

    id: Optional[int] = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    tasting_session_id: int = Field(foreign_key="tasting_sessions.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeTastingRead(SQLModel):
    """RecipeTasting for API response (includes recipe name)."""

    id: int
    recipe_id: int
    tasting_session_id: int
    recipe_name: Optional[str] = None
    created_at: datetime


class RecipeTastingCreate(SQLModel):
    """Schema for adding a recipe to a tasting session."""

    recipe_id: int


class RecipeTastingBatchCreate(SQLModel):
    """Schema for adding multiple recipes to a tasting session."""

    recipe_ids: list[int]


class RecipeTastingBatchResult(SQLModel):
    """Result of a batch add operation."""

    added: list[int]
    skipped: list[int]
