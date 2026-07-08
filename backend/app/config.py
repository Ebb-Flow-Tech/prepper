"""Application configuration using pydantic-settings."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = "Recipe Builder API"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./recipe_builder.db"

    # API
    api_v1_prefix: str = "/api/v1"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Supabase Storage
    supabase_url: str | None = None
    supabase_key: str | None = None
    supabase_bucket: str = ""
    supabase_recipe_images_folder: str = "recipe-images"
    supabase_tasting_note_images_folder: str = "tasting-note-images"
    supabase_ingredient_tasting_note_images_folder: str = "ingredient-tasting-note-images"

    # Supabase Auth
    # supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None

    # Anthropic API
    anthropic_api_key: str | None = None

    # Passport sync consumer (identity/org/entitlement platform).
    # When these are unset the sync endpoint is not mounted and identity
    # reporting is a no-op — the app degrades gracefully without Passport.
    passport_api_url: str | None = None
    passport_org_id: str | None = None
    passport_api_key: str | None = None
    passport_webhook_secret: str | None = None
    # Set only during a 24h webhook-secret rotation overlap; clear afterwards.
    passport_webhook_secret_prev: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
