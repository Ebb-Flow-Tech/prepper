"""Tests for supplier ingredient tag endpoints."""

from fastapi.testclient import TestClient

# ============ Helpers ============

def _create_supplier(client: TestClient, name: str = "Test Supplier") -> dict:
    res = client.post("/api/v1/suppliers", json={"name": name})
    assert res.status_code == 201
    return res.json()


def _create_ingredient(client: TestClient, name: str = "Test Ingredient") -> dict:
    res = client.post("/api/v1/ingredients", json={"name": name, "base_unit": "kg"})
    assert res.status_code == 201
    return res.json()


def _create_supplier_ingredient(client: TestClient, supplier_id: int, ingredient_id: int) -> dict:
    res = client.post(
        f"/api/v1/ingredients/{ingredient_id}/suppliers",
        json={
            "ingredient_id": ingredient_id,
            "supplier_id": supplier_id,
            "pack_size": 1.0,
            "pack_unit": "kg",
            "price_per_pack": 10.0,
        },
    )
    assert res.status_code == 201
    return res.json()


def _make_si(client: TestClient) -> dict:
    supplier = _create_supplier(client)
    ingredient = _create_ingredient(client)
    return _create_supplier_ingredient(client, supplier["id"], ingredient["id"])


# ============ Tag CRUD ============

def test_create_tag(client: TestClient):
    res = client.post("/api/v1/supplier-ingredient-tags", json={"name": "Organic"})
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Organic"
    assert data["is_active"] is True
    assert "id" in data


def test_create_tag_duplicate_name_409(client: TestClient):
    client.post("/api/v1/supplier-ingredient-tags", json={"name": "Halal"})
    res = client.post("/api/v1/supplier-ingredient-tags", json={"name": "Halal"})
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_list_tags_returns_only_active(client: TestClient):
    client.post("/api/v1/supplier-ingredient-tags", json={"name": "Vegan"})
    res2 = client.post("/api/v1/supplier-ingredient-tags", json={"name": "Kosher"})
    tag_id = res2.json()["id"]

    client.delete(f"/api/v1/supplier-ingredient-tags/{tag_id}")

    res = client.get("/api/v1/supplier-ingredient-tags")
    assert res.status_code == 200
    names = [t["name"] for t in res.json()]
    assert "Vegan" in names
    assert "Kosher" not in names


def test_soft_delete_tag(client: TestClient):
    create_res = client.post("/api/v1/supplier-ingredient-tags", json={"name": "Local"})
    tag_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/supplier-ingredient-tags/{tag_id}")
    assert del_res.status_code == 200
    assert del_res.json()["is_active"] is False

    # Confirm not returned in list
    list_res = client.get("/api/v1/supplier-ingredient-tags")
    names = [t["name"] for t in list_res.json()]
    assert "Local" not in names


def test_delete_tag_not_found(client: TestClient):
    res = client.delete("/api/v1/supplier-ingredient-tags/99999")
    assert res.status_code == 404


# ============ Per-Product Tag Links ============

def test_get_tags_for_supplier_ingredient_empty(client: TestClient):
    si = _make_si(client)
    res = client.get(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}")
    assert res.status_code == 200
    assert res.json() == []


def test_get_tags_for_supplier_ingredient_with_links(client: TestClient):
    si = _make_si(client)
    tag_res = client.post("/api/v1/supplier-ingredient-tags", json={"name": "Premium"})
    tag_id = tag_res.json()["id"]

    client.post(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}/{tag_id}")

    res = client.get(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}")
    assert res.status_code == 200
    assert any(t["name"] == "Premium" for t in res.json())


def test_add_tag_link_idempotent(client: TestClient):
    si = _make_si(client)
    tag_res = client.post("/api/v1/supplier-ingredient-tags", json={"name": "Fresh"})
    tag_id = tag_res.json()["id"]

    res1 = client.post(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}/{tag_id}")
    assert res1.status_code == 204

    res2 = client.post(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}/{tag_id}")
    assert res2.status_code == 204

    tags = client.get(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}").json()
    assert len([t for t in tags if t["name"] == "Fresh"]) == 1


def test_remove_tag_link(client: TestClient):
    si = _make_si(client)
    tag_res = client.post("/api/v1/supplier-ingredient-tags", json={"name": "GlutenFree"})
    tag_id = tag_res.json()["id"]

    client.post(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}/{tag_id}")

    del_res = client.delete(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}/{tag_id}")
    assert del_res.status_code == 204

    tags = client.get(f"/api/v1/supplier-ingredient-tags/supplier-ingredient/{si['id']}").json()
    assert all(t["name"] != "GlutenFree" for t in tags)
