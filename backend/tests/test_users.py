"""User routes.

These routes carried no authorisation at all: before default-deny they needed no token, and even
with one, any caller could PATCH any user's row. Authentication is now handled by the global gate
(tests/test_default_deny_auth.py); this file pins the AUTHORISATION that gate cannot express —
a user may edit only themselves.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.domain.user_service import UserService
from app.models import User
from tests.conftest import (
    ORG_ID,
    create_user,
    grant_org_role,
    link_identity,
    use_user,
)


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


def test_a_user_cannot_change_their_own_email(client: TestClient, session: Session):
    """Email is IDENTITY, not a profile field — and Passport resolves org membership by it.

    `deps._platform_user_for` falls back to matching `users.email` against
    `passport.membership.email` when no identity link has synced yet. That makes a self-writable
    email a way to inherit someone else's Passport identity:

        PATCH /users/{me} {"email": "ceo@corp.com"}   -> 200
        GET  /passport/organizations                  -> the CEO's orgs, with their org role

    The attacker needs no identity link — and never gets one, because links are only written for
    real Passport members. So the fallback fires permanently for exactly the accounts that must
    never resolve.

    `UserUpdate` says "Roles are NOT settable here — Passport owns them". Email is now the same
    kind of field, for the same reason.
    """
    user = use_user(client, create_user(session, "attacker", "attacker", email="nobody@x.com"))

    response = client.patch(
        f"/api/v1/users/{user.id}", json={"email": "ceo@corp.com"}
    )

    assert response.status_code == 422, "email must not be settable through the profile route"

    session.refresh(user)
    assert user.email == "nobody@x.com", "the email must be unchanged"


def test_a_user_can_still_update_their_profile_fields(client: TestClient, session: Session):
    """Blocking email must not lock the profile — the registration path sets a phone here."""
    user = use_user(client, create_user(session, "self2", "self2", email="me@x.com"))

    response = client.patch(
        f"/api/v1/users/{user.id}",
        json={"username": "newname", "phone_number": "+6591234567"},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "newname"
    assert response.json()["phone_number"] == "+6591234567"


# =============================================================================
# Cross-tenant PII
# =============================================================================


def test_list_users_does_not_leak_another_orgs_people(client: TestClient, session: Session):
    """`GET /users` returned EVERY user in the instance — email, username, phone number.

    Unscoped and unpaginated: any authenticated user could enumerate every tenant's staff, and the
    result is the reconnaissance step for anything that keys on a person. `directory.assignable_members`
    has always scoped this correctly; this route never did.
    """
    from tests.conftest import grant_org_role, link_identity, seed_entitlement

    # Someone in a completely unrelated org.
    create_user(session, "outsider", "outsider", email="outsider@other.com")
    link_identity(session, "outsider", "pu-outsider")
    grant_org_role(session, "pu-outsider", "Member", org_id="org-other")
    seed_entitlement(session, "org-other")

    body = client.get("/api/v1/users").text

    assert "outsider@other.com" not in body, "another org's people must not be listed"


def test_list_users_returns_my_own_org(client: TestClient, session: Session):
    """The happy path: an org admin still sees their own org's members."""
    from tests.conftest import grant_org_role, link_identity

    create_user(session, "colleague", "colleague", email="colleague@test.com")
    link_identity(session, "colleague", "pu-colleague")
    grant_org_role(session, "pu-colleague", "Member", org_id=ORG_ID)

    emails = [u["email"] for u in client.get("/api/v1/users").json()["items"]]

    assert "colleague@test.com" in emails


def test_list_users_is_paginated(client: TestClient, session: Session):
    """An unbounded list endpoint violates performance.md and hands over the whole table at once."""
    response = client.get("/api/v1/users?page_size=1")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body and "total_count" in body, "must return a paginated envelope"
    assert len(body["items"]) <= 1


def test_email_lookup_does_not_confirm_another_orgs_user(
    client: TestClient, session: Session
):
    """`?email=` is a targeted oracle: it must not confirm a person exists in another tenant."""
    from tests.conftest import grant_org_role, link_identity, seed_entitlement

    create_user(session, "outsider", "outsider", email="outsider@other.com")
    link_identity(session, "outsider", "pu-outsider")
    grant_org_role(session, "pu-outsider", "Member", org_id="org-other")
    seed_entitlement(session, "org-other")

    body = client.get("/api/v1/users?email=outsider@other.com").json()

    assert body["items"] == []


# --- /users/accounts: the org roster, from Passport, joined to local accounts ------------------
# `GET /users` scopes local `users` rows THROUGH the identity link, so it shows only people who
# have signed in via Passport SSO. On staging that is 1 of 20 active members — the other 19 are
# invisible to everybody. That scoping is correct and stays; it is simply the wrong QUESTION for a
# roster. The authoritative list of people in an org is Passport's membership, which embeds email,
# display name and role for everyone, signed in or not.
#
# `users` has no organization_id and must not get one, so the scope is a JOIN, and the local row is
# a LEFT join: someone who has never signed in has no link, no local row, and still belongs here.


def _caller(session: Session) -> User:
    user = create_user(session, "caller", "caller", email="caller@acme.test")
    link_identity(session, user.id, "pu-caller")
    grant_org_role(session, "pu-caller", "Admin")
    return user


def test_member_who_never_signed_in_appears_with_no_local_account(session: Session):
    caller = _caller(session)
    grant_org_role(session, "pu-ghost", "Member")  # no identity link, no users row

    rows, total = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    ghost = next(r for r in rows if r["platform_user_id"] == "pu-ghost")
    assert ghost["user_id"] is None
    assert ghost["phone_number"] is None
    assert ghost["email"] == "pu-ghost@test.com"  # from the membership, which EMBEDS it
    assert ghost["org_role"] == "Member"
    assert total == 2


def test_local_user_with_no_membership_does_not_appear(session: Session):
    """Nothing places them in an org, so nothing may show them in one."""
    caller = _caller(session)
    create_user(session, "stranger", "stranger", email="stranger@acme.test")

    rows, _ = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    assert "stranger@acme.test" not in {r["email"] for r in rows}
    assert "stranger" not in {r["user_id"] for r in rows}


def test_linked_member_carries_their_local_account(session: Session):
    caller = _caller(session)
    chef = create_user(
        session, "chef", "chef", email="chef@acme.test", phone_number="+61400000000"
    )
    link_identity(session, chef.id, "pu-chef")
    grant_org_role(session, "pu-chef", "Member")

    rows, _ = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    row = next(r for r in rows if r["platform_user_id"] == "pu-chef")
    assert row["user_id"] == chef.id
    assert row["phone_number"] == "+61400000000"
    assert row["username"] == "chef"


def test_accounts_never_leak_another_org(session: Session):
    caller = _caller(session)
    grant_org_role(session, "pu-rival", "Owner", org_id="org-b")

    rows, _ = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    assert "pu-rival" not in {r["platform_user_id"] for r in rows}


def test_accounts_fail_closed_for_an_org_that_is_not_the_callers(session: Session):
    """A forged org id returns NOBODY, not everybody."""
    caller = _caller(session)

    rows, total = UserService(session).list_org_member_accounts(
        caller.id, "org-not-mine", offset=0, limit=30
    )

    assert rows == []
    assert total == 0


def test_accounts_fail_closed_for_an_unlinked_caller(session: Session):
    caller = create_user(session, "loner", "loner", email="loner@acme.test")  # no link
    grant_org_role(session, "pu-other", "Member")

    rows, total = UserService(session).list_org_member_accounts(
        caller.id, ORG_ID, offset=0, limit=30
    )

    assert rows == []
    assert total == 0
