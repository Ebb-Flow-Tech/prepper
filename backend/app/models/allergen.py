"""Allergen model - food allergen entity."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.ingredient_allergen import IngredientAllergen


class AllergenBase(SQLModel):
    """Shared fields for Allergen."""

    name: str = Field(index=True)
    description: str | None = Field(default=None)


class Allergen(AllergenBase, table=True):
    """
    Allergen entity representing food allergens.

    Names are unique and case-insensitive.
    Supports soft delete via is_active flag.
    """

    __tablename__ = "allergens"

    id: int | None = Field(default=None, primary_key=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship to IngredientAllergen
    ingredient_allergens: list["IngredientAllergen"] = Relationship(back_populates="allergen")


class AllergenCreate(SQLModel):
    """Schema for creating a new allergen."""

    name: str
    description: str | None = None


class AllergenUpdate(SQLModel):
    """Schema for updating an allergen (all fields optional)."""

    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
