"""Tests for ingredient endpoints."""

from fastapi.testclient import TestClient


def _create_outlet(client: TestClient, name: str = "Test Outlet", code: str = "TO") -> int:
    """Helper to create an outlet and return its ID."""
    resp = client.post(
        "/api/v1/outlets",
        json={"name": name, "code": code, "outlet_type": "brand"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


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
    assert data["total_count"] == 2
    assert len(data["items"]) == 2


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
    assert list_response.json()["total_count"] == 0


# -------------------------------------------------------------------------
# Supplier-Ingredient CRUD tests (via supplier_ingredients table)
# -------------------------------------------------------------------------


def _create_ingredient_and_supplier(client: TestClient):
    """Helper to create an ingredient, supplier, and outlet, returning their IDs."""
    ing = client.post(
        "/api/v1/ingredients",
        json={"name": "Tomato", "base_unit": "kg", "cost_per_base_unit": 2.0},
    ).json()
    sup = client.post(
        "/api/v1/suppliers",
        json={"name": "Fresh Farms", "email": "fresh@farms.com"},
    ).json()
    outlet_id = _create_outlet(client)
    return ing["id"], sup["id"], outlet_id


def test_add_ingredient_supplier(client: TestClient):
    """Test adding a supplier to an ingredient via the join table."""
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

    response = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "outlet_id": outlet_id,
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
    assert data["outlet_id"] == outlet_id
    assert data["pack_size"] == 5.0
    assert data["price_per_pack"] == 12.50
    assert data["sku"] == "TOM-001"
    assert data["supplier_name"] == "Fresh Farms"
    assert data["ingredient_name"] == "Tomato"
    assert data["outlet_name"] == "Test Outlet"


def test_get_ingredient_suppliers(client: TestClient):
    """Test listing all suppliers for an ingredient."""
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

    # Add supplier
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "outlet_id": outlet_id,
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
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

    # Add supplier
    add_resp = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "outlet_id": outlet_id,
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
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

    # Add supplier
    add_resp = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "outlet_id": outlet_id,
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
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

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
            "outlet_id": outlet_id,
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
            "outlet_id": outlet_id,
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
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

    # Add supplier (not preferred)
    client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "outlet_id": outlet_id,
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


# -------------------------------------------------------------------------
# Server-Side Filter tests
# -------------------------------------------------------------------------


def test_list_ingredients_filter_by_category_ids(client: TestClient):
    """Test filtering ingredients by category_ids."""
    # Create a category
    cat = client.post("/api/v1/categories", json={"name": "Dairy"}).json()
    cat_id = cat["id"]

    # Create ingredients with and without category
    client.post("/api/v1/ingredients", json={"name": "Milk", "base_unit": "ml", "category_id": cat_id})
    client.post("/api/v1/ingredients", json={"name": "Flour", "base_unit": "g"})

    # Filter by category
    resp = client.get(f"/api/v1/ingredients?category_ids={cat_id}")
    data = resp.json()
    assert data["total_count"] == 1
    assert data["items"][0]["name"] == "Milk"


def test_list_ingredients_filter_by_units(client: TestClient):
    """Test filtering ingredients by units."""
    client.post("/api/v1/ingredients", json={"name": "Water", "base_unit": "ml"})
    client.post("/api/v1/ingredients", json={"name": "Oil", "base_unit": "ml"})
    client.post("/api/v1/ingredients", json={"name": "Flour", "base_unit": "g"})

    resp = client.get("/api/v1/ingredients?units=ml")
    data = resp.json()
    assert data["total_count"] == 2

    resp2 = client.get("/api/v1/ingredients?units=ml,g")
    data2 = resp2.json()
    assert data2["total_count"] == 3


def test_list_ingredients_filter_by_is_halal(client: TestClient):
    """Test filtering ingredients by is_halal."""
    client.post("/api/v1/ingredients", json={"name": "Chicken", "base_unit": "kg", "is_halal": True})
    client.post("/api/v1/ingredients", json={"name": "Pork", "base_unit": "kg", "is_halal": False})

    resp = client.get("/api/v1/ingredients?is_halal=true")
    data = resp.json()
    assert data["total_count"] == 1
    assert data["items"][0]["name"] == "Chicken"

    resp2 = client.get("/api/v1/ingredients?is_halal=false")
    data2 = resp2.json()
    assert data2["total_count"] == 1
    assert data2["items"][0]["name"] == "Pork"


def test_list_ingredients_filter_by_allergen_ids(client: TestClient):
    """Test filtering ingredients by allergen_ids."""
    # Create allergen
    allergen = client.post("/api/v1/allergens", json={"name": "Gluten"}).json()
    allergen_id = allergen["id"]

    # Create ingredients
    ing1 = client.post("/api/v1/ingredients", json={"name": "Wheat", "base_unit": "g"}).json()
    client.post("/api/v1/ingredients", json={"name": "Rice", "base_unit": "g"})

    # Link allergen to ingredient
    client.post("/api/v1/ingredient-allergens", json={"ingredient_id": ing1["id"], "allergen_id": allergen_id})

    # Filter by allergen
    resp = client.get(f"/api/v1/ingredients?allergen_ids={allergen_id}")
    data = resp.json()
    assert data["total_count"] == 1
    assert data["items"][0]["name"] == "Wheat"


def test_list_ingredients_combined_filters(client: TestClient):
    """Test combining multiple filters (AND logic)."""
    cat = client.post("/api/v1/categories", json={"name": "Grains"}).json()

    client.post("/api/v1/ingredients", json={"name": "Wheat Flour", "base_unit": "g", "category_id": cat["id"], "is_halal": True})
    client.post("/api/v1/ingredients", json={"name": "Rice Flour", "base_unit": "g", "category_id": cat["id"], "is_halal": False})
    client.post("/api/v1/ingredients", json={"name": "Water", "base_unit": "ml", "is_halal": True})

    # Filter by category + halal
    resp = client.get(f"/api/v1/ingredients?category_ids={cat['id']}&is_halal=true")
    data = resp.json()
    assert data["total_count"] == 1
    assert data["items"][0]["name"] == "Wheat Flour"

    # Filter by category + unit
    resp2 = client.get(f"/api/v1/ingredients?category_ids={cat['id']}&units=g")
    data2 = resp2.json()
    assert data2["total_count"] == 2


def test_sku_uniqueness(client: TestClient):
    """Test that SKU uniqueness is enforced across supplier-ingredient links."""
    ing_id, sup_id, outlet_id = _create_ingredient_and_supplier(client)

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
            "outlet_id": outlet_id,
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
            "outlet_id": outlet_id,
            "pack_size": 3.0,
            "pack_unit": "kg",
            "price_per_pack": 8.00,
            "sku": "UNIQUE-SKU-001",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "SKU already exists"
