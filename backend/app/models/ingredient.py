"""Ingredient model - canonical ingredient reference with baseline unit cost."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class IngredientBase(SQLModel):
    """Shared fields for Ingredient."""

    name: str = Field(index=True)
    base_unit: str = Field(description="e.g. g, kg, ml, l, pcs")
    cost_per_base_unit: float | None = Field(default=None)


class Ingredient(IngredientBase, table=True):
    """
    Canonical ingredient reference + baseline unit cost.

    Cost is indicative/stale by design - no suppliers, inventory, or history.
    """

    __tablename__ = "ingredients"

    id: int | None = Field(default=None, primary_key=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IngredientCreate(IngredientBase):
    """Schema for creating a new ingredient."""

    pass


class IngredientUpdate(SQLModel):
    """Schema for updating an ingredient (all fields optional)."""

    name: str | None = None
    base_unit: str | None = None
    cost_per_base_unit: float | None = None
