"""The org-backfill report must count correctly — its numbers decide a one-way migration.

The rule for undecidable rows is chosen from this report's output. If it over-counts "derivable",
rows get assigned to an org from a derivation that was never sound, and a wrong assignment loses a
user access to their own data. So every branch is pinned here against known data.

Runs on the SQLite test database, where the `passport` schema collapses to the default (see
`app/database.py`). The report's SQL is schema-qualified for Postgres, so the `_sqlite_schema`
fixture re-points it rather than executing it verbatim.

**Known limitation:** that rewrite means these tests exercise the report's LOGIC, not the exact SQL
string production runs. The `passport.`-qualified form is verified only by running the report
against a real Postgres. Run it once against staging before trusting its numbers.
"""

import pytest
from sqlalchemy import text as sa_text
from sqlmodel import Session

from app.models import RecipeOutlet
from scripts.org_backfill_report import SPECS, TableSpec, report_for
from tests.conftest import (
    ORG_ID,
    create_user,
    grant_org_role,
    link_identity,
    seed_brand,
    seed_entitlement,
    store,
)

OTHER_ORG = "org-other"


@pytest.fixture(autouse=True)
def _sqlite_schema(monkeypatch):
    """Point the report's `passport.`-qualified SQL at SQLite's flat namespace.

    The projection lives in a dedicated `passport` schema on Postgres and collapses to the default
    on SQLite. The report targets production, so it stays qualified; this rewrites for the test.

    Rewrites EVERY module-level SQL constant rather than a named list. An earlier version named
    `_OWNER_DERIVABLE` alone, so `org_reality`'s queries went unrewritten and died on
    `no such table: passport.organization`. A fixture that must be updated by hand whenever a query
    is added is a fixture that will be forgotten.
    """
    import scripts.org_backfill_report as mod

    for name in dir(mod):
        if not name.startswith("_"):
            continue
        value = getattr(mod, name)
        if isinstance(value, str) and "passport." in value:
            monkeypatch.setattr(mod, name, value.replace("passport.", ""))


def _spec(table: str) -> TableSpec:
    return next(s for s in SPECS if s.table == table)


def _single_org_owner(session: Session, user_id: str, org: str = ORG_ID) -> str:
    create_user(session, user_id, user_id)
    pu = f"pu-{user_id}"
    link_identity(session, user_id, pu)
    grant_org_role(session, pu, "Member", org_id=org)
    seed_entitlement(session, org)
    return user_id


def _multi_org_owner(session: Session, user_id: str) -> str:
    _single_org_owner(session, user_id, ORG_ID)
    grant_org_role(session, f"pu-{user_id}", "Member", org_id=OTHER_ORG)
    return user_id


# =============================================================================
# The headline finding: three tables can derive nothing at all
# =============================================================================


@pytest.mark.parametrize("table", ["ingredients", "categories", "menus_sketch"])
def test_tables_with_no_owner_and_no_link_are_wholly_undecidable(
    session: Session, client, table: str
):
    """These have no owner column and no unit link, so 100% of rows are undecidable.

    This is not a gap in the report — it is the finding. No ownership rule can assign them,
    because there is no ownership. The answer must come from a human who knows the history.
    """
    if table == "categories":
        client.post("/api/v1/categories", json={"name": "Dairy"})
    elif table == "ingredients":
        client.post(
            "/api/v1/ingredients",
            json={"name": "Tomato", "base_unit": "kg", "unit_price": 1.0},
        )
    else:
        client.post("/api/v1/menu-sketches", json={"name": "Spring"})

    r = report_for(session, _spec(table))

    assert r.total >= 1
    assert r.by_link == 0
    assert r.by_owner == 0
    assert r.undecidable == r.total, f"{table}: every row must be reported undecidable"


# =============================================================================
# Recipes — the one table with a genuinely authoritative derivation
# =============================================================================


def test_recipe_with_a_unit_link_is_derivable(session: Session, client, brand_id: str):
    """A recipe served at a unit carries that unit's org on the link row — authoritative."""
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Laksa", "portion_size": 1, "portion_unit": "pax"},
    ).json()
    client.post(f"/api/v1/recipes/{recipe['id']}/units", json={"unit_id": brand_id})

    r = report_for(session, _spec("recipes"))

    assert r.by_link >= 1, (
        "a recipe linked to exactly one org's unit is derivable from that link"
    )


