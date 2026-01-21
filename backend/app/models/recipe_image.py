"""RecipeImage model - represents images for recipes with ordering support."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class RecipeImageBase(SQLModel):
    """Shared fields for RecipeImage."""

    recipe_id: int = Field(foreign_key="recipes.id", index=True)
    image_url: str
    is_main: bool = Field(default=False, description="Primary image for display")
    order: int = Field(default=0, description="Display sequence")


class RecipeImage(RecipeImageBase, table=True):
    """
    Represents an image for a recipe.

    Each recipe can have multiple images with:
    - image_url: Storage location
    - is_main: Flag for primary display image
    - order: Sequence for carousel/gallery display
    """

    __tablename__ = "recipe_images"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RecipeImageCreate(RecipeImageBase):
    """Schema for creating a new recipe image."""

    pass


class RecipeImageUpdate(SQLModel):
    """Schema for updating recipe image metadata."""

    image_url: str | None = None
    is_main: bool | None = None
    order: int | None = None


class RecipeImageReorder(SQLModel):
    """Schema for reordering recipe images."""

    images: list[dict]  # Array of images with id and order
