"""Database engine and session management."""

from collections.abc import Generator

from sqlmodel import Session, create_engine

from app.config import get_settings

settings = get_settings()

# The projected Passport read-model tables live in a dedicated `passport` schema (design 2026-07-15).
# Postgres has real schemas; SQLite does not, so on SQLite we collapse `passport` → the default schema
# via a schema_translate_map. Every engine that touches these tables (app runtime + the test engine in
# conftest) MUST carry this map, or `passport.<table>` references fail on SQLite.
PASSPORT_SCHEMA = "passport"
SQLITE_SCHEMA_TRANSLATE_MAP = {PASSPORT_SCHEMA: None}

# SQLAlchemy appends the BOUND PARAMETERS of a failed statement to `StatementError.__str__`. Any
# handler that logs a database failure with `exc_info=True` therefore writes the row's values into
# the log — the PKCE `code_verifier` from `/auth/passport/start`, a user's email from the SSO
# callback's `ensure_user` INSERT. `security.md` forbids that outright ("never print secrets — not
# even under DEBUG"), and `pkce.py`'s whole premise is that the verifier stays server-side; a log
# aggregator is the same disclosure with longer retention.
#
# This is NOT a debugging trade-off: `echo=settings.debug` is the supported way to see SQL locally,
# and it is unaffected. Named rather than inlined so the test engine in `tests/conftest.py` shares
# the setting — otherwise the regression test runs against an engine that leaks by construction and
# certifies a fix it never exercised.
HIDE_SQL_PARAMETERS = True


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
    hide_parameters=HIDE_SQL_PARAMETERS,
    connect_args=connect_args,
    execution_options=schema_execution_options(settings.database_url),
    **engine_kwargs,
)


def get_session() -> Generator[Session, None, None]:
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session
