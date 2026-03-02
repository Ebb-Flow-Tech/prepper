"""Tests for ingredient endpoints."""

from fastapi.testclient import TestClient


def test_create_ingredient(client: TestClient):
    """Test creating a new ingredient."""
    response = client.post(
        "/api/v1/ingredients",
        json={
            "name": "Flour",
            "base_unit": "g",
            "cost_per_base_unit": 0.002,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Flour"
    assert data["base_unit"] == "g"
    assert data["cost_per_base_unit"] == 0.002
    assert data["is_active"] is True


def test_list_ingredients(client: TestClient):
    """Test listing ingredients."""
    # Create two ingredients
    client.post(
        "/api/v1/ingredients",
        json={"name": "Salt", "base_unit": "g"},
    )
    client.post(
        "/api/v1/ingredients",
        json={"name": "Sugar", "base_unit": "g"},
    )

    response = client.get("/api/v1/ingredients")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_deactivate_ingredient(client: TestClient):
    """Test deactivating an ingredient."""
    # Create ingredient
    create_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Butter", "base_unit": "g"},
    )
    ingredient_id = create_response.json()["id"]

    # Deactivate
    response = client.patch(f"/api/v1/ingredients/{ingredient_id}/deactivate")
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # Should not appear in active list
    list_response = client.get("/api/v1/ingredients?active_only=true")
    assert len(list_response.json()) == 0


# -------------------------------------------------------------------------
# Supplier-Ingredient CRUD tests (via supplier_ingredients table)
# -------------------------------------------------------------------------


def _create_ingredient_and_supplier(client: TestClient):
    """Helper to create an ingredient and a supplier, returning their IDs."""
    ing = client.post(
        "/api/v1/ingredients",
        json={"name": "Tomato", "base_unit": "kg", "cost_per_base_unit": 2.0},
    ).json()
    sup = client.post(
        "/api/v1/suppliers",
        json={"name": "Fresh Farms", "email": "fresh@farms.com"},
    ).json()
    return ing["id"], sup["id"]


def test_add_ingredient_supplier(client: TestClient):
    """Test adding a supplier to an ingredient via the join table."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    response = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
            "sku": "TOM-001",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["ingredient_id"] == ing_id
    assert data["supplier_id"] == sup_id
    assert data["pack_size"] == 5.0
    assert data["price_per_pack"] == 12.50
    assert data["sku"] == "TOM-001"
    assert data["supplier_name"] == "Fresh Farms"
    assert data["ingredient_name"] == "Tomato"


def test_get_ingredient_suppliers(client: TestClient):
    """Test listing all suppliers for an ingredient."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    # Add supplier
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
        },
    )

    response = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["supplier_id"] == sup_id


def test_get_ingredient_suppliers_empty(client: TestClient):
    """Test listing suppliers for an ingredient with none linked."""
    ing = client.post(
        "/api/v1/ingredients",
        json={"name": "Onion", "base_unit": "kg"},
    ).json()

    response = client.get(f"/api/v1/ingredients/{ing['id']}/suppliers")
    assert response.status_code == 200
    assert response.json() == []


def test_get_ingredient_suppliers_not_found(client: TestClient):
    """Test listing suppliers for non-existent ingredient returns 404."""
    response = client.get("/api/v1/ingredients/99999/suppliers")
    assert response.status_code == 404


def test_update_ingredient_supplier(client: TestClient):
    """Test updating a supplier-ingredient link."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    # Add supplier
    add_resp = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
        },
    )
    si_id = add_resp.json()["id"]

    # Update
    response = client.patch(
        f"/api/v1/ingredients/{ing_id}/suppliers/{si_id}",
        json={"price_per_pack": 15.00, "sku": "TOM-002"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["price_per_pack"] == 15.00
    assert data["sku"] == "TOM-002"


def test_remove_ingredient_supplier(client: TestClient):
    """Test removing a supplier-ingredient link."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    # Add supplier
    add_resp = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
        },
    )
    si_id = add_resp.json()["id"]

    # Remove
    response = client.delete(f"/api/v1/ingredients/{ing_id}/suppliers/{si_id}")
    assert response.status_code == 204

    # Verify it's gone
    list_resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
    assert list_resp.json() == []


def test_preferred_supplier(client: TestClient):
    """Test preferred supplier logic."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    # Create second supplier
    sup2 = client.post(
        "/api/v1/suppliers",
        json={"name": "Bulk Supplier"},
    ).json()

    # Add first supplier (not preferred)
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
            "is_preferred": False,
        },
    )

    # Add second supplier (preferred)
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup2["id"],
            "pack_size": 10.0,
            "pack_unit": "kg",
            "price_per_pack": 20.00,
            "is_preferred": True,
        },
    )

    # Get preferred
    response = client.get(f"/api/v1/ingredients/{ing_id}/suppliers/preferred")
    assert response.status_code == 200
    data = response.json()
    assert data["supplier_id"] == sup2["id"]
    assert data["is_preferred"] is True


def test_preferred_supplier_fallback(client: TestClient):
    """Test that preferred supplier falls back to first when none marked."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    # Add supplier (not preferred)
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
        },
    )

    response = client.get(f"/api/v1/ingredients/{ing_id}/suppliers/preferred")
    assert response.status_code == 200
    data = response.json()
    assert data["supplier_id"] == sup_id


def test_preferred_supplier_none(client: TestClient):
    """Test preferred supplier returns null when no suppliers exist."""
    ing = client.post(
        "/api/v1/ingredients",
        json={"name": "Garlic", "base_unit": "g"},
    ).json()

    response = client.get(f"/api/v1/ingredients/{ing['id']}/suppliers/preferred")
    assert response.status_code == 200
    assert response.json() is None


def test_sku_uniqueness(client: TestClient):
    """Test that SKU uniqueness is enforced across supplier-ingredient links."""
    ing_id, sup_id = _create_ingredient_and_supplier(client)

    # Create another ingredient
    ing2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Carrot", "base_unit": "kg"},
    ).json()

    # Add supplier to first ingredient with SKU
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "pack_size": 5.0,
            "pack_unit": "kg",
            "price_per_pack": 12.50,
            "sku": "UNIQUE-SKU-001",
        },
    )

    # Try to add same SKU to second ingredient - should fail with 422
    response = client.post(
        f"/api/v1/ingredients/{ing2['id']}/suppliers",
        json={
            "ingredient_id": ing2["id"],
            "supplier_id": sup_id,
            "pack_size": 3.0,
            "pack_unit": "kg",
            "price_per_pack": 8.00,
            "sku": "UNIQUE-SKU-001",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "SKU already exists"
