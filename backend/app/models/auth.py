"""Authentication request/response models."""

from pydantic import BaseModel, Field

from app.models.user import UserRead

# RFC 5321 4.5.3.1.3 caps a forward-path — and so, in practice, an email address — at 320 octets.
# Applied by every unauthenticated route that takes one, so the bound cannot drift between the
# routing decision, the login it routes to, and the recovery flow that must be indistinguishable
# from it.
EMAIL_MAX_LENGTH = 320


class LoginRequest(BaseModel):
    """Request schema for the app-native login endpoint.

    ``email`` is capped like its siblings. It was the one front-door route that was not, so a
    5000-octet string reached the unauthenticated membership lookup and came back 400 rather than
    422 — an uncapped field feeding a database query on a route reachable without a token.
    """

    email: str = Field(max_length=EMAIL_MAX_LENGTH)
    password: str


class LoginResponse(BaseModel):
    """Response schema for the app-native login endpoint.

    Still carries ``refresh_token``: the browser hands both tokens to its Supabase client via
    ``setSession``, and the CLIENT owns refresh from then on. There is no ``/auth/refresh-token``
    endpoint any more — a backend that redeems refresh tokens is a second session authority, and
    under Model 3 the only one that matters is the issuer's.
    """

    user: UserRead
    access_token: str
    refresh_token: str
    expires_in: int
