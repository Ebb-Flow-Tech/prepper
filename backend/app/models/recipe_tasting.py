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


class RecipeTastingCreate(SQLModel):
    """Schema for adding a recipe to a tasting session."""

    recipe_id: int
