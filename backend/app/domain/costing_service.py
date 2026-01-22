"""Costing engine - calculates recipe costs with sub-recipe support."""

from datetime import datetime

from sqlmodel import Session, select

from app.models import (
    Recipe,
    Ingredient,
    RecipeRecipe,
    CostBreakdownItem,
    SubRecipeCostItem,
    CostingResult,
)
from app.domain.recipe_service import RecipeService
from app.utils.unit_conversion import convert_to_base_unit


class CostingService:
    """Service for recipe cost calculations with recursive sub-recipe support."""

    def __init__(self, session: Session):
        self.session = session
        self.recipe_service = RecipeService(session)
        self._costing_stack: set[int] = set()  # Cycle detection during costing

    def _get_sub_recipes(self, recipe_id: int) -> list[RecipeRecipe]:
        """Get all sub-recipes for a recipe."""
        statement = (
            select(RecipeRecipe)
            .where(RecipeRecipe.parent_recipe_id == recipe_id)
            .order_by(RecipeRecipe.position)
        )
        return list(self.session.exec(statement).all())

    def _calculate_sub_recipe_line_cost(
        self,
        sub_recipe: RecipeRecipe,
        child_batch_cost: float | None,
        child_portion_cost: float | None,
        child_recipe: Recipe,
    ) -> float | None:
        """
        Calculate the line cost for a sub-recipe based on quantity and unit.

        Units:
        - "portion": quantity * cost_per_portion
        - "batch": quantity * batch_cost
        - "g" or "ml": requires yield conversion (portion-based scaling)
        """
        if child_batch_cost is None or child_portion_cost is None:
            return None

        unit = sub_recipe.unit.value if hasattr(sub_recipe.unit, 'value') else sub_recipe.unit
        quantity = sub_recipe.quantity

        if unit == "portion":
            return quantity * child_portion_cost
        elif unit == "batch":
            return quantity * child_batch_cost
        elif unit in ("g", "ml"):
            # For weight/volume, we need to know what the recipe yields per portion
            # Assume yield_quantity is in the same unit family as the sub-recipe unit
            # E.g., if recipe yields 500ml and we need 50ml, that's 50/500 = 0.1 batches
            if child_recipe.yield_quantity > 0:
                # Calculate what fraction of a batch we're using
                batch_fraction = quantity / (child_recipe.yield_quantity * child_recipe.yield_quantity)
                # Simplified: assume yield_quantity represents total output
                # More accurate: yield_quantity * yield_unit should be convertible
                batch_fraction = quantity / child_recipe.yield_quantity
                return batch_fraction * child_batch_cost
            return None
        else:
            # Default to portion-based calculation
            return quantity * child_portion_cost

    def calculate_recipe_cost(
        self, recipe_id: int, _depth: int = 0, _max_depth: int = 20
    ) -> CostingResult | None:
        """
        Calculate the full cost breakdown for a recipe, including sub-recipes.

        Logic:
        1. Fetch recipe_ingredients → calculate ingredient costs
        2. Fetch sub-recipes → recursively calculate their costs
        3. Aggregate: ingredient_cost + sub_recipe_cost = total_batch_cost
        4. Calculate cost per portion

        Includes cycle detection to prevent infinite recursion.
        """
        # Depth limiting
        if _depth >= _max_depth:
            return None

        # Cycle detection
        if recipe_id in self._costing_stack:
            return None  # Already calculating this recipe (cycle)
        self._costing_stack.add(recipe_id)

        try:
            recipe = self.session.get(Recipe, recipe_id)
            if not recipe:
                return None

            recipe_ingredients = self.recipe_service.get_recipe_ingredients(recipe_id)

            # --- 1. Calculate ingredient costs ---
            breakdown: list[CostBreakdownItem] = []
            ingredient_cost = 0.0
            missing_costs: list[str] = []

            for ri in recipe_ingredients:
                ingredient = self.session.get(Ingredient, ri.ingredient_id)
                if not ingredient:
                    continue

                # Convert quantity to base unit
                # TO DO: should use the base unit for the recipe ingredient unit
                quantity_in_base = convert_to_base_unit(
                    ri.quantity, ri.unit, ri.base_unit
                )

                # Calculate line cost with wastage adjustment
                # Formula: line_cost = (unit_cost / (100 - wastage_percentage)) × quantity
                # This accounts for waste: if wastage is 10%, we need 10% more material
                line_cost = None
                adjusted_cost_per_unit = None
                wastage_percentage = ri.wastage_percentage or 0.0

                if ri.unit_price is not None and quantity_in_base is not None:
                    # Adjust unit price for wastage percentage
                    wastage_factor = 1.0 / (1.0 - wastage_percentage / 100.0) if wastage_percentage < 100 else 1.0
                    adjusted_cost_per_unit = ri.unit_price * wastage_factor
                    line_cost = quantity_in_base * adjusted_cost_per_unit
                    ingredient_cost += line_cost
                else:
                    missing_costs.append(ingredient.name)

                breakdown.append(
                    CostBreakdownItem(
                        ingredient_id=ingredient.id,
                        ingredient_name=ingredient.name,
                        quantity=ri.quantity,
                        unit=ri.unit,
                        quantity_in_base_unit=quantity_in_base or ri.quantity,
                        base_unit=ri.base_unit,
                        cost_per_base_unit=ri.unit_price,
                        wastage_percentage=wastage_percentage,
                        adjusted_cost_per_unit=adjusted_cost_per_unit,
                        line_cost=line_cost,
                    )
                )

            # --- 2. Calculate sub-recipe costs (recursive) ---
            sub_recipe_breakdown: list[SubRecipeCostItem] = []
            sub_recipe_cost = 0.0

            sub_recipes = self._get_sub_recipes(recipe_id)
            for rr in sub_recipes:
                child_recipe = self.session.get(Recipe, rr.child_recipe_id)
                if not child_recipe:
                    missing_costs.append(f"[Sub-recipe {rr.child_recipe_id}]")
                    continue

                # Recursively calculate child recipe cost
                child_costing = self.calculate_recipe_cost(
                    rr.child_recipe_id, _depth + 1, _max_depth
                )

                child_batch_cost = child_costing.total_batch_cost if child_costing else None
                child_portion_cost = child_costing.cost_per_portion if child_costing else None

                # Calculate line cost based on unit
                line_cost = self._calculate_sub_recipe_line_cost(
                    rr, child_batch_cost, child_portion_cost, child_recipe
                )

                if line_cost is not None:
                    sub_recipe_cost += line_cost
                else:
                    missing_costs.append(f"[Sub-recipe: {child_recipe.name}]")

                sub_recipe_breakdown.append(
                    SubRecipeCostItem(
                        link_id=rr.id,
                        recipe_id=child_recipe.id,
                        recipe_name=child_recipe.name,
                        quantity=rr.quantity,
                        unit=rr.unit.value if hasattr(rr.unit, 'value') else rr.unit,
                        sub_recipe_batch_cost=child_batch_cost,
                        sub_recipe_portion_cost=child_portion_cost,
                        line_cost=line_cost,
                    )
                )

            # --- 3. Aggregate costs ---
            total_cost = ingredient_cost + sub_recipe_cost

            # Calculate cost per portion
            cost_per_portion = None
            if total_cost > 0 and recipe.yield_quantity > 0:
                cost_per_portion = total_cost / recipe.yield_quantity

            return CostingResult(
                recipe_id=recipe.id,
                recipe_name=recipe.name,
                yield_quantity=recipe.yield_quantity,
                yield_unit=recipe.yield_unit,
                breakdown=breakdown,
                sub_recipe_breakdown=sub_recipe_breakdown,
                ingredient_cost=ingredient_cost if ingredient_cost > 0 else None,
                sub_recipe_cost=sub_recipe_cost if sub_recipe_cost > 0 else None,
                total_batch_cost=total_cost if not missing_costs else None,
                cost_per_portion=cost_per_portion,
                missing_costs=missing_costs,
            )
        finally:
            # Remove from stack when done
            self._costing_stack.discard(recipe_id)

    def persist_cost_snapshot(self, recipe_id: int) -> Recipe | None:
        """
        Calculate and persist the cost to the recipe's cost_price field.

        This caches the calculated cost for quick access.
        """
        costing = self.calculate_recipe_cost(recipe_id)
        if not costing:
            return None

        recipe = self.session.get(Recipe, recipe_id)
        if not recipe:
            return None

        recipe.cost_price = costing.cost_per_portion
        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe
