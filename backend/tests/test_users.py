"""User routes.

These routes carried no authorisation at all: before default-deny they needed no token, and even
with one, any caller could PATCH any user's row. Authentication is now handled by the global gate
(tests/test_default_deny_auth.py); this file pins the AUTHORISATION that gate cannot express —
a user may edit only themselves.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.conftest import create_user, use_user


def test_user_can_update_their_own_row(client: TestClient, session: Session):
    """The registration path (`register/page.tsx`) PATCHes the caller's own row to set a phone."""
    user = use_user(client, create_user(session, "self-user", "selfuser"))

    response = client.patch(
        f"/api/v1/users/{user.id}", json={"phone_number": "+6591234567"}
    )

    assert response.status_code == 200
    assert response.json()["phone_number"] == "+6591234567"


def test_user_cannot_update_another_users_row(client: TestClient, session: Session):
    """A user id is the only thing standing between a caller and someone else's account.

    The route took a `user_id` from the path and wrote to it with no check that it belonged to the
    caller — so any authenticated user could rewrite any other user's email or phone.
    """
    victim = create_user(session, "victim-user", "victim")
    use_user(client, create_user(session, "attacker-user", "attacker"))

    response = client.patch(
        f"/api/v1/users/{victim.id}", json={"phone_number": "+6500000000"}
    )

    assert response.status_code == 403

    session.refresh(victim)
    assert victim.phone_number != "+6500000000", "the victim's row must be untouched"
