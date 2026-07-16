"""Database connection tests for Supabase/PostgreSQL."""

from sqlalchemy import text
from sqlmodel import Session

from app.database import engine


class TestDatabaseConnection:
    """Test suite for database connectivity."""

    def test_engine_connects(self):
        """Verify the engine can establish a connection."""
        with engine.connect() as connection:
            assert connection is not None

    def test_can_execute_query(self):
        """Verify we can execute a simple query."""
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            row = result.fetchone()
            assert row is not None
            assert row[0] == 1

    def test_can_get_server_time(self):
        """Verify we can get the current timestamp from the server."""
        with engine.connect() as connection:
            result = connection.execute(text("SELECT NOW()"))
            row = result.fetchone()
            assert row is not None
            assert row[0] is not None

    def test_session_works(self):
        """Verify SQLModel Session works correctly."""
        with Session(engine) as session:
            result = session.exec(text("SELECT 1"))
            row = result.fetchone()
            assert row[0] == 1

    def test_database_is_postgresql(self):
        """Verify we're connected to PostgreSQL (not SQLite)."""
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version()"))
            row = result.fetchone()
            version_string = row[0].lower()
            assert "postgresql" in version_string, f"Expected PostgreSQL, got: {row[0]}"
