"""Category model - ingredient category entity."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.ingredient import Ingredient


class CategoryBase(SQLModel):
    """Shared fields for Category."""

    name: str = Field(index=True)
    description: str | None = Field(default=None)
    source: str = Field(default="manual")


class Category(CategoryBase, table=True):
    """
    Category entity representing ingredient categories.

    Names are unique and case-insensitive.
    Supports soft delete via is_active flag.
    """

    __tablename__ = "categories"

    # Passport org UUID (rule 9) — a scope pointer, not a Passport fact. Nullable until the
    # backfill lands: existing rows have no org and any default would be a guess. See
    # alembic q1orgcol9p0q.
    organization_id: str | None = Field(default=None, index=True)

    id: int | None = Field(default=None, primary_key=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship to Ingredient
    ingredients: list["Ingredient"] = Relationship(back_populates="category_rel")


class CategoryCreate(SQLModel):
    """Schema for creating a new category."""

    name: str
    description: str | None = None
    source: str = "manual"


class CategoryUpdate(SQLModel):
    """Schema for updating a category (all fields optional)."""

    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
