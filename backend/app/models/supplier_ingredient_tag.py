"""SupplierIngredientTag models - tagging system for supplier ingredients."""

from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    pass


class SupplierIngredientTag(SQLModel, table=True):
    """Global tag definitions for supplier ingredients (soft-delete supported)."""

    __tablename__ = "supplier_ingredient_tags"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    is_active: bool = Field(default=True)

    # Relationships
    links: list["SupplierIngredientTagLink"] = Relationship(
        back_populates="tag",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class SupplierIngredientTagLink(SQLModel, table=True):
    """Join table for many-to-many between supplier ingredients and tags."""

    __tablename__ = "supplier_ingredient_supplier_ingredient_tags"

    __table_args__ = (
        UniqueConstraint(
            "supplier_ingredient_id",
            "supplier_ingredient_tag_id",
            name="uq_si_tag_link",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    supplier_ingredient_id: int = Field(
        sa_column=sa.Column(
            sa.Integer,
            sa.ForeignKey("supplier_ingredients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    supplier_ingredient_tag_id: int = Field(
        sa_column=sa.Column(
            sa.Integer,
            sa.ForeignKey("supplier_ingredient_tags.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )

    # Relationships
    tag: Optional["SupplierIngredientTag"] = Relationship(back_populates="links")


class SupplierIngredientTagRead(SQLModel):
    """Response DTO for a supplier ingredient tag."""

    id: int
    name: str
    is_active: bool


class SupplierIngredientTagCreate(SQLModel):
    """Request DTO for creating a supplier ingredient tag."""

    name: str
