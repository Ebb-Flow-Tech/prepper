"""Tests for the Passport sync read-model projection.

These exercise the conformance-critical logic that lives in the pure-sync ``store`` and
``role_projection`` modules — the version guard (``>=``), trap 1 (removed keeps the row),
trap 2 (entitlement revocation via upsert), immutable insert-if-absent / delete-if-present,
and org role -> local ``user_type`` projection with grant revocation. None of this needs the
private ``passport_client`` SDK: the store operates on plain dicts and a SQLModel ``Session``.
"""

from types import SimpleNamespace
from unittest.mock import patch

from sqlmodel import Session, select

from app.models import (
    PassportEntitlement,
    PassportIdentityLink,
    PassportMembership,
    PassportOrganization,
    User,
    UserType,
)
from app.passport import access, role_projection, store

ORG = "org-1"
PU = "pu-1"          # Passport platform_user_id
SUBJECT = "sub-1"    # local users.id (== identity link subject)


def _org_values(*, version: int, name: str = "Acme", status: str = "active") -> dict:
    return {"id": ORG, "name": name, "slug": "acme", "status": status, "version": version}


def _membership_values(
    *, version: int, role: str = "Member", status: str = "active"
) -> dict:
    return {
        "id": "m-1",
        "organization_id": ORG,
        "platform_user_id": PU,
        "role": role,
        "status": status,
        "version": version,
        "email": "chef@acme.test",
        "display_name": "Chef",
    }


def _entitlement_values(*, version: int, status: str = "active") -> dict:
    return {
        "id": "e-1",
        "organization_id": ORG,
        "app_id": "prepper",
        "status": status,
        "tier": "pro",
        "source": "admin",
        "version": version,
    }


def _link_values() -> dict:
    return {
        "id": "l-1",
        "platform_user_id": PU,
        "app_id": "prepper",
        "subject": SUBJECT,
        "linked_via": "manual",
    }


# --- is_newer -----------------------------------------------------------------------------

def test_is_newer_is_greater_or_equal():
    assert store.is_newer(1, None) is True          # nothing stored
    assert store.is_newer(3, 2) is True             # strictly newer
    assert store.is_newer(2, 2) is True             # EQUAL re-applies (trap 3: >=, not >)
    assert store.is_newer(1, 2) is False            # older is dropped


# --- version guard on a mutable aggregate -------------------------------------------------

def test_org_upsert_inserts_then_version_guards(session: Session):
    store.apply_org(session, _org_values(version=2, name="Acme"))
    row = session.get(PassportOrganization, ORG)
    assert row is not None and row.name == "Acme" and row.version == 2

    # Older event is a no-op.
    store.apply_org(session, _org_values(version=1, name="STALE"))
    session.expire_all()
    row = session.get(PassportOrganization, ORG)
    assert row.name == "Acme" and row.version == 2

    # Equal-version replay re-applies idempotently (proves >= rather than >).
    store.apply_org(session, _org_values(version=2, name="Acme-Replayed"))
    session.expire_all()
    row = session.get(PassportOrganization, ORG)
    assert row.name == "Acme-Replayed" and row.version == 2

    # Newer event applies.
    store.apply_org(session, _org_values(version=3, name="Acme-New"))
    session.expire_all()
    row = session.get(PassportOrganization, ORG)
    assert row.name == "Acme-New" and row.version == 3


# --- trap 1: membership.removed keeps the row ---------------------------------------------

def test_membership_removed_keeps_row_as_tombstone(session: Session):
    store.apply_membership(session, _membership_values(version=1, status="active"))
    assert session.get(PassportMembership, "m-1").status == "active"

    # "removed" arrives as a version-guarded upsert carrying status=removed — NOT a delete.
    store.apply_membership(session, _membership_values(version=2, status="removed"))
    session.expire_all()
    row = session.get(PassportMembership, "m-1")
    assert row is not None, "removed membership must be KEPT as a tombstone (trap 1)"
    assert row.status == "removed" and row.version == 2

    # Replay of the removal is idempotent (still present, unchanged).
    store.apply_membership(session, _membership_values(version=2, status="removed"))
    session.expire_all()
    assert session.get(PassportMembership, "m-1").status == "removed"


# --- trap 2: entitlement revocation arrives as an upsert ----------------------------------

def test_entitlement_revocation_is_applied_not_filtered(session: Session):
    store.apply_entitlement(session, _entitlement_values(version=1, status="active"))
    assert session.get(PassportEntitlement, "e-1").status == "active"

    # Revocation is an entitlement.upserted with status != active — must be applied.
    store.apply_entitlement(session, _entitlement_values(version=2, status="inactive"))
    session.expire_all()
    assert session.get(PassportEntitlement, "e-1").status == "inactive"


