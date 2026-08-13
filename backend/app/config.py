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

    # PASSPORT's Supabase project — the shared issuer. A token it signed is accepted, and the local
    # user is resolved by the token's VERIFIED email (platform_user.supabase_id is never synced, so
    # sub-matching is impossible in a consumer). Prepper's own project stays a valid issuer too, so
    # this only ever ADDS an accepted issuer.
    #
    # There is deliberately NO `passport_supabase_anon_key` beside it. The retired login-proxy needed
    # one to call `sign_in_with_password` server-side; under Model 3 the hosted login happens in the
    # BROWSER and the code exchange authenticates with `X-API-Key`, so this backend never touches
    # Passport's GoTrue. The anon key is a frontend concern (`NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY`)
    # and keeping a backend setting for a credential with no reader is how one gets wired back into
    # an auth path by someone "fixing" an unused variable.
    passport_supabase_url: str | None = None
    # ON by default so an environment that HAS the Passport config below is on the shared issuer
    # without a separate flag. This is a hard gate, not a switch on its own: `gate.sso_active` is
    # this flag AND `passport_supabase_url`, so an env without the URL (local/CI) silently stays on
    # the Prepper-native path. Set to False to hard disable (the reversible kill switch) — it turns
    # off the router, all three D9 refusals and the Passport-issuer verify path together.
    sso_enabled: bool = True

    # Anthropic API
    anthropic_api_key: str | None = None

    # Passport sync consumer (identity/org/entitlement platform).
    # When these are unset the sync endpoint is not mounted and identity
    # reporting is a no-op — the app degrades gracefully without Passport.
    passport_api_url: str | None = None
    passport_api_key: str | None = None
    passport_webhook_secret: str | None = None
    # Set only during a 24h webhook-secret rotation overlap; clear afterwards.
    passport_webhook_secret_prev: str | None = None

    # Passport hosted login (Model 3, OAuth 2.1 + PKCE).
    #
    # A DIFFERENT host from `passport_api_url`: this is the dashboard the BROWSER is redirected to
    # for `/authorize`; the API url is the server-to-server host the code exchange calls. Pointing
    # one at the other is the classic misconfiguration and yields a flat 404.
    passport_dashboard_url: str | None = None
    # Must equal the URI registered on Passport's PER-APP sign-in-callback allow-list byte for byte
    # (not the Supabase project-level redirect list). Re-sent in the exchange body per RFC 6749
    # §4.1.3, so a drift here fails the exchange rather than the redirect.
    sso_callback_url: str | None = None
    # Where the handoff lands: the session fragment on success, and all three failure codes
    # otherwise. Unset degrades to a relative path — misconfigured, but it still lands somewhere.
    frontend_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
