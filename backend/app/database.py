"""Database engine and session management."""

from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

# Build connect_args and pool config based on database type
connect_args = {}
engine_kwargs: dict = {}
is_sqlite = settings.database_url.startswith("sqlite")

if is_sqlite:
    connect_args["check_same_thread"] = False
else:
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
    **engine_kwargs,
)


def create_db_and_tables() -> None:
    """Create all database tables from SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session
