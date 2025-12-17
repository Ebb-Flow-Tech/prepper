"""RecipeRecipe model - sub-recipe linking for BOM hierarchy."""

from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class SubRecipeUnit(str, Enum):
    """Valid units for sub-recipe quantities."""

    PORTION = "portion"
    BATCH = "batch"
    GRAM = "g"
    MILLILITER = "ml"


class RecipeRecipeBase(SQLModel):
    """Shared fields for RecipeRecipe."""

    child_recipe_id: int = Field(foreign_key="recipes.id", index=True)
    quantity: float = Field(default=1.0)
    unit: SubRecipeUnit = Field(default=SubRecipeUnit.PORTION)


class RecipeRecipe(RecipeRecipeBase, table=True):
    """
    Links a parent recipe to a child (sub-recipe) component.

    Enables Bill of Materials (BOM) hierarchy where recipes can include
    other recipes as components (e.g., "Eggs Benedict" includes "Hollandaise Sauce").

    The costing service must recursively calculate costs through this hierarchy.
    Circular references are prevented at the service layer via cycle detection.
    """

    __tablename__ = "recipe_recipes"

    id: int | None = Field(default=None, primary_key=True)
    parent_recipe_id: int = Field(foreign_key="recipes.id", index=True)
    position: int = Field(default=0, description="Display order in parent recipe")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeRecipeCreate(RecipeRecipeBase):
    """Schema for adding a sub-recipe to a recipe."""

    pass


class RecipeRecipeUpdate(SQLModel):
    """Schema for updating a sub-recipe link."""

    quantity: float | None = None
    unit: SubRecipeUnit | None = None


class RecipeRecipeReorder(SQLModel):
    """Schema for reordering sub-recipes within a parent recipe."""

    ordered_ids: list[int]
