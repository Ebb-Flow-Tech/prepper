"""Pytest fixtures for testing.

Roles are Passport's, read PER-BRAND from the projection tables at the point of the check.
Nothing is stored on the ``users`` row any more, so a test that wants a user to have access must
SEED the chain Passport would have delivered:

    identity link -> membership -> entitlement -> brand unit -> unit_app_access
                                                            [-> unit_app_membership]

The last step is only needed for a plain ``Member``: an org ``Owner``/``Admin`` holds ``Manager``
at every brand of their org automatically, via Passport's ladder.

Seed nothing and the user derives nothing — access FAILS CLOSED. That is the point of the
``normal_user_client`` fixture: no identity link, therefore no brands, therefore no data.
"""

from itertools import count
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.api.deps import get_current_user, get_session
from app.database import get_session as db_get_session
from app.main import app
from app.models import User
from app.passport import store

APP_ID = "prepper"
ORG_ID = "org-test"

ADMIN_USER_ID = "test-admin-user"
ADMIN_PLATFORM_USER_ID = "pu-test-admin"
NORMAL_USER_ID = "test-normal-user"

MANAGER = "Manager"
STAFF = "Staff"

_ids = count(1)


def _next(prefix: str) -> str:
    return f"{prefix}-{next(_ids)}"


# ============================================================================
# Passport seeding helpers — the chain a user needs to derive any access
# ============================================================================


def seed_entitlement(session: Session, org_id: str = ORG_ID) -> None:
    """The org-level switch. Without it nothing is derived (Passport is not authoritative yet)."""
    store.apply_entitlement(
        session,
        {
            "id": _next("ent"),
            "organization_id": org_id,
            "app_id": APP_ID,
            "status": "active",
            "tier": "pro",
            "source": "admin",
            "version": 1,
        },
    )


def seed_brand(
    session: Session,
    name: str = "Test Brand",
    *,
    org_id: str = ORG_ID,
    external_ref: str | None = None,
) -> str:
    """An active brand carrying the Prepper app switch. Returns its unit id."""
    brand_id = _next("brand")
    store.apply_unit(
        session,
        {
            "id": brand_id,
            "organization_id": org_id,
            "type": "brand",
            "name": name,
            "external_ref": external_ref,
            "status": "active",
            "version": 1,
        },
    )
    store.create_unit_app_access(
        session,
        {
            "id": _next("uaa"),
            "organization_id": org_id,
            "unit_id": brand_id,
            "app_id": APP_ID,
        },
    )
    return brand_id


def seed_outlet_unit(
    session: Session, brand_id: str, name: str = "Test Outlet", *, org_id: str = ORG_ID
) -> str:
    """An outlet unit under ``brand_id``. It holds no people — it INHERITS the brand's roles."""
    outlet_id = _next("outlet")
    store.apply_unit(
        session,
        {
            "id": outlet_id,
            "organization_id": org_id,
            "type": "outlet",
            "name": name,
            "external_ref": None,
            "status": "active",
            "version": 1,
        },
    )
    store.create_relation(
        session,
        {
            "id": _next("rel"),
            "organization_id": org_id,
            "from_unit_id": outlet_id,
            "to_unit_id": brand_id,
            "relation": "belongs_to_brand",
        },
    )
    return outlet_id


def link_identity(session: Session, subject: str, platform_user_id: str) -> None:
    """The bridge from a local ``users.id`` to a Passport platform user."""
    store.create_identity_link(
        session,
        {
            "id": _next("link"),
            "platform_user_id": platform_user_id,
            "app_id": APP_ID,
            "subject": subject,
            "linked_via": "manual",
        },
    )


def grant_org_role(
    session: Session, platform_user_id: str, role: str, *, org_id: str = ORG_ID
) -> None:
    """An active org membership: ``Owner`` | ``Admin`` | ``Member``."""
    store.apply_membership(
        session,
        {
            "id": _next("mem"),
            "organization_id": org_id,
            "platform_user_id": platform_user_id,
            "role": role,
            "status": "active",
            "version": 1,
            "email": f"{platform_user_id}@test.com",
            "display_name": platform_user_id,
        },
    )


def grant_brand_role(
    session: Session,
    platform_user_id: str,
    brand_id: str,
    role: str,
    *,
    org_id: str = ORG_ID,
) -> None:
    """The (user, brand, app) role row: ``Manager`` | ``Staff``. Brand-scoped, by design."""
    store.apply_unit_app_membership(
        session,
        {
            "id": _next("uam"),
            "organization_id": org_id,
            "platform_user_id": platform_user_id,
            "unit_id": brand_id,
            "app_id": APP_ID,
            "role": role,
            "status": "active",
            "version": 1,
        },
    )