def test_recipe_owned_by_a_single_org_user_is_derivable_by_owner(
    session: Session, client
):
    """No unit link, but the owner belongs to exactly one org — so the org is unambiguous."""
    _single_org_owner(session, "solo-owner")
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Orphan", "portion_size": 1, "portion_unit": "pax"},
    ).json()
    session.exec(
        sa_text(f"UPDATE recipes SET owner_id = 'solo-owner' WHERE id = {recipe['id']}")
    )
    session.commit()

    r = report_for(session, _spec("recipes"))

    assert r.by_owner >= 1


def test_recipe_owned_by_an_unlinked_user_is_derivable_by_email(
    session: Session, client
):
    """The owner has NO identity link — only a membership carrying their email.

    This is the common case, not the edge case. `identity_link` is written on SSO login
    (`report_identity_link_safe`), so anyone who has not logged in since SSO went live has none.
    Measured on staging: 2 links for 5 users, and the sole recipe owner was not among them.

    A link-only derivation reported 0 of 11 recipes derivable. `deps.get_org_context` resolves
    link-OR-email, so the report must too — otherwise it models a chain the app does not use and
    its "undecidable" column is fiction.
    """
    create_user(session, "unlinked-owner", "unlinked", email="chef@temper.sg")
    # A membership Passport knows, matching by email. NO link_identity call — that is the point.
    store.apply_membership(
        session,
        {
            "id": "mem-unlinked",
            "organization_id": ORG_ID,
            "platform_user_id": "pu-unlinked",
            "role": "Member",
            "status": "active",
            "version": 1,
            "email": "chef@temper.sg",
            "display_name": "Chef",
        },
    )
    seed_entitlement(session, ORG_ID)

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Unlinked", "portion_size": 1, "portion_unit": "pax"},
    ).json()
    session.exec(
        sa_text(
            f"UPDATE recipes SET owner_id = 'unlinked-owner' WHERE id = {recipe['id']}"
        )
    )
    session.commit()

    r = report_for(session, _spec("recipes"))

    assert r.by_owner >= 1, (
        "an unlinked owner must still derive via their membership email"
    )


def test_recipe_owned_by_a_multi_org_user_is_undecidable(session: Session, client):
    """THE ambiguity this report exists to size.

    The owner belongs to two orgs, so the data cannot say which one the recipe belongs to.
    Assigning it would be a guess, and a wrong guess loses them their own recipe.
    """
    _multi_org_owner(session, "multi-owner")
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Ambiguous", "portion_size": 1, "portion_unit": "pax"},
    ).json()
    session.exec(
        sa_text(
            f"UPDATE recipes SET owner_id = 'multi-owner' WHERE id = {recipe['id']}"
        )
    )
    session.commit()

    r = report_for(session, _spec("recipes"))

    assert r.by_owner == 0, "a multi-org owner must never count as derivable"
    assert r.undecidable >= 1


def test_recipe_linked_to_two_orgs_is_a_conflict_not_a_derivation(
    session: Session, client
):
    """A recipe served at units in two orgs is a conflict, not a derivation.

    Resolving it to the first match would silently pick a tenant, so the report must surface it.

    The link rows are inserted DIRECTLY, not via the API, and deliberately: `POST /recipes/{id}/units`
    already refuses a brand the caller does not manage (403), so this admin cannot build the state
    through it. That is not proof the state cannot exist — a user who administers BOTH orgs can
    create it, and historical rows predate today's checks. The report reads whatever is actually in
    the database, so it is tested against that.
    """
    brand_a = seed_brand(session, "Brand A", org_id=ORG_ID)
    brand_b = seed_brand(session, "Brand B", org_id=OTHER_ORG)
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Shared", "portion_size": 1, "portion_unit": "pax"},
    ).json()

    session.add_all(
        [
            RecipeOutlet(
                recipe_id=recipe["id"], unit_id=brand_a, organization_id=ORG_ID
            ),
            RecipeOutlet(
                recipe_id=recipe["id"], unit_id=brand_b, organization_id=OTHER_ORG
            ),
        ]
    )
    session.commit()

    r = report_for(session, _spec("recipes"))

    assert r.link_conflict >= 1, "a two-org recipe is a conflict"
    assert r.by_link == 0, "a conflicted row must NOT also be counted derivable"
    assert r.warnings, "a conflict must be surfaced, not swallowed"


# =============================================================================
# Accounting
# =============================================================================


