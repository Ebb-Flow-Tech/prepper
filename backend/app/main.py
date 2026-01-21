"""FastAPI application factory and startup configuration."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_db_and_tables
from app.api import ingredients, recipes, recipe_ingredients, instructions, costing, sub_recipes, outlets, tastings, suppliers, recipe_tastings, tasting_history, categories, category_agent, feedback_summary_agent, recipe_images

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    # Startup
    create_db_and_tables()
    yield
    # Shutdown (cleanup if needed)


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
        categories.router,
        prefix=f"{settings.api_v1_prefix}/categories",
        tags=["categories"],
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

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy"}

    return app


app = create_app()
