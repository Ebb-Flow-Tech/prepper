"""Outlet management for multi-brand operations."""

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

    def get_outlets_for_recipe(self, recipe_id: int) -> list[RecipeOutlet]:
        """Get all outlets a recipe is assigned to."""
        statement = select(RecipeOutlet).where(RecipeOutlet.recipe_id == recipe_id)
        return list(self.session.exec(statement).all())

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

        When we set X as parent of Y, a cycle would be created if:
        1. X == Y (self-reference)
        2. Y is an ancestor of X (because then X would become ancestor of itself)

        Example: If A -> B (B's parent is A), then A cannot have B as parent,
        because that would make: A -> B -> A (cycle).
        """
        # Check for self-reference
        if outlet_id == potential_parent_id:
            return True

        # Check if outlet_id is an ancestor of potential_parent_id
        # by walking UP the parent chain from potential_parent_id
        visited = set()
        current = potential_parent_id

        while current is not None:
            if current in visited:
                # Cycle already exists, shouldn't happen but catch it
                return True
            visited.add(current)

            current_outlet = self.get_outlet(current)
            if not current_outlet:
                break

            # If we reach outlet_id while walking up, it means outlet_id is an ancestor
            if current_outlet.parent_outlet_id == outlet_id:
                return True

            current = current_outlet.parent_outlet_id

        return False

    # --- Hierarchical Outlet Methods ---

    def get_child_outlets(self, outlet_id: int) -> list[Outlet]:
        """Get all direct child outlets of a parent outlet."""
        statement = select(Outlet).where(Outlet.parent_outlet_id == outlet_id)
        return list(self.session.exec(statement).all())

    def get_outlet_hierarchy(self, outlet_id: int) -> dict:
        """Get the full hierarchy tree for an outlet and its children."""
        outlet = self.get_outlet(outlet_id)
        if not outlet:
            return {"error": "not_found"}

        children = self.get_child_outlets(outlet_id)

        return {
            "id": outlet.id,
            "name": outlet.name,
            "code": outlet.code,
            "outlet_type": outlet.outlet_type.value if hasattr(outlet.outlet_type, 'value') else outlet.outlet_type,
            "is_active": outlet.is_active,
            "children": [
                self.get_outlet_hierarchy(child.id)
                for child in children
                if child.id is not None
            ],
        }
