"""The recipe-units batch endpoint (`POST /recipes/units/batch`).

Replaces the deleted `/recipes/outlets/batch` that fed the card-list brand chips. Two things it must
guarantee: it returns a recipe's unit chips WITH names in one call (no N+1), and it is scoped to the
caller's accessible units so a card list never renders another tenant's brand.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Recipe, RecipeOutlet
from tests.conftest import ORG_ID, make_brand_user, seed_brand, use_user


def _recipe(session: Session, name: str = "Soup") -> Recipe:
    r = Recipe(organization_id=ORG_ID, name=name, created_by="admin-user-id", owner_id="admin-user-id")
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


def _serve_at(session: Session, recipe_id: int, unit_id: str, org_id: str) -> None:
    session.add(
        RecipeOutlet(recipe_id=recipe_id, unit_id=unit_id, organization_id=org_id)
    )
    session.commit()


def test_batch_returns_named_chips_for_accessible_units(
    client: TestClient, session: Session, brand_id: str
):
    r1, r2 = _recipe(session, "Soup"), _recipe(session, "Stew")
    _serve_at(session, r1.id, brand_id, "org-1")

    resp = client.post("/api/v1/recipes/units/batch", json={"recipe_ids": [r1.id, r2.id]})

    assert resp.status_code == 200
    body = resp.json()
    assert body[str(r1.id)][0]["unit_id"] == brand_id
    assert body[str(r1.id)][0]["unit_name"]  # resolved server-side, non-empty
    assert body[str(r2.id)] == []  # a recipe with no units yields an empty list, not an omission


def test_batch_hides_units_the_caller_cannot_see(
    client: TestClient, session: Session, brand_id: str
):
    """RULE 8/9 — the chip list is scoped. A recipe served at a brand the caller has no role at
    yields no chip for it, even though the row exists."""
    other_brand = seed_brand(session, name="Other", org_id="org-2")
    r = _recipe(session)
    _serve_at(session, r.id, brand_id, "org-1")
    _serve_at(session, r.id, other_brand, "org-2")

    # The admin client manages org-1 via the ladder but has no role in org-2.
    resp = client.post("/api/v1/recipes/units/batch", json={"recipe_ids": [r.id]})

    chips = resp.json()[str(r.id)]
    unit_ids = {c["unit_id"] for c in chips}
    assert brand_id in unit_ids
    assert other_brand not in unit_ids, "must not leak a brand the caller has no role at"


def test_batch_is_empty_for_a_user_with_no_role(
    client: TestClient, session: Session, brand_id: str
):
    r = _recipe(session)
    _serve_at(session, r.id, brand_id, "org-1")

    nobody = make_brand_user(session, "nobody-id", seed_brand(session, name="Zephyr"), "Staff")
    # ^ Staff at an unrelated brand; no access to brand_id.
    use_user(client, nobody)

    resp = client.post("/api/v1/recipes/units/batch", json={"recipe_ids": [r.id]})

    assert resp.json()[str(r.id)] == []
