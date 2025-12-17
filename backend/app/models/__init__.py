"""SQLModel database models and DTOs."""

from app.models.ingredient import (
    Ingredient,
    IngredientCreate,
    IngredientUpdate,
    FoodCategory,
    IngredientSource,
    SupplierEntry,
    SupplierEntryCreate,
    SupplierEntryUpdate,
)
from app.models.recipe import (
    Recipe,
    RecipeCreate,
    RecipeUpdate,
    RecipeStatus,
    RecipeStatusUpdate,
    InstructionsRaw,
    InstructionsStructured,
)
from app.models.recipe_ingredient import (
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientUpdate,
    RecipeIngredientReorder,
)
from app.models.recipe_recipe import (
    RecipeRecipe,
    RecipeRecipeCreate,
    RecipeRecipeUpdate,
    RecipeRecipeReorder,
    SubRecipeUnit,
)
from app.models.outlet import (
    Outlet,
    OutletCreate,
    OutletUpdate,
    OutletType,
    RecipeOutlet,
    RecipeOutletCreate,
    RecipeOutletUpdate,
)
from app.models.costing import (
    CostBreakdownItem,
    SubRecipeCostItem,
    CostingResult,
)

__all__ = [
    # Ingredient
    "Ingredient",
    "IngredientCreate",
    "IngredientUpdate",
    "FoodCategory",
    "IngredientSource",
    "SupplierEntry",
    "SupplierEntryCreate",
    "SupplierEntryUpdate",
    # Recipe
    "Recipe",
    "RecipeCreate",
    "RecipeUpdate",
    "RecipeStatus",
    "RecipeStatusUpdate",
    "InstructionsRaw",
    "InstructionsStructured",
    # RecipeIngredient
    "RecipeIngredient",
    "RecipeIngredientCreate",
    "RecipeIngredientUpdate",
    "RecipeIngredientReorder",
    # RecipeRecipe (sub-recipes)
    "RecipeRecipe",
    "RecipeRecipeCreate",
    "RecipeRecipeUpdate",
    "RecipeRecipeReorder",
    "SubRecipeUnit",
    # Outlet
    "Outlet",
    "OutletCreate",
    "OutletUpdate",
    "OutletType",
    "RecipeOutlet",
    "RecipeOutletCreate",
    "RecipeOutletUpdate",
    # Costing
    "CostBreakdownItem",
    "SubRecipeCostItem",
    "CostingResult",
]
