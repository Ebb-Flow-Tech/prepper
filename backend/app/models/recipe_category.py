"""Recipe category model - category entity for recipes."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class RecipeCategoryBase(SQLModel):
    """Shared fields for RecipeCategory."""

    name: str = Field(index=True)
    description: str | None = Field(default=None)


class RecipeCategory(RecipeCategoryBase, table=True):
    """
    RecipeCategory entity representing categories for recipes.
    """

    __tablename__ = "recipe_categories"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeCategoryCreate(SQLModel):
    """Schema for creating a new recipe category."""

    name: str
    description: str | None = None


class RecipeCategoryUpdate(SQLModel):
    """Schema for updating a recipe category (all fields optional)."""

    name: str | None = None
    description: str | None = None
