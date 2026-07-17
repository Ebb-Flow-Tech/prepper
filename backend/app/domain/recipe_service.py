"""Recipe lifecycle and ingredient management operations.

Visibility is derived from the Passport projection (``app.passport.access``), never from a
column on the ``users`` row. Prepper no longer owns an ``outlets`` table, so the old
"load the user's outlet, add its parent, filter on those two ids" walk is gone: the brands a
user holds a role at — and the outlets under them — are computed once by
``access.accessible_unit_ids`` and matched against ``recipe_outlets.unit_id``.
"""

from datetime import datetime

from sqlalchemy import false, func, or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.domain.org_scope import org_scope
from app.models import (
    AllergenInfo,
    Ingredient,
    IngredientAllergen,
    IngredientNested,
    Recipe,
    RecipeCreate,
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientRead,
    RecipeIngredientUpdate,
    RecipeOutlet,
    RecipeRecipe,
    RecipeStatus,
    RecipeUpdate,
    User,
)
from app.models.recipe_category import RecipeCategory
from app.models.recipe_recipe_category import RecipeRecipeCategory
from app.passport import access

_FORK_NAME_SUFFIX = "(Fork)"


class RecipeService:
    """Service for recipe lifecycle and ingredient management."""

    def __init__(self, session: Session):
        self.session = session

    # --- Recipe Lifecycle Operations ---

    def create_recipe(self, data: RecipeCreate, organization_id: str) -> Recipe:
        """Create a new recipe, stamped with the acting org.

        ``organization_id`` comes from the acting org context, never from the request body — the
        Create schemas deliberately have no such field. A tenant id a client can assert is not a
        tenant id, for the same reason `owner_id` and `users.email` are not.
        """
        recipe = Recipe.model_validate(data)
        recipe.organization_id = organization_id
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def _visible_recipe_conditions(self, current_user: User) -> list:  # type: ignore[type-arg]
        """The OR-conditions that make a recipe visible to ``current_user``.

        A recipe is visible when the user owns it, when it is public, or when it is assigned
        to a unit the user may see. The unit set comes from Passport: the brands the user
        holds a role at, plus the outlets under those brands.

        **Fail closed.** An empty unit set means the user holds no role at any brand, so the
        unit condition is simply omitted — they fall back to their own and public recipes.
        The old model's `outlet_id IS NULL` = "see everything" is deliberately NOT preserved;
        it was an artefact of the local outlets table. An org Owner/Admin needs no special
        case here — Passport's ladder gives them Manager at every brand, so their unit set is
        populated automatically.
        """
        conditions = [
            Recipe.owner_id == current_user.id,
            col(Recipe.is_public).is_(True),
        ]

        unit_ids = access.accessible_unit_ids(self.session, current_user.id)
        if not unit_ids:
            return conditions

        unit_recipe_ids = select(RecipeOutlet.recipe_id).where(
            col(RecipeOutlet.unit_id).in_(unit_ids),
            col(RecipeOutlet.is_active).is_(True),
        )
        conditions.append(col(Recipe.id).in_(unit_recipe_ids))
        return conditions

    def _build_list_query(
        self,
        organization_id: str,
        status: RecipeStatus | None = None,
        current_user: User | None = None,
        search: str | None = None,
        category_ids: list[int] | None = None,
    ):  # type: ignore[no-untyped-def]
        """Build the base recipe-listing query with search, category and access filters.

        ``organization_id`` is first and required: every branch below has to sit underneath it, and
        a defaulted org would mean forgetting it returns other tenants' recipes rather than an
        error.
        """
        statement = select(Recipe).where(org_scope(Recipe, organization_id))
        if status:
            statement = statement.where(Recipe.status == status)

        if search:
            category_match = (
                select(RecipeRecipeCategory.recipe_id)
                .join(
                    RecipeCategory,
                    col(RecipeRecipeCategory.category_id) == RecipeCategory.id,
                )
                .where(
                    col(RecipeCategory.name).ilike(f"%{search}%"),
                    col(RecipeRecipeCategory.is_active).is_(True),
                )
                .distinct()
            )
            sub_recipe_match = (
                select(RecipeRecipe.parent_recipe_id)
                .where(
                    col(RecipeRecipe.child_recipe_id).in_(
                        select(Recipe.id).where(col(Recipe.name).ilike(f"%{search}%"))
                    )
                )
                .distinct()
            )
            statement = statement.where(
                or_(
                    col(Recipe.name).ilike(f"%{search}%"),
                    col(Recipe.id).in_(category_match),
                    col(Recipe.id).in_(sub_recipe_match),
                )
            )

        if category_ids:
            category_subquery = (
                select(RecipeRecipeCategory.recipe_id)
                .where(
                    col(RecipeRecipeCategory.category_id).in_(category_ids),
                    col(RecipeRecipeCategory.is_active).is_(True),
                )
                .distinct()
            )
            statement = statement.where(col(Recipe.id).in_(category_subquery))

        # Anonymous callers see nothing — there is no unauthenticated recipe catalogue.
        if not current_user:
            return statement.where(false())

        # Explicit admin bypass: an org Owner/Admin administers the ORGANISATION and is expected to
        # see every recipe in it, including drafts owned by other people that are not yet assigned
        # to any unit. The ladder cannot supply that — `accessible_unit_ids` only reaches recipes
        # LINKED to a unit — so the bypass is real and stays.
        #
        # The statement is already narrowed to `organization_id` by `org_scope` above, so "admin of
        # the org being acted in" is the whole test, and the bypass is simply the absence of a
        # further filter. This used to OR in `Recipe.organization_id.in_(admin_orgs)` — the union of
        # every org the caller administers — which was correct only because nothing else scoped the
        # query. Under `org_scope` that union could only ever widen past the active org, so it goes.
        if organization_id in access.admin_org_ids(self.session, current_user.id):
            return statement

        return statement.where(or_(*self._visible_recipe_conditions(current_user)))

    def list_recipes(
        self,
        organization_id: str,
        status: RecipeStatus | None = None,
        current_user: User | None = None,
    ) -> list[Recipe]:
        """List recipes visible to the user in this org, optionally filtered by status."""
        statement = self._build_list_query(
            organization_id, status=status, current_user=current_user
        )
        return list(self.session.exec(statement).all())

    def list_paginated(
        self,
        organization_id: str,
        offset: int,
        limit: int,
        status: RecipeStatus | None = None,
        current_user: User | None = None,
        search: str | None = None,
        category_ids: list[int] | None = None,
    ) -> list[Recipe]:
        """Return one page of visible recipes, newest first."""
        statement = self._build_list_query(
            organization_id,
            status=status,
            current_user=current_user,
            search=search,
            category_ids=category_ids,
        )
        statement = statement.order_by(col(Recipe.id).desc()).offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def count(
        self,
        organization_id: str,
        status: RecipeStatus | None = None,
        current_user: User | None = None,
        search: str | None = None,
        category_ids: list[int] | None = None,
    ) -> int:
        """Count the recipes visible to the user under the same filters as the listing."""
        statement = self._build_list_query(
            organization_id,
            status=status,
            current_user=current_user,
            search=search,
            category_ids=category_ids,
        )
        count_statement = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_statement).one()

    def list_paginated_with_count(
        self,
        organization_id: str,
        offset: int,
        limit: int,
        status: RecipeStatus | None = None,
        current_user: User | None = None,
        search: str | None = None,
        category_ids: list[int] | None = None,
    ) -> tuple[list[Recipe], int]:
        """Return paginated items and total count, reusing the same base filter."""
        base = self._build_list_query(
            organization_id,
            status=status,
            current_user=current_user,
            search=search,
            category_ids=category_ids,
        )
        total = self.session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(
            self.session.exec(
                base.order_by(col(Recipe.id).desc()).offset(offset).limit(limit)
            ).all()
        )
        return items, total

    def get_recipe(self, recipe_id: int) -> Recipe | None:
        """Get a recipe by ID."""
        return self.session.get(Recipe, recipe_id)

    def update_recipe_metadata(self, recipe_id: int, data: RecipeUpdate) -> Recipe | None:
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

    def set_recipe_status(self, recipe_id: int, status: RecipeStatus) -> Recipe | None:
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

        Unit assignments are NOT copied: a fork starts unassigned and is placed on units
        explicitly, so a draft never leaks onto a live site by inheritance.
        """
        original = self.get_recipe(recipe_id)
        if not original:
            return None

        forked = Recipe(
            name=f"{original.name} {_FORK_NAME_SUFFIX}",
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
            version=original.version + 1,
            root_id=original.id,
            # The fork inherits the original's org. Without this it landed NULL — an orphan its own
            # creator could not see once reads filtered on the org, and one that `org_scope`'s
            # transitional NULL arm showed to EVERY org in the meantime. The same defect existed in
            # `fork_sketch` and `fork_menu`; all three were found by `q3orgnn3t4u` making the
            # column NOT NULL, not by any test.
            organization_id=original.organization_id,
        )
        self.session.add(forked)
        self.session.commit()
        self.session.refresh(forked)

        for ri in self.get_recipe_ingredients(recipe_id):
            self.session.add(
                RecipeIngredient(
                    recipe_id=forked.id,
                    ingredient_id=ri.ingredient_id,
                    quantity=ri.quantity,
                    unit=ri.unit,
                    unit_price=ri.unit_price,
                    base_unit=ri.base_unit,
                    supplier_id=ri.supplier_id,
                    wastage_percentage=ri.wastage_percentage,
                )
            )

        for rr in self._get_sub_recipes(recipe_id):
            self.session.add(
                RecipeRecipe(
                    parent_recipe_id=forked.id,
                    child_recipe_id=rr.child_recipe_id,
                    quantity=rr.quantity,
                    unit=rr.unit,
                    position=rr.position,
                )
            )

        self.session.commit()
        self.session.refresh(forked)
        return forked

    def _get_sub_recipes(self, recipe_id: int) -> list[RecipeRecipe]:
        """Get all sub-recipes for a parent recipe, ordered by position."""
        statement = (
            select(RecipeRecipe)
            .where(RecipeRecipe.parent_recipe_id == recipe_id)
            .order_by(col(RecipeRecipe.position))
        )
        return list(self.session.exec(statement).all())

    # --- Recipe Ingredient Management ---

    def _build_recipe_ingredient_read(self, ri: RecipeIngredient) -> RecipeIngredientRead:
        """Build a RecipeIngredientRead from RecipeIngredient with allergen data."""
        ingredient_nested = None
        if ri.ingredient:
            allergens: list[AllergenInfo] = []
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

    def _ingredient_with_allergens(self, recipe_ingredient_id: int) -> RecipeIngredient | None:
        """Reload a recipe ingredient with its ingredient + allergens eagerly loaded."""
        statement = (
            select(RecipeIngredient)
            .where(RecipeIngredient.id == recipe_ingredient_id)
            .options(
                selectinload(RecipeIngredient.ingredient).options(
                    selectinload(Ingredient.ingredient_allergens).options(
                        selectinload(IngredientAllergen.allergen)
                    )
                )
            )
        )
        return self.session.exec(statement).first()

    def get_recipe_ingredients(self, recipe_id: int) -> list[RecipeIngredientRead]:
        """Get all ingredients for a recipe, ordered by id (insertion order)."""
        statement = (
            select(RecipeIngredient)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(col(RecipeIngredient.id))
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

        refreshed = self._ingredient_with_allergens(recipe_ingredient.id)
        if not refreshed:
            return None
        return self._build_recipe_ingredient_read(refreshed)

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

        refreshed = self._ingredient_with_allergens(recipe_ingredient_id)
        if not refreshed:
            return None
        return self._build_recipe_ingredient_read(refreshed)

    def remove_ingredient_from_recipe(self, recipe_ingredient_id: int) -> bool:
        """Remove an ingredient from a recipe."""
        ri = self.session.get(RecipeIngredient, recipe_ingredient_id)
        if not ri:
            return False

        self.session.delete(ri)
        self.session.commit()
        return True

    # --- Versioning Operations ---

    def _unit_accessible_recipe_ids(self, subject: str, tree_ids: set[int]) -> set[int]:
        """Recipe IDs within ``tree_ids`` that ``subject`` can reach through a Passport unit.

        The old hierarchy walk (read `users.outlet_id`, load the outlet, add its parent brand)
        is gone with the local outlets table. `access.accessible_unit_ids` answers the same
        question from the projection — the brands the user holds a role at, plus the outlets
        under them — in one place, so the rule cannot drift between call sites.

        An empty unit set means no role at any brand: fail closed, nothing is reachable by unit.
        """
        unit_ids = access.accessible_unit_ids(self.session, subject)
        if not unit_ids:
            return set()

        statement = select(RecipeOutlet.recipe_id).where(
            col(RecipeOutlet.recipe_id).in_(tree_ids),
            col(RecipeOutlet.unit_id).in_(unit_ids),
            col(RecipeOutlet.is_active).is_(True),
        )
        return {rid for rid in self.session.exec(statement).all() if rid is not None}

    def _is_recipe_authorized(
        self,
        recipe: Recipe,
        user_id: str | None,
        unit_accessible_ids: set[int] | None = None,
    ) -> bool:
        """
        Check if a recipe is authorized for the given user.

        Authorization is granted if:
        - Recipe is public, OR
        - User owns the recipe, OR
        - Recipe is assigned to a unit the user may see
        """
        if recipe.is_public:
            return True
        if user_id is not None and recipe.owner_id == user_id:
            return True
        if unit_accessible_ids and recipe.id in unit_accessible_ids:
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
        - Recipe is assigned to a Passport unit the user may see

        Full recipe data is returned for authorized recipes. Unauthorized recipes are returned
        as masked recipes with only id, root_id, version, and status. If a recipe's parent is
        unauthorized, the masked recipe links to the last authorized ancestor in the tree.

        Returns a list of recipes ordered by version number (ascending).
        """
        recipe = self.get_recipe(recipe_id)
        if not recipe:
            return []

        # Find root by traversing up - only fetch root_id for efficiency
        root_id = recipe_id
        current_root_id = recipe.root_id
        while current_root_id is not None:
            root_id = current_root_id
            stmt = select(Recipe.root_id).where(Recipe.id == current_root_id)
            result = self.session.exec(stmt).first()
            if result is None:
                break
            current_root_id = result

        # Batch-walk down from the root, one query per level
        tree_ids: set[int] = {root_id}
        frontier = {root_id}
        while frontier:
            statement = select(Recipe.id, Recipe.root_id).where(
                col(Recipe.root_id).in_(frontier)
            )
            children = list(self.session.exec(statement).all())
            frontier = set()
            for child_id, _ in children:
                if child_id not in tree_ids:
                    tree_ids.add(child_id)
                    frontier.add(child_id)

        statement = (
            select(Recipe)
            .where(col(Recipe.id).in_(tree_ids))
            .order_by(col(Recipe.version), col(Recipe.created_at))
        )
        all_recipes = list(self.session.exec(statement).all())

        if user_id is None:
            return all_recipes

        unit_accessible_ids = self._unit_accessible_recipe_ids(user_id, tree_ids)

        recipe_map: dict[int, Recipe] = {}
        authorized_ids: set[int] = set()
        for r in all_recipes:
            recipe_map[r.id] = r
            if self._is_recipe_authorized(r, user_id, unit_accessible_ids):
                authorized_ids.add(r.id)

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
                if parent.id in ancestor_cache:
                    result = ancestor_cache[parent.id]
                    break
                path.append(current.id)
                current = parent

            for rid in path:
                ancestor_cache[rid] = result
            ancestor_cache[r.id] = result

            return result

        result: list[Recipe] = []
        for r in all_recipes:
            if r.id not in authorized_ids:
                result.append(
                    self._create_masked_recipe(r, find_last_authorized_ancestor(r))
                )
                continue

            # Authorized, but its parent may not be — re-point it at the nearest visible one
            if r.root_id is not None and r.root_id not in authorized_ids:
                result.append(
                    r.model_copy(update={"root_id": find_last_authorized_ancestor(r)})
                )
                continue

            result.append(r)

        return result
