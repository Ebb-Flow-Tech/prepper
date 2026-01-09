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
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "ACME Foods"
    assert data["address"] == "123 Main St, Springfield"
    assert data["phone_number"] == "+1-555-123-4567"
    assert data["email"] == "contact@acmefoods.com"
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
    assert len(data) == 2


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
        },
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "Updated Supplier"
    assert data["address"] == "200 New Ave"
    assert data["phone_number"] == "+1-555-111-1111"
    assert data["email"] == "new@supplier.com"


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
