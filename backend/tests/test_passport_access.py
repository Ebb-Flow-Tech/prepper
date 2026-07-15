"""Tests for the DERIVED app-access model — the four ``unit_app_*`` facts and the ladder.

App access is derived from the entitlement, the org role, the brand-app switch
(``unit_app_access``) and the (user, brand, app) role row (``unit_app_membership``). There is
no per-user app grant. Everything here fails SILENTLY when it is wrong — a misnamed handler is
a no-op, a forgotten ``org_role`` denies every Owner — so these are the only checks that catch
it.
"""


from sqlmodel import Session, select

from app.models import (
    PassportUnitAppAccess,
    PassportUnitAppMembership,
)
from app.passport import access, store

ORG = "org-1"
PU = "pu-1"          # Passport platform_user_id
SUBJECT = "sub-1"    # local users.id (== identity link subject)
BRAND = "brand-1"


def _membership_values(*, version: int, role: str = "Member", status: str = "active") -> dict:
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


def _unit_values(
    *,
    version: int,
    unit_id: str = BRAND,
    type: str = "brand",
    status: str = "active",
    external_ref: str | None = None,
) -> dict:
    return {
        "id": unit_id,
        "organization_id": ORG,
        "type": type,
        "name": "Coffee Shop",
        "external_ref": external_ref,
        "status": status,
        "version": version,
    }


def _app_access_values(*, unit_id: str = BRAND, access_id: str = "uaa-1") -> dict:
    return {
        "id": access_id,
        "organization_id": ORG,
        "unit_id": unit_id,
        "app_id": "prepper",
    }


def _role_values(
    *, version: int, role: str = "Staff", status: str = "active", unit_id: str = BRAND
) -> dict:
    return {
        "id": "uam-1",
        "organization_id": ORG,
        "platform_user_id": PU,
        "unit_id": unit_id,
        "app_id": "prepper",
        "role": role,
        "status": status,
        "version": version,
    }


# --- the dispatch table: a MISNAMED handler is a silent no-op, not an error ----------------
# ``apply_event`` resolves handlers with ``getattr(handlers, name, None)`` and SKIPS when
# absent — the guard that makes unknown event types forward-compatible also makes a typo'd
# method name indistinguishable from an intentional opt-out. It does not raise; it silently
# drops every event of that type. These two tests are the only thing that catches that.

def test_every_dispatched_handler_exists():
    from passport_client.receiver import _DISPATCH

    from app.passport.handlers import PassportHandlers

    missing = sorted(m for m, _ in _DISPATCH.values() if not hasattr(PassportHandlers, m))
    assert not missing, f"silent no-op handlers: {missing}"


def test_no_dead_handlers():
    from passport_client.receiver import _DISPATCH

    from app.passport.handlers import PassportHandlers

    live = {m for m, _ in _DISPATCH.values()}
    dead = sorted(
        n
        for n in vars(PassportHandlers)
        if not n.startswith("_")
        and callable(getattr(PassportHandlers, n))
        and n not in live
    )
    assert not dead, f"handlers no event will ever dispatch to: {dead}"


# --- the unit-app aggregates ---------------------------------------------------------------

def test_unit_app_membership_removed_keeps_row_as_tombstone(session: Session):
    store.apply_unit_app_membership(session, _role_values(version=1))
    assert session.get(PassportUnitAppMembership, "uam-1").status == "active"

    # Same shape as trap 1: a keep-the-row upsert, never a delete. Deleting it would lose the
    # roster permanently — a restored entitlement must bring access back losslessly.
    store.apply_unit_app_membership(session, _role_values(version=2, status="removed"))
    session.expire_all()
    row = session.get(PassportUnitAppMembership, "uam-1")
    assert row is not None, "removed role row must be KEPT as a tombstone"
    assert row.status == "removed" and row.version == 2


def test_unit_app_access_insert_if_absent_and_delete(session: Session):
    store.create_unit_app_access(session, _app_access_values())
    assert session.get(PassportUnitAppAccess, "uaa-1") is not None

    # Immutable: a duplicate delivery is a no-op, not an error.
    store.create_unit_app_access(session, _app_access_values())
    assert len(session.exec(select(PassportUnitAppAccess)).all()) == 1

    # This one IS a real delete — the switch's absence is what makes the brand confer nothing.
    store.remove_unit_app_access(session, "uaa-1")
    assert session.get(PassportUnitAppAccess, "uaa-1") is None


# --- derived access + THE LADDER -----------------------------------------------------------

def _seed_entitled_brand(session: Session) -> None:
    """An active entitlement + an active brand carrying the app + the identity link."""
    store.apply_entitlement(session, _entitlement_values(version=1))
    store.apply_unit(session, _unit_values(version=1))
    store.create_unit_app_access(session, _app_access_values())
    store.create_identity_link(session, _link_values())


def test_owner_with_no_role_rows_has_access(session: Session):
    """THE LADDER — an org Owner/Admin holds Manager everywhere with ZERO role rows.

    This is the one test that catches a forgotten ``org_role``, and no other check will: a
    hand-rolled join just returns False and silently denies every Owner and Admin.
    """
    _seed_entitled_brand(session)
    store.apply_membership(session, _membership_values(version=1, role="Owner"))

    assert access.has_prepper_access(session, SUBJECT) is True
    assert access.brand_roles(session, SUBJECT) == {BRAND: "Manager"}


def test_member_without_a_role_row_is_denied(session: Session):
    # A plain Member gets nothing from the ladder — access is DERIVED, not implied by membership.
    _seed_entitled_brand(session)
    store.apply_membership(session, _membership_values(version=1, role="Member"))

    assert access.has_prepper_access(session, SUBJECT) is False
    assert access.brand_roles(session, SUBJECT) == {}


