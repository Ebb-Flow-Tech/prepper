"""Recipe-RecipeCategory model - many-to-many relationship between recipes and recipe categories."""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class RecipeRecipeCategory(SQLModel, table=True):
    """
    Many-to-many relationship between recipes and recipe categories.

    Tracks which recipe categories are assigned to which recipes.
    """

    __tablename__ = "recipe_recipe_categories"

    id: Optional[int] = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    category_id: int = Field(foreign_key="recipe_categories.id", index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeRecipeCategoryCreate(SQLModel):
    """Schema for adding a recipe category to a recipe."""

    recipe_id: int
    category_id: int
    is_active: bool = True


class RecipeRecipeCategoryUpdate(SQLModel):
    """Schema for updating a recipe-category link."""

    is_active: bool | None = None
