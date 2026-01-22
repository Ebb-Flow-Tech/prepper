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
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.recipe_tasting import (
    RecipeTasting,
    RecipeTastingCreate,
)
from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)
from app.models.recipe_image import (
    RecipeImage,
    RecipeImageCreate,
    RecipeImageUpdate,
    RecipeImageReorder,
)
from app.models.tasting_note_image import (
    TastingNoteImage,
    TastingNoteImageCreate,
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
    # Supplier
    "Supplier",
    "SupplierCreate",
    "SupplierUpdate",
    # RecipeTasting
    "RecipeTasting",
    "RecipeTastingCreate",
    # Category
    "Category",
    "CategoryCreate",
    "CategoryUpdate",
    # RecipeImage
    "RecipeImage",
    "RecipeImageCreate",
    "RecipeImageUpdate",
    "RecipeImageReorder",
    # TastingNoteImage
    "TastingNoteImage",
    "TastingNoteImageCreate",
]
