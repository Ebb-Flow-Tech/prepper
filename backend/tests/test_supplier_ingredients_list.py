"""Tests for GET /api/v1/supplier-ingredients (cross-supplier product listing).

Visibility is the set of Passport units the caller can reach — the brands they hold a role at,
plus the outlets under them. A user with no role reaches nothing: the list FAILS CLOSED.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.conftest import (
    STAFF,
    create_user,
    make_brand_user,
    seed_brand,
    seed_outlet_unit,
    use_user,
)


@pytest.fixture
def admin_client(client: TestClient) -> TestClient:
    """The org-admin client — the ladder makes them Manager at every brand of the org."""
    return client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_category(client: TestClient, name: str) -> int:
    resp = client.post("/api/v1/categories", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_ingredient(client: TestClient, name: str = "Tomato", category_id: int | None = None) -> int:
    body: dict = {"name": name, "base_unit": "kg"}
    if category_id:
        body["category_id"] = category_id
    resp = client.post("/api/v1/ingredients", json=body)
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_supplier(client: TestClient, name: str = "Supplier A") -> int:
    resp = client.post("/api/v1/suppliers", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


def _add_supplier_ingredient(
    client: TestClient,
    ing_id: int,
    sup_id: int,
    unit_id: str,
    pack_unit: str = "kg",
    price: float = 10.0,
    sku: str | None = None,
) -> int:
    body: dict = {
        "ingredient_id": ing_id,
        "supplier_id": sup_id,
        "unit_id": unit_id,
        "pack_size": 5.0,
        "pack_unit": pack_unit,
        "price_per_pack": price,
    }
    if sku is not None:
        body["sku"] = sku
    resp = client.post(f"/api/v1/ingredients/{ing_id}/suppliers", json=body)
    assert resp.status_code == 201
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSupplierIngredientsListEndpoint:
    """Tests for GET /api/v1/supplier-ingredients."""

    URL = "/api/v1/supplier-ingredients"

    # --- basic response shape ---

    def test_empty_when_no_data(self, admin_client: TestClient):
        """Returns empty paginated list when no supplier ingredients exist."""
        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total_count"] == 0
        assert data["total_pages"] == 0
        assert data["page_number"] == 1

    def test_response_shape(self, session: Session, admin_client: TestClient):
        """Each item contains all expected fields."""
        unit_id = seed_brand(session, "Shop A")
        cat_id = _create_category(admin_client, "Vegetables")
        ing_id = _create_ingredient(admin_client, "Carrot", category_id=cat_id)
        sup_id = _create_supplier(admin_client, "Farm Direct")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id, price=12.5, sku="CARR-001")

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        item = resp.json()["items"][0]

        assert "id" in item
        assert item["ingredient_id"] == ing_id
        assert item["ingredient_name"] == "Carrot"
        assert item["category_name"] == "Vegetables"
        assert item["sku"] == "CARR-001"
        assert item["supplier_id"] == sup_id
        assert item["supplier_name"] == "Farm Direct"
        assert item["unit"] == "kg"
        assert item["price_per_pack"] == 12.5

    # --- org-admin visibility ---

    def test_org_admin_sees_all_entries(self, session: Session, admin_client: TestClient):
        """An org admin holds Manager at every brand, so every unit's entries are visible."""
        unit_a = seed_brand(session, "Outlet A")
        unit_b = seed_brand(session, "Outlet B")
        ing_a = _create_ingredient(admin_client, "Apple")
        ing_b = _create_ingredient(admin_client, "Banana")
        sup_a = _create_supplier(admin_client, "Sup A")
        sup_b = _create_supplier(admin_client, "Sup B")
        _add_supplier_ingredient(admin_client, ing_a, sup_a, unit_a)
        _add_supplier_ingredient(admin_client, ing_b, sup_b, unit_b)

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["total_count"] == 2

    # --- access control ---

    def test_user_with_no_passport_role_sees_nothing(
        self, session: Session, admin_client: TestClient
    ):
        """FAIL CLOSED — no role anywhere means no units, and an empty scope shows nothing.

        The old model read a null `outlet_id` as "see every outlet". That is deliberately gone.
        """
        unit_id = seed_brand(session, "Outlet X")
        ing_id = _create_ingredient(admin_client, "Pepper")
        sup_id = _create_supplier(admin_client, "Pepper Farm")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id)

        use_user(admin_client, create_user(session, "no-role", "norole"))

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["total_count"] == 0

    def test_user_sees_their_own_brands_entries(
        self, session: Session, admin_client: TestClient
    ):
        unit_id = seed_brand(session, "My Outlet")
        ing_id = _create_ingredient(admin_client, "Garlic")
        sup_id = _create_supplier(admin_client, "Herb Co")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id)

        use_user(admin_client, make_brand_user(session, "user-my", unit_id, STAFF, "myuser"))

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 1
        assert data["items"][0]["ingredient_name"] == "Garlic"

    def test_cross_brand_isolation(self, session: Session, admin_client: TestClient):
        """A role at brand A shows nothing of brand B."""
        brand_a = seed_brand(session, "Brand A")
        brand_b = seed_brand(session, "Brand B")
        ing_id = _create_ingredient(admin_client, "Rice")
        sup_id = _create_supplier(admin_client, "Rice Co")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, brand_b)

        use_user(admin_client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["total_count"] == 0

    def test_brand_role_reaches_entries_at_its_outlets(
        self, session: Session, admin_client: TestClient
    ):
        """An outlet inherits its brand, so a role at the brand reaches the outlet's entries."""
        brand_id = seed_brand(session, "Parent Brand")
        outlet_id = seed_outlet_unit(session, brand_id, "Child Location")
        ing_id = _create_ingredient(admin_client, "Onion")
        sup_id = _create_supplier(admin_client, "Onion Farm")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, outlet_id)

        use_user(
            admin_client, make_brand_user(session, "child-user", brand_id, STAFF, "childuser")
        )

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.json()["total_count"] == 1

    # --- search ---

    def test_search_by_ingredient_name(self, session: Session, admin_client: TestClient):
        """search param filters by ingredient name (case-insensitive)."""
        unit_id = seed_brand(session, "Shop S")
        ing_a = _create_ingredient(admin_client, "Chicken Breast")
        ing_b = _create_ingredient(admin_client, "Beef Tenderloin")
        sup = _create_supplier(admin_client, "Meat Co")
        _add_supplier_ingredient(admin_client, ing_a, sup, unit_id)
        _add_supplier_ingredient(admin_client, ing_b, sup, unit_id)

        resp = admin_client.get(self.URL, params={"search": "chicken"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 1
        assert data["items"][0]["ingredient_name"] == "Chicken Breast"

    def test_search_by_sku(self, session: Session, admin_client: TestClient):
        """search param filters by SKU (case-insensitive)."""
        unit_id = seed_brand(session, "Shop K")
        ing_id = _create_ingredient(admin_client, "Salmon")
        sup_id = _create_supplier(admin_client, "Fish Market")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id, sku="FISH-SAL-001")

        resp = admin_client.get(self.URL, params={"search": "sal"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 1
        assert data["items"][0]["sku"] == "FISH-SAL-001"

    def test_search_no_match_returns_empty(self, session: Session, admin_client: TestClient):
        """search with no match returns an empty list."""
        unit_id = seed_brand(session, "Shop E")
        ing_id = _create_ingredient(admin_client, "Milk")
        sup_id = _create_supplier(admin_client, "Dairy Co")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id)

        resp = admin_client.get(self.URL, params={"search": "xyznotexist"})
        assert resp.status_code == 200
        assert resp.json()["total_count"] == 0

    # --- pagination ---

    def test_pagination_page_size(self, session: Session, admin_client: TestClient):
        """page_size limits results per page."""
        unit_id = seed_brand(session, "Shop P")
        sup_id = _create_supplier(admin_client, "Bulk Sup")
        for i in range(5):
            ing_id = _create_ingredient(admin_client, f"Ingredient {i}")
            _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id)

        resp = admin_client.get(self.URL, params={"page_size": 3, "page_number": 1})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 5
        assert data["total_pages"] == 2
        assert len(data["items"]) == 3

    def test_pagination_second_page(self, session: Session, admin_client: TestClient):
        """page_number=2 returns the second page of results."""
        unit_id = seed_brand(session, "Shop Q")
        sup_id = _create_supplier(admin_client, "Page Sup")
        for i in range(5):
            ing_id = _create_ingredient(admin_client, f"Product {i}")
            _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id)

        resp = admin_client.get(self.URL, params={"page_size": 3, "page_number": 2})
        assert resp.status_code == 200
        data = resp.json()
        assert data["page_number"] == 2
        assert len(data["items"]) == 2

    def test_pagination_defaults(self, admin_client: TestClient):
        """Default page_number=1, page_size=20 are applied."""
        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["page_number"] == 1

    # --- category name ---

    def test_category_name_is_null_when_uncategorised(
        self, session: Session, admin_client: TestClient
    ):
        """category_name is None for ingredients without a category."""
        unit_id = seed_brand(session, "Shop NC")
        ing_id = _create_ingredient(admin_client, "Mystery Herb")  # no category_id
        sup_id = _create_supplier(admin_client, "Herb Supply")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, unit_id)

        resp = admin_client.get(self.URL)
        assert resp.status_code == 200
        item = resp.json()["items"][0]
        assert item["category_name"] is None
