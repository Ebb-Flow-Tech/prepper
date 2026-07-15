"""Alembic environment configuration."""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

from alembic import context

# Import settings to get DATABASE_URL from environment
from app.config import get_settings

# Import all models to ensure they're registered with SQLModel
from app.models import Ingredient, Recipe, RecipeIngredient  # noqa: F401

config = context.config

# Override sqlalchemy.url with environment variable
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Match app/database.py: require TLS for Postgres. Migrations run on every deploy via
    # the Fly release_command, so this connection must be encrypted too. SQLite (local/tests)
    # doesn't accept sslmode, so omit it there.
    connect_args = (
        {}
        if settings.database_url.startswith("sqlite")
        else {"sslmode": settings.database_sslmode}
    )
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
