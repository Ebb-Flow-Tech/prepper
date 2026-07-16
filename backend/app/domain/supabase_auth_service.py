"""Supabase authentication service.

Handles all Supabase auth operations (login, register, logout, token refresh).
Does NOT touch the database.

Uses a singleton Supabase client to avoid re-creating HTTP connections per request.
Supports local JWT verification to eliminate network round-trips on every auth check.
"""

from functools import lru_cache

import jwt as _pyjwt
from ebb_flow_tech_auth import (
    AuthError as _EbbAuthError,
)
from ebb_flow_tech_auth import (
    JwksUnavailableError as _EbbJwksUnavailableError,
)
from ebb_flow_tech_auth import (
    TokenExpiredError as _EbbTokenExpiredError,
)
from ebb_flow_tech_auth import (
    TokenInvalidError as _EbbTokenInvalidError,
)
from ebb_flow_tech_auth import verify_token as _ebb_verify_token
from jwt.exceptions import InvalidTokenError as _JwtInvalidTokenError
from supabase import create_client

from app.config import get_settings


@lru_cache
def _get_supabase_client():
    """Create and cache a singleton Supabase client (Prepper's own project)."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise ValueError("Supabase credentials not configured")
    return create_client(settings.supabase_url, settings.supabase_key)


@lru_cache
def _get_passport_supabase_client():
    """Create and cache a client pointed at PASSPORT's project (the shared issuer).

    Used by the SSO login-proxy (P3 §5.2): Prepper's own login page authenticates email/password
    here, so the browser receives a Passport-issued token. Uses the anon (public) key — the same
    key a browser would use — never Prepper's service-role key.
    """
    settings = get_settings()
    if not settings.passport_supabase_url or not settings.passport_supabase_anon_key:
        raise ValueError("Passport Supabase credentials not configured")
    return create_client(settings.passport_supabase_url, settings.passport_supabase_anon_key)


class SupabaseAuthService:
    """Service for Supabase authentication operations."""

    def __init__(self) -> None:
        """Initialize with cached Supabase client."""
        self.client = _get_supabase_client()
        settings = get_settings()
        self.service_role_key = settings.supabase_key
        self._jwt_secret = settings.supabase_jwt_secret

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

    @property
    def sso_login_enabled(self) -> bool:
        """Whether the SSO login-proxy is active — email/password authenticate against Passport.

        Requires all three: the feature flag, Passport's project URL, and its anon key. Any missing
        → the login path falls back to Prepper's own project (fully reversible)."""
        s = get_settings()
        return bool(s.sso_enabled and s.passport_supabase_url and s.passport_supabase_anon_key)

    def login_via_passport(self, email: str, password: str) -> dict:
        """Authenticate email/password against PASSPORT's project; return a Passport-issued session.

        The returned ``user_id`` is the Passport ``sub`` (not a Prepper sub) and ``email`` is the
        authenticated address — the caller resolves the LOCAL ``users`` row by that email, never by
        this sub (P3 §5.2). Same error contract as :meth:`login`.
        """
        client = _get_passport_supabase_client()
        try:
            response = client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            if not response.user or not response.user.email:
                # A successful sign-in without an email is unreachable in practice, but the caller
                # keys the local lookup on this email — guard so a null maps to a clean 400, not a
                # 500 (parity with verify_passport_identity's `if not identity.email`).
                raise ValueError("Invalid email or password")
            return {
                "user_id": response.user.id,  # Passport sub — resolve locally by email, not this
                "email": response.user.email,
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_in": response.session.expires_in,
            }
        except ValueError:
            raise  # the deliberate null-email guard above → 400, not the 503 fallback below
        except Exception as e:
            error_msg = str(e).lower()
            if "invalid login" in error_msg or "invalid credentials" in error_msg:
                raise ValueError("Invalid email or password")
            raise RuntimeError(f"Passport auth error: {str(e)}")

    def refresh_via_passport(self, refresh_token: str) -> dict:
        """Refresh a Passport-issued session against PASSPORT's project (SSO login-proxy).

        A session minted by :meth:`login_via_passport` carries a Passport refresh token, which only
        Passport's GoTrue can redeem — so refresh must route here, not to Prepper's project."""
        client = _get_passport_supabase_client()
        try:
            response = client.auth.refresh_session(refresh_token)
            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_in": response.session.expires_in,
            }
        except Exception as e:
            error_msg = str(e).lower()
            if "invalid" in error_msg or "expired" in error_msg:
                raise ValueError("Invalid or expired refresh token")
            raise RuntimeError(f"Passport auth error: {str(e)}")

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
            response = self.client.auth.admin.create_user(
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

    def get_user_info(self, access_token: str) -> dict:
        """
        Fetch Supabase user profile (id, email, metadata) using an access token.

        Used by the OAuth completion flow to read provider-supplied metadata
        (e.g. Google `full_name`, `name`, `avatar_url`) when auto-provisioning
        a local users row on first sign-in.

        Returns:
            Dictionary with keys: user_id, email, user_metadata

        Raises:
            ValueError: If token is invalid or expired
            RuntimeError: If Supabase service is unavailable
        """
        try:
            response = self.client.auth.get_user(access_token)
            if not response or not getattr(response, "user", None):
                raise ValueError("Invalid or expired token")
            user = response.user
            return {
                "user_id": user.id,
                "email": getattr(user, "email", None),
                "user_metadata": getattr(user, "user_metadata", None) or {},
            }
        except ValueError:
            raise
        except Exception as e:
            error_msg = str(e).lower()
            if "invalid" in error_msg or "expired" in error_msg:
                raise ValueError("Invalid or expired token")
            raise RuntimeError(f"Supabase error: {str(e)}")

    def verify_token(self, token: str) -> str | None:
        """
        Verify JWT token and return user ID if valid.

        Delegates to the shared `ebb_flow_tech_auth` library which handles
        JWKS caching and ES256/RS256 signature verification locally — no
        network round-trip to Supabase per request (only periodic JWKS fetch).

        Args:
            token: JWT access token

        Returns:
            User ID if token is valid, None if invalid or expired
        """
        import logging
        logger = logging.getLogger(__name__)

        settings = get_settings()
        logger.debug("verify_token: supabase_url=%s token_prefix=%s", settings.supabase_url, token[:20] if token else None)
        try:
            identity = _ebb_verify_token(
                token,
                supabase_url=settings.supabase_url,
            )
            logger.debug("verify_token: success user_id=%s", identity.user_id)
            return identity.user_id
        except (_EbbTokenExpiredError, _EbbTokenInvalidError):
            return None
        except _EbbJwksUnavailableError:
            # Supabase project uses HS256 — JWKS has no public keys.
            # Fall back to symmetric verification with the JWT secret.
            return self._verify_hs256(token, settings.supabase_url, logger)
        except _EbbAuthError as e:
            logger.warning("verify_token: rejected token type=%s msg=%s", type(e).__name__, e)
            return None
        except Exception as e:
            logger.error("verify_token: unexpected error type=%s msg=%s", type(e).__name__, e, exc_info=True)
            return None

    def verify_passport_identity(self, token: str) -> tuple[str, str] | None:
        """Verify a token signed by PASSPORT's Supabase project; return its ``(sub, email)``.

        The SSO issuer-cutover seam (P3, dark-launched behind ``sso_enabled``). A token from the
        shared issuer carries a ``sub`` this app has never seen — its users are keyed by their own
        project's sub — so an EXISTING user is resolved by the **verified email** (the caller maps it
        onto the local ``users`` row; ``platform_user.supabase_id`` is deliberately never synced). The
        ``sub`` is returned too so a member with no local row yet can be provisioned keyed by it
        (§5.2). Returns ``None`` when SSO is off, unconfigured, or the token does not verify.

        Adds an accepted issuer; it never rejects a token the primary path would have accepted, so
        it is safe to deploy dark and flip on. See the P3 design doc in the passport repo.
        """
        settings = get_settings()
        if not settings.sso_enabled or not settings.passport_supabase_url:
            return None

        try:
            identity = _ebb_verify_token(token, supabase_url=settings.passport_supabase_url)
        except (_EbbTokenExpiredError, _EbbTokenInvalidError, _EbbAuthError):
            return None
        except Exception:  # noqa: BLE001 — a bad Passport token must fall back, never 500
            return None
        if not identity.email:
            return None
        return identity.user_id, identity.email

    def _verify_hs256(self, token: str, supabase_url: str | None, logger) -> str | None:
        """Verify a Supabase HS256 JWT using the project's JWT secret."""
        import logging
        if not self._jwt_secret or not supabase_url:
            logging.getLogger(__name__).error(
                "verify_token: JWKS unavailable and SUPABASE_JWT_SECRET not configured"
            )
            return None
        issuer = f"{supabase_url.rstrip('/')}/auth/v1"
        try:
            claims = _pyjwt.decode(
                token,
                key=self._jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=issuer,
                options={"require": ["exp", "iat", "sub"]},
            )
            logger.debug("verify_token HS256 fallback: success user_id=%s", claims["sub"])
            return claims["sub"]
        except _JwtInvalidTokenError as e:
            logger.warning("verify_token HS256 fallback: rejected token msg=%s", e)
            return None


# Module-level singleton for use in deps.py and auth.py
_auth_service: SupabaseAuthService | None = None


def get_auth_service() -> SupabaseAuthService:
    """Get or create the singleton SupabaseAuthService instance."""
    global _auth_service
    if _auth_service is None:
        _auth_service = SupabaseAuthService()
    return _auth_service