def test_member_with_a_role_row_has_access_at_that_brand(session: Session):
    _seed_entitled_brand(session)
    store.apply_membership(session, _membership_values(version=1, role="Member"))
    store.apply_unit_app_membership(session, _role_values(version=1, role="Staff"))

    assert access.has_prepper_access(session, SUBJECT) is True
    assert access.brand_roles(session, SUBJECT) == {BRAND: "Staff"}


def test_brand_carrying_no_app_access_confers_nothing_even_to_an_owner(session: Session):
    # A brand with no unit_app_access row is not an app brand — not even the ladder reaches it.
    store.apply_entitlement(session, _entitlement_values(version=1))
    store.apply_unit(session, _unit_values(version=1))
    store.create_identity_link(session, _link_values())
    store.apply_membership(session, _membership_values(version=1, role="Owner"))

    assert access.brand_roles(session, SUBJECT) == {}
    assert access.has_prepper_access(session, SUBJECT) is False


def test_archived_brand_confers_nothing(session: Session):
    _seed_entitled_brand(session)
    store.apply_membership(session, _membership_values(version=1, role="Owner"))
    store.apply_unit(session, _unit_values(version=2, status="archived"))

    assert access.has_prepper_access(session, SUBJECT) is False


def test_entitlement_revocation_denies_access_but_deletes_nothing(session: Session):
    """TRAP 2 — revocation is an org-level kill switch, NOT a cascade.

    Access dies by arithmetic; the role rows go dormant and come back losslessly when the
    entitlement is restored. A consumer that deleted them here would lose the roster forever.
    """
    _seed_entitled_brand(session)
    store.apply_membership(session, _membership_values(version=1, role="Member"))
    store.apply_unit_app_membership(session, _role_values(version=1))

    assert access.has_prepper_access(session, SUBJECT) is True

    # Revocation arrives as an entitlement.upserted with status != active.
    store.apply_entitlement(session, _entitlement_values(version=2, status="suspended"))
    session.expire_all()
    assert access.has_prepper_access(session, SUBJECT) is False

    # The roster survives, dormant — nothing was deleted.
    assert session.get(PassportUnitAppMembership, "uam-1") is not None

    # Restored -> access returns losslessly, with no re-grant.
    store.apply_entitlement(session, _entitlement_values(version=3, status="active"))
    session.expire_all()
    assert access.brand_roles(session, SUBJECT) == {BRAND: "Staff"}


def test_access_fails_open_before_entitlements_sync(session: Session):
    # Turning the projection on must not lock everyone out before the data has landed.
    store.create_identity_link(session, _link_values())
    assert access.has_prepper_access(session, SUBJECT) is True


# --- an outlet INHERITS its brand ----------------------------------------------------------
# Prepper owns no `outlets` table any more. An outlet is a Passport unit that resolves through
# `belongs_to_brand`; people are only ever held at BRANDS.

OUTLET = "outlet-1"


def _seed_outlet_unit(session: Session) -> None:
    store.apply_unit(session, _unit_values(version=1, unit_id=OUTLET, type="outlet"))
    store.create_relation(
        session,
        {
            "id": "rel-1",
            "organization_id": ORG,
            "from_unit_id": OUTLET,
            "to_unit_id": BRAND,
            "relation": "belongs_to_brand",
        },
    )


def test_role_at_an_outlet_resolves_through_its_brand(session: Session):
    _seed_entitled_brand(session)
    _seed_outlet_unit(session)
    store.apply_membership(session, _membership_values(version=1, role="Member"))
    store.apply_unit_app_membership(session, _role_values(version=1, role="Staff"))

    # The role row names the BRAND; asking at the outlet must resolve to it.
    assert access.role_at_unit(session, SUBJECT, OUTLET) == "Staff"
    assert access.accessible_unit_ids(session, SUBJECT) == {BRAND, OUTLET}


def test_no_role_means_no_units_at_all(session: Session):
    """FAIL CLOSED — a user with no Passport role sees nothing.

    The old model read a null `outlet_id` as "see everything". An empty derivation now means an
    empty scope, and every list endpoint is filtered by it.
    """
    _seed_entitled_brand(session)
    _seed_outlet_unit(session)

    assert access.brand_roles(session, "nobody") == {}
    assert access.role_at_unit(session, "nobody", BRAND) is None
    assert access.accessible_unit_ids(session, "nobody") == set()


# --- rule 9: multi-org ---------------------------------------------------------------------
def test_owner_of_one_org_gets_nothing_at_another_orgs_brands(session: Session):
    """RULE 9 — the cross-org grant this scoping exists to prevent.

    Prepper holds units, brand-app switches and memberships for EVERY org it is entitled to. An
    unscoped derivation would hand an Owner of org A the Manager ladder at every brand of org B.
    Nothing errors when it does — the user simply sees another tenant's brands. This is the only
    test that catches it.
    """
    other_org, other_brand = "org-2", "brand-2"

    # The user is an OWNER of org-1, which carries the app on brand-1.
    _seed_entitled_brand(session)
    store.apply_membership(session, _membership_values(version=1, role="Owner"))

    # org-2 is a different tenant: entitled, with its own active brand carrying Prepper.
    store.apply_entitlement(
        session, {**_entitlement_values(version=1), "id": "e-2", "organization_id": other_org}
    )
    store.apply_unit(
        session,
        {**_unit_values(version=1), "id": other_brand, "organization_id": other_org},
    )
    store.create_unit_app_access(
        session,
        {
            **_app_access_values(),
            "id": "aa-2",
            "organization_id": other_org,
            "unit_id": other_brand,
        },
    )

    roles = access.brand_roles(session, SUBJECT)

    assert roles == {BRAND: "Manager"}, "ladder must not reach across the org boundary"
    assert other_brand not in roles
