"""Supabase authentication service.

Handles all Supabase auth operations against PREPPER's own project (sign-in, sign-out, password
recovery), plus verification of tokens signed by PASSPORT's project. Does NOT touch the database.

There is no ``refresh_token`` here either. The browser hands both tokens to its Supabase client and
that client owns refresh from then on; a backend that also redeems refresh tokens is a second
session authority, and under Model 3 the issuer is the only one that gets to be that.

There is no client pointed at Passport's GoTrue any more, and there must not be one again: under
Model 3 the browser signs in at Passport's hosted page and the code exchange authenticates with
``X-API-Key``, so this backend never handles a Passport password. The retired ``login_via_passport``
did, which meant a Prepper compromise harvested credentials valid for every app on the platform.

Uses a singleton Supabase client to avoid re-creating HTTP connections per request.
Supports local JWT verification to eliminate network round-trips on every auth check.
"""

from functools import lru_cache

import jwt as _pyjwt
from missiongroupsystems_auth import (
    AuthError as _EbbAuthError,
)
from missiongroupsystems_auth import (
    JwksUnavailableError as _EbbJwksUnavailableError,
)
from missiongroupsystems_auth import (
    TokenExpiredError as _EbbTokenExpiredError,
)
from missiongroupsystems_auth import (
    TokenInvalidError as _EbbTokenInvalidError,
)
from missiongroupsystems_auth import verify_token as _ebb_verify_token
from jwt.exceptions import InvalidTokenError as _JwtInvalidTokenError
from supabase import create_client

from app.config import get_settings
from app.passport import gate


@lru_cache
def _get_supabase_client():
    """Create and cache a singleton Supabase client (Prepper's own project).

    ``settings.supabase_key`` is the **service_role** key despite the plain name — the storage
    paths and `auth.admin.*` cannot be reached with the anon key. It bypasses RLS, so it never
    leaves the server. This is the ONLY Supabase client this service holds: see the module
    docstring for why there is no second one pointed at Passport's project.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise ValueError("Supabase credentials not configured")
    return create_client(settings.supabase_url, settings.supabase_key)


class SupabaseAuthService:
    """Service for Supabase authentication operations."""

    def __init__(self) -> None:
        """Read settings only. Prepper's own client is built on first use, not here.

        Constructing it eagerly coupled EVERY auth path to Prepper's own project, including the
        ones that never touch it — today that is the whole Model 3 callback, which only calls
        `verify_passport_identity`. `SupabaseAuthService()` raised when `supabase_key` was unset
        and `api/auth.py` turns that into a 503, so SSO was unusable on any deployment that had
        not also configured a project it would never call.
        """
        settings = get_settings()
        self.service_role_key = settings.supabase_key
        self._jwt_secret = settings.supabase_jwt_secret

    @property
    def client(self):  # type: ignore[no-untyped-def]
        """Prepper's own Supabase client, built on first access.

        Still raises `ValueError` when unconfigured — deferred, not suppressed. The paths that need
        it (storage, `auth.admin.create_user`, non-SSO login) must fail as loudly as before; the
        point is only that paths which do NOT need it are no longer taken down with them.
        """
        return _get_supabase_client()

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

    def send_password_recovery(self, email: str) -> None:
        """Ask PREPPER's own project to mail a recovery link. Never Passport's.

        Raises whatever GoTrue raises. ``api/auth.py``'s route swallows it deliberately, because a
        differing response is the enumeration oracle that route exists to refuse — the decision
        belongs there, where the property is stated, not buried in a service that cannot see it.
        """
        self.client.auth.reset_password_email(email)

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

        Delegates to the shared `missiongroupsystems_auth` library which handles
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
        # The SAME `sso_active` the router and all three D9 refusals use. It was an inline
        # flag-AND-url test here, a second copy in the retired `sso_login_enabled`, and a third in
        # the router — three definitions of "SSO is on" that could disagree, which is how a kill
        # switch ends up switching off only part of the thing it names.
        if not gate.sso_active(settings):
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
