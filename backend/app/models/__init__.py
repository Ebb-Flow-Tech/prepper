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
    RecipeIngredientRead,
    IngredientNested,
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
from app.models.tasting import (
    TastingSession,
    TastingSessionCreate,
    TastingSessionUpdate,
    TastingNote,
    TastingNoteCreate,
    TastingNoteUpdate,
    TastingNoteRead,
    TastingNoteWithRecipe,
    TastingDecision,
    RecipeTastingSummary,
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
    "RecipeIngredientRead",
    "IngredientNested",
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
    # Tasting
    "TastingSession",
    "TastingSessionCreate",
    "TastingSessionUpdate",
    "TastingNote",
    "TastingNoteCreate",
    "TastingNoteUpdate",
    "TastingNoteRead",
    "TastingNoteWithRecipe",
    "TastingDecision",
    "RecipeTastingSummary",
]
