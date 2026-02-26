"""Ingredient-Allergen model - many-to-many relationship between ingredients and allergens."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.ingredient import Ingredient


class IngredientAllergen(SQLModel, table=True):
    """
    Many-to-many relationship between ingredients and allergens.

    Tracks which allergens are associated with which ingredients.
    Supports hard delete (no is_active flag).
    """

    __tablename__ = "ingredient_allergens"

    id: Optional[int] = Field(default=None, primary_key=True)
    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    allergen_id: int = Field(foreign_key="allergens.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    ingredient: "Ingredient" = Relationship(back_populates="ingredient_allergens")
    allergen: "Allergen" = Relationship(back_populates="ingredient_allergens")


class IngredientAllergenCreate(SQLModel):
    """Schema for adding an allergen to an ingredient."""

    ingredient_id: int
    allergen_id: int