def test_a_row_derivable_both_ways_is_counted_once(
    session: Session, client, brand_id: str
):
    """A recipe with a unit link AND a single-org owner is ONE row, not two.

    Found by running against staging: `menus` reported total=3, by_link=1, by_owner=3 —
    UNDECIDABLE = -1. The categories are not disjoint, so a row satisfying both was counted twice
    and the coverage summed past the total. A report that over-counts "derivable" is the exact
    failure that matters: it under-states how many rows need a human decision.

    Link is authoritative; owner is the fallback. `by_owner` must therefore mean
    "not link-derivable, but owner-derivable".
    """
    _single_org_owner(session, "both-ways")
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Both", "portion_size": 1, "portion_unit": "pax"},
    ).json()
    client.post(f"/api/v1/recipes/{recipe['id']}/units", json={"unit_id": brand_id})
    session.exec(
        sa_text(f"UPDATE recipes SET owner_id = 'both-ways' WHERE id = {recipe['id']}")
    )
    session.commit()

    r = report_for(session, _spec("recipes"))

    assert r.total == 1
    assert r.by_link == 1, "the authoritative link derivation wins"
    assert r.by_owner == 0, (
        "and the same row must NOT be counted again as owner-derivable"
    )
    assert r.undecidable == 0


def test_counts_never_exceed_the_total(session: Session, client, brand_id: str):
    """set + by_link + by_owner + undecidable must equal total, or the report lies about coverage."""
    _single_org_owner(session, "coverage-owner")
    linked = client.post(
        "/api/v1/recipes", json={"name": "A", "portion_size": 1, "portion_unit": "pax"}
    ).json()
    client.post(f"/api/v1/recipes/{linked['id']}/units", json={"unit_id": brand_id})
    session.exec(
        sa_text(
            f"UPDATE recipes SET owner_id = 'coverage-owner' WHERE id = {linked['id']}"
        )
    )
    session.commit()
    client.post("/api/v1/categories", json={"name": "Sauces"})

    for spec in SPECS:
        r = report_for(session, spec)
        assert r.already_set + r.by_link + r.by_owner + r.undecidable == r.total, (
            f"{spec.table}: coverage does not reconcile to total"
        )
        assert r.undecidable >= 0, (
            f"{spec.table}: negative undecidable means double-counting"
        )


def test_an_empty_table_reports_zero_not_a_crash(session: Session):
    """A table with no rows must report zeros — the report runs before any backfill exists."""
    r = report_for(session, _spec("menus"))
    assert (r.total, r.by_link, r.by_owner, r.undecidable) == (0, 0, 0, 0)


# =============================================================================
# The premise check — is this deployment actually multi-org?
# =============================================================================


def test_org_reality_reports_a_single_org_deployment(session: Session, client):
    """One org, nobody spanning two: the multi-org machinery is inert and backfill is trivial."""
    from scripts.org_backfill_report import org_reality

    store.apply_org(
        session,
        {
            "id": ORG_ID,
            "name": "Mission Groups",
            "slug": "mg",
            "status": "active",
            "version": 1,
        },
    )

    reality = org_reality(session)

    assert len(reality["orgs"]) == 1
    assert reality["multi_org_users"] == 0
    assert reality["backfill_can_run"] is True


def test_org_reality_flags_multi_org_users(session: Session, client):
    """A user in two orgs is what makes the header and the switcher necessary.

    Staging has zero. If production has zero too, that machinery is solving a problem this
    deployment does not have — which is worth knowing before building more of it.
    """
    from scripts.org_backfill_report import org_reality

    store.apply_org(
        session,
        {"id": ORG_ID, "name": "A", "slug": "a", "status": "active", "version": 1},
    )
    store.apply_org(
        session,
        {"id": OTHER_ORG, "name": "B", "slug": "b", "status": "active", "version": 1},
    )
    _multi_org_owner(session, "spans-both")

    reality = org_reality(session)

    assert reality["multi_org_users"] == 1
    assert reality["backfill_can_run"] is False, (
        "two orgs means the founding-org rule is unsound and q2 must abort"
    )


def test_org_reality_ignores_a_removed_membership(session: Session, client):
    """Passport keeps tombstones. A removed membership is not a second org for this user."""
    from scripts.org_backfill_report import org_reality

    store.apply_org(
        session,
        {"id": ORG_ID, "name": "A", "slug": "a", "status": "active", "version": 1},
    )
    _single_org_owner(session, "left-one")
    store.apply_membership(
        session,
        {
            "id": "mem-gone",
            "organization_id": OTHER_ORG,
            "platform_user_id": "pu-left-one",
            "role": "Member",
            "status": "removed",
            "version": 1,
            "email": "x@test.com",
            "display_name": "x",
        },
    )

    assert org_reality(session)["multi_org_users"] == 0
