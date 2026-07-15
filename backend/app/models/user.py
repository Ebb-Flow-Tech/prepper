"""User model — Prepper's own authenticated account (Supabase auth).

RULE 8: this row carries NO ROLE. `user_type`, `is_manager` and `outlet_id` are deleted.

- The org role (`Owner`|`Admin`|`Member`) and the brand-app role (`Manager`|`Staff`) are Passport's
  vocabulary, and they are READ PER-BRAND at the point of the check (`app.passport.access`), never
  denormalised onto this row. A projected role goes stale the moment Passport changes it, and
  nothing tells you.
- A person may hold DIFFERENT roles at different brands. A single global flag cannot express that,
  which is exactly why `is_manager` had to go: it granted at every brand what was granted at one.
- Structure scope (`outlet_id`) is gone too — a user's reach is derived from the brands they hold a
  role at (`access.accessible_unit_ids`), not stored here.

What remains is genuinely Prepper's: the login identity and personal details. `id` is the Supabase
`sub` — Prepper is still its own identity provider (Passport SSO is deferred; `passport_identity_link`
is the bridge).
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class UserBase(SQLModel):
    """Shared fields for User."""

    email: str = Field(unique=True, index=True)
    username: str = Field(index=True)
    phone_number: str | None = Field(default=None, description="Optional phone number")


class User(UserBase, table=True):
    """An authenticated Prepper user. `id` matches the Supabase auth user id."""

    __tablename__ = "users"

    id: str = Field(primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserCreate(UserBase):
    """Schema for creating a user."""

    id: str  # Supabase user ID


class UserUpdate(SQLModel):
    """Schema for updating a user. Roles are NOT settable here — Passport owns them."""

    email: str | None = None
    username: str | None = None
    phone_number: str | None = None


class UserRead(UserBase):
    """Schema for reading a user (API response)."""

    id: str
    phone_number: str | None
    created_at: datetime
    updated_at: datetime
