"""Database engine and session management."""

from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

# The projected Passport read-model tables live in a dedicated `passport` schema (design 2026-07-15).
# Postgres has real schemas; SQLite does not, so on SQLite we collapse `passport` → the default schema
# via a schema_translate_map. Every engine that touches these tables (app runtime + the test engine in
# conftest) MUST carry this map, or `passport.<table>` references fail on SQLite.
PASSPORT_SCHEMA = "passport"
SQLITE_SCHEMA_TRANSLATE_MAP = {PASSPORT_SCHEMA: None}


def schema_execution_options(database_url: str) -> dict:
    """execution_options for an engine, given its URL. SQLite collapses the passport schema; on
    Postgres the real schema is used, so no translation is applied."""
    if database_url.startswith("sqlite"):
        return {"schema_translate_map": SQLITE_SCHEMA_TRANSLATE_MAP}
    return {}


# Build connect_args and pool config based on database type
connect_args = {}
engine_kwargs: dict = {}
is_sqlite = settings.database_url.startswith("sqlite")

if is_sqlite:
    connect_args["check_same_thread"] = False
else:
    # Enforce TLS: fail loudly rather than silently connecting in plaintext. Supabase
    # requires SSL; psycopg2 defaults to sslmode=prefer, which would fall back to
    # unencrypted if enforcement were ever off. See app.config.Settings.database_sslmode.
    connect_args["sslmode"] = settings.database_sslmode
    # Connection pooling for PostgreSQL / non-SQLite databases
    engine_kwargs.update(
        pool_size=20,
        max_overflow=40,
        pool_recycle=3600,
        pool_pre_ping=True,
    )

engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=connect_args,
    execution_options=schema_execution_options(settings.database_url),
    **engine_kwargs,
)


def create_db_and_tables() -> None:
    """Create all database tables from SQLModel metadata.

    On Postgres the `passport` schema must exist before the projection tables can be created; the
    schema is owned by the connecting role. On SQLite the schema collapses to the default (via the
    engine's schema_translate_map), so no schema DDL is needed."""
    if not is_sqlite:
        with engine.begin() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {PASSPORT_SCHEMA}"))
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session
