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
    line_cost: float | None


class CostingResult(SQLModel):
    """Complete costing result for a recipe."""

    recipe_id: int
    recipe_name: str
    yield_quantity: float
    yield_unit: str
    breakdown: list[CostBreakdownItem]
    total_batch_cost: float | None
    cost_per_portion: float | None
    missing_costs: list[str]
