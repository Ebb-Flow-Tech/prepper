"""SQLModel database models and DTOs."""

from app.models.allergen import (
    Allergen,
    AllergenCreate,
    AllergenUpdate,
)
from app.models.auth import (
    LoginRequest,
    LoginResponse,
    RefreshTokenResponse,
    RegisterRequest,
    TokenRequest,
)
from app.models.category import (
    Category,
    CategoryCreate,
    CategoryUpdate,
)
from app.models.costing import (
    CostBreakdownItem,
    CostingResult,
    SubRecipeCostItem,
)
from app.models.ingredient import (
    FoodCategory,
    Ingredient,
    IngredientCreate,
    IngredientListRead,
    IngredientSource,
    IngredientUpdate,
)
from app.models.ingredient_allergen import (
    IngredientAllergen,
    IngredientAllergenCreate,
)
from app.models.ingredient_tasting import (
    IngredientTasting,
    IngredientTastingBatchCreate,
    IngredientTastingBatchResult,
    IngredientTastingCreate,
    IngredientTastingNote,
    IngredientTastingNoteCreate,
    IngredientTastingNoteRead,
    IngredientTastingNoteUpdate,
    IngredientTastingNoteWithDetails,
    IngredientTastingRead,
    IngredientTastingSummary,
)
from app.models.menu import (
    Menu,
    MenuCreate,
    MenuDetail,
    MenuItem,
    MenuItemCreate,
    MenuItemRead,
    MenuItemUpdate,
    MenuOutlet,
    MenuOutletCreate,
    MenuRead,
    MenuSection,
    MenuSectionCreate,
    MenuSectionRead,
    MenuSectionUpdate,
    MenuUpdate,
)
from app.models.menu_sketch import (
    MenuSketch,
    MenuSketchCreate,
    MenuSketchRead,
    MenuSketchUpdate,
)
from app.models.recipe_outlet import (
    RecipeOutlet,
    RecipeOutletCreate,
    RecipeOutletUpdate,
)
from app.models.outlet_supplier_ingredient import (
    OutletSupplierIngredient,
    OutletSupplierIngredientCreate,
    OutletSupplierIngredientRead,
)
from app.models.pagination import PaginatedResponse
from app.models.passport import (
    PassportEntitlement,
    PassportIdentityLink,
    PassportMembership,
    PassportOrganization,
    PassportUnit,
    PassportUnitAppAccess,
    PassportUnitAppMembership,
    PassportUnitRelation,
)
from app.models.recipe import (
    InstructionsRaw,
    InstructionsStructured,
    Recipe,
    RecipeCreate,
    RecipeListRead,
    RecipeStatus,
    RecipeStatusUpdate,
    RecipeUpdate,
)
from app.models.recipe_category import (
    RecipeCategory,
    RecipeCategoryCreate,
    RecipeCategoryUpdate,
)
from app.models.recipe_image import (
    RecipeImage,
    RecipeImageCreate,
    RecipeImageReorder,
    RecipeImageUpdate,
)
from app.models.recipe_ingredient import (
    AllergenInfo,
    IngredientNested,
    RecipeIngredient,
    RecipeIngredientCreate,
    RecipeIngredientRead,
    RecipeIngredientUpdate,
)
from app.models.recipe_recipe import (
    RecipeRecipe,
    RecipeRecipeCreate,
    RecipeRecipeReorder,
    RecipeRecipeUpdate,
    SubRecipeUnit,
)
from app.models.recipe_recipe_category import (
    RecipeRecipeCategory,
    RecipeRecipeCategoryCreate,
    RecipeRecipeCategoryUpdate,
)
from app.models.recipe_tasting import (
    RecipeTasting,
    RecipeTastingBatchCreate,
    RecipeTastingBatchResult,
    RecipeTastingCreate,
    RecipeTastingIngredient,
    RecipeTastingRead,
    RecipeTastingReorderItem,
    RecipeTastingReorderRequest,
)
from app.models.supplier import (
    Supplier,
    SupplierCreate,
    SupplierUpdate,
)
from app.models.supplier_ingredient import (
    SupplierIngredient,
    SupplierIngredientCreate,
    SupplierIngredientRead,
    SupplierIngredientUpdate,
)
from app.models.supplier_ingredient_tag import (
    SupplierIngredientTag,
    SupplierIngredientTagCreate,
    SupplierIngredientTagLink,
    SupplierIngredientTagRead,
)
from app.models.tasting import (
    RecipeTastingSummary,
    TastingDecision,
    TastingNote,
    TastingNoteCreate,
    TastingNoteRead,
    TastingNoteUpdate,
    TastingNoteWithRecipe,
    TastingSession,
    TastingSessionCreate,
    TastingSessionRead,
    TastingSessionUpdate,
    TastingUser,
    TastingUserRead,
)
from app.models.tasting_note_image import (
    TastingNoteImage,
    TastingNoteImageCreate,
)
from app.models.user import (
    User,
    UserCreate,
    UserRead,
    UserUpdate,
)

__all__ = [
    # Ingredient
    "Ingredient",
    "IngredientCreate",
    "IngredientListRead",
    "IngredientUpdate",
    "FoodCategory",
    "IngredientSource",
    # Pagination
    "PaginatedResponse",
    # Recipe
    "Recipe",
    "RecipeCreate",
    "RecipeUpdate",
    "RecipeListRead",
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
    # Recipe <-> Passport unit
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
    # OutletSupplierIngredient
    "OutletSupplierIngredient",
    "OutletSupplierIngredientCreate",
    "OutletSupplierIngredientRead",
    # RecipeTasting
    "RecipeTasting",
    "RecipeTastingRead",
    "RecipeTastingCreate",
    "RecipeTastingBatchCreate",
    "RecipeTastingIngredient",
    "RecipeTastingBatchResult",
    "RecipeTastingReorderItem",
    "RecipeTastingReorderRequest",
    # IngredientTasting
    "IngredientTasting",
    "IngredientTastingCreate",
    "IngredientTastingBatchCreate",
    "IngredientTastingBatchResult",
    "IngredientTastingRead",
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
    # MenuSketch
    "MenuSketch",
    "MenuSketchCreate",
    "MenuSketchUpdate",
    "MenuSketchRead",
    # SupplierIngredientTag
    "SupplierIngredientTag",
    "SupplierIngredientTagLink",
    "SupplierIngredientTagRead",
    "SupplierIngredientTagCreate",
    # Passport read-model projection
    "PassportOrganization",
    "PassportMembership",
    "PassportEntitlement",
    "PassportIdentityLink",
    "PassportUnit",
    "PassportUnitRelation",
    "PassportUnitAppAccess",
    "PassportUnitAppMembership",
]
