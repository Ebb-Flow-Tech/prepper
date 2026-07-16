"""Tests for unit-scoped supplier-ingredient visibility.

A supplier-ingredient link hangs off a Passport UNIT. Who may see it is decided by
``access.accessible_unit_ids`` — the brands the caller holds a role at, plus the outlets under
them. There is no local outlet hierarchy any more, and no user column to consult.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.conftest import (
    ORG_ID,
    STAFF,
    create_user,
    make_brand_user,
    seed_brand,
    seed_outlet_unit,
    use_user,
)


def _create_ingredient(client: TestClient, name: str = "Tomato") -> int:
    resp = client.post("/api/v1/ingredients", json={"name": name, "base_unit": "kg"})
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_supplier(client: TestClient, name: str = "Fresh Farms") -> int:
    resp = client.post("/api/v1/suppliers", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


def _add_supplier_ingredient(
    client: TestClient, ing_id: int, sup_id: int, unit_id: str, pack_size: float = 5.0, price: float = 10.0
) -> int:
    resp = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "unit_id": unit_id,
            "pack_size": pack_size,
            "pack_unit": "kg",
            "price_per_pack": price,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestUnitScopedSupplierIngredients:
    """Unit-scoped visibility for supplier ingredients."""

    def test_brand_role_sees_links_at_the_brand(self, session: Session, client: TestClient):
        """A user at an outlet of the brand sees the brand's links — the outlet inherits."""
        brand_id = seed_brand(session, "Brand A")
        seed_outlet_unit(session, brand_id, "Location 1")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)
        _add_supplier_ingredient(client, ing_id, sup_id, brand_id)

        use_user(client, make_brand_user(session, "location-user", brand_id, STAFF, "locuser"))

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["unit_id"] == brand_id

    def test_brand_role_sees_links_at_its_outlets(self, session: Session, client: TestClient):
        """The other direction: a link placed on an outlet is visible to the brand's people."""
        brand_id = seed_brand(session, "Brand B")
        outlet_id = seed_outlet_unit(session, brand_id, "Location 2")

        ing_id = _create_ingredient(client, "Onion")
        sup_id = _create_supplier(client, "Local Farms")
        _add_supplier_ingredient(client, ing_id, sup_id, outlet_id)

        use_user(client, make_brand_user(session, "brand-user", brand_id, STAFF, "branduser"))

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["unit_id"] == outlet_id

    def test_org_admin_sees_all(self, session: Session, client: TestClient):
        """An org admin holds Manager at every brand, so nothing is hidden from them."""
        unit_a = seed_brand(session, "Outlet A")
        unit_b = seed_brand(session, "Outlet B")

        ing_id = _create_ingredient(client, "Garlic")
        sup_id = _create_supplier(client, "Global Supply")

        _add_supplier_ingredient(client, ing_id, sup_id, unit_a)
        sup_id2 = _create_supplier(client, "Another Supply")
        _add_supplier_ingredient(client, ing_id, sup_id2, unit_b)

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_user_with_no_passport_role_sees_nothing(
        self, session: Session, client: TestClient
    ):
        """FAIL CLOSED — an empty unit scope shows nothing, where a null outlet once showed all."""
        unit_id = seed_brand(session, "Some Outlet")
        ing_id = _create_ingredient(client, "Pepper")
        sup_id = _create_supplier(client, "Pepper Co")
        _add_supplier_ingredient(client, ing_id, sup_id, unit_id)

        use_user(client, create_user(session, "no-role-user", "norole"))

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_cross_brand_isolation(self, session: Session, client: TestClient):
        """A role at brand A shows nothing of brand B."""
        brand_a = seed_brand(session, "Brand A")
        brand_b = seed_brand(session, "Brand B")

        ing_id = _create_ingredient(client, "Carrot")
        sup_id = _create_supplier(client, "Carrot Farm")
        _add_supplier_ingredient(client, ing_id, sup_id, brand_b)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_supplier_endpoint_is_unit_scoped_too(self, session: Session, client: TestClient):
        """The supplier-side listing respects the same scope."""
        brand_a = seed_brand(session, "Outlet AA")
        brand_b = seed_brand(session, "Outlet BB")

        ing_id = _create_ingredient(client, "Rice")
        sup_id = _create_supplier(client, "Rice Supply")
        _add_supplier_ingredient(client, ing_id, sup_id, brand_a)

        use_user(client, make_brand_user(session, "user-b", brand_b, STAFF, "userb"))

        resp = client.get(f"/api/v1/suppliers/{sup_id}/ingredients")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_unit_shown_is_the_users_accessible_unit_not_the_first_inserted(
        self, session: Session, client: TestClient
    ):
        """Regression: with links at several units, the one SHOWN must be the one the caller can
        reach — not whichever link happens to be first in insertion order."""
        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        brand_a = seed_brand(session, "Outlet Alpha")
        brand_b = seed_brand(session, "Outlet Beta")

        ing_id = _create_ingredient(client, "Truffle")
        sup_id = _create_supplier(client, "Luxury Farms")

        # Linked to brand_a FIRST (so it is outlet_links[0]).
        si_id = _add_supplier_ingredient(client, ing_id, sup_id, brand_a)

        session.add(
            OutletSupplierIngredient(
                supplier_ingredient_id=si_id, unit_id=brand_b, organization_id=ORG_ID
            )
        )
        session.commit()

        use_user(client, make_brand_user(session, "user-b", brand_b, STAFF, "userb"))

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["unit_id"] == brand_b, (
            "unit_id should be the unit the caller can reach, not the first-inserted link"
        )
        assert data[0]["unit_name"] == "Outlet Beta"

    def test_non_org_admin_cannot_move_a_link_to_another_unit(
        self, session: Session, client: TestClient
    ):
        """Re-homing a link stays org-admin-only — a brand Manager cannot move it elsewhere."""
        brand_id = seed_brand(session, "Test Out")
        other_brand = seed_brand(session, "Other Out")

        ing_id = _create_ingredient(client, "Basil")
        sup_id = _create_supplier(client, "Herb Co")
        si_id = _add_supplier_ingredient(client, ing_id, sup_id, brand_id)

        use_user(client, make_brand_user(session, "normal-user", brand_id, STAFF, "normaluser"))

        resp = client.patch(
            f"/api/v1/ingredients/{ing_id}/suppliers/{si_id}",
            json={"unit_id": other_brand},
        )
        assert resp.status_code == 403


