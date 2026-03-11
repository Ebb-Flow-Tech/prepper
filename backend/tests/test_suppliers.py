"""Tests for supplier endpoints."""

from fastapi.testclient import TestClient


def test_create_supplier(client: TestClient):
    """Test creating a new supplier."""
    response = client.post(
        "/api/v1/suppliers",
        json={
            "name": "ACME Foods",
            "address": "123 Main St, Springfield",
            "phone_number": "+1-555-123-4567",
            "email": "contact@acmefoods.com",
            "shipping_company_name": "FastFreight Ltd",
            "code": "ACME",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "ACME Foods"
    assert data["address"] == "123 Main St, Springfield"
    assert data["phone_number"] == "+1-555-123-4567"
    assert data["email"] == "contact@acmefoods.com"
    assert data["shipping_company_name"] == "FastFreight Ltd"
    assert data["code"] == "ACME"
    assert "id" in data


def test_list_suppliers(client: TestClient):
    """Test listing suppliers."""
    # Create two suppliers
    client.post(
        "/api/v1/suppliers",
        json={
            "name": "Fresh Farms",
            "address": "456 Farm Rd, Countryside",
            "phone_number": "+1-555-987-6543",
            "email": "info@freshfarms.com",
        },
    )
    client.post(
        "/api/v1/suppliers",
        json={
            "name": "Local Produce Co",
            "address": "789 Market St, Downtown",
            "phone_number": "+1-555-456-7890",
            "email": "sales@localproduce.com",
        },
    )

    response = client.get("/api/v1/suppliers")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 2
    assert len(data["items"]) == 2


def test_update_supplier(client: TestClient):
    """Test updating a supplier."""
    # Create a supplier
    create_response = client.post(
        "/api/v1/suppliers",
        json={
            "name": "Original Supplier",
            "address": "100 Old St",
            "phone_number": "+1-555-000-0000",
            "email": "old@supplier.com",
        },
    )
    assert create_response.status_code == 201
    supplier_id = create_response.json()["id"]

    # Update the supplier
    update_response = client.patch(
        f"/api/v1/suppliers/{supplier_id}",
        json={
            "name": "Updated Supplier",
            "address": "200 New Ave",
            "phone_number": "+1-555-111-1111",
            "email": "new@supplier.com",
            "shipping_company_name": "SpeedShip Co",
            "code": "UPDS",
        },
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "Updated Supplier"
    assert data["address"] == "200 New Ave"
    assert data["phone_number"] == "+1-555-111-1111"
    assert data["email"] == "new@supplier.com"
    assert data["shipping_company_name"] == "SpeedShip Co"
    assert data["code"] == "UPDS"


def test_update_supplier_shipping_and_code(client: TestClient):
    """Test that shipping_company_name and code can be set and cleared independently."""
    create_response = client.post(
        "/api/v1/suppliers",
        json={
            "name": "Shipping Test Supplier",
            "shipping_company_name": "Initial Carrier",
            "code": "INIT",
        },
    )
    assert create_response.status_code == 201
    data = create_response.json()
    assert data["shipping_company_name"] == "Initial Carrier"
    assert data["code"] == "INIT"
    supplier_id = data["id"]

    # Clear shipping_company_name and code
    update_response = client.patch(
        f"/api/v1/suppliers/{supplier_id}",
        json={"shipping_company_name": None, "code": None},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["shipping_company_name"] is None
    assert updated["code"] is None


def test_delete_supplier(client: TestClient):
    """Test deleting a supplier."""
    # Create a supplier
    create_response = client.post(
        "/api/v1/suppliers",
        json={
            "name": "Supplier To Delete",
            "address": "999 Delete Ln",
            "phone_number": "+1-555-999-9999",
            "email": "delete@supplier.com",
        },
    )
    assert create_response.status_code == 201
    supplier_id = create_response.json()["id"]

    # Delete the supplier
    delete_response = client.delete(f"/api/v1/suppliers/{supplier_id}")
    assert delete_response.status_code == 204

    # Verify the supplier is deleted
    get_response = client.get(f"/api/v1/suppliers/{supplier_id}")
    assert get_response.status_code == 404


def test_get_supplier(client: TestClient):
    """Test getting a single supplier by ID."""
    create_response = client.post(
        "/api/v1/suppliers",
        json={"name": "Single Supplier", "email": "single@supplier.com"},
    )
    supplier_id = create_response.json()["id"]

    response = client.get(f"/api/v1/suppliers/{supplier_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Single Supplier"


def test_get_supplier_not_found(client: TestClient):
    """Test getting a non-existent supplier returns 404."""
    response = client.get("/api/v1/suppliers/99999")
    assert response.status_code == 404


def test_deactivate_supplier(client: TestClient):
    """Test soft-deleting a supplier via deactivate endpoint."""
    create_response = client.post(
        "/api/v1/suppliers",
        json={"name": "Supplier To Deactivate"},
    )
    supplier_id = create_response.json()["id"]

    response = client.patch(f"/api/v1/suppliers/{supplier_id}/deactivate")
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # Deactivated supplier should still be retrievable by ID
    get_response = client.get(f"/api/v1/suppliers/{supplier_id}")
    assert get_response.status_code == 200
    assert get_response.json()["is_active"] is False


def test_deactivate_supplier_not_found(client: TestClient):
    """Test deactivating a non-existent supplier returns 404."""
    response = client.patch("/api/v1/suppliers/99999/deactivate")
    assert response.status_code == 404


def test_reactivate_supplier_via_update(client: TestClient):
    """Test restoring an archived supplier by updating is_active to True."""
    # Create and deactivate
    create_response = client.post(
        "/api/v1/suppliers",
        json={"name": "Supplier To Restore"},
    )
    supplier_id = create_response.json()["id"]
    client.patch(f"/api/v1/suppliers/{supplier_id}/deactivate")

    # Reactivate via PATCH update
    response = client.patch(
        f"/api/v1/suppliers/{supplier_id}",
        json={"is_active": True},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is True
    assert response.json()["name"] == "Supplier To Restore"


def test_list_suppliers_active_only(client: TestClient):
    """Test that listing suppliers filters out deactivated ones by default."""
    client.post("/api/v1/suppliers", json={"name": "Active Supplier"})
    deactivate_resp = client.post(
        "/api/v1/suppliers", json={"name": "Inactive Supplier"}
    )
    inactive_id = deactivate_resp.json()["id"]
    client.patch(f"/api/v1/suppliers/{inactive_id}/deactivate")

    # Default: active_only=True
    response = client.get("/api/v1/suppliers")
    assert response.status_code == 200
    names = [s["name"] for s in response.json()["items"]]
    assert "Active Supplier" in names
    assert "Inactive Supplier" not in names


def test_list_suppliers_include_inactive(client: TestClient):
    """Test listing all suppliers including deactivated ones."""
    client.post("/api/v1/suppliers", json={"name": "Active Supplier 2"})
    deactivate_resp = client.post(
        "/api/v1/suppliers", json={"name": "Inactive Supplier 2"}
    )
    inactive_id = deactivate_resp.json()["id"]
    client.patch(f"/api/v1/suppliers/{inactive_id}/deactivate")

    # active_only=false returns all
    response = client.get("/api/v1/suppliers", params={"active_only": False})
    assert response.status_code == 200
    names = [s["name"] for s in response.json()["items"]]
    assert "Active Supplier 2" in names
    assert "Inactive Supplier 2" in names


def test_update_supplier_not_found(client: TestClient):
    """Test updating a non-existent supplier returns 404."""
    response = client.patch(
        "/api/v1/suppliers/99999",
        json={"name": "Does Not Exist"},
    )
    assert response.status_code == 404


def test_delete_supplier_not_found(client: TestClient):
    """Test deleting a non-existent supplier returns 404."""
    response = client.delete("/api/v1/suppliers/99999")
    assert response.status_code == 404


def test_get_supplier_ingredients_empty(client: TestClient):
    """Test getting ingredients for a supplier with no linked ingredients."""
    create_response = client.post(
        "/api/v1/suppliers",
        json={"name": "No Ingredients Supplier"},
    )
    supplier_id = create_response.json()["id"]

    response = client.get(f"/api/v1/suppliers/{supplier_id}/ingredients")
    assert response.status_code == 200
    assert response.json() == []


def test_get_supplier_ingredients_not_found(client: TestClient):
    """Test getting ingredients for a non-existent supplier returns 404."""
    response = client.get("/api/v1/suppliers/99999/ingredients")
    assert response.status_code == 404


def test_get_supplier_ingredients_with_links(client: TestClient):
    """Test getting ingredients linked via supplier_ingredients table."""
    # Create supplier
    sup = client.post(
        "/api/v1/suppliers",
        json={"name": "Test Supplier"},
    ).json()

    # Create ingredient
    ing = client.post(
        "/api/v1/ingredients",
        json={"name": "Rice", "base_unit": "kg", "cost_per_base_unit": 1.5},
    ).json()

    # Create outlet
    outlet = client.post(
        "/api/v1/outlets",
        json={"name": "Test Outlet", "code": "TO", "outlet_type": "brand"},
    ).json()

    # Link them via ingredient supplier endpoint
    client.post(
        f"/api/v1/ingredients/{ing['id']}/suppliers",
        json={
            "ingredient_id": ing["id"],
            "supplier_id": sup["id"],
            "outlet_id": outlet["id"],
            "pack_size": 25.0,
            "pack_unit": "kg",
            "price_per_pack": 30.00,
        },
    )

    # Query from supplier side
    response = client.get(f"/api/v1/suppliers/{sup['id']}/ingredients")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["ingredient_id"] == ing["id"]
    assert data[0]["supplier_id"] == sup["id"]
    assert data[0]["outlet_id"] == outlet["id"]
    assert data[0]["ingredient_name"] == "Rice"
    assert data[0]["supplier_name"] == "Test Supplier"
    assert data[0]["outlet_name"] == "Test Outlet"
    assert data[0]["pack_size"] == 25.0
    assert data[0]["price_per_pack"] == 30.00
