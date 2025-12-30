"""Ingredient model - canonical ingredient reference with supplier pricing."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, JSON, String
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.recipe_ingredient import RecipeIngredient


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


class SupplierEntry(SQLModel):
    """Schema for a supplier entry within the suppliers JSONB field.

    Structure:
    {
        "supplier_id": "fmh-123",        # External ID (FMH) or internal UUID
        "supplier_name": "ABC Foods",
        "sku": "TOM-001",
        "pack_size": 5.0,
        "pack_unit": "kg",
        "price_per_pack": 12.50,
        "currency": "SGD",               # Multi-currency supported
        "is_preferred": true,
        "source": "fmh",                 # "fmh" | "manual" - tracks origin
        "last_updated": "2024-12-01",
        "last_synced": "2024-12-01"      # Only for FMH-sourced entries
    }
    """

    supplier_id: str
    supplier_name: str
    sku: str | None = None
    pack_size: float
    pack_unit: str
    price_per_pack: float
    currency: str = "SGD"
    is_preferred: bool = False
    source: str = "manual"  # "fmh" | "manual"
    last_updated: str | None = None
    last_synced: str | None = None  # Only for FMH-sourced entries


class IngredientBase(SQLModel):
    """Shared fields for Ingredient."""

    name: str = Field(index=True)
    base_unit: str = Field(description="e.g. g, kg, ml, l, pcs")
    cost_per_base_unit: float | None = Field(default=None)

    # NOTE: category and source are defined on Ingredient table class with sa_column
    # to force VARCHAR storage instead of native PostgreSQL ENUM


class Ingredient(IngredientBase, table=True):
    """
    Canonical ingredient reference with supplier pricing.

    Supports:
    - Multiple suppliers with pricing (JSONB)
    - Master ingredient linking for canonical references
    - Food category classification
    - Source tracking (FMH sync vs manual entry)
    """

    __tablename__ = "ingredients"

    id: int | None = Field(default=None, primary_key=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Food category - stored as VARCHAR to avoid native ENUM issues
    category: str | None = Field(default=None, sa_column=Column(String(50), nullable=True))

    # Source tracking - stored as VARCHAR to avoid native ENUM issues
    source: str = Field(
        default="manual", sa_column=Column(String(20), nullable=False, default="manual")
    )

    # NEW: Supplier pricing data (JSONB array of SupplierEntry)
    # Structure: [{"supplier_id": "...", "supplier_name": "...", ...}, ...]
    suppliers: list[dict] | None = Field(default=None, sa_column=Column(JSON))

    # NEW: Self-referential FK to master ingredient (for variants)
    master_ingredient_id: int | None = Field(
        default=None, foreign_key="ingredients.id", index=True
    )

    # Self-referential relationships
    # Note: Using Optional["Ingredient"] for SQLAlchemy's string-based class resolution
    master_ingredient: Optional["Ingredient"] = Relationship(
        back_populates="variants",
        sa_relationship_kwargs={"remote_side": "Ingredient.id"},
    )
    variants: list["Ingredient"] = Relationship(back_populates="master_ingredient")

    # Relationship to RecipeIngredient
    recipe_ingredients: list["RecipeIngredient"] = Relationship(back_populates="ingredient")


class IngredientCreate(SQLModel):
    """Schema for creating a new ingredient."""

    name: str
    base_unit: str
    cost_per_base_unit: float | None = None
    category: str | None = None  # Use FoodCategory enum values: proteins, vegetables, etc.
    source: str = "manual"  # "fmh" or "manual"
    master_ingredient_id: int | None = None
    suppliers: list[dict] | None = None


class IngredientUpdate(SQLModel):
    """Schema for updating an ingredient (all fields optional)."""

    name: str | None = None
    base_unit: str | None = None
    cost_per_base_unit: float | None = None
    category: str | None = None  # Use FoodCategory enum values
    source: str | None = None  # "fmh" or "manual"
    master_ingredient_id: int | None = None
    suppliers: list[dict] | None = None


class SupplierEntryCreate(SQLModel):
    """Schema for adding a supplier entry to an ingredient."""

    supplier_id: str
    supplier_name: str
    sku: str | None = None
    pack_size: float
    pack_unit: str
    price_per_pack: float
    currency: str = "SGD"
    is_preferred: bool = False
    source: str = "manual"


class SupplierEntryUpdate(SQLModel):
    """Schema for updating a supplier entry (all fields optional except supplier_id)."""

    supplier_name: str | None = None
    sku: str | None = None
    pack_size: float | None = None
    pack_unit: str | None = None
    price_per_pack: float | None = None
    currency: str | None = None
    is_preferred: bool | None = None
