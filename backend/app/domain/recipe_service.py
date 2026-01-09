"""Recipe lifecycle and ingredient management operations."""

from datetime import datetime

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models import (
    Recipe,
    RecipeCreate,
    RecipeUpdate,
    RecipeStatus,
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientUpdate,
    RecipeRecipe,
)


class RecipeService:
    """Service for recipe lifecycle and ingredient management."""

    def __init__(self, session: Session):
        self.session = session

    # --- Recipe Lifecycle Operations ---

    def create_recipe(self, data: RecipeCreate) -> Recipe:
        """Create a new recipe."""
        recipe = Recipe.model_validate(data)
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def list_recipes(self, status: RecipeStatus | None = None) -> list[Recipe]:
        """List all recipes, optionally filtering by status."""
        statement = select(Recipe)
        if status:
            statement = statement.where(Recipe.status == status)
        return list(self.session.exec(statement).all())

    def get_recipe(self, recipe_id: int) -> Recipe | None:
        """Get a recipe by ID."""
        return self.session.get(Recipe, recipe_id)

    def update_recipe_metadata(
        self, recipe_id: int, data: RecipeUpdate
    ) -> Recipe | None:
        """Update recipe metadata fields."""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(recipe, key, value)

        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def set_recipe_status(
        self, recipe_id: int, status: RecipeStatus
    ) -> Recipe | None:
        """Update a recipe's status."""
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return None

        recipe.status = status
        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def soft_delete_recipe(self, recipe_id: int) -> Recipe | None:
        """Soft-delete a recipe by setting status to archived."""
        return self.set_recipe_status(recipe_id, RecipeStatus.ARCHIVED)

    def fork_recipe(self, recipe_id: int, new_owner_id: str | None = None) -> Recipe | None:
        """
        Fork a recipe - create a copy with all ingredients and sub-recipes.

        The forked recipe will:
        - Have a new name with "(Fork)" suffix
        - Be owned by new_owner_id (or same as original if not provided)
        - Start as draft status
        - Copy all recipe ingredients
        - Copy all sub-recipe links (referencing original child recipes)
        - Copy instructions (raw and structured)
        """
        original = self.get_recipe(recipe_id)
        if not original:
            return None

        # Determine root_id and version for the fork
        # root_id points to the recipe this was forked from
        # Version increments based on the original's version
        new_version = original.version + 1

        # Create the forked recipe
        forked = Recipe(
            name=f"{original.name} (Fork)",
            yield_quantity=original.yield_quantity,
            yield_unit=original.yield_unit,
            is_prep_recipe=original.is_prep_recipe,
            instructions_raw=original.instructions_raw,
            instructions_structured=original.instructions_structured,
            selling_price_est=original.selling_price_est,
            status=RecipeStatus.DRAFT,
            is_public=False,  # Forked recipes start as private
            owner_id=new_owner_id if new_owner_id else original.owner_id,
            created_by=new_owner_id,
            version=new_version,
            root_id=original.id,
        )
        self.session.add(forked)
        self.session.commit()
        self.session.refresh(forked)

        # Copy all recipe ingredients
        original_ingredients = self.get_recipe_ingredients(recipe_id)
        for ri in original_ingredients:
            new_ri = RecipeIngredient(
                recipe_id=forked.id,
                ingredient_id=ri.ingredient_id,
                quantity=ri.quantity,
                unit=ri.unit,
                sort_order=ri.sort_order,
                unit_price=ri.unit_price,
                base_unit=ri.base_unit,
                supplier_id=ri.supplier_id,
            )
            self.session.add(new_ri)

        # Copy all sub-recipe links (referencing original child recipes)
        original_sub_recipes = self._get_sub_recipes(recipe_id)
        for rr in original_sub_recipes:
            new_rr = RecipeRecipe(
                parent_recipe_id=forked.id,
                child_recipe_id=rr.child_recipe_id,
                quantity=rr.quantity,
                unit=rr.unit,
                position=rr.position,
            )
            self.session.add(new_rr)

        self.session.commit()
        self.session.refresh(forked)
        return forked

    def _get_sub_recipes(self, recipe_id: int) -> list[RecipeRecipe]:
        """Get all sub-recipes for a parent recipe, ordered by position."""
        statement = (
            select(RecipeRecipe)
            .where(RecipeRecipe.parent_recipe_id == recipe_id)
            .order_by(RecipeRecipe.position)
        )
        return list(self.session.exec(statement).all())

    # --- Recipe Ingredient Management ---

    def get_recipe_ingredients(self, recipe_id: int) -> list[RecipeIngredient]:
        """Get all ingredients for a recipe, ordered by sort_order."""
        statement = (
            select(RecipeIngredient)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.sort_order)
            .options(selectinload(RecipeIngredient.ingredient))
        )
        return list(self.session.exec(statement).all())

    def add_ingredient_to_recipe(
        self, recipe_id: int, data: RecipeIngredientCreate
    ) -> RecipeIngredient | None:
        """Add an ingredient to a recipe (no duplicates allowed)."""
        # Check for duplicates
        existing = self.session.exec(
            select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe_id,
                RecipeIngredient.ingredient_id == data.ingredient_id,
            )
        ).first()

        if existing:
            return None  # Duplicate not allowed

        # Get max sort_order for this recipe
        max_order_result = self.session.exec(
            select(RecipeIngredient.sort_order)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.sort_order.desc())
        ).first()
        next_order = (max_order_result or 0) + 1

        # no priority -> just take the ingredient

        recipe_ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            ingredient_id=data.ingredient_id,
            quantity=data.quantity,
            unit=data.unit,
            sort_order=next_order,
            base_unit=data.base_unit,
            unit_price=data.unit_price,
            supplier_id=data.supplier_id
        )
        self.session.add(recipe_ingredient)
        self.session.commit()
        self.session.refresh(recipe_ingredient)
        return recipe_ingredient

    def update_recipe_ingredient(
        self, recipe_ingredient_id: int, data: RecipeIngredientUpdate
    ) -> RecipeIngredient | None:
        """Update a recipe ingredient's quantity or unit."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ri, key, value)

        self.session.add(ri)
        self.session.commit()
        self.session.refresh(ri)
        return ri

    def remove_ingredient_from_recipe(self, recipe_ingredient_id: int) -> bool:
        """Remove an ingredient from a recipe."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return False

        self.session.delete(ri)
        self.session.commit()
        return True

    def reorder_recipe_ingredients(
        self, recipe_id: int, ordered_ids: list[int]
    ) -> list[RecipeIngredient]:
        """Reorder recipe ingredients based on provided ID order."""
        for index, ri_id in enumerate(ordered_ids):
            ri = self.session.get(RecipeIngredient, ri_id)
            if ri and ri.recipe_id == recipe_id:
                ri.sort_order = index
                self.session.add(ri)

        self.session.commit()
        return self.get_recipe_ingredients(recipe_id)

    # --- Versioning Operations ---

    def get_version_tree(self, recipe_id: int) -> list[Recipe]:
        """
        Get all recipes in the version tree for a given recipe.

        This traverses both up (to find ancestors) and down (to find descendants)
        to return the complete version tree.

        Returns a list of recipes ordered by version number (ascending).
        """
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return []

        # Collect all recipe IDs in the version tree
        tree_ids: set[int] = {recipe_id}

        # Traverse up to find all ancestors and collect their IDs
        current = recipe
        while current.root_id is not None:
            tree_ids.add(current.root_id)
            parent = self.get_recipe(current.root_id)
            if parent is None:
                break
            current = parent

        # Find the root (oldest ancestor) - this is now 'current'
        root_id = current.id

        # Traverse down from root to find all descendants using BFS
        def collect_all_descendants(start_id: int) -> None:
            """Collect all descendants using BFS to handle branching."""
            queue = [start_id]
            visited = {start_id}

            while queue:
                current_id = queue.pop(0)
                # Find all recipes that have this recipe as their root_id
                statement = select(Recipe).where(Recipe.root_id == current_id)
                children = list(self.session.exec(statement).all())
                for child in children:
                    if child.id not in visited:
                        visited.add(child.id)
                        tree_ids.add(child.id)
                        queue.append(child.id)

        # Start collecting from root
        collect_all_descendants(root_id)

        # Fetch all recipes in the tree and sort by version
        statement = (
            select(Recipe)
            .where(Recipe.id.in_(tree_ids))
            .order_by(Recipe.version, Recipe.created_at)
        )
        return list(self.session.exec(statement).all())
