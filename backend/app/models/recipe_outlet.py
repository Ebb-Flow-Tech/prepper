"""RecipeOutlet — links a recipe to a Passport UNIT (a brand or an outlet).

Prepper no longer owns an `outlets` table. Structure — entities, brands, outlets and the edges
between them — is Passport's, projected into `passport_unit` / `passport_unit_relation`. This join
table therefore points at a Passport unit UUID, adopted verbatim (rule 5): there is no local serial
id for a place, and no second copy of its name or status to drift.

`organization_id` is the Passport org UUID (rule 9). It stores no Passport fact — it is a scope
pointer, so every query can be org-scoped without consulting a configured constant.
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class RecipeOutletBase(SQLModel):
    """Shared fields for RecipeOutlet."""

    unit_id: str = Field(foreign_key="passport_unit.id", index=True)
    organization_id: str = Field(index=True)
    is_active: bool = Field(
        default=True, description="Can deactivate a recipe for a specific unit"
    )
    price_override: float | None = Field(
        default=None, description="Unit-specific selling price"
    )


class RecipeOutlet(RecipeOutletBase, table=True):
    """Links recipes to Passport units (many-to-many), with per-unit activation and pricing."""

    __tablename__ = "recipe_outlets"

    recipe_id: int = Field(foreign_key="recipes.id", primary_key=True)
    unit_id: str = Field(foreign_key="passport_unit.id", primary_key=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeOutletCreate(SQLModel):
    """Schema for adding a recipe to a unit."""

    unit_id: str
    is_active: bool = True
    price_override: float | None = None


class RecipeOutletUpdate(SQLModel):
    """Schema for updating a recipe-unit link."""

    is_active: bool | None = None
    price_override: float | None = None
