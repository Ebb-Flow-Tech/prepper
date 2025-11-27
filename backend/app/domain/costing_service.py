"""Costing engine - calculates recipe costs."""

from datetime import datetime

from sqlmodel import Session

from app.models import Recipe, Ingredient, CostBreakdownItem, CostingResult
from app.domain.recipe_service import RecipeService
from app.utils.unit_conversion import convert_to_base_unit


class CostingService:
    """Service for recipe cost calculations."""

    def __init__(self, session: Session):
        self.session = session
        self.recipe_service = RecipeService(session)

    def calculate_recipe_cost(self, recipe_id: int) -> CostingResult | None:
        """
        Calculate the full cost breakdown for a recipe.

        Logic:
        1. Fetch recipe_ingredients
        2. Join with ingredients
        3. Convert quantity → base_unit
        4. Multiply by cost_per_base_unit
        5. Aggregate: total batch cost + cost per portion
        """
        recipe = self.session.get(Recipe, recipe_id)
        if not recipe:
            return None

        recipe_ingredients = self.recipe_service.get_recipe_ingredients(recipe_id)

        breakdown: list[CostBreakdownItem] = []
        total_cost = 0.0
        missing_costs: list[str] = []

        for ri in recipe_ingredients:
            ingredient = self.session.get(Ingredient, ri.ingredient_id)
            if not ingredient:
                continue

            # Convert quantity to base unit
            quantity_in_base = convert_to_base_unit(
                ri.quantity, ri.unit, ingredient.base_unit
            )

            # Calculate line cost
            line_cost = None
            if ingredient.cost_per_base_unit is not None and quantity_in_base is not None:
                line_cost = quantity_in_base * ingredient.cost_per_base_unit
                total_cost += line_cost
            else:
                missing_costs.append(ingredient.name)

            breakdown.append(
                CostBreakdownItem(
                    ingredient_id=ingredient.id,
                    ingredient_name=ingredient.name,
                    quantity=ri.quantity,
                    unit=ri.unit,
                    quantity_in_base_unit=quantity_in_base or ri.quantity,
                    base_unit=ingredient.base_unit,
                    cost_per_base_unit=ingredient.cost_per_base_unit,
                    line_cost=line_cost,
                )
            )

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
            total_batch_cost=total_cost if not missing_costs else None,
            cost_per_portion=cost_per_portion,
            missing_costs=missing_costs,
        )

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
