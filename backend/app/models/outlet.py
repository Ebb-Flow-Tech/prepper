"""Outlet model - represents brands or locations for multi-brand operations."""

from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class OutletType(str, Enum):
    """Type of outlet."""

    BRAND = "brand"
    LOCATION = "location"


class OutletBase(SQLModel):
    """Shared fields for Outlet."""

    name: str = Field(max_length=100, index=True)
    code: str = Field(max_length=20, description="Short code e.g. 'CS', 'TBH'")
    outlet_type: OutletType = Field(default=OutletType.BRAND)


class Outlet(OutletBase, table=True):
    """
    Represents a brand or location for multi-brand operations.

    Recipes can be assigned to multiple outlets, allowing:
    - Brand-specific recipe collections
    - Location-specific overrides
    - Centralized recipe templates shared across outlets
    """

    __tablename__ = "outlets"

    id: int | None = Field(default=None, primary_key=True)
    is_active: bool = Field(default=True)

    # Optional: Parent outlet for hierarchical structures (franchises)
    parent_outlet_id: int | None = Field(
        default=None, foreign_key="outlets.id", index=True
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OutletCreate(OutletBase):
    """Schema for creating a new outlet."""

    parent_outlet_id: int | None = None


class OutletUpdate(SQLModel):
    """Schema for updating an outlet (all fields optional)."""

    name: str | None = None
    code: str | None = None
    outlet_type: OutletType | None = None
    parent_outlet_id: int | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# RecipeOutlet junction table
# ---------------------------------------------------------------------------


class RecipeOutletBase(SQLModel):
    """Shared fields for RecipeOutlet."""

    outlet_id: int = Field(foreign_key="outlets.id")
    is_active: bool = Field(default=True, description="Can deactivate recipe for specific outlet")
    price_override: float | None = Field(default=None, description="Outlet-specific selling price")


class RecipeOutlet(RecipeOutletBase, table=True):
    """
    Links recipes to outlets (many-to-many).

    A recipe can be used at multiple outlets, with optional:
    - Per-outlet activation/deactivation
    - Per-outlet price overrides
    """

    __tablename__ = "recipe_outlets"

    # Composite primary key
    recipe_id: int = Field(foreign_key="recipes.id", primary_key=True)
    outlet_id: int = Field(foreign_key="outlets.id", primary_key=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeOutletCreate(SQLModel):
    """Schema for adding a recipe to an outlet."""

    outlet_id: int
    is_active: bool = True
    price_override: float | None = None


class RecipeOutletUpdate(SQLModel):
    """Schema for updating a recipe-outlet link."""

    is_active: bool | None = None
    price_override: float | None = None
