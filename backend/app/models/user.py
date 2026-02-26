"""User model - represents authenticated users linked to Supabase auth."""

from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


class UserType(str, Enum):
    """User role type."""

    NORMAL = "normal"
    ADMIN = "admin"


class UserBase(SQLModel):
    """Shared fields for User."""

    email: str = Field(unique=True, index=True)
    username: str = Field(index=True)
    user_type: UserType = Field(default=UserType.NORMAL)
    is_manager: bool = Field(default=False, description="Can manage menus and other resources")
    outlet_id: int | None = Field(default=None, foreign_key="outlets.id")
    phone_number: str | None = Field(default=None, description="Optional phone number")


class User(UserBase, table=True):
    """
    Represents an authenticated user.

    - id matches the Supabase auth user ID (not auto-increment)
    - outlet_id links to the user's primary outlet
    - user_type determines role (normal or admin)
    """

    __tablename__ = "users"

    id: str = Field(primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserCreate(UserBase):
    """Schema for creating a user."""

    id: str  # Supabase user ID


class UserUpdate(SQLModel):
    """Schema for updating a user."""

    email: str | None = None
    username: str | None = None
    user_type: UserType | None = None
    is_manager: bool | None = None
    outlet_id: int | None = None
    phone_number: str | None = None


class UserRead(UserBase):
    """Schema for reading a user (API response)."""

    id: str
    is_manager: bool
    phone_number: str | None
    created_at: datetime
    updated_at: datetime
