"""Recipe category domain operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models.recipe_category import (
    RecipeCategory,
    RecipeCategoryCreate,
    RecipeCategoryUpdate,
)


class RecipeCategoryService:
    """Service for recipe category CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_recipe_category(self, data: RecipeCategoryCreate) -> RecipeCategory:
        """Create a new recipe category."""
        recipe_category = RecipeCategory.model_validate(data)
        self.session.add(recipe_category)
        self.session.commit()
        self.session.refresh(recipe_category)
        return recipe_category

    def list_recipe_categories(self) -> list[RecipeCategory]:
        """List all recipe categories."""
        statement = select(RecipeCategory)
        return list(self.session.exec(statement).all())

    def get_recipe_category(self, category_id: int) -> RecipeCategory | None:
        """Get a recipe category by ID."""
        return self.session.get(RecipeCategory, category_id)

    def update_recipe_category(
        self, category_id: int, data: RecipeCategoryUpdate
    ) -> RecipeCategory | None:
        """Update a recipe category's fields."""
        recipe_category = self.get_recipe_category(category_id)
        if not recipe_category:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(recipe_category, key, value)

        recipe_category.updated_at = datetime.utcnow()
        self.session.add(recipe_category)
        self.session.commit()
        self.session.refresh(recipe_category)
        return recipe_category

    def delete_recipe_category(self, category_id: int) -> bool:
        """Delete a recipe category by ID."""
        recipe_category = self.get_recipe_category(category_id)
        if not recipe_category:
            return False

        self.session.delete(recipe_category)
        self.session.commit()
        return True
