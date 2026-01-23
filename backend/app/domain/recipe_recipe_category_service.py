"""Recipe-RecipeCategory domain operations."""

from datetime import datetime

from sqlmodel import Session, select

from app.models.recipe_recipe_category import (
    RecipeRecipeCategory,
    RecipeRecipeCategoryCreate,
    RecipeRecipeCategoryUpdate,
)


class RecipeRecipeCategoryService:
    """Service for recipe-category link CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_recipe_category_link(
        self, data: RecipeRecipeCategoryCreate
    ) -> RecipeRecipeCategory:
        """Create a link between a recipe and a recipe category."""
        # Check if link already exists
        existing = self.get_link_by_recipe_and_category(
            data.recipe_id, data.category_id
        )
        if existing:
            # If exists but is_active is different, update it
            if existing.is_active != data.is_active:
                return self.update_recipe_category_link(
                    existing.id, RecipeRecipeCategoryUpdate(is_active=data.is_active)
                )
            return existing

        recipe_category = RecipeRecipeCategory.model_validate(data)
        self.session.add(recipe_category)
        self.session.commit()
        self.session.refresh(recipe_category)
        return recipe_category

    def list_recipe_categories(self) -> list[RecipeRecipeCategory]:
        """List all recipe-category links."""
        statement = select(RecipeRecipeCategory)
        return list(self.session.exec(statement).all())

    def list_recipe_categories_by_recipe(
        self, recipe_id: int
    ) -> list[RecipeRecipeCategory]:
        """List all categories assigned to a recipe."""
        statement = select(RecipeRecipeCategory).where(
            RecipeRecipeCategory.recipe_id == recipe_id
        )
        return list(self.session.exec(statement).all())

    def list_recipes_by_category(
        self, category_id: int
    ) -> list[RecipeRecipeCategory]:
        """List all recipes in a category."""
        statement = select(RecipeRecipeCategory).where(
            RecipeRecipeCategory.category_id == category_id
        )
        return list(self.session.exec(statement).all())

    def get_recipe_category_link(self, link_id: int) -> RecipeRecipeCategory | None:
        """Get a recipe-category link by ID."""
        return self.session.get(RecipeRecipeCategory, link_id)

    def get_link_by_recipe_and_category(
        self, recipe_id: int, category_id: int
    ) -> RecipeRecipeCategory | None:
        """Get a link by recipe_id and category_id."""
        statement = select(RecipeRecipeCategory).where(
            (RecipeRecipeCategory.recipe_id == recipe_id)
            & (RecipeRecipeCategory.category_id == category_id)
        )
        return self.session.exec(statement).first()

    def update_recipe_category_link(
        self, link_id: int, data: RecipeRecipeCategoryUpdate
    ) -> RecipeRecipeCategory | None:
        """Update a recipe-category link."""
        link = self.get_recipe_category_link(link_id)
        if not link:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(link, key, value)

        link.updated_at = datetime.utcnow()
        self.session.add(link)
        self.session.commit()
        self.session.refresh(link)
        return link

    def delete_recipe_category_link(self, link_id: int) -> bool:
        """Delete a recipe-category link."""
        link = self.get_recipe_category_link(link_id)
        if not link:
            return False

        self.session.delete(link)
        self.session.commit()
        return True

    def delete_recipe_categories_by_recipe(self, recipe_id: int) -> int:
        """Delete all category links for a recipe. Returns count deleted."""
        statement = select(RecipeRecipeCategory).where(
            RecipeRecipeCategory.recipe_id == recipe_id
        )
        links = list(self.session.exec(statement).all())
        for link in links:
            self.session.delete(link)
        self.session.commit()
        return len(links)

    def delete_recipe_categories_by_category(self, category_id: int) -> int:
        """Delete all recipe links for a category. Returns count deleted."""
        statement = select(RecipeRecipeCategory).where(
            RecipeRecipeCategory.category_id == category_id
        )
        links = list(self.session.exec(statement).all())
        for link in links:
            self.session.delete(link)
        self.session.commit()
        return len(links)
