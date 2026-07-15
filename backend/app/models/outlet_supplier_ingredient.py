"""OutletSupplierIngredient model - links supplier-ingredient records to outlets for display scoping."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.supplier_ingredient import SupplierIngredient


class OutletSupplierIngredient(SQLModel, table=True):
    """Join table linking a supplier-ingredient record to one or more outlets."""

    __tablename__ = "outlet_supplier_ingredient"
    __table_args__ = (
        UniqueConstraint(
            "supplier_ingredient_id", "unit_id",
            name="uq_outlet_supplier_ingredient_si_unit",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    supplier_ingredient_id: int = Field(foreign_key="supplier_ingredients.id", index=True)
    unit_id: str = Field(foreign_key="passport_unit.id", index=True)
    organization_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    supplier_ingredient: Optional["SupplierIngredient"] = Relationship(back_populates="outlet_links")
    # No relationship to a unit: `passport_unit` is an externally-owned READ MODEL written only
    # by the sync handler. Resolve names in a batch query (see the services) — a lazy per-row
    # traverse across a projection is an N+1 waiting to happen.


class OutletSupplierIngredientCreate(SQLModel):
    """Schema for linking a supplier-ingredient to a Passport unit."""

    supplier_ingredient_id: int
    unit_id: str


class OutletSupplierIngredientRead(SQLModel):
    """Response DTO for outlet-supplier-ingredient link."""

    id: int
    supplier_ingredient_id: int
    unit_id: str
    created_at: datetime
    unit_name: str | None = None
