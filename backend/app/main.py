"""FastAPI application factory and startup configuration."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    allergens,
    auth,
    auth_passport,
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
    organizations,
    passport_roles,
    recipe_allergens,
    recipe_categories,
    recipe_images,
    recipe_ingredients,
    recipe_recipe_categories,
    recipe_tastings,
    recipe_units,
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
from app.api.deps import require_auth
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
        # Default-deny: every API route requires a JWT unless `deps.public_routes` allowlists it.
        # Registered here rather than per-router so a router added later is protected by omission
        # rather than exposed by it. See tests/test_default_deny_auth.py.
        dependencies=[Depends(require_auth)],
        # The docs routes are the ONE thing that dependency cannot reach: FastAPI registers them as
        # plain Starlette `Route`s, not `APIRoute`s, so they served the full schema to anyone. They
        # are not allowlisted either — they were simply invisible to the gate AND to the test that
        # enumerates `app.openapi()["paths"]`, since they do not appear in the schema they serve.
        #
        # Gated by `debug` rather than added to the allowlist: a JSON API has no useful 401 to hand
        # an anonymous browser, so the honest answer is not to serve them in production. Developers
        # keep them via DEBUG=true. `app.openapi()` is unaffected, so the auth fixtures still work.
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
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
    # Same prefix as `auth.router` on purpose — one `/auth` surface, split by concern rather than
    # by URL. Order is not load-bearing here: no path in either router shadows one in the other.
    app.include_router(
        auth_passport.router,
        prefix=f"{settings.api_v1_prefix}/auth",
        tags=["auth"],
    )
    app.include_router(
        ingredients.router,
        prefix=f"{settings.api_v1_prefix}/ingredients",
        tags=["ingredients"],
    )
    # BEFORE `recipes.router`, and that ORDER IS LOAD-BEARING. Both mount at /recipes, and
    # `recipes` declares `GET /{recipe_id}` — a catch-all for any single path segment. Registered
    # after it, this router's static `GET /with-feedback` would be swallowed and 422 with
    # "unable to parse 'with-feedback' as an integer". Starlette matches in registration order, so
    # specific paths must precede parameterised ones. Pinned by
    # tests/test_route_order.py::test_with_feedback_is_not_swallowed_by_recipe_id.
    app.include_router(
        tasting_history.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-tastings"],
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
    # No /outlets router: brands and outlets are created and edited in PASSPORT, and Prepper only
    # projects them (rule 7). What remains is which units a recipe is served at.
    app.include_router(
        recipe_units.router,
        prefix=f"{settings.api_v1_prefix}/recipes",
        tags=["recipe-units"],
    )
    app.include_router(
        tastings.router,
        prefix=f"{settings.api_v1_prefix}/tasting-sessions",
        tags=["tastings"],
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
    # The orgs the caller may act in — names + their role in each. Read from the projection; the
    # only route that surfaces `passport.organization` to the client.
    app.include_router(
        organizations.router,
        prefix=f"{settings.api_v1_prefix}/passport/organizations",
        tags=["organizations"],
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
