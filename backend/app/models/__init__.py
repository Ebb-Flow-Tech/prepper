"""SQLModel database models and DTOs."""

from app.models.ingredient import (
    Ingredient,
    IngredientCreate,
    IngredientUpdate,
    FoodCategory,
    IngredientSource,
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
    RecipeIngredientRead,
    IngredientNested,
    AllergenInfo,
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
    TastingSessionRead,
    TastingUser,
    TastingUserRead,
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
from app.models.supplier_ingredient import (
    SupplierIngredient,
    SupplierIngredientCreate,
    SupplierIngredientUpdate,
    SupplierIngredientRead,
)
from app.models.recipe_tasting import (
    RecipeTasting,
    RecipeTastingCreate,
)
from app.models.ingredient_tasting import (
    IngredientTasting,
    IngredientTastingCreate,
    IngredientTastingNote,
    IngredientTastingNoteCreate,
    IngredientTastingNoteUpdate,
    IngredientTastingNoteRead,
    IngredientTastingNoteWithDetails,
    IngredientTastingSummary,
)
from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)
from app.models.allergen import (
    Allergen,
    AllergenCreate,
    AllergenUpdate,
)
from app.models.ingredient_allergen import (
    IngredientAllergen,
    IngredientAllergenCreate,
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
from app.models.recipe_category import (
    RecipeCategory,
    RecipeCategoryCreate,
    RecipeCategoryUpdate,
)
from app.models.recipe_recipe_category import (
    RecipeRecipeCategory,
    RecipeRecipeCategoryCreate,
    RecipeRecipeCategoryUpdate,
)
from app.models.user import (
    User,
    UserCreate,
    UserUpdate,
    UserRead,
    UserType,
)
from app.models.auth import (
    LoginRequest,
    RegisterRequest,
    LoginResponse,
    TokenRequest,
    RefreshTokenResponse,
)
from app.models.menu import (
    Menu,
    MenuCreate,
    MenuUpdate,
    MenuRead,
    MenuSection,
    MenuSectionCreate,
    MenuSectionUpdate,
    MenuSectionRead,
    MenuItem,
    MenuItemCreate,
    MenuItemUpdate,
    MenuItemRead,
    MenuOutlet,
    MenuOutletCreate,
    MenuDetail,
)

__all__ = [
    # Ingredient
    "Ingredient",
    "IngredientCreate",
    "IngredientUpdate",
    "FoodCategory",
    "IngredientSource",
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
    "TastingSessionRead",
    "TastingUser",
    "TastingUserRead",
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
    # SupplierIngredient
    "SupplierIngredient",
    "SupplierIngredientCreate",
    "SupplierIngredientUpdate",
    "SupplierIngredientRead",
    # RecipeTasting
    "RecipeTasting",
    "RecipeTastingCreate",
    # IngredientTasting
    "IngredientTasting",
    "IngredientTastingCreate",
    "IngredientTastingNote",
    "IngredientTastingNoteCreate",
    "IngredientTastingNoteUpdate",
    "IngredientTastingNoteRead",
    "IngredientTastingNoteWithDetails",
    "IngredientTastingSummary",
    # Category
    "Category",
    "CategoryCreate",
    "CategoryUpdate",
    # Allergen
    "Allergen",
    "AllergenCreate",
    "AllergenUpdate",
    # IngredientAllergen
    "IngredientAllergen",
    "IngredientAllergenCreate",
    # RecipeImage
    "RecipeImage",
    "RecipeImageCreate",
    "RecipeImageUpdate",
    "RecipeImageReorder",
    # TastingNoteImage
    "TastingNoteImage",
    "TastingNoteImageCreate",
    # RecipeCategory
    "RecipeCategory",
    "RecipeCategoryCreate",
    "RecipeCategoryUpdate",
    # RecipeRecipeCategory
    "RecipeRecipeCategory",
    "RecipeRecipeCategoryCreate",
    "RecipeRecipeCategoryUpdate",
    # User
    "User",
    "UserCreate",
    "UserUpdate",
    "UserRead",
    "UserType",
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "LoginResponse",
    "TokenRequest",
    "RefreshTokenResponse",
    # Menu
    "Menu",
    "MenuCreate",
    "MenuUpdate",
    "MenuRead",
    "MenuSection",
    "MenuSectionCreate",
    "MenuSectionUpdate",
    "MenuSectionRead",
    "MenuItem",
    "MenuItemCreate",
    "MenuItemUpdate",
    "MenuItemRead",
    "MenuOutlet",
    "MenuOutletCreate",
    "MenuDetail",
]
