"""Recipe model - the core artifact kitchen + finance cares about."""

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON
from sqlmodel import Column, Field, SQLModel


class RecipeStatus(str, Enum):
    """Recipe lifecycle status."""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class RecipeBase(SQLModel):
    """Shared fields for Recipe."""

    name: str = Field(index=True)
    yield_quantity: float = Field(default=1.0)
    yield_unit: str = Field(default="portion", description="e.g. portion, kg, tray")
    is_prep_recipe: bool = Field(default=False)


class Recipe(RecipeBase, table=True):
    """
    The core recipe artifact.

    - instructions_structured is derived state (safe to recompute anytime)
    - cost_price is also derived (cache only)
    """

    __tablename__ = "recipes"

    id: int | None = Field(default=None, primary_key=True)
    instructions_raw: str | None = Field(default=None)
    instructions_structured: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column(JSON),
    )
    cost_price: float | None = Field(default=None, description="Cached cost calculation")
    selling_price_est: float | None = Field(default=None)
    status: RecipeStatus = Field(default=RecipeStatus.DRAFT)
    is_public: bool = Field(default=False)
    owner_id: str | None = Field(default=None)

    # Versioning
    version: int = Field(default=1, description="Version number of this recipe")
    root_id: int | None = Field(
        default=None,
        foreign_key="recipes.id",
        description="ID of the original recipe this was forked from",
    )

    # Description
    description: str | None = Field(default=None, description="Recipe description")

    # Image
    image_url: str | None = Field(default=None, description="URL of the selected main image")

    # Feedback
    summary_feedback: str | None = Field(default=None, description="Summary feedback on the recipe")

    # Authorship tracking
    created_by: str | None = Field(default=None, max_length=100)
    updated_by: str | None = Field(default=None, max_length=100)

    # R&D workflow
    rnd_started: bool = Field(default=False, description="Flag indicating if R&D workflow has been started")
    review_ready: bool = Field(default=False, description="Flag indicating if recipe is ready for review in R&D page")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeCreate(RecipeBase):
    """Schema for creating a new recipe."""

    cost_price: float | None = None
    status: RecipeStatus = RecipeStatus.DRAFT
    is_public: bool = False
    created_by: str | None = None
    owner_id: str | None = None
    version: int = 1
    root_id: int | None = None
    description: str | None = None
    rnd_started: bool = False
    review_ready: bool = False


class RecipeUpdate(SQLModel):
    """Schema for updating recipe metadata (all fields optional)."""

    name: str | None = None
    yield_quantity: float | None = None
    yield_unit: str | None = None
    cost_price: float | None = None
    selling_price_est: float | None = None
    is_prep_recipe: bool | None = None
    is_public: bool | None = None
    status: RecipeStatus | None = None
    updated_by: str | None = None
    description: str | None = None
    summary_feedback: str | None = None
    rnd_started: bool | None = None
    review_ready: bool | None = None
    image_url: str | None = None


class RecipeStatusUpdate(SQLModel):
    """Schema for updating recipe status."""

    status: RecipeStatus


class InstructionsRaw(SQLModel):
    """Schema for raw instructions input."""

    text: str


class InstructionsStructured(SQLModel):
    """Schema for structured instructions (JSON format)."""

    steps: list[dict[str, Any]]
