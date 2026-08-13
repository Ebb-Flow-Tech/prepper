"""D6 — derived access is checked on the REQUEST path, not only at the door.

The login gate answers "may this person be here?" once, at a moment that is stale the instant a
role is revoked. Without this gate a session minted before the revocation keeps working until its
token expires; with it, every request re-derives.

It **fails open** wherever Passport is not yet authoritative for the caller — no identity link, no
org, or no entitlement synced. That is the same rule `is_org_blocked` and the Model 3 callback
already follow, and it is what stops switching the projection on from locking out every real user
before the data lands.

Only reachable with the real gate running, so these tests use `anon_client` (session overrides
only) — `conftest._override_deps` stubs `require_auth` itself and would certify nothing.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.conftest import (
    MANAGER,
    create_user,
    grant_brand_role,
    grant_org_role,
    link_identity,
    seed_brand,
    seed_entitlement,
)

# A gated route that scopes nothing: it needs an authenticated user and no active org, so a
# refusal here can only have come from the gate under test.
GATED_ROUTE = "/api/v1/auth/me"

SUBJECT = "u-gate"
PLATFORM_USER_ID = "pu-gate"


@pytest.fixture(name="gate_client")
def gate_client_fixture(anon_client: TestClient):
    """A client whose bearer token verifies to `SUBJECT` — and nothing else stubbed.

    The token is a PREPPER-issued one (the Passport verify path returns None), so these tests
    exercise the gate for the ordinary request, not just the SSO seam.
    """
    verified = SimpleNamespace(
        verify_passport_identity=lambda _token: None,
        verify_token=lambda _token: SUBJECT,
    )
    with patch("app.api.deps.get_auth_service", return_value=verified):
        yield anon_client


def _call(client: TestClient):
    return client.get(GATED_ROUTE, headers={"Authorization": "Bearer tok"})


def test_a_member_with_derived_access_passes(gate_client: TestClient, session: Session) -> None:
    create_user(session, SUBJECT, "chef")
    link_identity(session, SUBJECT, PLATFORM_USER_ID)
    grant_org_role(session, PLATFORM_USER_ID, "Member")
    seed_entitlement(session)
    grant_brand_role(session, PLATFORM_USER_ID, seed_brand(session), MANAGER)

    assert _call(gate_client).status_code == 200


def test_a_member_without_derived_access_is_refused(
    gate_client: TestClient, session: Session
) -> None:
    """Entitled org, but no brand carries the Prepper switch and the member holds no role — the
    derivation is empty, so the answer is 403 rather than an application with nothing in it."""
    create_user(session, SUBJECT, "chef")
    link_identity(session, SUBJECT, PLATFORM_USER_ID)
    grant_org_role(session, PLATFORM_USER_ID, "Member")
    seed_entitlement(session)

    response = _call(gate_client)
    assert response.status_code == 403
    assert "access" in response.json()["detail"].lower()


def test_an_unlinked_user_with_no_synced_entitlement_passes(
    gate_client: TestClient, session: Session
) -> None:
    """The fail-open half, and the reason this gate can ship before the projection has landed.

    Nothing is seeded, so Passport is not authoritative for this caller at all. Refusing here
    would lock out every user of an environment whose sync has not run yet.
    """
    create_user(session, SUBJECT, "chef")

    assert _call(gate_client).status_code == 200


def test_a_member_whose_org_has_no_entitlement_yet_passes(
    gate_client: TestClient, session: Session
) -> None:
    """Linked and a member, but no entitlement row has synced for the org. Same fail-open —
    "no data" must never be read as "no access"."""
    create_user(session, SUBJECT, "chef")
    link_identity(session, SUBJECT, PLATFORM_USER_ID)
    grant_org_role(session, PLATFORM_USER_ID, "Member")

    assert _call(gate_client).status_code == 200


class TestThePassportIssuerPath:
    """The gate must hold for a PASSPORT-issued token too — the case D6 chiefly exists for.

    The fixture above stubs `verify_passport_identity` to None, so everything before this class
    only ever exercised a Prepper-issued token. That is the easier half: under Model 3 the session
    minted by the callback is Passport's, so a revoked member's live session arrives here on the
    Passport branch, resolved by verified email rather than by local sub. A gate that only covered
    the Prepper branch would look complete and cover almost nothing that ships.
    """

    @staticmethod
    def _passport_client(anon_client: TestClient):
        verified = SimpleNamespace(
            # A Passport-signed token: its `sub` is Passport's, and the local row is resolved by
            # the VERIFIED email — not by this sub, which this app has never seen.
            verify_passport_identity=lambda _token: ("S_passport_sub", "chef@brand.test"),
            verify_token=lambda _token: None,
        )
        return patch("app.api.deps.get_auth_service", return_value=verified)

    def test_a_member_with_derived_access_passes(
        self, anon_client: TestClient, session: Session
    ) -> None:
        create_user(session, SUBJECT, "chef", email="chef@brand.test")
        link_identity(session, SUBJECT, PLATFORM_USER_ID)
        grant_org_role(session, PLATFORM_USER_ID, "Member")
        seed_entitlement(session)
        grant_brand_role(session, PLATFORM_USER_ID, seed_brand(session), MANAGER)

        with self._passport_client(anon_client):
            assert _call(anon_client).status_code == 200

    def test_a_member_whose_access_was_revoked_is_refused_mid_session(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """The scenario D6 is for. The token is still valid and still Passport's — Prepper cannot
        shorten its life — so only a per-request derivation can notice that the brand role backing
        it is gone."""
        create_user(session, SUBJECT, "chef", email="chef@brand.test")
        link_identity(session, SUBJECT, PLATFORM_USER_ID)
        grant_org_role(session, PLATFORM_USER_ID, "Member")
        seed_entitlement(session)  # entitled, but no brand role and no ladder

        with self._passport_client(anon_client):
            response = _call(anon_client)

        assert response.status_code == 403
        assert "access" in response.json()["detail"].lower()

    def test_a_member_before_entitlements_sync_still_passes(
        self, anon_client: TestClient, session: Session
    ) -> None:
        """Fail-open holds on this branch too, or flipping the projection on locks out every
        member whose session came from the callback."""
        create_user(session, SUBJECT, "chef", email="chef@brand.test")
        link_identity(session, SUBJECT, PLATFORM_USER_ID)
        grant_org_role(session, PLATFORM_USER_ID, "Member")

        with self._passport_client(anon_client):
            assert _call(anon_client).status_code == 200
