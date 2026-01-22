"""Costing models for API responses."""

from sqlmodel import SQLModel


class CostBreakdownItem(SQLModel):
    """Cost breakdown for a single ingredient in a recipe."""

    ingredient_id: int
    ingredient_name: str
    quantity: float
    unit: str
    quantity_in_base_unit: float
    base_unit: str
    cost_per_base_unit: float | None
    wastage_percentage: float = 0.0
    adjusted_cost_per_unit: float | None = None  # Cost per unit after wastage adjustment
    line_cost: float | None


class SubRecipeCostItem(SQLModel):
    """Cost breakdown for a sub-recipe component."""

    link_id: int
    recipe_id: int
    recipe_name: str
    quantity: float
    unit: str  # "portion", "batch", "g", "ml"
    sub_recipe_batch_cost: float | None
    sub_recipe_portion_cost: float | None
    line_cost: float | None  # Calculated based on quantity and unit


class CostingResult(SQLModel):
    """Complete costing result for a recipe."""

    recipe_id: int
    recipe_name: str
    yield_quantity: float
    yield_unit: str
    breakdown: list[CostBreakdownItem]
    sub_recipe_breakdown: list[SubRecipeCostItem] = []
    ingredient_cost: float | None = None
    sub_recipe_cost: float | None = None
    total_batch_cost: float | None
    cost_per_portion: float | None
    missing_costs: list[str]
