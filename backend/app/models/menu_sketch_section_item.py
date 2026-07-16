"""MenuSketchSectionItem model — a dish entry within a menu sketch section."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import field_validator
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class MenuSketchSectionItem(SQLModel, table=True):
    """A dish (item) within a MenuSketchSection.

    The display name is derived from the linked Recipe (via recipe_id).
    Items without a recipe_id are name-less stubs.
    """

    __tablename__ = "menu_sketch_section_item"

    id: int | None = Field(default=None, primary_key=True)
    menu_sketch_section_id: int = Field(foreign_key="menu_sketch_section.id")

    # Link to the recipes table — NULL only when recipe creation is deferred
    recipe_id: int | None = Field(default=None, foreign_key="recipes.id")

    sales_price: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)
    cost_price: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)
    margin: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)

    # Menu description — NOT the recipe description
    description: str | None = Field(default=None)

    is_highlight: bool = Field(default=False)

    # Array of icon strings (e.g. emoji or icon keys)
    icons: list = Field(default_factory=list, sa_column=Column(JSON))

    order_no: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MenuSketchSectionItemCreate(SQLModel):
    """Schema for creating a new dish item.

    Either pass an existing ``recipe_id`` OR a ``name`` string to have a new
    Recipe created automatically.  At least one must be provided.
    """

    menu_sketch_section_id: int
    recipe_id: int | None = None
    # Used both to auto-create a Recipe (when recipe_id is None) and to name
    # the dish on the menu.  When recipe_id is given, ``name`` is ignored.
    name: str | None = None
    sales_price: Decimal | None = None
    cost_price: Decimal | None = None
    description: str | None = None
    is_highlight: bool = False
    icons: list[str] = []
    order_no: int = 0


class MenuSketchSectionItemUpdate(SQLModel):
    """Schema for updating a dish item (all fields optional).

    - Pass ``recipe_id`` to switch to an existing recipe.
    - Pass ``name`` to rename the currently-linked recipe (with optional fork
      logic when the recipe has tasting feedback).
    - Pass ``name`` without ``recipe_id`` to auto-create a new recipe.
    """

    recipe_id: int | None = None
    name: str | None = None
    sales_price: Decimal | None = None
    cost_price: Decimal | None = None
    margin: Decimal | None = None
    description: str | None = None
    is_highlight: bool | None = None
    icons: list[str] | None = None
    order_no: int | None = None


class MenuSketchTastingNoteRead(SQLModel):
    """Compact tasting note embedded in MenuSketchSectionItemRead."""

    id: int
    feedback: str | None
    taster_name: str | None
    decision: str | None
    overall_rating: int | None
    session_name: str | None
    session_date: datetime | None
    created_at: datetime


class MenuSketchSectionItemRead(SQLModel):
    """Schema for reading a dish item (API response)."""

    id: int
    menu_sketch_section_id: int
    recipe_id: int | None
    # Resolved from the linked Recipe at read time
    recipe_name: str | None
    sales_price: Decimal | None
    cost_price: Decimal | None
    margin: Decimal | None
    description: str | None
    is_highlight: bool
    icons: list[str]
    order_no: int
    tasting_notes: list[MenuSketchTastingNoteRead]
    created_at: datetime
    updated_at: datetime

    @field_validator("icons", mode="before")
    @classmethod
    def coerce_icons(cls, v: Any) -> list:
        return v if isinstance(v, list) else []
