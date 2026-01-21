"""RecipeIngredient model - quantitative link between recipe and ingredients."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.ingredient import Ingredient


class RecipeIngredientBase(SQLModel):
    """Shared fields for RecipeIngredient."""

    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    quantity: float
    unit: str = Field(description="Must be convertible to ingredient.base_unit")


class RecipeIngredient(RecipeIngredientBase, table=True):
    """
    Quantitative link between recipe and ingredients.

    This table is CRITICAL - all costing and scaling flows through here.
    Units must be convertible to ingredient.base_unit.
    """

    __tablename__ = "recipe_ingredients"

    id: int | None = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    unit_price: float | None = Field(default=None)  # not all unit prices are known
    base_unit: str | None = Field(default=None)
    supplier_id: int | None = Field(default=None)  # not all ingredients currently
    wastage_percentage: float = Field(default=0)  # wastage as percentage (0-100)

    # Relationship to Ingredient
    ingredient: Optional["Ingredient"] = Relationship(back_populates="recipe_ingredients")


class RecipeIngredientCreate(RecipeIngredientBase):
    """Schema for adding an ingredient to a recipe."""
    base_unit: str | None = None
    unit_price: float | None = None
    supplier_id: int | None = None
    wastage_percentage: float = 0


class RecipeIngredientUpdate(SQLModel):
    """Schema for updating a recipe ingredient."""

    quantity: float | None = None
    unit: str | None = None
    base_unit: str | None = None
    unit_price: float | None = None
    supplier_id: int | None = None
    wastage_percentage: float | None = None


class RecipeIngredientReorder(SQLModel):
    """Schema for reordering recipe ingredients."""

    ordered_ids: list[int]


class IngredientNested(SQLModel):
    """Ingredient data for nested response in RecipeIngredientRead."""

    id: int
    name: str
    base_unit: str
    cost_per_base_unit: float | None = None
    is_active: bool = True
    suppliers: list[dict] | None = None


class RecipeIngredientRead(SQLModel):
    """RecipeIngredient for API response (includes nested Ingredient)."""

    id: int
    recipe_id: int
    ingredient_id: int
    quantity: float
    unit: str
    sort_order: int
    created_at: datetime
    base_unit: str | None = None
    unit_price: float | None = None
    supplier_id: int | None = None
    wastage_percentage: float = 0
    ingredient: IngredientNested | None = None
