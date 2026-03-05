"""Recipe lifecycle and ingredient management operations."""

from datetime import datetime

from sqlalchemy.orm import selectinload, joinedload
from sqlmodel import Session, select

from app.models import (
    Recipe,
    RecipeCreate,
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientUpdate,
    RecipeOutlet,
    RecipeRecipe,
    RecipeStatus,
    RecipeUpdate,
    User,
    UserType,
    Ingredient,
    IngredientAllergen,
    Allergen,
    RecipeIngredientRead,
    IngredientNested,
    AllergenInfo,
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

    def list_recipes(
        self, status: RecipeStatus | None = None, current_user: User | None = None
    ) -> list[Recipe]:
        """List all recipes, optionally filtering by status and user permissions.

        Access control for non-admin users:
        - Can see recipes they created (owner_id)
        - Can see public recipes (is_public)
        - Can see recipes assigned to their outlet:
          - If user is in parent outlet (brand): only their outlet's recipes
          - If user is in child outlet (location): their outlet + parent outlet's recipes

        Admin users see all recipes.
        """
        from sqlalchemy import or_

        statement = select(Recipe)
        if status:
            statement = statement.where(Recipe.status == status)

        # Admin users see all recipes
        if current_user and current_user.user_type == UserType.ADMIN:
            return list(self.session.exec(statement).all())

        # No user = no access
        if not current_user:
            return []

        # Build SQL-level access control filters
        conditions = [
            Recipe.owner_id == current_user.id,
            Recipe.is_public == True,
        ]

        # Add outlet-based access
        if current_user.outlet_id:
            from app.domain.outlet_service import OutletService

            outlet_service = OutletService(self.session)
            user_outlet = outlet_service.get_outlet(current_user.outlet_id)
            if user_outlet:
                accessible_outlet_ids = {current_user.outlet_id}
                if user_outlet.outlet_type.value != "brand" and user_outlet.parent_outlet_id:
                    accessible_outlet_ids.add(user_outlet.parent_outlet_id)

                # Subquery: recipe IDs accessible via outlets
                outlet_recipe_ids = (
                    select(RecipeOutlet.recipe_id)
                    .where(
                        RecipeOutlet.outlet_id.in_(accessible_outlet_ids),
                        RecipeOutlet.is_active,
                    )
                )
                conditions.append(Recipe.id.in_(outlet_recipe_ids))

        statement = statement.where(or_(*conditions))
        return list(self.session.exec(statement).all())

    def _build_list_query(self, status=None, current_user=None, search=None, category_ids=None):
        """Build base query for recipe listing with filters."""
        from sqlalchemy import or_
        statement = select(Recipe)
        if status:
            statement = statement.where(Recipe.status == status)
        if search:
            statement = statement.where(Recipe.name.ilike(f"%{search}%"))
        if category_ids:
            from app.models.recipe_recipe_category import RecipeRecipeCategory
            category_subquery = select(RecipeRecipeCategory.recipe_id).where(
                RecipeRecipeCategory.category_id.in_(category_ids),
                RecipeRecipeCategory.is_active == True,
            ).distinct()
            statement = statement.where(Recipe.id.in_(category_subquery))
        # Access control
        if current_user and current_user.user_type == UserType.ADMIN:
            return statement
        if not current_user:
            return statement.where(Recipe.id == None)  # return nothing
        conditions = [Recipe.owner_id == current_user.id, Recipe.is_public == True]
        if current_user.outlet_id:
            from app.domain.outlet_service import OutletService
            outlet_service = OutletService(self.session)
            user_outlet = outlet_service.get_outlet(current_user.outlet_id)
            if user_outlet:
                accessible_outlet_ids = {current_user.outlet_id}
                if user_outlet.outlet_type.value != "brand" and user_outlet.parent_outlet_id:
                    accessible_outlet_ids.add(user_outlet.parent_outlet_id)
                outlet_recipe_ids = select(RecipeOutlet.recipe_id).where(
                    RecipeOutlet.outlet_id.in_(accessible_outlet_ids), RecipeOutlet.is_active)
                conditions.append(Recipe.id.in_(outlet_recipe_ids))
        statement = statement.where(or_(*conditions))
        return statement

    def list_paginated(self, offset: int, limit: int, status=None, current_user=None, search: str | None = None, category_ids=None) -> list[Recipe]:
        statement = self._build_list_query(status=status, current_user=current_user, search=search, category_ids=category_ids)
        statement = statement.order_by(Recipe.id.desc()).offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def count(self, status=None, current_user=None, search: str | None = None, category_ids=None) -> int:
        from sqlalchemy import func
        statement = self._build_list_query(status=status, current_user=current_user, search=search, category_ids=category_ids)
        count_stmt = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_stmt).one()

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
                unit_price=ri.unit_price,
                base_unit=ri.base_unit,
                supplier_id=ri.supplier_id,
                wastage_percentage=ri.wastage_percentage,
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

    def _build_recipe_ingredient_read(self, ri: RecipeIngredient) -> RecipeIngredientRead:
        """Build a RecipeIngredientRead from RecipeIngredient with allergen data."""
        ingredient_nested = None
        if ri.ingredient:
            # Build allergen list from ingredient_allergens
            allergens = []
            if ri.ingredient.ingredient_allergens:
                allergens = [
                    AllergenInfo(id=ia.allergen.id, name=ia.allergen.name)
                    for ia in ri.ingredient.ingredient_allergens
                    if ia.allergen
                ]

            ingredient_nested = IngredientNested(
                id=ri.ingredient.id,
                name=ri.ingredient.name,
                base_unit=ri.ingredient.base_unit,
                cost_per_base_unit=ri.ingredient.cost_per_base_unit,
                is_active=ri.ingredient.is_active,
                allergens=allergens or None,
            )

        return RecipeIngredientRead(
            id=ri.id,
            recipe_id=ri.recipe_id,
            ingredient_id=ri.ingredient_id,
            quantity=ri.quantity,
            unit=ri.unit,
            created_at=ri.created_at,
            base_unit=ri.base_unit,
            unit_price=ri.unit_price,
            supplier_id=ri.supplier_id,
            wastage_percentage=ri.wastage_percentage,
            ingredient=ingredient_nested,
        )

    def get_recipe_ingredients(self, recipe_id: int) -> list[RecipeIngredientRead]:
        """Get all ingredients for a recipe, ordered by id (insertion order)."""
        statement = (
            select(RecipeIngredient)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.id)
            .options(
                selectinload(RecipeIngredient.ingredient).options(
                    selectinload(Ingredient.ingredient_allergens).options(
                        selectinload(IngredientAllergen.allergen)
                    )
                )
            )
        )
        recipe_ingredients = self.session.exec(statement).all()
        return [self._build_recipe_ingredient_read(ri) for ri in recipe_ingredients]

    def add_ingredient_to_recipe(
        self, recipe_id: int, data: RecipeIngredientCreate
    ) -> RecipeIngredientRead | None:
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

        recipe_ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            ingredient_id=data.ingredient_id,
            quantity=data.quantity,
            unit=data.unit,
            base_unit=data.base_unit,
            unit_price=data.unit_price,
            supplier_id=data.supplier_id,
            wastage_percentage=data.wastage_percentage,
        )
        self.session.add(recipe_ingredient)
        self.session.commit()
        self.session.refresh(recipe_ingredient)

        # Reload with allergen data
        statement = select(RecipeIngredient).where(
            RecipeIngredient.id == recipe_ingredient.id
        ).options(
            selectinload(RecipeIngredient.ingredient).options(
                selectinload(Ingredient.ingredient_allergens).options(
                    selectinload(IngredientAllergen.allergen)
                )
            )
        )
        refreshed = self.session.exec(statement).first()
        if refreshed:
            return self._build_recipe_ingredient_read(refreshed)
        return None

    def update_recipe_ingredient(
        self, recipe_ingredient_id: int, data: RecipeIngredientUpdate
    ) -> RecipeIngredientRead | None:
        """Update a recipe ingredient's quantity or unit."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ri, key, value)

        self.session.add(ri)
        self.session.commit()

        # Reload with allergen data
        statement = select(RecipeIngredient).where(
            RecipeIngredient.id == recipe_ingredient_id
        ).options(
            selectinload(RecipeIngredient.ingredient).options(
                selectinload(Ingredient.ingredient_allergens).options(
                    selectinload(IngredientAllergen.allergen)
                )
            )
        )
        refreshed = self.session.exec(statement).first()
        if refreshed:
            return self._build_recipe_ingredient_read(refreshed)
        return None

    def remove_ingredient_from_recipe(self, recipe_ingredient_id: int) -> bool:
        """Remove an ingredient from a recipe."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return False

        self.session.delete(ri)
        self.session.commit()
        return True

    # --- Versioning Operations ---

    def _get_outlet_accessible_recipe_ids(
        self, user_id: str, tree_ids: set[int]
    ) -> set[int]:
        """
        Get recipe IDs from the tree that are accessible to the user via outlet hierarchy.

        Steps:
        1. Look up the user by user_id to get their outlet_id
        2. If user has outlet_id, query their outlet to determine type (brand/location)
        3. Build accessible_outlet_ids:
           - Always include user's own outlet
           - If outlet is "location" and has parent_outlet_id, also include parent
           - If outlet is "brand", only include own outlet (no children)
        4. Batch-query RecipeOutlet for recipes in tree_ids assigned to accessible_outlet_ids
        5. Return set of accessible recipe IDs

        Args:
            user_id: The user ID to check
            tree_ids: The set of recipe IDs in the version tree

        Returns:
            Set of recipe IDs that are accessible via outlet
        """
        from app.domain.outlet_service import OutletService
        from app.domain.user_service import UserService

        # Look up user to get outlet assignment
        user_service = UserService(self.session)
        user = user_service.get_user(user_id)

        # If user not found or has no outlet, return empty set
        if not user or not user.outlet_id:
            return set()

        # Get user's outlet to determine type
        outlet_service = OutletService(self.session)
        user_outlet = outlet_service.get_outlet(user.outlet_id)

        if not user_outlet:
            return set()

        # Build accessible outlet IDs based on hierarchy
        accessible_outlet_ids = {user.outlet_id}

        # Location users can also see recipes from their parent brand
        if user_outlet.outlet_type.value == "location" and user_outlet.parent_outlet_id:
            accessible_outlet_ids.add(user_outlet.parent_outlet_id)
        # Brand users can only see their own outlet (not children)

        # Query RecipeOutlet for recipes in tree assigned to accessible outlets
        statement = select(RecipeOutlet).where(
            RecipeOutlet.recipe_id.in_(tree_ids),
            RecipeOutlet.outlet_id.in_(accessible_outlet_ids),
            RecipeOutlet.is_active,
        )
        recipe_outlets = self.session.exec(statement).all()

        return {ro.recipe_id for ro in recipe_outlets if ro.recipe_id is not None}

    def _is_recipe_authorized(
        self,
        recipe: Recipe,
        user_id: str | None,
        outlet_accessible_ids: set[int] | None = None,
    ) -> bool:
        """
        Check if a recipe is authorized for the given user.

        Authorization is granted if:
        - Recipe is public, OR
        - User owns the recipe, OR
        - Recipe is accessible via user's outlet hierarchy

        Args:
            recipe: The recipe to check
            user_id: The user ID (used for ownership check)
            outlet_accessible_ids: Optional set of recipe IDs accessible via outlet

        Returns:
            True if user is authorized, False otherwise
        """
        if recipe.is_public:
            return True
        if user_id is not None and recipe.owner_id == user_id:
            return True
        if outlet_accessible_ids and recipe.id in outlet_accessible_ids:
            return True
        return False

    def _create_masked_recipe(self, recipe: Recipe, new_root_id: int | None) -> Recipe:
        """Create a masked version of a recipe with minimal info."""
        return Recipe(
            id=recipe.id,
            name="",  # Empty name for unauthorized recipes
            yield_quantity=0,
            yield_unit="",
            is_prep_recipe=False,
            instructions_raw=None,
            instructions_structured=None,
            cost_price=None,
            selling_price_est=None,
            status=recipe.status,
            is_public=False,
            owner_id=None,
            version=recipe.version,
            root_id=new_root_id,  # Link to last authorized ancestor
            created_by=None,
            updated_by=None,
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )

    def get_version_tree(self, recipe_id: int, user_id: str | None = None) -> list[Recipe]:
        """
        Get all recipes in the version tree for a given recipe.

        This traverses both up (to find ancestors) and down (to find descendants)
        to return the complete version tree.

        If user_id is provided, recipes are filtered based on:
        - Recipe ownership (owner_id matches user_id)
        - Recipe is public (is_public == True)
        - Recipe is accessible via user's outlet hierarchy (user's outlet or parent outlet if location)

        Full recipe data is returned for authorized recipes. Unauthorized recipes are returned
        as masked recipes with only id, root_id, version, and status. If a recipe's parent is
        unauthorized, the masked recipe links to the last authorized ancestor in the tree.

        Returns a list of recipes ordered by version number (ascending).
        """
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return []

        # Find root by traversing up - only fetch id and root_id for efficiency
        root_id = recipe_id
        current_root_id = recipe.root_id
        while current_root_id is not None:
            root_id = current_root_id
            stmt = select(Recipe.root_id).where(Recipe.id == current_root_id)
            result = self.session.exec(stmt).first()
            if result is None:
                break
            current_root_id = result

        # Single recursive CTE query to get all descendants from root
        # For databases that support it, this is much more efficient
        # Fallback: batch query all recipes with root_id in tree
        tree_ids: set[int] = {root_id}
        frontier = {root_id}

        while frontier:
            # Batch query: find all children of current frontier
            statement = select(Recipe.id, Recipe.root_id).where(
                Recipe.root_id.in_(frontier)
            )
            children = list(self.session.exec(statement).all())
            frontier = set()
            for child_id, _ in children:
                if child_id not in tree_ids:
                    tree_ids.add(child_id)
                    frontier.add(child_id)

        # Fetch all recipes in a single query, sorted
        statement = (
            select(Recipe)
            .where(Recipe.id.in_(tree_ids))
            .order_by(Recipe.version, Recipe.created_at)
        )
        all_recipes = list(self.session.exec(statement).all())

        # If no user_id provided, return all recipes unfiltered
        if user_id is None:
            return all_recipes

        # Get recipes accessible via user's outlet hierarchy
        outlet_accessible_ids = self._get_outlet_accessible_recipe_ids(user_id, tree_ids)

        # Build lookup structures in a single pass
        recipe_map: dict[int, Recipe] = {}
        authorized_ids: set[int] = set()
        for r in all_recipes:
            recipe_map[r.id] = r
            if self._is_recipe_authorized(r, user_id, outlet_accessible_ids):
                authorized_ids.add(r.id)

        # Memoized ancestor lookup to avoid redundant traversals
        ancestor_cache: dict[int, int | None] = {}

        def find_last_authorized_ancestor(r: Recipe) -> int | None:
            """Find the nearest authorized ancestor, with memoization."""
            if r.id in ancestor_cache:
                return ancestor_cache[r.id]

            path: list[int] = []
            current = r
            result: int | None = None

            while current.root_id is not None:
                parent = recipe_map.get(current.root_id)
                if parent is None:
                    break
                if parent.id in authorized_ids:
                    result = parent.id
                    break
                # Check if parent's result is already cached
                if parent.id in ancestor_cache:
                    result = ancestor_cache[parent.id]
                    break
                path.append(current.id)
                current = parent

            # Cache results for all recipes in the path
            for rid in path:
                ancestor_cache[rid] = result
            ancestor_cache[r.id] = result

            return result

        # Build result list
        result: list[Recipe] = []
        for r in all_recipes:
            if r.id in authorized_ids:
                # Authorized: return full recipe, adjust root_id if parent unauthorized
                if r.root_id is not None and r.root_id not in authorized_ids:
                    new_root_id = find_last_authorized_ancestor(r)
                    adjusted_recipe = r.model_copy(update={"root_id": new_root_id})
                    result.append(adjusted_recipe)
                else:
                    result.append(r)
            else:
                # Unauthorized: return masked recipe
                new_root_id = find_last_authorized_ancestor(r)
                result.append(self._create_masked_recipe(r, new_root_id))

        return result
