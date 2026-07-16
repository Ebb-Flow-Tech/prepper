"""FastAPI routers - thin HTTP layer that delegates to domain operations."""

from app.api import (
    costing,
    ingredients,
    instructions,
    recipe_ingredients,
    recipe_units,
    recipes,
    sub_recipes,
    users,
)

__all__ = [
    "ingredients",
    "recipes",
    "recipe_ingredients",
    "instructions",
    "costing",
    "sub_recipes",
    "recipe_units",
    "users",
]
