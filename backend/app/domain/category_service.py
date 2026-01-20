"""Category domain operations."""

from datetime import datetime

from sqlmodel import Session, select, func

from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)


class CategoryService:
    """Service for category CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_category(self, data: CategoryCreate) -> Category:
        """Create a new category.

        Raises ValueError if a category with the same name already exists
        (case-insensitive check).
        """
        if self._name_exists(data.name):
            raise ValueError(f"Category with name '{data.name}' already exists")

        category = Category.model_validate(data)
        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def list_categories(self, active_only: bool = True) -> list[Category]:
        """List all categories.

        Args:
            active_only: If True, only return active (non-deleted) categories.
        """
        statement = select(Category)
        if active_only:
            statement = statement.where(Category.is_active == True)
        return list(self.session.exec(statement).all())

    def get_category(self, category_id: int) -> Category | None:
        """Get a category by ID."""
        return self.session.get(Category, category_id)

    def update_category(
        self, category_id: int, data: CategoryUpdate
    ) -> Category | None:
        """Update a category's fields.

        Raises ValueError if the new name conflicts with an existing category
        (case-insensitive check).
        """
        category = self.get_category(category_id)
        if not category:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Check for name uniqueness if name is being updated
        if "name" in update_data and update_data["name"]:
            new_name = update_data["name"]
            if self._name_exists(new_name, exclude_id=category_id):
                raise ValueError(f"Category with name '{new_name}' already exists")

        for key, value in update_data.items():
            setattr(category, key, value)

        category.updated_at = datetime.utcnow()
        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def soft_delete_category(self, category_id: int) -> Category | None:
        """Soft-delete a category by setting is_active to False."""
        category = self.get_category(category_id)
        if not category:
            return None

        category.is_active = False
        category.updated_at = datetime.utcnow()
        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def _name_exists(self, name: str, exclude_id: int | None = None) -> bool:
        """Check if a category with the given name exists (case-insensitive).

        Args:
            name: The category name to check.
            exclude_id: Optional category ID to exclude from the check
                       (useful when updating a category).
        """
        statement = select(Category).where(
            func.lower(Category.name) == name.lower(),
            Category.is_active == True,
        )
        if exclude_id is not None:
            statement = statement.where(Category.id != exclude_id)

        result = self.session.exec(statement).first()
        return result is not None
