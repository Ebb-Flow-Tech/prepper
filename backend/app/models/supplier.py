"""Supplier model - vendor/supplier entity for ingredient sourcing."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.supplier_ingredient import SupplierIngredient


class SupplierBase(SQLModel):
    """Shared fields for Supplier."""

    name: str = Field(index=True)
    address: str | None = Field(default=None)
    phone_number: str | None = Field(default=None)
    email: str | None = Field(default=None)
    shipping_company_name: str | None = Field(default=None)
    code: str | None = Field(default=None)
    source: str = Field(default="manual")


class Supplier(SupplierBase, table=True):
    """
    Supplier entity representing vendors that provide ingredients.
    """

    __tablename__ = "suppliers"

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
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship to SupplierIngredient
    supplier_ingredients: list["SupplierIngredient"] = Relationship(back_populates="supplier")


class SupplierCreate(SQLModel):
    """Schema for creating a new supplier."""

    name: str
    address: str | None = None
    phone_number: str | None = None
    email: str | None = None
    shipping_company_name: str | None = None
    code: str | None = None
    source: str = "manual"


class SupplierUpdate(SQLModel):
    """Schema for updating a supplier (all fields optional)."""

    name: str | None = None
    address: str | None = None
    phone_number: str | None = None
    email: str | None = None
    shipping_company_name: str | None = None
    code: str | None = None
    is_active: bool | None = None
