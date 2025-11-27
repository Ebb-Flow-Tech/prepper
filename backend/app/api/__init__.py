"""FastAPI routers - thin HTTP layer that delegates to domain operations."""

from app.api import ingredients, recipes, recipe_ingredients, instructions, costing

__all__ = [
    "ingredients",
    "recipes",
    "recipe_ingredients",
    "instructions",
    "costing",
]
