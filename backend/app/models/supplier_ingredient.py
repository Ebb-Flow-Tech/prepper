"""SupplierIngredient model - normalized join table for supplier-ingredient relationships."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.ingredient import Ingredient
    from app.models.outlet import Outlet
    from app.models.supplier import Supplier


class SupplierIngredientBase(SQLModel):
    """Shared fields for SupplierIngredient."""

    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    supplier_id: int = Field(foreign_key="suppliers.id", index=True)
    outlet_id: int = Field(foreign_key="outlets.id", index=True)
    sku: str | None = Field(default=None, unique=True)
    pack_size: float
    pack_unit: str
    price_per_pack: float
    currency: str = Field(default="SGD")
    source: str = Field(default="manual")
    is_preferred: bool = Field(default=False)


class SupplierIngredient(SupplierIngredientBase, table=True):
    """Normalized join table linking suppliers to ingredients with pricing data."""

    __tablename__ = "supplier_ingredients"
    __table_args__ = (
        UniqueConstraint(
            "ingredient_id", "supplier_id", "outlet_id",
            name="uq_supplier_ingredient_outlet",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    ingredient: Optional["Ingredient"] = Relationship(back_populates="supplier_ingredients")
    supplier: Optional["Supplier"] = Relationship(back_populates="supplier_ingredients")
    outlet: Optional["Outlet"] = Relationship()


class SupplierIngredientCreate(SQLModel):
    """Schema for creating a supplier-ingredient link."""

    ingredient_id: int
    supplier_id: int
    outlet_id: int
    sku: str | None = None
    pack_size: float
    pack_unit: str
    price_per_pack: float
    currency: str = "SGD"
    source: str = "manual"
    is_preferred: bool = False


class SupplierIngredientUpdate(SQLModel):
    """Schema for updating a supplier-ingredient link (all fields optional)."""

    sku: str | None = None
    pack_size: float | None = None
    pack_unit: str | None = None
    price_per_pack: float | None = None
    currency: str | None = None
    source: str | None = None
    is_preferred: bool | None = None
    outlet_id: int | None = None


class SupplierIngredientRead(SQLModel):
    """Response DTO for supplier-ingredient with nested names."""

    id: int
    ingredient_id: int
    supplier_id: int
    outlet_id: int
    sku: str | None = None
    pack_size: float
    pack_unit: str
    price_per_pack: float
    currency: str = "SGD"
    source: str = "manual"
    is_preferred: bool = False
    created_at: datetime
    updated_at: datetime
    supplier_name: str | None = None
    ingredient_name: str | None = None
    outlet_name: str | None = None
