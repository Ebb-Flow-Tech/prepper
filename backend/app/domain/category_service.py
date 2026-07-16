"""Category domain operations."""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, select

from app.domain.org_scope import org_scope
from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)


class CategoryService:
    """Service for category CRUD operations."""

    def __init__(self, session: Session, organization_id: str):
        """``organization_id`` is required, and deliberately has no default.

        A default would mean a caller that forgets it gets a service that silently reads every
        org's rows — which is precisely the bug this constructor exists to make unwritable. The
        org comes from `get_org_context`, i.e. from the token.
        """
        self.session = session
        self.organization_id = organization_id

    def create_category(self, data: CategoryCreate) -> Category:
        """Create a new category, stamped with the acting org.

        Raises ValueError if a category with the same name already exists in this org
        (case-insensitive check).

        The org comes from the acting org context, never the request body — the Create schemas
        have no such field. A tenant id a client can assert is not a tenant id.
        """
        if self._name_exists(data.name):
            raise ValueError(f"Category with name '{data.name}' already exists")

        category = Category.model_validate(data)
        category.organization_id = self.organization_id
        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def list_categories(self, active_only: bool = True) -> list[Category]:
        """List this org's categories.

        Args:
            active_only: If True, only return active (non-deleted) categories.
        """
        statement = select(Category).where(org_scope(Category, self.organization_id))
        if active_only:
            statement = statement.where(Category.is_active == True)
        return list(self.session.exec(statement).all())

    def _build_list_query(self, active_only: bool = True, search: str | None = None):
        statement = select(Category).where(org_scope(Category, self.organization_id))
        if active_only:
            statement = statement.where(Category.is_active == True)
        if search:
            statement = statement.where(Category.name.ilike(f"%{search}%"))
        return statement

    def list_paginated(
        self, offset: int, limit: int, active_only: bool = True, search: str | None = None
    ) -> list[Category]:
        statement = self._build_list_query(active_only=active_only, search=search)
        statement = statement.offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def count(self, active_only: bool = True, search: str | None = None) -> int:
        statement = self._build_list_query(active_only=active_only, search=search)
        count_stmt = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_stmt).one()

    def get_category(self, category_id: int) -> Category | None:
        """Get a category by ID, within this org.

        A `session.get()` here would fetch by primary key alone and hand back another org's row on
        a guessed integer. `update_category` and `soft_delete_category` both resolve through this
        method, so the org predicate is what stops a cross-org write as well as a cross-org read.
        """
        return self.session.exec(
            select(Category).where(
                Category.id == category_id,
                org_scope(Category, self.organization_id),
            )
        ).first()

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
        """Check if a category with the given name exists in this org (case-insensitive).

        Scoped to the org for a reason beyond privacy: unscoped, "Desserts" existing anywhere in
        the system would stop every other org from ever creating "Desserts". Uniqueness that
        crosses a tenant boundary leaks the other tenant's contents through the 409.

        (`org_scope` still admits NULL rows, so a legacy un-backfilled name keeps blocking — which
        is exactly today's behaviour, and it resolves itself as the backfill lands.)

        Args:
            name: The category name to check.
            exclude_id: Optional category ID to exclude from the check
                       (useful when updating a category).
        """
        statement = select(Category).where(
            func.lower(Category.name) == name.lower(),
            Category.is_active == True,
            org_scope(Category, self.organization_id),
        )
        if exclude_id is not None:
            statement = statement.where(Category.id != exclude_id)

        result = self.session.exec(statement).first()
        return result is not None
