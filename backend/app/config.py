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
    # TLS mode for the Postgres connection (psycopg2/libpq). "require" encrypts and refuses
    # plaintext instead of psycopg2's default "prefer", which silently downgrades. Upgrade to
    # "verify-full" (with a CA cert) for MITM protection. Ignored for SQLite (local/tests).
    database_sslmode: str = "require"

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

    # SSO issuer cutover (P3, dark-launched). When enabled, a token signed by PASSPORT's
    # Supabase project is accepted and the local user is resolved by the token's VERIFIED
    # email (platform_user.supabase_id is never synced, so sub-matching is impossible in a
    # consumer). Prepper's own project stays a valid issuer too until 5.3 — this only ADDS an
    # accepted issuer, so it is safe to ship off and flip on. See
    # passport docs/specs/2026-07-15-sso-issuer-cutover-prepper-pilot-design.md.
    passport_supabase_url: str | None = None
    # Passport project's anon (public) key. Needed for the SSO login-proxy: Prepper keeps its own
    # login page but authenticates email/password against PASSPORT's GoTrue (P3 §5.2 decision 2),
    # so the browser gets a Passport-issued token. Verification of that token uses JWKS/the issuer
    # (no key), but `sign_in_with_password` needs the project's anon key. Login-proxy is active only
    # when sso_enabled AND both passport_supabase_url and this key are set.
    passport_supabase_anon_key: str | None = None
    # ON by default so an environment that HAS the Passport config below is on the shared issuer
    # without a separate flag. This is a hard gate, not a switch on its own: the login-proxy and the
    # accept-Passport-tokens path only activate when `passport_supabase_url` (and, for login, the
    # anon key) are ALSO set — so an env without them (local/CI) silently stays on the Prepper-native
    # path. It only ever ADDS an accepted issuer, never rejects a Prepper token. Set to False to hard
    # disable (the reversible kill switch).
    sso_enabled: bool = True

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
