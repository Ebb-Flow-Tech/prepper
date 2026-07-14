"""Read-model queries over the projection (brands / roster / assignable members).

These reads back the role-management UI. They are deliberately served from the PROJECTION, never
from Passport's API — so they must survive a Passport outage and must never leak another org's
brands. The tests below pin exactly that.
"""

from sqlmodel import Session

from app.passport import directory, store

ORG = "org-1"
OTHER_ORG = "org-2"
PU = "pu-1"
SUBJECT = "sub-1"
BRAND = "brand-1"
OTHER_BRAND = "brand-2"
DARK_BRAND = "brand-3"  # a brand that does NOT carry Prepper


def _unit(unit_id: str, org: str = ORG, *, name: str = "Acme", status: str = "active") -> dict:
    return {
        "id": unit_id,
        "organization_id": org,
        "type": "brand",
        "name": name,
        "external_ref": None,
        "status": status,
        "version": 1,
    }


def _access(access_id: str, unit_id: str, org: str = ORG) -> dict:
    return {
        "id": access_id,
        "organization_id": org,
        "unit_id": unit_id,
        "app_id": "prepper-app",
    }


def _membership(org: str = ORG, *, role: str = "Member", status: str = "active") -> dict:
    return {
        "id": f"m-{org}",
        "organization_id": org,
        "platform_user_id": PU,
        "role": role,
        "status": status,
        "version": 1,
        "email": "chef@acme.test",
        "display_name": "Chef",
    }


def _entitlement(org: str = ORG) -> dict:
    return {
        "id": f"e-{org}",
        "organization_id": org,
        "app_id": "prepper-app",
        "status": "active",
        "tier": None,
        "source": "admin",
        "version": 1,
    }


def _role_row(row_id: str, unit_id: str, org: str = ORG, *, status: str = "active") -> dict:
    return {
        "id": row_id,
        "organization_id": org,
        "platform_user_id": PU,
        "unit_id": unit_id,
        "app_id": "prepper-app",
        "role": "Staff",
        "status": status,
        "version": 1,
    }


def _link(session: Session) -> None:
    store.create_identity_link(
        session,
        {
            "id": "l-1",
            "platform_user_id": PU,
            "app_id": "prepper-app",
            "subject": SUBJECT,
            "linked_via": "token",
        },
    )


def _seed(session: Session) -> None:
    """One org, entitled, one brand carrying Prepper, and a linked member."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership())
    store.apply_unit(session, _unit(BRAND))
    store.create_unit_app_access(session, _access("a-1", BRAND))


def test_unlinked_user_sees_nothing(session: Session):
    """No identity link => Passport is not authoritative for this person yet. Empty, never a leak."""
    store.apply_entitlement(session, _entitlement())
    store.apply_unit(session, _unit(BRAND))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    assert directory.brands_for_user(session, SUBJECT) == []
    assert directory.roster(session, SUBJECT) == []
    assert directory.assignable_members(session, SUBJECT) == []


def test_linked_non_member_sees_nothing(session: Session):
    """A linked platform user with NO org membership has no orgs — so no brands.

    This is the live case for a Passport SUPER ADMIN: they sit outside org membership by design
    ("never synced"), so they legitimately see nothing in a consuming app.
    """
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_unit(session, _unit(BRAND))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    assert directory.brands_for_user(session, SUBJECT) == []


def test_brand_carrying_the_app_is_listed_with_the_users_role(session: Session):
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))

    brands = directory.brands_for_user(session, SUBJECT)

    assert [b["id"] for b in brands] == [BRAND]
    assert brands[0]["my_role"] == "Staff"


def test_owner_sees_manager_at_every_brand_via_the_ladder(session: Session):
    """The ladder: an org Owner holds Manager everywhere, with ZERO role rows. The UI must agree
    with the permission check, so `my_role` comes from the same derivation."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    brands = directory.brands_for_user(session, SUBJECT)

    assert brands[0]["my_role"] == "Manager", "Owner must hold Manager with no role row"


def test_brand_without_app_access_is_hidden(session: Session):
    """A brand carrying no `unit_app_access` row confers access to NOBODY — not even an Owner.
    Showing it would offer somewhere a role cannot actually be given."""
    _seed(session)
    store.apply_unit(session, _unit(DARK_BRAND, name="Dark"))  # no unit_app_access row

    assert [b["id"] for b in directory.brands_for_user(session, SUBJECT)] == [BRAND]


def test_archived_brand_is_hidden(session: Session):
    _seed(session)
    store.apply_unit(session, _unit(BRAND, status="archived", name="Acme"))

    assert directory.brands_for_user(session, SUBJECT) == []


def test_roster_excludes_removed_tombstones(session: Session):
    """`remove_unit_app_membership` KEEPS the row (status=removed). A tombstone confers nothing —
    showing it would read as an active grant."""
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    assert len(directory.roster(session, SUBJECT)) == 1

    store.apply_unit_app_membership(
        session, {**_role_row("uam-1", BRAND, status="removed"), "version": 2}
    )
    session.expire_all()

    assert directory.roster(session, SUBJECT) == []


def test_roster_carries_the_email_embedded_in_the_membership(session: Session):
    """Membership EMBEDS email/display_name — there is no user aggregate to join (the snapshot has
    no users collection)."""
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))

    row = directory.roster(session, SUBJECT)[0]

    assert row["email"] == "chef@acme.test"
    assert row["unit_name"] == "Acme"
    assert row["role"] == "Staff"


def test_another_orgs_brands_and_roles_are_never_visible(session: Session):
    """RULE 9 — Prepper holds units and switches for EVERY org it is entitled to. An unscoped read
    would show a user another tenant's brands. Nothing errors when it does."""
    _seed(session)
    # A second entitled org, with its own brand carrying Prepper and its own role row.
    store.apply_entitlement(session, _entitlement(OTHER_ORG))
    store.apply_unit(session, _unit(OTHER_BRAND, OTHER_ORG, name="Other"))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND, OTHER_ORG))
    store.apply_unit_app_membership(session, _role_row("uam-2", OTHER_BRAND, OTHER_ORG))

    brand_ids = [b["id"] for b in directory.brands_for_user(session, SUBJECT)]
    roster_units = [r["unit_id"] for r in directory.roster(session, SUBJECT)]

    assert brand_ids == [BRAND], "must not leak another org's brands"
    assert OTHER_BRAND not in roster_units, "must not leak another org's role rows"
