"""Tests for the Passport sync read-model projection.

These exercise the conformance-critical logic that lives in the pure-sync ``store`` and
``role_projection`` modules — the version guard (``>=``), trap 1 (removed keeps the row),
trap 2 (entitlement revocation via upsert), immutable insert-if-absent / delete-if-present,
and org role -> local ``user_type`` projection with grant revocation. None of this needs the
private ``passport_client`` SDK: the store operates on plain dicts and a SQLModel ``Session``.
"""

import asyncio
from types import SimpleNamespace

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




def test_removed_membership_revokes_local_grants_and_keeps_the_tombstone(session: Session):
    """RULE 6 — a removed member loses their local unit-scoped grants.

    It does NOT demote `user_type`: that projection was a rule-8 violation (it conflated the org
    vocabulary with Prepper's) and is deleted. Roles are read per-brand at the point of the check
    now, so there is nothing to demote. Revocation survives because it can only ever REDUCE access,
    which is the direction that is always safe.
    """
    _seed_user(session)
    store.create_identity_link(session, _link_values())
    store.apply_membership(session, _membership_values(version=1, role="Admin"))

    user = session.get(User, SUBJECT)
    user.is_manager = True
    session.add(user)
    session.commit()

    store.apply_membership(session, _membership_values(version=2, status="removed"))
    role_projection.revoke_local_grants(session, platform_user_id=PU)
    session.expire_all()

    user = session.get(User, SUBJECT)
    assert user.is_manager is False, "rule 6: unit-scoped grants are revoked"
    assert user.outlet_id is None
    # TRAP 1: the membership row is KEPT as a tombstone, never deleted.
    assert session.get(PassportMembership, "m-1").status == "removed"


# --- entitlement kill switch (request-path gate) ------------------------------------------

def _link_member(session: Session) -> None:
    """Link SUBJECT -> PU and make them an active member of ORG.

    Rule 9: the kill switch is evaluated against the orgs the USER actually belongs to, resolved
    from the projection — there is no configured org to patch.
    """
    store.create_identity_link(session, _link_values())
    store.apply_membership(session, _membership_values(version=1))


def test_org_not_blocked_when_user_is_not_linked(session: Session):
    # Even with a revoked entitlement present, an unlinked user fails open: Passport is not yet
    # authoritative for them, so turning the projection on must not lock them out.
    store.apply_entitlement(session, _entitlement_values(version=1, status="inactive"))
    assert access.is_org_blocked(session, SUBJECT) is False


def test_org_not_blocked_when_no_entitlement_synced(session: Session):
    # Linked member, but no entitlement rows yet -> fail open (do not block).
    _link_member(session)
    assert access.is_org_blocked(session, SUBJECT) is False


def test_org_blocked_when_entitlement_inactive(session: Session):
    _link_member(session)
    store.apply_entitlement(session, _entitlement_values(version=1, status="active"))
    assert access.is_org_blocked(session, SUBJECT) is False

    # Kill switch thrown: entitlement flips non-active -> the user's whole org is blocked.
    store.apply_entitlement(session, _entitlement_values(version=2, status="suspended"))
    session.expire_all()
    assert access.is_org_blocked(session, SUBJECT) is True

    # Restored -> unblocked. TRAP 2: revocation deletes nothing, so restoring is lossless.
    store.apply_entitlement(session, _entitlement_values(version=3, status="active"))
    session.expire_all()
    assert access.is_org_blocked(session, SUBJECT) is False


# --- resync_org fan-out (the manual re-sync bundle, SDK 0.2.0+) ---------------------------

def _record_handlers(monkeypatch, handlers_obj, names):
    """Replace each named per-aggregate handler on ``handlers_obj`` with a coroutine that
    records its name in call order. Returns the shared call log."""
    calls: list[str] = []

    def _make(name):
        async def _f(_payload):
            calls.append(name)
        return _f

    for name in names:
        monkeypatch.setattr(handlers_obj, name, _make(name))
    return calls


_ALL_HANDLER_NAMES = (
    "upsert_org", "upsert_unit", "create_relation", "upsert_membership",
    "create_identity_link", "upsert_entitlement",
    "create_unit_app_access", "upsert_unit_app_membership",
    "remove_membership", "remove_identity_link", "remove_relation",
    "remove_unit_app_access", "remove_unit_app_membership",
)

_REMOVAL_HANDLERS = {
    "remove_membership",
    "remove_identity_link",
    "remove_relation",
    "remove_unit_app_access",
    "remove_unit_app_membership",
}


def _resync_bundle(*, org_id=ORG, memberships=1):
    return SimpleNamespace(
        app_id="prepper",
        org_id=org_id,
        resync_id="resync-1",
        triggered_by=None,
        organizations=[SimpleNamespace()],
        units=[SimpleNamespace()],
        unit_relations=[SimpleNamespace()],
        memberships=[SimpleNamespace() for _ in range(memberships)],
        identity_links=[SimpleNamespace()],
        entitlements=[SimpleNamespace()],
        unit_app_accesses=[SimpleNamespace()],
        unit_app_memberships=[SimpleNamespace()],
    )


def test_resync_org_fans_out_in_fk_order_upsert_only(monkeypatch):
    from app.passport import handlers as handlers_mod

    h = handlers_mod.PassportHandlers()
    calls = _record_handlers(monkeypatch, h, _ALL_HANDLER_NAMES)

    asyncio.run(h.resync_org(_resync_bundle(memberships=2)))

    # FK-safe order across all EIGHT collections: the brand-app switch must land before the
    # role row that depends on it, and the role row references a unit, a user and an app.
    assert calls == [
        "upsert_org",
        "upsert_unit",
        "create_relation",
        "upsert_membership",
        "upsert_membership",
        "create_identity_link",
        "upsert_entitlement",
        "create_unit_app_access",
        "upsert_unit_app_membership",
    ]
    # TRAP 3: upsert-only — a resync never deletes / removes local rows.
    assert not (_REMOVAL_HANDLERS & set(calls))


def test_resync_org_applies_every_org_it_is_delivered(monkeypatch):
    """RULE 9 — a bundle for another org is APPLIED, not dropped.

    This test previously asserted the opposite (drop anything != the configured org). That filter
    was the single-org bug: Prepper receives events for every org it is entitled to, and discarding
    a "foreign" org's bundle silently puts permanent holes in the read model. Nothing errors when
    it does.
    """
    from app.passport import handlers as handlers_mod

    h = handlers_mod.PassportHandlers()
    calls = _record_handlers(monkeypatch, h, _ALL_HANDLER_NAMES)

    asyncio.run(h.resync_org(_resync_bundle(org_id="other-org")))

    assert calls, "a bundle for another entitled org must be projected, not dropped"
    assert not (_REMOVAL_HANDLERS & set(calls)), "resync is upsert-only"