class TestUnitScopedSupplierIngredientWrites:
    """Reads were scoped; WRITES were not — the same asymmetry as `GET /menu-items/{section_id}`.

    `add_ingredient_supplier` and `remove_ingredient_supplier` took no subject, so any signed-in
    user could create or delete a supplier-pricing link at ANY brand's unit — including links they
    cannot read, because the read path IS scoped. Destroying data you cannot see is a strange
    privilege to hold.

    The routes declared `current_user` and never referenced it, which is how this stayed invisible:
    the signature looked authorised.
    """

    def test_cannot_add_a_link_at_another_brands_unit(
        self, session: Session, client: TestClient
    ):
        """`unit_id` is client-supplied. It must be checked against the caller's brands."""
        brand_a = seed_brand(session, "Brand A")
        brand_b = seed_brand(session, "Brand B")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        response = client.post(
            f"/api/v1/ingredients/{ing_id}/suppliers",
            json={
                "ingredient_id": ing_id,
                "supplier_id": sup_id,
                "unit_id": brand_b,
                "pack_size": 5.0,
                "pack_unit": "kg",
                "price_per_pack": 99.0,
            },
        )

        assert response.status_code == 404, (
            "brand B's unit is not visible to brand A, so it cannot be written to"
        )

    def test_cannot_delete_another_brands_link(
        self, session: Session, client: TestClient
    ):
        """The link id is a small integer. It must not be a way to delete a rival's pricing."""
        brand_a = seed_brand(session, "Brand A")
        brand_b = seed_brand(session, "Brand B")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)
        # Seeded by the org admin, who manages every brand via the ladder.
        link_id = _add_supplier_ingredient(client, ing_id, sup_id, brand_b)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        response = client.delete(f"/api/v1/ingredients/{ing_id}/suppliers/{link_id}")

        assert response.status_code == 404

        # And it must actually still be there.
        use_user(client, create_user(session, "admin-check", "admincheck"))
        from app.models.supplier_ingredient import SupplierIngredient

        assert session.get(SupplierIngredient, link_id) is not None, (
            "brand B's link must survive brand A's delete"
        )

    def test_a_user_can_still_add_a_link_at_their_own_brand(
        self, session: Session, client: TestClient
    ):
        """The happy path must keep working — this is a scope check, not a lockout."""
        brand_a = seed_brand(session, "Brand A")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        response = client.post(
            f"/api/v1/ingredients/{ing_id}/suppliers",
            json={
                "ingredient_id": ing_id,
                "supplier_id": sup_id,
                "unit_id": brand_a,
                "pack_size": 5.0,
                "pack_unit": "kg",
                "price_per_pack": 10.0,
            },
        )

        assert response.status_code == 201


