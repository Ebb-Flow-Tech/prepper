"""Authentication API endpoints.

Provides login, register, logout, token refresh, and user info endpoints.
Orchestrates between SupabaseAuthService and UserService.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlmodel import Session

from app.api.deps import (
    get_current_user,
    get_session,
    resolve_or_provision_passport_user,
)
from app.domain.supabase_auth_service import get_auth_service
from app.domain.user_service import UserService
from app.models import (
    LoginRequest,
    LoginResponse,
    RefreshTokenResponse,
    RegisterRequest,
    TokenRequest,
    User,
    UserCreate,
    UserRead,
)
from app.passport.access import (
    has_prepper_access_for_platform_user,
    platform_user_id_for_email,
)
from app.passport.identity import report_identity_link_safe

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    session: Session = Depends(get_session),
) -> LoginResponse:
    """
    Authenticate user with email and password.

    Returns:
        User info and access/refresh tokens
    """
    try:
        auth_service = get_auth_service()
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_service = UserService(session)

    # SSO login-proxy (P3 §5.2): Prepper keeps its own login page, but authenticates against
    # PASSPORT's project so the browser gets a Passport-issued token — one credential for every app,
    # and no Prepper-side invite/SMTP. The local user is resolved by the VERIFIED email (not the
    # returned sub); that same Passport token is then trusted by get_current_user on every request.
    if auth_service.sso_login_enabled:
        try:
            auth_result = auth_service.login_via_passport(data.email, data.password)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email or password",
            )
        except RuntimeError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable",
            )
        user = resolve_or_provision_passport_user(
            session, auth_result["user_id"], auth_result["email"]
        )
        if user is None:
            # Valid Passport credentials, but not an active member here — no local access.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of any Prepper organisation",
            )
        # App-access gate: membership alone is not access, and a NON-member must not get a session
        # via a legacy local row. Resolve the member by email→membership (active-only). None ⇒ not a
        # current member (e.g. a removed member who still owns a local `users` row, or a valid
        # Passport account that was never a member here) ⇒ deny. Otherwise require DERIVED access
        # (a brand role or the Owner/Admin ladder). `has_prepper_access_for_platform_user` fails OPEN
        # until entitlements sync, matching the request-path derivation, so a real member is never
        # locked out before the projection lands.
        platform_user_id = platform_user_id_for_email(session, auth_result["email"])
        if platform_user_id is None or not has_prepper_access_for_platform_user(
            session, platform_user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to Prepper",
            )
        # Bind the identity link (Passport sub → platform_user) so the request-path access derivation
        # can resolve this user. Best-effort + async: it round-trips through Passport and syncs back,
        # so the link is not present on THIS request — see the known gap in the SSO plan (§ open item).
        report_identity_link_safe(auth_result["access_token"])
        return LoginResponse(
            user=UserRead.model_validate(user),
            access_token=auth_result["access_token"],
            refresh_token=auth_result["refresh_token"],
            expires_in=auth_result["expires_in"],
        )

    # --- Prepper-native login (SSO off — the reversible fallback) ---
    try:
        auth_result = auth_service.login(data.email, data.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    # Get user from database
    user = user_service.get_user(auth_result["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database",
        )

    # Report the identity link to Passport (best-effort, no-op if unconfigured). Forwards the
    # end user's own token — Passport takes sub + email from the verified claims.
    report_identity_link_safe(auth_result["access_token"])

    return LoginResponse(
        user=UserRead.model_validate(user),
        access_token=auth_result["access_token"],
        refresh_token=auth_result["refresh_token"],
        expires_in=auth_result["expires_in"],
    )


@router.post(
    "/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED
)
def register(
    data: RegisterRequest,
    session: Session = Depends(get_session),
) -> LoginResponse:
    """
    Register a new user in Supabase and local database.

    Returns:
        User info and access/refresh tokens
    """
    try:
        auth_service = get_auth_service()
    except (RuntimeError, ValueError) as e:
        print("/register | e", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_service = UserService(session)

    # Check if email already exists in database
    existing = user_service.get_user_by_email(data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    # Create user in Supabase
    try:
        supabase_user_id = auth_service.register(data.email, data.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )
    except RuntimeError as e:
        print("/register | user in Supabase Auth | e", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    # Create user in database. The row carries NO role and NO unit: registration cannot grant
    # anything. Roles live in Passport and are read per-brand at the point of the check, so a
    # self-registering user starts with access to nothing until Passport says otherwise.
    try:
        user_create = UserCreate(
            id=supabase_user_id,
            email=data.email,
            username=data.username,
        )
        user = user_service.create_user(user_create)
    except Exception as e:
        # User created in Supabase but failed in DB
        # This is a data consistency issue
        print("/register | user in db | e", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user in database",
        )

    # Login to get tokens
    try:
        auth_result = auth_service.login(data.email, data.password)
    except Exception:
        # User created but login failed - this is unexpected
        # Raise error to allow client to handle
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User created but failed to generate tokens. Please login separately.",
        )

    # Report the identity link to Passport (best-effort, no-op if unconfigured). Forwards the
    # end user's own token — Passport takes sub + email from the verified claims.
    report_identity_link_safe(auth_result["access_token"])

    return LoginResponse(
        user=UserRead.model_validate(user),
        access_token=auth_result["access_token"],
        refresh_token=auth_result["refresh_token"],
        expires_in=auth_result["expires_in"],
    )


@router.post("/oauth-complete", response_model=UserRead)
def oauth_complete(
    authorization: str | None = Header(None),
    session: Session = Depends(get_session),
) -> UserRead:
    """
    Complete an OAuth sign-in (e.g. Google via Supabase) by resolving or
    provisioning the local `users` row that corresponds to the Supabase user.

    Client flow: after `supabase.auth.exchangeCodeForSession(code)`, the
    browser holds a Supabase access_token. It calls this endpoint with
    `Authorization: Bearer <access_token>`. We verify the JWT, fetch the
    user's Supabase profile (email + `user_metadata`) and either return
    the existing DB row or create one seeded from the Google profile.

    A new row carries no role and no unit — Passport owns both, and they are read per-brand at
    the point of the check. Username is taken from `user_metadata.full_name`,
    `user_metadata.name`, or the email local-part — in that order.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.replace("Bearer ", "")

    try:
        auth_service = get_auth_service()
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_id = auth_service.verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_service = UserService(session)

    # Fast path: user already provisioned.
    existing = user_service.get_user(user_id)
    if existing:
        report_identity_link_safe(token)
        return UserRead.model_validate(existing)

    # Fetch Supabase profile for email + Google-supplied metadata.
    try:
        info = auth_service.get_user_info(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    email = info.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider did not supply an email address",
        )

    # Guard: a different Supabase user already owns this email locally.
    if user_service.get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    metadata = info.get("user_metadata") or {}
    username = (
        metadata.get("full_name")
        or metadata.get("name")
        or email.split("@", 1)[0]
    )

    try:
        user = user_service.create_user(
            UserCreate(
                id=user_id,
                email=email,
                username=username,
            )
        )
    except ValueError:
        # Race: someone else provisioned between our checks.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Report the identity link to Passport (best-effort, no-op if unconfigured). Forwards the
    # end user's own token — Passport takes sub + email from the verified claims.
    report_identity_link_safe(token)

    return UserRead.model_validate(user)


@router.post("/refresh-token", response_model=RefreshTokenResponse)
def refresh_token(data: TokenRequest) -> RefreshTokenResponse:
    """
    Refresh an expired access token using a refresh token.

    Returns:
        New access and refresh tokens
    """
    try:
        auth_service = get_auth_service()
        # A session minted by the SSO login-proxy carries a Passport refresh token, redeemable only
        # by Passport's GoTrue — so refresh must route to Passport when the proxy is active.
        if auth_service.sso_login_enabled:
            result = auth_service.refresh_via_passport(data.refresh_token)
        else:
            result = auth_service.refresh_token(data.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    return RefreshTokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        expires_in=result["expires_in"],
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(authorization: str | None = Header(None)) -> None:
    """
    Sign out the current user.

    Requires JWT in Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.replace("Bearer ", "")

    try:
        auth_service = get_auth_service()
        auth_service.logout(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except RuntimeError as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )


@router.get("/me", response_model=UserRead)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """
    Get current authenticated user's information.

    Requires JWT in Authorization header.
    """
    return UserRead.model_validate(current_user)
