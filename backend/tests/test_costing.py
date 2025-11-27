"""Tests for costing endpoints."""

from fastapi.testclient import TestClient


def test_calculate_recipe_cost(client: TestClient):
    """Test calculating recipe cost."""
    # Create ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={
            "name": "Flour",
            "base_unit": "g",
            "cost_per_base_unit": 0.002,
        },
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Simple Bread",
            "yield_quantity": 2,
            "yield_unit": "loaf",
        },
    )
    recipe_id = recipe_response.json()["id"]

    # Add ingredient to recipe (500g flour)
    client.post(
        f"/api/v1/recipes/{recipe_id}/ingredients",
        json={
            "ingredient_id": ingredient_id,
            "quantity": 500,
            "unit": "g",
        },
    )

    # Calculate costing
    response = client.get(f"/api/v1/recipes/{recipe_id}/costing")
    assert response.status_code == 200
    data = response.json()

    assert data["recipe_name"] == "Simple Bread"
    assert data["total_batch_cost"] == 1.0  # 500g * 0.002
    assert data["cost_per_portion"] == 0.5  # 1.0 / 2 loaves
    assert len(data["breakdown"]) == 1
    assert data["missing_costs"] == []


def test_costing_with_unit_conversion(client: TestClient):
    """Test costing with unit conversion (kg to g)."""
    # Create ingredient with cost in grams
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={
            "name": "Sugar",
            "base_unit": "g",
            "cost_per_base_unit": 0.001,
        },
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Sweet Mix",
            "yield_quantity": 1,
            "yield_unit": "batch",
        },
    )
    recipe_id = recipe_response.json()["id"]

    # Add 1kg of sugar (should convert to 1000g)
    client.post(
        f"/api/v1/recipes/{recipe_id}/ingredients",
        json={
            "ingredient_id": ingredient_id,
            "quantity": 1,
            "unit": "kg",
        },
    )

    # Calculate costing
    response = client.get(f"/api/v1/recipes/{recipe_id}/costing")
    assert response.status_code == 200
    data = response.json()

    # 1kg = 1000g, cost = 1000 * 0.001 = 1.0
    assert data["total_batch_cost"] == 1.0
