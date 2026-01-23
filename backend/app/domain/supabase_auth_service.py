"""Supabase authentication service.

Handles all Supabase auth operations (login, register, logout, token refresh).
Does NOT touch the database.
"""

from supabase import create_client

from app.config import get_settings


class SupabaseAuthService:
    """Service for Supabase authentication operations."""

    def __init__(self) -> None:
        """Initialize Supabase client."""
        settings = get_settings()

        if not settings.supabase_url or not settings.supabase_key:
            raise ValueError("Supabase credentials not configured")

        self.client = create_client(settings.supabase_url, settings.supabase_key)
        self.service_role_key = settings.supabase_key

    def login(self, email: str, password: str) -> dict:
        """
        Authenticate user with email and password.

        Returns:
            Dictionary with keys: user_id, access_token, refresh_token, expires_in

        Raises:
            ValueError: If credentials are invalid
            RuntimeError: If Supabase service is unavailable
        """
        try:
            response = self.client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            return {
                "user_id": response.user.id,
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_in": response.session.expires_in,
            }
        except Exception as e:
            error_msg = str(e).lower()
            if "invalid login" in error_msg or "invalid credentials" in error_msg:
                raise ValueError("Invalid email or password")
            raise RuntimeError(f"Supabase error: {str(e)}")

    def register(self, email: str, password: str) -> str:
        """
        Create user in Supabase auth using admin API.

        Returns:
            Supabase user ID

        Raises:
            ValueError: If email already exists
            RuntimeError: If Supabase service is unavailable
        """
        if not self.service_role_key:
            raise RuntimeError("Supabase service role key not configured")

        try:
            # Create service client with service role key for admin operations
            admin_client = create_client(
                str(self.client.supabase_url), self.service_role_key
            )
            response = admin_client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,  # Skip email verification
                }
            )
            return response.user.id
        except Exception as e:
            error_msg = str(e).lower()
            if "already registered" in error_msg or "already exists" in error_msg:
                raise ValueError("User with this email already exists")
            raise RuntimeError(f"Supabase error: {str(e)}")

    def refresh_token(self, refresh_token: str) -> dict:
        """
        Refresh an expired access token.

        Returns:
            Dictionary with keys: access_token, refresh_token, expires_in

        Raises:
            ValueError: If refresh token is invalid or expired
            RuntimeError: If Supabase service is unavailable
        """
        try:
            response = self.client.auth.refresh_session(refresh_token)
            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_in": response.session.expires_in,
            }
        except Exception as e:
            error_msg = str(e).lower()
            if "invalid" in error_msg or "expired" in error_msg:
                raise ValueError("Invalid or expired refresh token")
            raise RuntimeError(f"Supabase error: {str(e)}")

    def logout(self, access_token: str) -> None:
        """
        Sign out the current user.

        Args:
            access_token: JWT access token to invalidate

        Raises:
            ValueError: If token is invalid or expired
            RuntimeError: If Supabase service is unavailable
        """
        try:
            # Verify token is valid first
            user = self.client.auth.get_user(access_token)
            if not user:
                raise ValueError("Invalid or expired token")
            # Sign out without passing token (client maintains session)
            self.client.auth.sign_out()
        except ValueError:
            raise
        except Exception as e:
            error_msg = str(e).lower()
            # Ignore "not logged in" errors, consider them success
            if "not logged in" in error_msg or "no user" in error_msg:
                return
            # Invalid token errors
            if "invalid" in error_msg or "expired" in error_msg:
                raise ValueError("Invalid or expired token")
            raise RuntimeError(f"Supabase error: {str(e)}")

    def verify_token(self, token: str) -> str | None:
        """
        Verify JWT token and return user ID if valid.

        Args:
            token: JWT access token

        Returns:
            User ID if token is valid, None if invalid or expired

        Raises:
            RuntimeError: If Supabase service is unavailable
        """
        try:
            user = self.client.auth.get_user(token)
            return user.user.id if user and user.user else None
        except Exception:
            # Token is invalid or expired
            return None
