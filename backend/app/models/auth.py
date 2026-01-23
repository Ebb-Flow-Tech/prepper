"""Authentication request/response models."""

from pydantic import BaseModel

from app.models.user import UserRead


class LoginRequest(BaseModel):
    """Request schema for login endpoint."""

    email: str
    password: str


class RegisterRequest(BaseModel):
    """Request schema for register endpoint."""

    email: str
    password: str
    username: str
    user_type: str = "normal"
    outlet_id: int | None = None


class LoginResponse(BaseModel):
    """Response schema for login and register endpoints."""

    user: UserRead
    access_token: str
    refresh_token: str
    expires_in: int


class TokenRequest(BaseModel):
    """Request schema for refresh token endpoint."""

    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Response schema for refresh token endpoint."""

    access_token: str
    refresh_token: str
    expires_in: int
