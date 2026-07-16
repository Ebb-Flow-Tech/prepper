"""`GET /passport/organizations` — the orgs the caller may act in.

The only endpoint that returns org NAMES to the client. `passport.organization` has been projected
since the sync consumer landed but nothing ever read it, so the frontend has carried
`organization_id` on three payloads and had no way to render it.

Feeds the org switcher and Profile's Organisation section.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.conftest import (
    ORG_ID,
    create_user,
    grant_org_role,
    link_identity,
    seed_entitlement,
    store,
    use_user,
)

OTHER_ORG = "org-other"


def _org(session: Session, org_id: str, name: str, status: str = "active") -> None:
    store.apply_org(
        session,
        {"id": org_id, "name": name, "slug": name.lower().replace(" ", "-"),
         "status": status, "version": 1},
    )


def test_lists_the_callers_org_with_its_name_and_role(
    client: TestClient, session: Session
):
    """Name and org role together — Profile needs both, and they are one join apart."""
    _org(session, ORG_ID, "Mission Groups")

    response = client.get("/api/v1/passport/organizations")

    assert response.status_code == 200
    orgs = response.json()
    assert len(orgs) == 1
    assert orgs[0]["id"] == ORG_ID
    assert orgs[0]["name"] == "Mission Groups"
    assert orgs[0]["my_org_role"] == "Admin"  # the `client` fixture is an org admin


def test_lists_every_org_the_caller_belongs_to(client: TestClient, session: Session):
    """A multi-org user gets all of them — this is what the switcher switches between."""
    _org(session, ORG_ID, "Mission Groups")
    _org(session, OTHER_ORG, "Second Org")
    grant_org_role(session, "pu-test-admin", "Member", org_id=OTHER_ORG)
    seed_entitlement(session, OTHER_ORG)

    orgs = client.get("/api/v1/passport/organizations").json()

    assert {o["id"] for o in orgs} == {ORG_ID, OTHER_ORG}
    by_id = {o["id"]: o for o in orgs}
    assert by_id[ORG_ID]["my_org_role"] == "Admin"
    assert by_id[OTHER_ORG]["my_org_role"] == "Member", (
        "the role is read PER ORG — not the strongest across all of them"
    )


def test_does_not_list_an_org_the_caller_does_not_belong_to(
    client: TestClient, session: Session
):
    """Every org Passport delivers is projected, including ones this user has no membership in.

    Returning them would leak the tenant list of the whole platform.
    """
    _org(session, ORG_ID, "Mission Groups")
    _org(session, OTHER_ORG, "Someone Else's Org")

    orgs = client.get("/api/v1/passport/organizations").json()

    assert [o["id"] for o in orgs] == [ORG_ID]


def test_unlinked_user_resolves_by_email(client: TestClient, session: Session):
    """Same resolution as `get_org_context`, and for the same reason.

    A freshly-logged-in SSO user has no identity link yet (it syncs asynchronously). If this
    endpoint used the link alone it would return an empty list, the app shell would have no org to
    select, and the user could not proceed — while every other route would have resolved them fine.
    """
    _org(session, ORG_ID, "Mission Groups")
    store.apply_membership(
        session,
        {
            "id": "mem-sso",
            "organization_id": ORG_ID,
            "platform_user_id": "pu-sso",
            "role": "Member",
            "status": "active",
            "version": 1,
            "email": "chef@temper.sg",
            "display_name": "Chef",
        },
    )
    seed_entitlement(session, ORG_ID)
    use_user(client, create_user(session, "sso-user", "ssouser", email="chef@temper.sg"))

    orgs = client.get("/api/v1/passport/organizations").json()

    assert [o["id"] for o in orgs] == [ORG_ID]
    assert orgs[0]["my_org_role"] == "Member"


def test_user_with_no_passport_identity_gets_an_empty_list(
    client: TestClient, session: Session
):
    """Empty, not 403. The caller is authenticated; they simply belong to nothing.

    A 403 here would be indistinguishable from a bug to the client, and this endpoint exists to
    tell it what it may select — 'nothing' is a valid answer.
    """
    _org(session, ORG_ID, "Mission Groups")
    use_user(client, create_user(session, "stranger", "stranger", email="x@nowhere.com"))

    response = client.get("/api/v1/passport/organizations")

    assert response.status_code == 200
    assert response.json() == []


def test_a_removed_membership_confers_nothing(client: TestClient, session: Session):
    """Passport keeps a tombstone row when a membership is removed. It is not access."""
    _org(session, ORG_ID, "Mission Groups")
    _org(session, OTHER_ORG, "Left Behind")
    store.apply_membership(
        session,
        {
            "id": "mem-removed",
            "organization_id": OTHER_ORG,
            "platform_user_id": "pu-test-admin",
            "role": "Member",
            "status": "removed",
            "version": 1,
            "email": "admin@test.com",
            "display_name": "admin",
        },
    )

    orgs = client.get("/api/v1/passport/organizations").json()

    assert [o["id"] for o in orgs] == [ORG_ID]


def test_requires_authentication(session: Session):
    """It reports who you are — it cannot be public."""
    link_identity(session, "nobody", "pu-nobody")
    # Covered exhaustively by tests/test_default_deny_auth.py; asserted here so the endpoint's own
    # suite fails if it is ever added to the public allowlist.
    from app.api.deps import public_routes
    from app.config import get_settings

    assert ("GET", "/api/v1/passport/organizations") not in public_routes(get_settings())
