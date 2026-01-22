"""Pytest fixtures for testing."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.api.deps import get_session
from app.database import get_session as db_get_session


@pytest.fixture(name="session")
def session_fixture():
    """Create a new in-memory database session for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Create a test client with the test database session."""

    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[db_get_session] = get_session_override

    # Mock storage service to avoid needing Supabase credentials
    storage_patches = [
        patch("app.api.recipe_images.is_storage_configured", return_value=True),
        patch("app.api.recipe_images.StorageService"),
    ]

    with storage_patches[0]:
        with storage_patches[1] as mock_storage_class:
            mock_storage = MagicMock()

            # Make the mock's async method work with await
            async def async_upload(*args, **kwargs):
                return "https://example.com/storage/recipe_images/test.png"

            mock_storage.upload_image_from_base64 = MagicMock(side_effect=async_upload)
            mock_storage_class.return_value = mock_storage

            client = TestClient(app)
            yield client

    app.dependency_overrides.clear()


# ============================================================================
# Anthropic/Claude Agent Mocks
# ============================================================================


@pytest.fixture
def mock_settings():
    """Mock settings with Anthropic API key configured."""
    with patch("app.agents.base_agent.get_settings") as mock:
        settings = MagicMock()
        settings.anthropic_api_key = "test-api-key"
        mock.return_value = settings
        yield mock


@pytest.fixture
def mock_anthropic():
    """Mock Anthropic client for testing agents without API calls."""
    with patch("app.agents.base_agent.anthropic.Anthropic") as mock:
        yield mock


@pytest.fixture
def agent_with_mocks(mock_settings, mock_anthropic):
    """Combined fixture for agent initialization with mocked dependencies.

    Returns the mock Anthropic client for configuring responses.
    """
    return mock_anthropic


@pytest.fixture
def agent_no_api_key():
    """Fixture for testing agent initialization without API key.

    Use this when testing error handling for missing API key.
    """
    with patch("app.agents.base_agent.get_settings") as mock:
        settings = MagicMock()
        settings.anthropic_api_key = None
        mock.return_value = settings
        yield mock


class MockContentBlock:
    """Mock content block for Claude responses."""

    def __init__(self, text: str = "", block_type: str = "text"):
        self.text = text
        self.type = block_type


class MockToolUseBlock:
    """Mock tool use block for Claude responses."""

    def __init__(self, tool_id: str, name: str, input_data: dict):
        self.id = tool_id
        self.name = name
        self.input = input_data
        self.type = "tool_use"


class MockClaudeResponse:
    """Mock Claude API response."""

    def __init__(self, content: list, stop_reason: str = "end_turn"):
        self.content = content
        self.stop_reason = stop_reason
