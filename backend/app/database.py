"""Database engine and session management."""

from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

# Build connect_args based on database type
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=connect_args,
)


def create_db_and_tables() -> None:
    """Create all database tables from SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session
