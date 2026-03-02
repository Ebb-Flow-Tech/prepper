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


class Supplier(SupplierBase, table=True):
    """
    Supplier entity representing vendors that provide ingredients.
    """

    __tablename__ = "suppliers"

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


class SupplierUpdate(SQLModel):
    """Schema for updating a supplier (all fields optional)."""

    name: str | None = None
    address: str | None = None
    phone_number: str | None = None
    email: str | None = None
    is_active: bool | None = None
