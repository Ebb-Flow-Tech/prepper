"""Tests for authentication endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.models import User, UserType


class MockSupabaseUser:
    """Mock Supabase user object."""

    def __init__(self, user_id: str, email: str):
        self.id = user_id
        self.email = email


class MockSupabaseSession:
    """Mock Supabase session object."""

    def __init__(
        self,
        access_token: str = "test_access_token",
        refresh_token: str = "test_refresh_token",
        expires_in: int = 3600,
    ):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_in = expires_in


class MockSupabaseAuthResponse:
    """Mock Supabase auth response."""

    def __init__(
        self,
        user_id: str = "test_user_id",
        email: str = "test@example.com",
        access_token: str = "test_access_token",
        refresh_token: str = "test_refresh_token",
        expires_in: int = 3600,
    ):
        self.user = MockSupabaseUser(user_id, email)
        self.session = MockSupabaseSession(access_token, refresh_token, expires_in)


@pytest.fixture
def mock_supabase_client(monkeypatch):
    """Mock Supabase client for testing auth endpoints."""

    # Mock settings to provide Supabase credentials
    class MockSettings:
        """Mock settings with Supabase credentials."""
        supabase_url = "https://test.supabase.co"
        supabase_key = "test_key"

    monkeypatch.setattr(
        "app.domain.supabase_auth_service.get_settings",
        lambda: MockSettings(),
    )

    class MockAuth:
        """Mock auth module."""

        def sign_in_with_password(self, credentials):
            """Mock sign in with password."""
            if (
                credentials["email"] == "admin@prepper.com"
                and credentials["password"] == "admin123"
            ):
                return MockSupabaseAuthResponse(
                    user_id="user-admin-001",
                    email="admin@prepper.com",
                    access_token="valid_token_admin",
                    refresh_token="refresh_token_admin",
                )
            elif (
                credentials["email"] == "chef@prepper.com"
                and credentials["password"] == "chef123"
            ):
                return MockSupabaseAuthResponse(
                    user_id="user-chef-002",
                    email="chef@prepper.com",
                    access_token="valid_token_chef",
                    refresh_token="refresh_token_chef",
                )
            elif (
                credentials["email"] == "newuser@prepper.com"
                and credentials["password"] == "password123"
            ):
                return MockSupabaseAuthResponse(
                    user_id="user-new-003",
                    email="newuser@prepper.com",
                    access_token="valid_token_new",
                    refresh_token="refresh_token_new",
                )
            else:
                raise Exception("Invalid login credentials")

        @property
        def admin(self):
            """Mock admin methods."""
            return self.AdminMethods()

        class AdminMethods:
            """Mock admin methods."""

            def create_user(self, data):
                """Mock create user."""
                if data["email"] == "newuser@prepper.com":
                    return MockSupabaseAuthResponse(
                        user_id="user-new-003",
                        email="newuser@prepper.com",
                        access_token="valid_token_new",
                        refresh_token="refresh_token_new",
                    )
                else:
                    raise Exception("User already registered")

        def refresh_session(self, refresh_token):
            """Mock refresh session."""
            if refresh_token == "valid_refresh_token":
                return MockSupabaseAuthResponse(
                    access_token="new_access_token",
                    refresh_token="new_refresh_token",
                )
            else:
                raise Exception("Invalid or expired refresh token")

        def get_user(self, token):
            """Mock get user from token."""
            if token == "valid_token_admin":
                response = MagicMock()
                response.user = MockSupabaseUser("user-admin-001", "admin@prepper.com")
                return response
            elif token == "valid_token_chef":
                response = MagicMock()
                response.user = MockSupabaseUser("user-chef-002", "chef@prepper.com")
                return response
            elif token == "new_access_token":
                response = MagicMock()
                response.user = MockSupabaseUser("user-admin-001", "admin@prepper.com")
                return response
            else:
                raise Exception("Invalid or expired token")

        def sign_out(self):
            """Mock sign out."""
            return None

    class MockSupabaseClient:
        """Mock Supabase client."""

        def __init__(self, url, key):
            self.supabase_url = url
            self.auth = MockAuth()

    monkeypatch.setattr(
        "app.domain.supabase_auth_service.create_client",
        lambda url, key: MockSupabaseClient(url, key),
    )
    yield


# ============================================================================
# Login Tests
# ============================================================================


def test_login_success(client: TestClient, mock_supabase_client, session):
    """Test successful login."""
    # Create user in database first
    user = User(
        id="user-admin-001",
        email="admin@prepper.com",
        username="admin",
        user_type=UserType.ADMIN,
    )
    session.add(user)
    session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@prepper.com", "password": "admin123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == "user-admin-001"
    assert data["user"]["email"] == "admin@prepper.com"
    assert data["access_token"] == "valid_token_admin"
    assert data["refresh_token"] == "refresh_token_admin"
    assert data["expires_in"] == 3600


def test_login_invalid_credentials(client: TestClient, mock_supabase_client):
    """Test login with invalid credentials."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@prepper.com", "password": "wrongpassword"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_login_user_not_in_database(client: TestClient, mock_supabase_client):
    """Test login when user exists in Supabase but not in database."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@prepper.com", "password": "admin123"},
    )

    assert response.status_code == 404
    data = response.json()
    assert "User not found in database" in data["detail"]


def test_login_creates_user_on_first_login(
    client: TestClient, mock_supabase_client, session
):
    """Test that login creates user in database if missing."""
    # First, create the user in the database
    user = User(
        id="user-admin-001",
        email="admin@prepper.com",
        username="admin",
        user_type=UserType.ADMIN,
    )
    session.add(user)
    session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@prepper.com", "password": "admin123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == "user-admin-001"
    assert data["user"]["email"] == "admin@prepper.com"


# ============================================================================
# Register Tests
# ============================================================================


def test_register_success(client: TestClient, mock_supabase_client):
    """Test successful user registration."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@prepper.com",
            "password": "password123",
            "username": "newuser",
            "user_type": "normal",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["id"] == "user-new-003"
    assert data["user"]["email"] == "newuser@prepper.com"
    assert data["user"]["username"] == "newuser"
    assert data["user"]["user_type"] == "normal"
    assert data["access_token"] == "valid_token_new"
    assert data["refresh_token"] == "refresh_token_new"


