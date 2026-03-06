"""Outlet management for multi-brand operations."""

from collections import deque
from datetime import datetime

from sqlmodel import Session, select

from app.models import (
    Recipe,
    Outlet,
    OutletCreate,
    OutletUpdate,
    RecipeOutlet,
    RecipeOutletCreate,
    RecipeOutletUpdate,
)


class OutletService:
    """Service for outlet and recipe-outlet management."""

    def __init__(self, session: Session):
        self.session = session

    # --- Outlet CRUD ---

    def create_outlet(self, data: OutletCreate) -> Outlet:
        """Create a new outlet."""
        outlet = Outlet.model_validate(data)
        self.session.add(outlet)
        self.session.commit()
        self.session.refresh(outlet)
        return outlet

    def list_outlets(self, is_active: bool | None = None) -> list[Outlet]:
        """List all outlets, optionally filtering by active status."""
        statement = select(Outlet)
        if is_active is not None:
            statement = statement.where(Outlet.is_active == is_active)
        return list(self.session.exec(statement).all())

    def _build_list_query(self, is_active=None, search=None):
        statement = select(Outlet)
        if is_active is not None:
            statement = statement.where(Outlet.is_active == is_active)
        if search:
            statement = statement.where(Outlet.name.ilike(f"%{search}%"))
        return statement

    def list_paginated(self, offset: int, limit: int, is_active=None, search=None, accessible_ids: set[int] | None = None) -> list[Outlet]:
        statement = self._build_list_query(is_active=is_active, search=search)
        if accessible_ids is not None:
            statement = statement.where(Outlet.id.in_(accessible_ids))
        statement = statement.offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def count(self, is_active=None, search=None, accessible_ids: set[int] | None = None) -> int:
        from sqlalchemy import func
        statement = self._build_list_query(is_active=is_active, search=search)
        if accessible_ids is not None:
            statement = statement.where(Outlet.id.in_(accessible_ids))
        count_stmt = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_stmt).one()

    def list_paginated_with_count(self, offset: int, limit: int, is_active=None, search=None, accessible_ids: set[int] | None = None) -> tuple[list[Outlet], int]:
        """Return paginated items and total count, reusing the same base filter."""
        from sqlalchemy import func
        base = self._build_list_query(is_active=is_active, search=search)
        if accessible_ids is not None:
            base = base.where(Outlet.id.in_(accessible_ids))
        total = self.session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(self.session.exec(base.offset(offset).limit(limit)).all())
        return items, total

    def get_outlet(self, outlet_id: int) -> Outlet | None:
        """Get an outlet by ID."""
        return self.session.get(Outlet, outlet_id)

    def get_outlet_by_code(self, code: str) -> Outlet | None:
        """Get an outlet by its short code."""
        statement = select(Outlet).where(Outlet.code == code)
        return self.session.exec(statement).first()

    def update_outlet(self, outlet_id: int, data: OutletUpdate) -> Outlet | None:
        """Update outlet fields."""
        outlet = self.get_outlet(outlet_id)
        if not outlet:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Check for circular parent reference if parent_outlet_id is being updated
        if "parent_outlet_id" in update_data and update_data["parent_outlet_id"] is not None:
            new_parent_id = update_data["parent_outlet_id"]
            # Check if setting this parent would create a cycle
            if self._would_create_cycle(outlet_id, new_parent_id):
                return None  # Will be handled as error in the API layer

        for key, value in update_data.items():
            setattr(outlet, key, value)

        outlet.updated_at = datetime.utcnow()
        self.session.add(outlet)
        self.session.commit()
        self.session.refresh(outlet)
        return outlet

    def deactivate_outlet(self, outlet_id: int) -> Outlet | None:
        """Soft-delete an outlet by setting is_active to False."""
        outlet = self.get_outlet(outlet_id)
        if not outlet:
            return None

        outlet.is_active = False
        outlet.updated_at = datetime.utcnow()
        self.session.add(outlet)
        self.session.commit()
        self.session.refresh(outlet)
        return outlet

    # --- Recipe-Outlet Management ---

    def get_recipes_for_outlet(
        self, outlet_id: int, is_active: bool | None = None
    ) -> list[RecipeOutlet]:
        """Get all recipe-outlet links for an outlet."""
        statement = select(RecipeOutlet).where(RecipeOutlet.outlet_id == outlet_id)
        if is_active is not None:
            statement = statement.where(RecipeOutlet.is_active == is_active)
        return list(self.session.exec(statement).all())

    def get_parent_outlet_recipes(
        self, outlet_id: int, is_active: bool | None = None
    ) -> list[RecipeOutlet]:
        """Get all recipe-outlet links from the parent outlet (if exists)."""
        outlet = self.get_outlet(outlet_id)
        if not outlet or not outlet.parent_outlet_id:
            return []

        return self.get_recipes_for_outlet(outlet.parent_outlet_id, is_active=is_active)

    def get_outlets_for_recipe(self, recipe_id: int) -> list[RecipeOutlet]:
        """Get all outlets a recipe is assigned to."""
        statement = select(RecipeOutlet).where(RecipeOutlet.recipe_id == recipe_id)
        return list(self.session.exec(statement).all())

    def get_outlets_for_recipes_batch(
        self, recipe_ids: list[int]
    ) -> dict[int, list[RecipeOutlet]]:
        """Get all outlets for multiple recipes in a single query.

        Returns a dictionary mapping recipe_id -> list of RecipeOutlet records.
        """
        if not recipe_ids:
            return {}

        # Fetch all RecipeOutlet records for these recipe IDs in one query
        statement = select(RecipeOutlet).where(RecipeOutlet.recipe_id.in_(recipe_ids))
        recipe_outlets = list(self.session.exec(statement).all())

        # Group by recipe_id
        result: dict[int, list[RecipeOutlet]] = {}
        for outlet in recipe_outlets:
            if outlet.recipe_id not in result:
                result[outlet.recipe_id] = []
            result[outlet.recipe_id].append(outlet)

        # Ensure all recipe_ids have an entry (even if empty list)
        for recipe_id in recipe_ids:
            if recipe_id not in result:
                result[recipe_id] = []

        return result

    def add_recipe_to_outlet(
        self, recipe_id: int, data: RecipeOutletCreate
    ) -> RecipeOutlet | None:
        """Add a recipe to an outlet."""
        # Validate recipe exists
        recipe = self.session.get(Recipe, recipe_id)
        if not recipe:
            return None

        # Validate outlet exists
        outlet = self.session.get(Outlet, data.outlet_id)
        if not outlet:
            return None

        # Check for existing link
        existing = self.session.exec(
            select(RecipeOutlet).where(
                RecipeOutlet.recipe_id == recipe_id,
                RecipeOutlet.outlet_id == data.outlet_id,
            )
        ).first()

        if existing:
            # Already exists - update instead
            existing.is_active = data.is_active
            existing.price_override = data.price_override
            self.session.add(existing)
            self.session.commit()
            self.session.refresh(existing)
            return existing

        # Create new link
        recipe_outlet = RecipeOutlet(
            recipe_id=recipe_id,
            outlet_id=data.outlet_id,
            is_active=data.is_active,
            price_override=data.price_override,
        )
        self.session.add(recipe_outlet)
        self.session.commit()
        self.session.refresh(recipe_outlet)
        return recipe_outlet

    def update_recipe_outlet(
        self, recipe_id: int, outlet_id: int, data: RecipeOutletUpdate
    ) -> RecipeOutlet | None:
        """Update a recipe-outlet link."""
        statement = select(RecipeOutlet).where(
            RecipeOutlet.recipe_id == recipe_id,
            RecipeOutlet.outlet_id == outlet_id,
        )
        recipe_outlet = self.session.exec(statement).first()

        if not recipe_outlet:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(recipe_outlet, key, value)

        self.session.add(recipe_outlet)
        self.session.commit()
        self.session.refresh(recipe_outlet)
        return recipe_outlet

    def remove_recipe_from_outlet(self, recipe_id: int, outlet_id: int) -> bool:
        """Remove a recipe from an outlet."""
        statement = select(RecipeOutlet).where(
            RecipeOutlet.recipe_id == recipe_id,
            RecipeOutlet.outlet_id == outlet_id,
        )
        recipe_outlet = self.session.exec(statement).first()

        if not recipe_outlet:
            return False

        self.session.delete(recipe_outlet)
        self.session.commit()
        return True

    # --- Helper Methods for Validation ---

    def _would_create_cycle(self, outlet_id: int, potential_parent_id: int) -> bool:
        """Check if setting potential_parent_id as parent of outlet_id would create a cycle.

        Fetches all outlets once and walks the parent chain in-memory.
        """
        if outlet_id == potential_parent_id:
            return True

        # Fetch all outlets into a parent lookup map in one query
        all_outlets = self.session.exec(select(Outlet)).all()
        parent_map = {o.id: o.parent_outlet_id for o in all_outlets}

        # Walk up the parent chain from potential_parent_id
        visited: set[int] = set()
        current = potential_parent_id

        while current is not None:
            if current in visited:
                return True
            visited.add(current)

            parent_id = parent_map.get(current)
            if parent_id is None:
                break
            if parent_id == outlet_id:
                return True
            current = parent_id

        return False

    # --- Hierarchical Outlet Methods ---

    def get_accessible_outlet_ids(self, user_outlet_id: int) -> set[int]:
        """Get all outlet IDs accessible to a user based on their outlet assignment.

        Fetches all outlets in one query, walks up to root, then BFS down
        to collect all IDs in the user's hierarchy subtree.
        """
        all_outlets = list(self.session.exec(select(Outlet)).all())
        by_id = {o.id: o for o in all_outlets}

        if user_outlet_id not in by_id:
            return set()

        # Walk up to find the root of this hierarchy
        current = user_outlet_id
        while current in by_id and by_id[current].parent_outlet_id is not None:
            current = by_id[current].parent_outlet_id

        # BFS down from root to collect all accessible IDs
        children_map: dict[int, list[int]] = {}
        for o in all_outlets:
            if o.parent_outlet_id is not None:
                children_map.setdefault(o.parent_outlet_id, []).append(o.id)

        accessible: set[int] = set()
        queue = deque([current])
        while queue:
            oid = queue.popleft()
            accessible.add(oid)
            queue.extend(children_map.get(oid, []))

        return accessible

    def get_child_outlets(self, outlet_id: int) -> list[Outlet]:
        """Get all direct child outlets of a parent outlet."""
        statement = select(Outlet).where(Outlet.parent_outlet_id == outlet_id)
        return list(self.session.exec(statement).all())

    def get_outlet_hierarchy(self, outlet_id: int) -> dict:
        """Get the full hierarchy tree for an outlet and its children.

        Fetches all outlets in a single query and builds the tree in memory.
        """
        # Fetch all outlets in one query
        all_outlets = list(self.session.exec(select(Outlet)).all())
        outlet_map = {o.id: o for o in all_outlets}

        root = outlet_map.get(outlet_id)
        if not root:
            return {"error": "not_found"}

        # Group by parent_outlet_id for fast child lookup
        children_map: dict[int, list[Outlet]] = {}
        for o in all_outlets:
            if o.parent_outlet_id is not None:
                children_map.setdefault(o.parent_outlet_id, []).append(o)

        def build_node(oid: int) -> dict:
            o = outlet_map[oid]
            return {
                "id": o.id,
                "name": o.name,
                "code": o.code,
                "outlet_type": o.outlet_type.value if hasattr(o.outlet_type, 'value') else o.outlet_type,
                "is_active": o.is_active,
                "children": [
                    build_node(child.id)
                    for child in children_map.get(oid, [])
                    if child.id is not None
                ],
            }

        return build_node(outlet_id)
