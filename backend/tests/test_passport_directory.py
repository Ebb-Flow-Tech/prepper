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

    assert directory.brands_for_user(session, SUBJECT, ORG) == []
    assert directory.roster(session, SUBJECT, ORG) == []
    assert directory.assignable_members(session, SUBJECT, ORG) == []


def test_linked_non_member_sees_nothing(session: Session):
    """A linked platform user with NO org membership has no orgs — so no brands.

    This is the live case for a Passport SUPER ADMIN: they sit outside org membership by design
    ("never synced"), so they legitimately see nothing in a consuming app.
    """
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_unit(session, _unit(BRAND))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    assert directory.brands_for_user(session, SUBJECT, ORG) == []


def test_brand_carrying_the_app_is_listed_with_the_users_role(session: Session):
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))

    brands = directory.brands_for_user(session, SUBJECT, ORG)

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

    brands = directory.brands_for_user(session, SUBJECT, ORG)

    assert brands[0]["my_role"] == "Manager", "Owner must hold Manager with no role row"


def test_brand_without_app_access_is_hidden(session: Session):
    """A brand carrying no `unit_app_access` row confers access to NOBODY — not even an Owner.
    Showing it would offer somewhere a role cannot actually be given."""
    _seed(session)
    # The subject needs a real role at BRAND: the directory is scoped to what the caller can
    # REACH, so a Member with no role row sees nothing and this would assert `[] == []`.
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    store.apply_unit(session, _unit(DARK_BRAND, name="Dark"))  # no unit_app_access row

    assert [b["id"] for b in directory.brands_for_user(session, SUBJECT, ORG)] == [BRAND]


def test_archived_brand_is_hidden(session: Session):
    _seed(session)
    store.apply_unit(session, _unit(BRAND, status="archived", name="Acme"))

    assert directory.brands_for_user(session, SUBJECT, ORG) == []


def test_roster_excludes_removed_tombstones(session: Session):
    """`remove_unit_app_membership` KEEPS the row (status=removed). A tombstone confers nothing —
    showing it would read as an active grant."""
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    assert len(directory.roster(session, SUBJECT, ORG)) == 1

    store.apply_unit_app_membership(
        session, {**_role_row("uam-1", BRAND, status="removed"), "version": 2}
    )
    session.expire_all()

    assert directory.roster(session, SUBJECT, ORG) == []


def test_roster_carries_the_email_embedded_in_the_membership(session: Session):
    """Membership EMBEDS email/display_name — there is no user aggregate to join (the snapshot has
    no users collection)."""
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))

    row = directory.roster(session, SUBJECT, ORG)[0]

    assert row["email"] == "chef@acme.test"
    assert row["unit_name"] == "Acme"
    assert row["role"] == "Staff"


def test_a_member_of_two_orgs_sees_only_the_org_they_are_acting_in(session: Session):
    """The narrowing that `in_(org_ids)` could not express.

    The test below covers an org the subject does NOT belong to — which the old union already
    excluded. This is the case it did not: the subject is a genuine member of BOTH orgs, so the
    union returned both orgs' brands at once and the org switcher was decorative, since switching
    changed nothing about what came back.
    """
    _seed(session)
    # The subject needs a real role at BRAND: the directory is scoped to what the caller can
    # REACH, so a Member with no role row sees nothing and this would assert `[] == []`.
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    store.apply_entitlement(session, _entitlement(OTHER_ORG))
    store.apply_membership(session, _membership(OTHER_ORG))  # a real member of the second org
    store.apply_unit(session, _unit(OTHER_BRAND, OTHER_ORG, name="Other"))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND, OTHER_ORG))
    store.apply_unit_app_membership(session, _role_row("uam-2", OTHER_BRAND, OTHER_ORG))

    assert [b["id"] for b in directory.brands_for_user(session, SUBJECT, ORG)] == [BRAND]
    assert [b["id"] for b in directory.brands_for_user(session, SUBJECT, OTHER_ORG)] == [
        OTHER_BRAND
    ], "acting in the other org must show the other org's brands — narrowed, not hardcoded"


