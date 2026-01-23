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
    outlet_id: int | None = Field(default=None, foreign_key="outlets.id")


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
    outlet_id: int | None = None


class UserRead(UserBase):
    """Schema for reading a user (API response)."""

    id: str
    created_at: datetime
    updated_at: datetime