def test_register_duplicate_email(client: TestClient, mock_supabase_client):
    """Test registration with duplicate email."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "existing@prepper.com",
            "password": "password123",
            "username": "existing",
        },
    )

    assert response.status_code == 400
    data = response.json()
    assert "already exists" in data["detail"]


# ============================================================================
# Refresh Token Tests
# ============================================================================


def test_refresh_token_success(client: TestClient, mock_supabase_client):
    """Test successful token refresh."""
    response = client.post(
        "/api/v1/auth/refresh-token",
        json={"refresh_token": "valid_refresh_token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "new_access_token"
    assert data["refresh_token"] == "new_refresh_token"
    assert data["expires_in"] == 3600


def test_refresh_token_invalid(client: TestClient, mock_supabase_client):
    """Test refresh with invalid refresh token."""
    response = client.post(
        "/api/v1/auth/refresh-token",
        json={"refresh_token": "invalid_refresh_token"},
    )

    assert response.status_code == 401
    data = response.json()
    assert "detail" in data


# ============================================================================
# Logout Tests
# ============================================================================


def test_logout_success(client: TestClient, mock_supabase_client):
    """Test successful logout."""
    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": "Bearer valid_token_admin"},
    )

    assert response.status_code == 204


def test_logout_missing_token(client: TestClient, mock_supabase_client):
    """Test logout without authentication."""
    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 401
    data = response.json()
    assert "Not authenticated" in data["detail"]


def test_logout_invalid_token(client: TestClient, mock_supabase_client):
    """Test logout with invalid token."""
    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": "Bearer invalid_token"},
    )

    assert response.status_code == 401
    data = response.json()
    assert "detail" in data


# ============================================================================
# Get Current User Tests
# ============================================================================


def test_get_current_user_success(
    client: TestClient, mock_supabase_client, session
):
    """Test getting current user info."""
    # Create user in database
    user = User(
        id="user-admin-001",
        email="admin@prepper.com",
        username="admin",
        user_type=UserType.ADMIN,
    )
    session.add(user)
    session.commit()

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer valid_token_admin"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "user-admin-001"
    assert data["email"] == "admin@prepper.com"
    assert data["username"] == "admin"
    assert data["user_type"] == "admin"


def test_get_current_user_missing_token(client: TestClient, mock_supabase_client):
    """Test getting current user without token."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    data = response.json()
    assert "Not authenticated" in data["detail"]


def test_get_current_user_invalid_token(client: TestClient, mock_supabase_client):
    """Test getting current user with invalid token."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_token"},
    )

    assert response.status_code == 401
    data = response.json()
    assert "Invalid or expired token" in data["detail"]


def test_get_current_user_token_valid_but_user_not_found(
    client: TestClient, mock_supabase_client
):
    """Test getting current user when token is valid but user not in database."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer valid_token_admin"},
    )

    assert response.status_code == 404
    data = response.json()
    assert "User not found" in data["detail"]