def test_directory_fails_closed_for_an_org_you_are_not_in(session: Session):
    """`get_org_context` validates the acting org, so this should be unreachable from a request.

    Pinned anyway: these functions take an org id as an argument, and an argument is exactly the
    kind of thing a future caller supplies from somewhere less careful.
    """
    _seed(session)
    store.apply_entitlement(session, _entitlement(OTHER_ORG))
    store.apply_unit(session, _unit(OTHER_BRAND, OTHER_ORG, name="Other"))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND, OTHER_ORG))

    assert directory.brands_for_user(session, SUBJECT, OTHER_ORG) == []
    assert directory.roster(session, SUBJECT, OTHER_ORG) == []
    assert directory.assignable_members(session, SUBJECT, OTHER_ORG) == []


def test_another_orgs_brands_and_roles_are_never_visible(session: Session):
    """RULE 9 — Prepper holds units and switches for EVERY org it is entitled to. An unscoped read
    would show a user another tenant's brands. Nothing errors when it does."""
    _seed(session)
    # The subject needs a real role at BRAND: the directory is scoped to what the caller can
    # REACH, so a Member with no role row sees nothing and this would assert `[] == []`.
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    # A second entitled org, with its own brand carrying Prepper and its own role row.
    store.apply_entitlement(session, _entitlement(OTHER_ORG))
    store.apply_unit(session, _unit(OTHER_BRAND, OTHER_ORG, name="Other"))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND, OTHER_ORG))
    store.apply_unit_app_membership(session, _role_row("uam-2", OTHER_BRAND, OTHER_ORG))

    brand_ids = [b["id"] for b in directory.brands_for_user(session, SUBJECT, ORG)]
    roster_units = [r["unit_id"] for r in directory.roster(session, SUBJECT, ORG)]

    assert brand_ids == [BRAND], "must not leak another org's brands"
    assert OTHER_BRAND not in roster_units, "must not leak another org's role rows"


# --- derived rows: the ladder, shown ---------------------------------------------------------
# An Owner/Admin holds Manager at every app-carrying brand with NO role row. The roster used to
# list stored rows only, so it could read "nobody has access" while every Owner had everything —
# which is why the page carried a paragraph apologising for itself. On staging that gap is 3 rows
# displayed against ~190 real grants. These pin the fix, and pin that the ladder is a FLOOR FOR
# GAPS: an explicit row beats it, so an Owner given Staff at one brand is Staff THERE.


def _by_brand(rows: list[dict], unit_id: str) -> list[dict]:
    return [r for r in rows if r["unit_id"] == unit_id]


def test_owner_appears_as_a_derived_row_at_every_app_carrying_brand(session: Session):
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(OTHER_BRAND, name="Beta"))
    store.create_unit_app_access(session, _access("a-1", BRAND))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND))

    rows = directory.roster(session, SUBJECT, ORG)

    assert {r["unit_id"] for r in rows} == {BRAND, OTHER_BRAND}
    for r in rows:
        assert r["role"] == "Manager"
        assert r["source"] == "derived"
        assert r["assignment_id"] is None
        assert r["org_role"] == "Owner"


