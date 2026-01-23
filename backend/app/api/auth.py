"""Authentication API endpoints.

Provides login, register, logout, token refresh, and user info endpoints.
Orchestrates between SupabaseAuthService and UserService.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.domain.supabase_auth_service import SupabaseAuthService
from app.domain.user_service import UserService
from app.models import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    TokenRequest,
    RefreshTokenResponse,
    UserCreate,
    UserRead,
    UserType,
)

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
        auth_service = SupabaseAuthService()
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_service = UserService(session)

    try:
        # Login via Supabase
        auth_result = auth_service.login(data.email, data.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password",
        )
    except RuntimeError as e:
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
        auth_service = SupabaseAuthService()
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

    # Create user in database
    try:
        user_create = UserCreate(
            id=supabase_user_id,
            email=data.email,
            username=data.username,
            user_type=UserType(data.user_type),
            outlet_id=data.outlet_id,
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
    except Exception as e:
        # User created but login failed - this is unexpected
        # Raise error to allow client to handle
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User created but failed to generate tokens. Please login separately.",
        )

    return LoginResponse(
        user=UserRead.model_validate(user),
        access_token=auth_result["access_token"],
        refresh_token=auth_result["refresh_token"],
        expires_in=auth_result["expires_in"],
    )


@router.post("/refresh-token", response_model=RefreshTokenResponse)
def refresh_token(data: TokenRequest) -> RefreshTokenResponse:
    """
    Refresh an expired access token using a refresh token.

    Returns:
        New access and refresh tokens
    """
    try:
        auth_service = SupabaseAuthService()
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
        auth_service = SupabaseAuthService()
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
    authorization: str | None = Header(None),
    session: Session = Depends(get_session),
) -> UserRead:
    """
    Get current authenticated user's information.

    Requires JWT in Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.replace("Bearer ", "")

    try:
        auth_service = SupabaseAuthService()
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    user_service = UserService(session)

    # Verify token and get user ID
    user_id = auth_service.verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Get user from database
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserRead.model_validate(user)