class TestUnitScopedSupplierIngredientUpdate:
    """The THIRD sibling on this table. `add` and `remove` were fixed; `update` was not.

    `update_ingredient_supplier` takes no `subject`, and the route only checks authority when
    `data.unit_id` is present — so a PATCH without `unit_id` reaches the service with no check at
    all. Any signed-in user can rewrite any brand's supplier pricing.

    The census's `declares_user_but_ignores_it` detector cannot see this: the route DOES reference
    `current_user`, just conditionally. A fourth instance of the class the census was written to
    find, hiding behind an `if`.
    """

    def test_cannot_patch_another_brands_link(self, session: Session, client: TestClient):
        """No `unit_id` in the body, so the route's only check never fires."""
        brand_a = seed_brand(session, "Brand A")
        brand_b = seed_brand(session, "Brand B")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)
        link_id = _add_supplier_ingredient(client, ing_id, sup_id, brand_b, price=50.0)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        response = client.patch(
            f"/api/v1/ingredients/{ing_id}/suppliers/{link_id}",
            json={"price_per_pack": 0.01, "sku": "PWNED"},
        )

        assert response.status_code == 404, "brand B's link is not brand A's to edit"

        from app.models.supplier_ingredient import SupplierIngredient

        session.expire_all()
        link = session.get(SupplierIngredient, link_id)
        assert link is not None
        assert link.price_per_pack == 50.0, "brand B's price must be untouched"
        assert link.sku != "PWNED"

    def test_patch_does_not_disclose_another_brands_link(
        self, session: Session, client: TestClient
    ):
        """The 200 body returned the whole link — unit, sku, price — that the scoped READ hides.

        A write oracle is also a read oracle: it must not confirm the link even exists.
        """
        brand_a = seed_brand(session, "Brand A")
        brand_b = seed_brand(session, "Brand B")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)
        link_id = _add_supplier_ingredient(client, ing_id, sup_id, brand_b, price=50.0)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        body = client.patch(
            f"/api/v1/ingredients/{ing_id}/suppliers/{link_id}", json={"sku": "probe"}
        ).text

        assert "50.0" not in body, "the price must not leak through the error path"
        assert brand_b not in body, "the unit must not leak"

    def test_can_still_patch_a_link_at_their_own_brand(
        self, session: Session, client: TestClient
    ):
        """The happy path must keep working — this is a scope check, not a lockout."""
        brand_a = seed_brand(session, "Brand A")

        ing_id = _create_ingredient(client)
        sup_id = _create_supplier(client)
        link_id = _add_supplier_ingredient(client, ing_id, sup_id, brand_a, price=50.0)

        use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        response = client.patch(
            f"/api/v1/ingredients/{ing_id}/suppliers/{link_id}",
            json={"price_per_pack": 12.5},
        )

        assert response.status_code == 200
        assert response.json()["price_per_pack"] == 12.5