# --- immutable aggregate: insert-if-absent / delete-if-present ----------------------------

def test_identity_link_insert_if_absent_and_delete(session: Session):
    store.create_identity_link(session, _link_values())
    assert session.get(PassportIdentityLink, "l-1") is not None

    # Insert-if-absent: a duplicate delivery is a no-op, not an error.
    store.create_identity_link(session, _link_values())
    assert (
        len(session.exec(select(PassportIdentityLink)).all()) == 1
    )

    store.remove_identity_link(session, "l-1")
    assert session.get(PassportIdentityLink, "l-1") is None

    # Delete-if-present: removing an absent link is a no-op.
    store.remove_identity_link(session, "l-1")


# --- role projection ----------------------------------------------------------------------

def _seed_user(session: Session) -> User:
    user = User(
        id=SUBJECT,
        email="chef@acme.test",
        username="chef",
        user_type=UserType.NORMAL,
        is_manager=True,
        outlet_id=7,
    )
    session.add(user)
    session.commit()
    return user


def test_project_role_noop_without_identity_link(session: Session):
    _seed_user(session)
    store.apply_membership(session, _membership_values(version=1, role="Admin"))
    # No identity link yet -> membership can't resolve to a local user -> no change.
    role_projection.project_role(session, platform_user_id=PU, org_id=ORG)
    session.expire_all()
    assert session.get(User, SUBJECT).user_type == UserType.NORMAL


def test_project_role_maps_admin_and_member(session: Session):
    _seed_user(session)
    store.create_identity_link(session, _link_values())

    store.apply_membership(session, _membership_values(version=1, role="Member"))
    role_projection.project_role(session, platform_user_id=PU, org_id=ORG)
    session.expire_all()
    assert session.get(User, SUBJECT).user_type == UserType.NORMAL

    store.apply_membership(session, _membership_values(version=2, role="Admin"))
    role_projection.project_role(session, platform_user_id=PU, org_id=ORG)
    session.expire_all()
    assert session.get(User, SUBJECT).user_type == UserType.ADMIN


def test_removed_membership_demotes_and_revokes_grants(session: Session):
    _seed_user(session)
    store.create_identity_link(session, _link_values())
    store.apply_membership(session, _membership_values(version=1, role="Admin"))
    role_projection.project_role(session, platform_user_id=PU, org_id=ORG)
    session.expire_all()
    assert session.get(User, SUBJECT).user_type == UserType.ADMIN

    # Membership removed -> keep tombstone, demote to normal, revoke unit-scoped grants.
    store.apply_membership(session, _membership_values(version=2, status="removed"))
    role_projection.project_role(session, platform_user_id=PU, org_id=ORG)
    role_projection.revoke_local_grants(session, platform_user_id=PU)
    session.expire_all()

    user = session.get(User, SUBJECT)
    assert user.user_type == UserType.NORMAL
    assert user.is_manager is False
    assert user.outlet_id is None
    # The membership row itself is kept as a tombstone.
    assert session.get(PassportMembership, "m-1").status == "removed"


# --- entitlement kill switch (request-path gate) ------------------------------------------

def _with_org(org_id):
    """Patch the access gate's settings to a given configured org id."""
    return patch.object(
        access, "get_settings", return_value=SimpleNamespace(passport_org_id=org_id)
    )


def test_org_not_blocked_when_passport_unconfigured(session: Session):
    # Even with a revoked entitlement present, an unconfigured org fails open.
    store.apply_entitlement(session, _entitlement_values(version=1, status="inactive"))
    with _with_org(None):
        assert access.is_org_blocked(session) is False


def test_org_not_blocked_when_no_entitlement_synced(session: Session):
    # Configured org but no entitlement rows yet -> fail open (do not block).
    with _with_org(ORG):
        assert access.is_org_blocked(session) is False


def test_org_blocked_when_entitlement_inactive(session: Session):
    store.apply_entitlement(session, _entitlement_values(version=1, status="active"))
    with _with_org(ORG):
        assert access.is_org_blocked(session) is False

    # Kill switch thrown: entitlement flips non-active -> whole org blocked.
    store.apply_entitlement(session, _entitlement_values(version=2, status="suspended"))
    session.expire_all()
    with _with_org(ORG):
        assert access.is_org_blocked(session) is True

    # Restored -> unblocked.
    store.apply_entitlement(session, _entitlement_values(version=3, status="active"))
    session.expire_all()
    with _with_org(ORG):
        assert access.is_org_blocked(session) is False
