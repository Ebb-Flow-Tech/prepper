"""Supplier model - vendor/supplier entity for ingredient sourcing."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class SupplierBase(SQLModel):
    """Shared fields for Supplier."""

    name: str = Field(index=True)
    sku: str | None = Field(default=None)


class Supplier(SupplierBase, table=True):
    """
    Supplier entity representing vendors that provide ingredients.
    """

    __tablename__ = "suppliers"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SupplierCreate(SQLModel):
    """Schema for creating a new supplier."""

    name: str
    sku: str | None = None


class SupplierUpdate(SQLModel):
    """Schema for updating a supplier (all fields optional)."""

    name: str | None = None
    sku: str | None = None
