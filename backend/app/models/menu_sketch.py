"""MenuSketch model — freeform input-driven menu builder."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class MenuSketch(SQLModel, table=True):
    """
    Freeform menu sketch.

    Sections and items are stored in the relational tables
    ``menu_sketch_section`` and ``menu_sketch_section_item`` rather than
    as a nested JSON blob.
    """

    __tablename__ = "menus_sketch"

    # Passport org UUID (rule 9) — a scope pointer, not a Passport fact. Nullable until the
    # backfill lands: existing rows have no org and any default would be a guess. See
    # alembic q1orgcol9p0q.
    organization_id: str | None = Field(default=None, nullable=False, index=True)
    # NOT NULL in the database (`q3orgnn3t4u`) but Optional in Python: the create path is
    # `model_validate(data)` — where `data` is a Create schema that deliberately has no org
    # field — followed by stamping it from the acting org. A required field would break that
    # at validation. `nullable=False` is what keeps the model honest about the column, so
    # autogenerate does not offer to make it nullable again and SQLite tests fail on an
    # unstamped insert the same way Postgres would.

    id: int | None = Field(default=None, primary_key=True)
    version: int = Field(default=1)
    name: str = Field(default="Untitled Menu")

    # 'draft' | 'archived'  — soft-delete via status transition
    status: str = Field(default="draft")

    # Points to the sketch this was forked from (nullable)
    root: int | None = Field(default=None, foreign_key="menus_sketch.id")

    # Menu-wide rich-text notes (HTML string from Tiptap)
    notes: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MenuSketchCreate(SQLModel):
    """Schema for creating a new menu sketch."""

    name: str = "Untitled Menu"


class MenuSketchUpdate(SQLModel):
    """Schema for updating a menu sketch (all fields optional)."""

    name: str | None = None
    status: str | None = None
    notes: str | None = None


class MenuSketchRead(SQLModel):
    """Schema for reading a menu sketch (API response)."""

    id: int
    version: int
    name: str
    status: str
    root: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
