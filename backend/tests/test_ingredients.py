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
