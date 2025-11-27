"""Shared dependencies for API routes."""

from collections.abc import Generator

from sqlmodel import Session

from app.database import engine


def get_session() -> Generator[Session, None, None]:
    """Yield a database session for dependency injection."""
    with Session(engine) as session:
        yield session
