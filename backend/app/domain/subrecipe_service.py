"""Sub-recipe management with cycle detection for BOM hierarchy."""

from collections import deque

from sqlmodel import Session, select

from app.models import (
    Recipe,
    RecipeRecipe,
    RecipeRecipeCreate,
    RecipeRecipeUpdate,
)


class CycleDetectedError(Exception):
    """Raised when adding a sub-recipe would create a circular reference."""

    pass


class SubRecipeService:
    """Service for managing recipe-to-recipe (sub-recipe) relationships."""

    def __init__(self, session: Session):
        self.session = session

    # --- Cycle Detection ---

    def _get_child_recipe_ids(self, recipe_id: int) -> list[int]:
        """Get all direct child recipe IDs for a given recipe."""
        statement = select(RecipeRecipe.child_recipe_id).where(
            RecipeRecipe.parent_recipe_id == recipe_id
        )
        return list(self.session.exec(statement).all())

    def can_add_subrecipe(self, parent_id: int, child_id: int) -> bool:
        """
        Check if adding child as sub-recipe would create a cycle.

        Uses BFS to check if parent is reachable from child's descendants.
        If parent_id appears anywhere in child's sub-recipe tree, adding
        would create a cycle: parent → child → ... → parent

        Returns True if safe to add, False if would create cycle.
        """
        # Self-reference is never allowed
        if parent_id == child_id:
            return False

        # BFS from child to find if parent is reachable
        visited: set[int] = set()
        queue: deque[int] = deque([child_id])

        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)

            # Get all sub-recipes of current
            sub_recipe_ids = self._get_child_recipe_ids(current)

            # If parent is in the sub-recipes, we'd create a cycle
            if parent_id in sub_recipe_ids:
                return False

            queue.extend(sub_recipe_ids)

        return True

    # --- Sub-Recipe CRUD ---

    def get_sub_recipes(self, recipe_id: int) -> list[RecipeRecipe]:
        """Get all sub-recipes for a parent recipe, ordered by position."""
        statement = (
            select(RecipeRecipe)
            .where(RecipeRecipe.parent_recipe_id == recipe_id)
            .order_by(RecipeRecipe.position)
        )
        return list(self.session.exec(statement).all())

    def get_parent_recipes(self, recipe_id: int) -> list[RecipeRecipe]:
        """
        Get all recipes that use this recipe as a sub-recipe.

        This is the reverse lookup: "What recipes include me?"
        """
        statement = select(RecipeRecipe).where(
            RecipeRecipe.child_recipe_id == recipe_id
        )
        return list(self.session.exec(statement).all())

    def add_sub_recipe(
        self, parent_recipe_id: int, data: RecipeRecipeCreate
    ) -> RecipeRecipe:
        """
        Add a sub-recipe to a parent recipe.

        Raises CycleDetectedError if this would create a circular reference.
        """
        # Validate parent exists
        parent = self.session.get(Recipe, parent_recipe_id)
        if not parent:
            raise ValueError(f"Parent recipe {parent_recipe_id} not found")

        # Validate child exists
        child = self.session.get(Recipe, data.child_recipe_id)
        if not child:
            raise ValueError(f"Child recipe {data.child_recipe_id} not found")

        # Check for cycles
        if not self.can_add_subrecipe(parent_recipe_id, data.child_recipe_id):
            raise CycleDetectedError(
                f"Adding recipe {data.child_recipe_id} as sub-recipe of "
                f"{parent_recipe_id} would create a circular reference"
            )

        # Check for duplicates
        existing = self.session.exec(
            select(RecipeRecipe).where(
                RecipeRecipe.parent_recipe_id == parent_recipe_id,
                RecipeRecipe.child_recipe_id == data.child_recipe_id,
            )
        ).first()

        if existing:
            raise ValueError(
                f"Recipe {data.child_recipe_id} is already a sub-recipe of {parent_recipe_id}"
            )

        # Get next position
        max_position_result = self.session.exec(
            select(RecipeRecipe.position)
            .where(RecipeRecipe.parent_recipe_id == parent_recipe_id)
            .order_by(RecipeRecipe.position.desc())
        ).first()
        next_position = (max_position_result or 0) + 1

        # Create the link
        recipe_recipe = RecipeRecipe(
            parent_recipe_id=parent_recipe_id,
            child_recipe_id=data.child_recipe_id,
            quantity=data.quantity,
            unit=data.unit,
            position=next_position,
        )
        self.session.add(recipe_recipe)
        self.session.commit()
        self.session.refresh(recipe_recipe)
        return recipe_recipe

    def update_sub_recipe(
        self, link_id: int, data: RecipeRecipeUpdate
    ) -> RecipeRecipe | None:
        """Update a sub-recipe link's quantity or unit."""
        rr = self.session.get(RecipeRecipe, link_id)
        if not rr:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(rr, key, value)

        self.session.add(rr)
        self.session.commit()
        self.session.refresh(rr)
        return rr

    def remove_sub_recipe(self, link_id: int) -> bool:
        """Remove a sub-recipe link."""
        rr = self.session.get(RecipeRecipe, link_id)
        if not rr:
            return False

        self.session.delete(rr)
        self.session.commit()
        return True

    def reorder_sub_recipes(
        self, parent_recipe_id: int, ordered_ids: list[int]
    ) -> list[RecipeRecipe]:
        """Reorder sub-recipes based on provided link ID order."""
        for index, link_id in enumerate(ordered_ids):
            rr = self.session.get(RecipeRecipe, link_id)
            if rr and rr.parent_recipe_id == parent_recipe_id:
                rr.position = index
                self.session.add(rr)

        self.session.commit()
        return self.get_sub_recipes(parent_recipe_id)

    # --- Utility Methods ---

    def get_full_bom_tree(self, recipe_id: int, depth: int = 0, max_depth: int = 10) -> dict:
        """
        Get the full Bill of Materials tree for a recipe.

        Returns a nested structure showing all sub-recipes recursively.
        Includes depth limiting to prevent runaway queries.
        """
        if depth >= max_depth:
            return {"recipe_id": recipe_id, "truncated": True}

        recipe = self.session.get(Recipe, recipe_id)
        if not recipe:
            return {"recipe_id": recipe_id, "error": "not_found"}

        sub_recipes = self.get_sub_recipes(recipe_id)

        return {
            "recipe_id": recipe_id,
            "recipe_name": recipe.name,
            "sub_recipes": [
                {
                    "link_id": rr.id,
                    "quantity": rr.quantity,
                    "unit": rr.unit.value if hasattr(rr.unit, 'value') else rr.unit,
                    "position": rr.position,
                    "child": self.get_full_bom_tree(
                        rr.child_recipe_id, depth + 1, max_depth
                    ),
                }
                for rr in sub_recipes
            ],
        }
