"""Menu model - represents menus for restaurant operations."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class MenuBase(SQLModel):
    """Shared fields for Menu."""

    name: str = Field(max_length=200, index=True)
    is_published: bool = Field(default=False)
    version_no: int = Field(default=1)


class Menu(MenuBase, table=True):
    """
    Represents a restaurant menu composed of sections and items.

    - Menus are outlet-scoped and can be published/unpublished
    - Supports versioning via version_no
    - created_by tracks the user who created the menu
    """

    __tablename__ = "menus"

    # Passport org UUID (rule 9) — a scope pointer, not a Passport fact. Nullable until the
    # backfill lands: existing rows have no org and any default would be a guess. See
    # alembic q1orgcol9p0q.
    organization_id: str | None = Field(default=None, index=True)

    id: int | None = Field(default=None, primary_key=True)
    created_by: str = Field(foreign_key="users.id", index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MenuCreate(MenuBase):
    """Schema for creating a new menu."""

    created_by: str


class MenuUpdate(SQLModel):
    """Schema for updating a menu (all fields optional)."""

    name: str | None = None
    is_published: bool | None = None


# ---------------------------------------------------------------------------
# MenuSection
# ---------------------------------------------------------------------------


class MenuSectionBase(SQLModel):
    """Shared fields for MenuSection."""

    name: str = Field(max_length=200)
    order_no: int = Field(ge=0)


class MenuSection(MenuSectionBase, table=True):
    """
    Represents a section within a menu (e.g., 'Appetizers', 'Mains').

    Sections are ordered within a menu via order_no.
    """

    __tablename__ = "menu_sections"

    id: int | None = Field(default=None, primary_key=True)
    menu_id: int = Field(foreign_key="menus.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MenuSectionCreate(MenuSectionBase):
    """Schema for creating a menu section."""

    menu_id: int


class MenuSectionUpdate(SQLModel):
    """Schema for updating a menu section."""

    name: str | None = None
    order_no: int | None = None


# ---------------------------------------------------------------------------
# MenuItem
# ---------------------------------------------------------------------------


class MenuItemBase(SQLModel):
    """Shared fields for MenuItem."""

    recipe_id: int = Field(foreign_key="recipes.id")
    order_no: int = Field(ge=0)
    display_price: float | None = Field(default=None, gt=0, description="Price to display for this menu item")
    additional_info: str | None = Field(default=None, max_length=500)
    key_highlights: str | None = Field(default=None, max_length=500)
    substitution: str | None = Field(default=None, max_length=500)


class MenuItem(MenuItemBase, table=True):
    """
    Represents a recipe item within a menu section.

    Items are ordered within a section via order_no.
    Includes optional display_price, additional_info, key_highlights, and substitution for display.
    """

    __tablename__ = "menu_items"

    id: int | None = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="menu_sections.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MenuItemCreate(MenuItemBase):
    """Schema for creating a menu item."""

    section_id: int


class MenuItemUpdate(SQLModel):
    """Schema for updating a menu item."""

    recipe_id: int | None = None
    order_no: int | None = None
    display_price: float | None = None
    additional_info: str | None = None
    key_highlights: str | None = None
    substitution: str | None = None


# ---------------------------------------------------------------------------
# MenuOutlet junction table
# ---------------------------------------------------------------------------


class MenuOutletBase(SQLModel):
    """Shared fields for MenuOutlet."""

    menu_id: int = Field(foreign_key="menus.id")
    unit_id: str = Field(foreign_key="passport.unit.id", index=True)
    organization_id: str = Field(index=True)


class MenuOutlet(MenuOutletBase, table=True):
    """Links menus to Passport UNITS (many-to-many).

    A unit is a brand or an outlet, projected from Passport (rule 5: its UUID is the key). An outlet
    inherits its brand through `belongs_to_brand`, so a menu on a brand reaches that brand's sites —
    which is Passport's structure, not a convention Prepper maintains.
    """

    __tablename__ = "menu_outlets"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MenuOutletCreate(SQLModel):
    """Schema for adding a menu to a unit."""

    menu_id: int
    unit_id: str


# ---------------------------------------------------------------------------
# Read schemas (with nested data)
# ---------------------------------------------------------------------------


class MenuItemRead(MenuItemBase):
    """Schema for reading a menu item (API response)."""

    id: int
    section_id: int
    recipe_name: str
    created_at: datetime
    updated_at: datetime


class MenuSectionRead(MenuSectionBase):
    """Schema for reading a menu section with items (API response)."""

    id: int
    menu_id: int
    items: list[MenuItemRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class MenuRead(MenuBase):
    """Schema for reading a menu (API response)."""

    id: int
    created_by: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MenuDetail(MenuRead):
    """Schema for reading a menu with all details (API response)."""

    sections: list[MenuSectionRead] = Field(default_factory=list)
    outlets: list["MenuOutlet"] = Field(default_factory=list)