def test_a_brand_without_app_access_yields_no_rows_even_for_an_owner(session: Session):
    """No ``unit_app_access`` row => the brand confers access to nobody, ladder included."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(DARK_BRAND, name="Dark"))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    rows = directory.roster(session, SUBJECT, ORG)

    assert _by_brand(rows, DARK_BRAND) == []
    assert len(_by_brand(rows, BRAND)) == 1


def test_explicit_row_beats_the_ladder_and_stays_removable(session: Session):
    """An Owner with an explicit Staff row is STAFF there — a real demotion, on a real row.

    So it keeps its assignment_id and reads 'assigned'. Keying `source` on the ORG ROLE instead
    would label this 'derived', strip its Select and Remove, and leave a live assignment
    uneditable through the UI forever.
    """
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(OTHER_BRAND, name="Beta"))
    store.create_unit_app_access(session, _access("a-1", BRAND))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND))
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))  # role="Staff"

    rows = directory.roster(session, SUBJECT, ORG)

    demoted = _by_brand(rows, BRAND)[0]
    assert demoted["role"] == "Staff"
    assert demoted["source"] == "assigned"
    assert demoted["assignment_id"] == "uam-1"

    elsewhere = _by_brand(rows, OTHER_BRAND)[0]
    assert elsewhere["role"] == "Manager"
    assert elsewhere["source"] == "derived"
    assert elsewhere["assignment_id"] is None


def test_plain_member_with_a_role_row_is_assigned_not_derived(session: Session):
    _seed(session)  # membership role defaults to "Member"
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))

    rows = directory.roster(session, SUBJECT, ORG)

    assert len(rows) == 1
    assert rows[0]["source"] == "assigned"
    assert rows[0]["assignment_id"] == "uam-1"
    assert rows[0]["role"] == "Staff"


def test_removed_role_row_is_a_tombstone_and_confers_nothing(session: Session):
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND, status="removed"))

    assert directory.roster(session, SUBJECT, ORG) == []


def test_roster_never_leaks_another_orgs_members(session: Session):
    _seed(session)
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))
    store.apply_entitlement(session, _entitlement(OTHER_ORG))
    store.apply_membership(session, _membership(OTHER_ORG, role="Owner"))
    store.apply_unit(session, _unit(OTHER_BRAND, OTHER_ORG, name="Rival"))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND, OTHER_ORG))

    rows = directory.roster(session, SUBJECT, ORG)

    # NB: asserting on `organization_id` alone would be tautological — the implementation stamps
    # the argument onto every row. Assert on data that came out of the DB.
    assert _by_brand(rows, OTHER_BRAND) == []
    assert {r["unit_id"] for r in rows} == {BRAND}
    assert {r["platform_user_id"] for r in rows} == {PU}


# --- brand scoping: you see the brands you can reach, and no others ---------------------------
# `brands_for_user` returned EVERY app-carrying brand in the org, with `my_role: None` on the ones
# the caller cannot reach — so a Staff at one brand saw all of them. Harmless-looking until the
# roster grew derived rows: it then handed every member the name and email of every person at every
# brand (190 rows on staging, against the 3 it used to show).
#
# Passport cannot enforce this: the roster is served from Prepper's projection and Passport never
# sees the request. It is ours to get right.


def _staff_at_one_brand(session: Session) -> None:
    """A plain Member holding Staff at BRAND only — no ladder, no access to OTHER_BRAND."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership())  # role="Member"
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(OTHER_BRAND, name="Beta"))
    store.create_unit_app_access(session, _access("a-1", BRAND))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND))
    store.apply_unit_app_membership(session, _role_row("uam-1", BRAND))  # Staff at BRAND


def test_brands_are_scoped_to_the_ones_the_caller_can_reach(session: Session):
    _staff_at_one_brand(session)

    brands = directory.brands_for_user(session, SUBJECT, ORG)

    assert [b["id"] for b in brands] == [BRAND]
    assert all(b["my_role"] is not None for b in brands)


def test_an_owner_still_sees_every_app_carrying_brand_via_the_ladder(session: Session):
    """Scoping must not cost the ladder its reach — an Owner reaches every brand carrying the app."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership(role="Owner"))
    store.apply_unit(session, _unit(BRAND))
    store.apply_unit(session, _unit(OTHER_BRAND, name="Beta"))
    store.create_unit_app_access(session, _access("a-1", BRAND))
    store.create_unit_app_access(session, _access("a-2", OTHER_BRAND))

    brands = directory.brands_for_user(session, SUBJECT, ORG)

    assert {b["id"] for b in brands} == {BRAND, OTHER_BRAND}


def test_roster_is_scoped_to_the_brands_the_caller_can_reach(session: Session):
    """A Staff at one brand must not learn who works at a brand they cannot reach."""
    _staff_at_one_brand(session)
    # Somebody else — an Owner — therefore derived Manager at BOTH brands.
    store.apply_membership(
        session,
        {
            **_membership(role="Owner"),
            "id": "m-owner",
            "platform_user_id": "pu-owner",
            "email": "owner@acme.test",
        },
    )

    rows = directory.roster(session, SUBJECT, ORG)

    assert {r["unit_id"] for r in rows} == {BRAND}, "OTHER_BRAND's roster is not theirs to see"
    assert "owner@acme.test" not in {
        r["email"] for r in rows if r["unit_id"] != BRAND
    }


def test_a_user_with_no_brand_access_sees_no_roster(session: Session):
    """A plain Member with no role row reaches nothing — fail closed, not 'everything'."""
    _link(session)
    store.apply_entitlement(session, _entitlement())
    store.apply_membership(session, _membership())  # Member, no role row, no ladder
    store.apply_unit(session, _unit(BRAND))
    store.create_unit_app_access(session, _access("a-1", BRAND))

    assert directory.brands_for_user(session, SUBJECT, ORG) == []
    assert directory.roster(session, SUBJECT, ORG) == []
