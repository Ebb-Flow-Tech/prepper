"""RecipeIngredient model - quantitative link between recipe and ingredients."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class RecipeIngredientBase(SQLModel):
    """Shared fields for RecipeIngredient."""

    ingredient_id: int = Field(foreign_key="ingredients.id", index=True)
    quantity: float
    unit: str = Field(description="Must be convertible to ingredient.base_unit")


class RecipeIngredient(RecipeIngredientBase, table=True):
    """
    Quantitative link between recipe and ingredients.

    This table is CRITICAL - all costing and scaling flows through here.
    Units must be convertible to ingredient.base_unit.
    """

    __tablename__ = "recipe_ingredients"

    id: int | None = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeIngredientCreate(RecipeIngredientBase):
    """Schema for adding an ingredient to a recipe."""

    pass


class RecipeIngredientUpdate(SQLModel):
    """Schema for updating a recipe ingredient."""

    quantity: float | None = None
    unit: str | None = None


class RecipeIngredientReorder(SQLModel):
    """Schema for reordering recipe ingredients."""

    ordered_ids: list[int]