def create_user(
    session: Session,
    user_id: str,
    username: str = "user",
    email: str | None = None,
) -> User:
    """A local Prepper account, carrying NO role — roles live in Passport."""
    existing = session.exec(select(User).where(User.id == user_id)).first()
    if existing:
        return existing

    user = User(
        id=user_id,
        email=email or f"{username}@test.com",
        username=username,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def make_org_admin(
    session: Session,
    user_id: str,
    username: str = "admin",
    *,
    platform_user_id: str | None = None,
    org_id: str = ORG_ID,
) -> User:
    """A user who administers the ORG: link + ``Admin`` membership + entitlement.

    They need no ``unit_app_membership`` anywhere — the ladder hands them ``Manager`` at every
    brand of the org, including brands seeded after this call (roles are derived per request).
    """
    user = create_user(session, user_id, username)
    pu_id = platform_user_id or f"pu-{user_id}"
    link_identity(session, user_id, pu_id)
    grant_org_role(session, pu_id, "Admin", org_id=org_id)
    seed_entitlement(session, org_id)
    return user


def make_brand_user(
    session: Session,
    user_id: str,
    brand_id: str,
    role: str,
    username: str = "brand-user",
    *,
    org_id: str = ORG_ID,
) -> User:
    """A user holding ``role`` (``Manager``/``Staff``) at ONE brand and nothing anywhere else."""
    user = create_user(session, user_id, username)
    pu_id = f"pu-{user_id}"
    link_identity(session, user_id, pu_id)
    grant_org_role(session, pu_id, "Member", org_id=org_id)
    grant_brand_role(session, pu_id, brand_id, role, org_id=org_id)
    return user


def use_user(client: TestClient, user: User) -> User:
    """Make ``user`` the caller for subsequent requests on this client."""
    client.app.dependency_overrides[get_current_user] = lambda: user
    return user


# ============================================================================
# Core fixtures
# ============================================================================


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


@pytest.fixture(name="admin_user")
def admin_user_fixture(session: Session) -> User:
    """The org-admin user behind the ``client`` fixture."""
    return make_org_admin(
        session, ADMIN_USER_ID, "admin", platform_user_id=ADMIN_PLATFORM_USER_ID
    )


@pytest.fixture(name="brand_id")
def brand_id_fixture(session: Session) -> str:
    """A seeded, entitled brand. The org admin manages it via the ladder; nobody else does."""
    return seed_brand(session)


def _override_deps(session: Session, user: User) -> None:
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[db_get_session] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(name="client")
def client_fixture(session: Session, admin_user: User):
    """A test client acting as an ORG ADMIN — Manager at every brand of the org via the ladder."""
    _override_deps(session, admin_user)

    with (
        patch("app.api.recipe_images.is_storage_configured", return_value=True),
        patch("app.api.recipe_images.StorageService") as mock_storage_class,
    ):
        mock_storage = MagicMock()

        async def async_upload(*args, **kwargs):
            return "https://example.com/storage/recipe_images/test.png"

        mock_storage.upload_image_from_base64 = MagicMock(side_effect=async_upload)
        mock_storage_class.return_value = mock_storage

        yield TestClient(app)

    app.dependency_overrides.clear()


# ============================================================================
# Storage Mocks
# ============================================================================


@pytest.fixture
def mock_storage(monkeypatch):
    """Mock Supabase storage for image upload testing."""

    def mock_is_configured():
        return True

    class MockStorageService:
        async def upload_image_from_base64(self, base64_data: str, item_id: int, folder: str = ""):
            return f"https://fake-storage.supabase.co/storage/v1/object/public/bucket/{folder}/item_{item_id}.png"

        async def delete_image(self, image_url: str):
            return True

    monkeypatch.setattr("app.api.tasting_note_images.is_storage_configured", mock_is_configured)
    monkeypatch.setattr("app.api.tasting_note_images.StorageService", MockStorageService)

    yield


@pytest.fixture
def client_with_storage(session: Session, admin_user: User, mock_storage):
    """A test client acting as an org admin, with storage mocking enabled."""
    _override_deps(session, admin_user)
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def normal_user_client(session: Session):
    """A test client acting as a user with NO Passport roles at all.

    Nothing is seeded for them — no identity link, no membership, no brand role — so every
    derivation returns empty and they see nothing. Fail closed: a null scope used to mean
    "see everything"; it now means "see nothing".
    """
    user = create_user(session, NORMAL_USER_ID, "testuser")
    _override_deps(session, user)
    yield TestClient(app)
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
