"""OutletSupplierIngredient model - links supplier-ingredient records to outlets for display scoping."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.outlet import Outlet
    from app.models.supplier_ingredient import SupplierIngredient


class OutletSupplierIngredient(SQLModel, table=True):
    """Join table linking a supplier-ingredient record to one or more outlets."""

    __tablename__ = "outlet_supplier_ingredient"
    __table_args__ = (
        UniqueConstraint(
            "supplier_ingredient_id", "outlet_id",
            name="uq_outlet_supplier_ingredient",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    supplier_ingredient_id: int = Field(foreign_key="supplier_ingredients.id", index=True)
    outlet_id: int = Field(foreign_key="outlets.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    supplier_ingredient: Optional["SupplierIngredient"] = Relationship(back_populates="outlet_links")
    outlet: Optional["Outlet"] = Relationship()


class OutletSupplierIngredientCreate(SQLModel):
    """Schema for linking a supplier-ingredient to an outlet."""

    supplier_ingredient_id: int
    outlet_id: int


class OutletSupplierIngredientRead(SQLModel):
    """Response DTO for outlet-supplier-ingredient link."""

    id: int
    supplier_ingredient_id: int
    outlet_id: int
    created_at: datetime
    outlet_name: str | None = None
