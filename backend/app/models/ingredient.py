"""Ingredient model - canonical ingredient reference with supplier pricing."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, String
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.recipe_ingredient import RecipeIngredient
    from app.models.category import Category
    from app.models.ingredient_allergen import IngredientAllergen
    from app.models.supplier_ingredient import SupplierIngredient


class FoodCategory(str, Enum):
    """Food category classification for ingredients."""

    PROTEINS = "proteins"
    VEGETABLES = "vegetables"
    FRUITS = "fruits"
    DAIRY = "dairy"
    GRAINS = "grains"
    SPICES = "spices"
    OILS_FATS = "oils_fats"
    SAUCES_CONDIMENTS = "sauces_condiments"
    BEVERAGES = "beverages"
    OTHER = "other"


class IngredientSource(str, Enum):
    """Source of ingredient data."""

    FMH = "fmh"  # Synced from FoodMarketHub
    MANUAL = "manual"  # Manually entered



class IngredientBase(SQLModel):
    """Shared fields for Ingredient."""

    name: str = Field(index=True)
    base_unit: str = Field(description="e.g. g, kg, ml, l, pcs")
    cost_per_base_unit: float | None = Field(default=None)
    is_halal: bool = Field(default=False)

    # NOTE: category and source are defined on Ingredient table class with sa_column
    # to force VARCHAR storage instead of native PostgreSQL ENUM


class Ingredient(IngredientBase, table=True):
    """
    Canonical ingredient reference with supplier pricing.

    Supports:
    - Multiple suppliers via supplier_ingredients join table
    - Master ingredient linking for canonical references
    - Food category classification
    - Source tracking (FMH sync vs manual entry)
    """

    __tablename__ = "ingredients"

    id: int | None = Field(default=None, primary_key=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Food category - stored as VARCHAR to avoid native ENUM issues (legacy field)
    category: str | None = Field(default=None, sa_column=Column(String(50), nullable=True))

    # Foreign key to categories table
    category_id: int | None = Field(default=None, foreign_key="categories.id", index=True)

    # Source tracking - stored as VARCHAR to avoid native ENUM issues
    source: str = Field(
        default="manual", sa_column=Column(String(20), nullable=False, default="manual")
    )

    # Self-referential FK to master ingredient (for variants)
    master_ingredient_id: int | None = Field(
        default=None, foreign_key="ingredients.id", index=True
    )

    # Self-referential relationships
    master_ingredient: Optional["Ingredient"] = Relationship(
        back_populates="variants",
        sa_relationship_kwargs={"remote_side": "Ingredient.id"},
    )
    variants: list["Ingredient"] = Relationship(back_populates="master_ingredient")

    # Relationship to RecipeIngredient
    recipe_ingredients: list["RecipeIngredient"] = Relationship(back_populates="ingredient")

    # Relationship to Category
    category_rel: Optional["Category"] = Relationship(back_populates="ingredients")

    # Relationship to IngredientAllergen
    ingredient_allergens: list["IngredientAllergen"] = Relationship(back_populates="ingredient")

    # Relationship to SupplierIngredient
    supplier_ingredients: list["SupplierIngredient"] = Relationship(back_populates="ingredient")


class IngredientCreate(SQLModel):
    """Schema for creating a new ingredient."""

    name: str
    base_unit: str
    cost_per_base_unit: float | None = None
    is_halal: bool = False
    category: str | None = None  # Use FoodCategory enum values: proteins, vegetables, etc.
    category_id: int | None = None  # Foreign key to categories table
    source: str = "manual"  # "fmh" or "manual"
    master_ingredient_id: int | None = None


class IngredientUpdate(SQLModel):
    """Schema for updating an ingredient (all fields optional)."""

    name: str | None = None
    base_unit: str | None = None
    cost_per_base_unit: float | None = None
    is_halal: bool | None = None
    category: str | None = None  # Use FoodCategory enum values
    category_id: int | None = None  # Foreign key to categories table
    source: str | None = None  # "fmh" or "manual"
    master_ingredient_id: int | None = None
    is_active: bool | None = None
