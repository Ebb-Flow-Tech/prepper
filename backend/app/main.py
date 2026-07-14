"""FastAPI application factory and startup configuration."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    allergens,
    auth,
    categories,
    category_agent,
    costing,
    feedback_summary_agent,
    ingredient_allergens,
    ingredient_tasting_notes,
    ingredient_tastings,
    ingredients,
    instructions,
    menu_sketch_section_item_comments,
    menu_sketch_section_items,
    menu_sketch_sections,
    menu_sketches,
    menus,
    outlets,
    passport_roles,
    recipe_allergens,
    recipe_categories,
    recipe_images,
    recipe_ingredients,
    recipe_recipe_categories,
    recipe_tastings,
    recipes,
    sub_recipes,
    supplier_ingredient_tags,
    supplier_ingredients,
    suppliers,
    tasting_history,
    tasting_note_images,
    tastings,
    users,
)
from app.config import get_settings
from app.database import create_db_and_tables

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    # Startup
    create_db_and_tables()
    yield
    # Shutdown
    from app.domain.storage_service import close_http_client
    await close_http_client()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        debug=settings.debug,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routers
    app.include_router(
        auth.router,
        prefix=f"{settings.api_v1_prefix}/auth",
        tags=["auth"],
    )
    app.include_router(
        ingredients.router,
        prefix=f"{settings.api_v1_prefix}/ingredients",
        tags=["ingredients"],
    )
    app.include_router(
        recipes.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipes"],
    )
    app.include_router(
        recipe_ingredients.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-ingredients"],
    )
    app.include_router(
        instructions.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["instructions"],
    )
    app.include_router(
        costing.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["costing"],
    )
    app.include_router(
        sub_recipes.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["sub-recipes"],
    )
    app.include_router(
        sub_recipes.batch_router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["sub-recipes"],
    )
    app.include_router(
        outlets.router,
        prefix=f"{settings.api_v1_prefix}/outlets",
        tags=["outlets"],
    )
    app.include_router(
        outlets.recipe_outlets_router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-outlets"],
    )
    app.include_router(
        tastings.router,
        prefix=f"{settings.api_v1_prefix}/tasting-sessions",
        tags=["tastings"],
    )
    app.include_router(
        tasting_history.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-tastings"],
    )
    app.include_router(
        suppliers.router,
        prefix=f"{settings.api_v1_prefix}/suppliers",
        tags=["suppliers"],
    )
    app.include_router(
        recipe_tastings.router,
        prefix=f"{settings.api_v1_prefix}/tasting-sessions",
        tags=["recipe-tastings"],
    )
    app.include_router(
        ingredient_tastings.router,
        prefix=f"{settings.api_v1_prefix}/tasting-sessions",
        tags=["ingredient-tastings"],
    )
    app.include_router(
        ingredient_tasting_notes.router,
        prefix=f"{settings.api_v1_prefix}/tasting-sessions",
        tags=["ingredient-tasting-notes"],
    )
    app.include_router(
        categories.router,
        prefix=f"{settings.api_v1_prefix}/categories",
        tags=["categories"],
    )
    app.include_router(
        recipe_categories.router,
        prefix=f"{settings.api_v1_prefix}/recipe-categories",
        tags=["recipe-categories"],
    )
    app.include_router(
        recipe_recipe_categories.router,
        prefix=f"{settings.api_v1_prefix}/recipe-recipe-categories",
        tags=["recipe-recipe-categories"],
    )
    app.include_router(
        category_agent.router,
        prefix=f"{settings.api_v1_prefix}/agents",
        tags=["agents"],
    )
    app.include_router(
        feedback_summary_agent.router,
        prefix=f"{settings.api_v1_prefix}/agents",
        tags=["agents"],
    )
    app.include_router(
        recipe_images.router,
        prefix=f"{settings.api_v1_prefix}/recipe-images",
        tags=["recipe-images"],
    )
    app.include_router(
        tasting_note_images.router,
        prefix=f"{settings.api_v1_prefix}/tasting-note-images",
        tags=["tasting-note-images"],
    )
    app.include_router(
        users.router,
        prefix=f"{settings.api_v1_prefix}/users",
        tags=["users"],
    )
    app.include_router(
        allergens.router,
        prefix=f"{settings.api_v1_prefix}/allergens",
        tags=["allergens"],
    )
    # Brand-app roles: write-back to Passport, which owns these rows. Mutations go UP via the
    # SDK and come back DOWN through sync — nothing here writes the local projection.
    app.include_router(
        passport_roles.router,
        prefix=f"{settings.api_v1_prefix}/passport/brand-roles",
        tags=["passport-roles"],
    )
    app.include_router(
        ingredient_allergens.router,
        prefix=f"{settings.api_v1_prefix}/ingredient-allergens",
        tags=["ingredient-allergens"],
    )
    app.include_router(
        recipe_allergens.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-allergens"],
    )
    app.include_router(
        recipe_allergens.batch_router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-allergens"],
    )
    app.include_router(
        menus.router,
        prefix=f"{settings.api_v1_prefix}/menus",
        tags=["menus"],
    )
    app.include_router(
        menus.menu_outlets_router,
        prefix=f"{settings.api_v1_prefix}/menu-outlets",
        tags=["menu-outlets"],
    )
    app.include_router(
        menus.menu_items_router,
        prefix=f"{settings.api_v1_prefix}/menu-items",
        tags=["menu-items"],
    )
    app.include_router(
        menu_sketches.router,
        prefix=f"{settings.api_v1_prefix}/menu-sketches",
        tags=["menu-sketches"],
    )
    app.include_router(
        menu_sketch_sections.router,
        prefix=f"{settings.api_v1_prefix}/menu-sketch-sections",
        tags=["menu-sketch-sections"],
    )
    app.include_router(
        menu_sketch_section_items.router,
        prefix=f"{settings.api_v1_prefix}/menu-sketch-section-items",
        tags=["menu-sketch-section-items"],
    )
    app.include_router(
        menu_sketch_section_item_comments.router,
        prefix=f"{settings.api_v1_prefix}/menu-sketch-section-item-comments",
        tags=["menu-sketch-section-item-comments"],
    )
    app.include_router(
        supplier_ingredients.router,
        prefix=f"{settings.api_v1_prefix}/supplier-ingredients",
        tags=["supplier-ingredients"],
    )
    app.include_router(
        supplier_ingredient_tags.router,
        prefix=f"{settings.api_v1_prefix}/supplier-ingredient-tags",
        tags=["supplier-ingredient-tags"],
    )

    # Passport sync receive endpoint (identity/org/entitlement platform).
    # The private `passport-client` SDK is an optional dependency: if it isn't
    # installed the endpoint is simply not mounted, and the app runs unchanged.
    try:
        from app.passport.sync_router import mount_passport_sync

        mount_passport_sync(app, api_prefix=settings.api_v1_prefix)
    except ImportError:
        import logging

        logging.getLogger(__name__).info(
            "passport-client not installed; Passport sync endpoint not mounted"
        )

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy"}

    return app


app = create_app()
