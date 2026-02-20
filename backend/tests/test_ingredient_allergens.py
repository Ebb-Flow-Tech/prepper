"""Tests for ingredient-allergen relationship endpoints."""

from fastapi.testclient import TestClient


def test_add_allergen_to_ingredient(client: TestClient):
    """Test adding an allergen to an ingredient."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Milk", "base_unit": "ml"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create an allergen
    allergen_response = client.post(
        "/api/v1/allergens",
        json={"name": "Milk"},
    )
    allergen_id = allergen_response.json()["id"]

    # Add allergen to ingredient
    response = client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": allergen_id},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["ingredient_id"] == ingredient_id
    assert data["allergen_id"] == allergen_id
    assert "id" in data
    assert "created_at" in data


def test_add_allergen_to_nonexistent_ingredient(client: TestClient):
    """Test adding an allergen to an ingredient that doesn't exist."""
    # Create an allergen
    allergen_response = client.post(
        "/api/v1/allergens",
        json={"name": "Peanuts"},
    )
    allergen_id = allergen_response.json()["id"]

    # Try to add to nonexistent ingredient
    response = client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": 9999, "allergen_id": allergen_id},
    )
    assert response.status_code == 400


def test_add_nonexistent_allergen_to_ingredient(client: TestClient):
    """Test adding an allergen that doesn't exist to an ingredient."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Egg", "base_unit": "pcs"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Try to add nonexistent allergen
    response = client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": 9999},
    )
    assert response.status_code == 400


def test_add_duplicate_allergen_to_ingredient(client: TestClient):
    """Test that adding the same allergen twice fails."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Wheat", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create an allergen
    allergen_response = client.post(
        "/api/v1/allergens",
        json={"name": "Wheat"},
    )
    allergen_id = allergen_response.json()["id"]

    # Add allergen first time - should succeed
    response1 = client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": allergen_id},
    )
    assert response1.status_code == 201

    # Add allergen second time - should fail
    response2 = client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": allergen_id},
    )
    assert response2.status_code == 400


def test_remove_allergen_from_ingredient(client: TestClient):
    """Test removing an allergen from an ingredient."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Fish", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create an allergen
    allergen_response = client.post(
        "/api/v1/allergens",
        json={"name": "Fish"},
    )
    allergen_id = allergen_response.json()["id"]

    # Add allergen to ingredient
    add_response = client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": allergen_id},
    )
    link_id = add_response.json()["id"]

    # Remove allergen from ingredient
    response = client.delete(f"/api/v1/ingredient-allergens/{link_id}")
    assert response.status_code == 204


def test_remove_nonexistent_link(client: TestClient):
    """Test removing a link that doesn't exist."""
    response = client.delete("/api/v1/ingredient-allergens/9999")
    assert response.status_code == 404


def test_list_all_ingredient_allergen_links(client: TestClient):
    """Test listing all ingredient-allergen links."""
    # Create ingredients
    ing1_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 1", "base_unit": "g"},
    )
    ing1_id = ing1_response.json()["id"]

    ing2_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 2", "base_unit": "ml"},
    )
    ing2_id = ing2_response.json()["id"]

    # Create allergens
    allergen_response = client.post(
        "/api/v1/allergens",
        json={"name": "Allergen 1"},
    )
    allergen_id = allergen_response.json()["id"]

    # Add allergens to ingredients
    client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ing1_id, "allergen_id": allergen_id},
    )
    client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ing2_id, "allergen_id": allergen_id},
    )

    # List all links
    response = client.get("/api/v1/ingredient-allergens")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_allergens_by_ingredient(client: TestClient):
    """Test getting all allergens for a specific ingredient."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create allergens
    allergen1_response = client.post(
        "/api/v1/allergens",
        json={"name": "Allergen 1"},
    )
    allergen1_id = allergen1_response.json()["id"]

    allergen2_response = client.post(
        "/api/v1/allergens",
        json={"name": "Allergen 2"},
    )
    allergen2_id = allergen2_response.json()["id"]

    # Add allergens to ingredient
    client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": allergen1_id},
    )
    client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ingredient_id, "allergen_id": allergen2_id},
    )

    # Get allergens for ingredient
    response = client.get(f"/api/v1/ingredient-allergens/ingredient/{ingredient_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    allergen_ids = [link["allergen_id"] for link in data]
    assert allergen1_id in allergen_ids
    assert allergen2_id in allergen_ids


def test_get_ingredients_by_allergen(client: TestClient):
    """Test getting all ingredients containing a specific allergen."""
    # Create ingredients
    ing1_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 1", "base_unit": "g"},
    )
    ing1_id = ing1_response.json()["id"]

    ing2_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 2", "base_unit": "ml"},
    )
    ing2_id = ing2_response.json()["id"]

    # Create an allergen
    allergen_response = client.post(
        "/api/v1/allergens",
        json={"name": "Test Allergen"},
    )
    allergen_id = allergen_response.json()["id"]

    # Add allergen to both ingredients
    client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ing1_id, "allergen_id": allergen_id},
    )
    client.post(
        "/api/v1/ingredient-allergens",
        json={"ingredient_id": ing2_id, "allergen_id": allergen_id},
    )

    # Get ingredients for allergen
    response = client.get(f"/api/v1/ingredient-allergens/allergen/{allergen_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ingredient_ids = [link["ingredient_id"] for link in data]
    assert ing1_id in ingredient_ids
    assert ing2_id in ingredient_ids


def test_add_multiple_allergens_to_ingredient(client: TestClient):
    """Test adding multiple allergens to a single ingredient."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Complex Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create multiple allergens
    allergen_ids = []
    for i in range(3):
        allergen_response = client.post(
            "/api/v1/allergens",
            json={"name": f"Allergen {i+1}"},
        )
        allergen_ids.append(allergen_response.json()["id"])

    # Add all allergens
    for allergen_id in allergen_ids:
        response = client.post(
            "/api/v1/ingredient-allergens",
            json={"ingredient_id": ingredient_id, "allergen_id": allergen_id},
        )
        assert response.status_code == 201

    # Verify all allergens are associated
    response = client.get(f"/api/v1/ingredient-allergens/ingredient/{ingredient_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_empty_allergen_list_for_ingredient(client: TestClient):
    """Test getting allergens for an ingredient with no allergens."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Clean Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Get allergens - should return empty list
    response = client.get(f"/api/v1/ingredient-allergens/ingredient/{ingredient_id}")
    assert response.status_code == 200
    assert response.json() == []
