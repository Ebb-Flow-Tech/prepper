"""Tests for ingredient-tasting session relationship endpoints."""

from fastapi.testclient import TestClient


def test_add_ingredient_to_session(client: TestClient):
    """Test adding an ingredient to a tasting session."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Olive Oil", "base_unit": "ml"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Ingredient Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add ingredient to session
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient_id},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["ingredient_id"] == ingredient_id
    assert data["tasting_session_id"] == session_id
    assert "id" in data
    assert "created_at" in data


def test_add_ingredient_to_nonexistent_session(client: TestClient):
    """Test adding an ingredient to a session that doesn't exist."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Try to add to nonexistent session
    response = client.post(
        "/api/v1/tasting-sessions/9999/ingredients",
        json={"ingredient_id": ingredient_id},
    )
    assert response.status_code == 404


def test_add_nonexistent_ingredient_to_session(client: TestClient):
    """Test adding an ingredient that doesn't exist to a session."""
    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Try to add nonexistent ingredient
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": 9999},
    )
    assert response.status_code == 400


def test_add_duplicate_ingredient_to_session(client: TestClient):
    """Test that adding the same ingredient twice fails."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "kg"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add ingredient first time - should succeed
    response1 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient_id},
    )
    assert response1.status_code == 201

    # Add ingredient second time - should fail
    response2 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient_id},
    )
    assert response2.status_code == 400


def test_remove_ingredient_from_session(client: TestClient):
    """Test removing an ingredient from a tasting session."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "l"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add ingredient to session
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient_id},
    )

    # Remove ingredient from session
    response = client.delete(
        f"/api/v1/tasting-sessions/{session_id}/ingredients/{ingredient_id}"
    )
    assert response.status_code == 204


def test_remove_nonexistent_ingredient_from_session(client: TestClient):
    """Test removing an ingredient that isn't in the session."""
    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Try to remove an ingredient that was never added
    response = client.delete(
        f"/api/v1/tasting-sessions/{session_id}/ingredients/9999"
    )
    assert response.status_code == 404


def test_add_multiple_ingredients_to_session(client: TestClient):
    """Test adding multiple ingredients to a session."""
    # Create ingredients
    ingredient1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 1", "base_unit": "g"},
    ).json()
    ingredient2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 2", "base_unit": "ml"},
    ).json()
    ingredient3 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 3", "base_unit": "kg"},
    ).json()

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Ingredient Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add all ingredients
    for ingredient in [ingredient1, ingredient2, ingredient3]:
        response = client.post(
            f"/api/v1/tasting-sessions/{session_id}/ingredients",
            json={"ingredient_id": ingredient["id"]},
        )
        assert response.status_code == 201


def test_get_session_ingredients(client: TestClient):
    """Test getting all ingredients associated with a tasting session."""
    # Create ingredients
    ingredient1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 1", "base_unit": "g"},
    ).json()
    ingredient2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 2", "base_unit": "ml"},
    ).json()

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Ingredient Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add ingredients to session
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient1["id"]},
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient2["id"]},
    )

    # Get session ingredients
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredients")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ingredient_ids = [r["ingredient_id"] for r in data]
    assert ingredient1["id"] in ingredient_ids
    assert ingredient2["id"] in ingredient_ids


def test_batch_add_ingredients_to_session(client: TestClient):
    """Test adding multiple ingredients to a session in one call."""
    ingredient1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Batch Ingredient 1", "base_unit": "g"},
    ).json()
    ingredient2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Batch Ingredient 2", "base_unit": "ml"},
    ).json()
    ingredient3 = client.post(
        "/api/v1/ingredients",
        json={"name": "Batch Ingredient 3", "base_unit": "kg"},
    ).json()

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Batch Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients/batch",
        json={"ingredient_ids": [ingredient1["id"], ingredient2["id"], ingredient3["id"]]},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["added"]) == 3
    assert len(data["skipped"]) == 0
    assert ingredient1["id"] in data["added"]
    assert ingredient2["id"] in data["added"]
    assert ingredient3["id"] in data["added"]

    # Verify all ingredients are in session
    get_response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredients")
    assert len(get_response.json()) == 3


def test_batch_add_ingredients_skips_duplicates(client: TestClient):
    """Test that batch add skips already-added ingredients."""
    ingredient1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Existing Ingredient", "base_unit": "g"},
    ).json()
    ingredient2 = client.post(
        "/api/v1/ingredients",
        json={"name": "New Ingredient", "base_unit": "ml"},
    ).json()

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add ingredient1 individually first
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients",
        json={"ingredient_id": ingredient1["id"]},
    )

    # Batch add both - ingredient1 should be skipped
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients/batch",
        json={"ingredient_ids": [ingredient1["id"], ingredient2["id"]]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == [ingredient2["id"]]
    assert data["skipped"] == [ingredient1["id"]]


def test_batch_add_ingredients_skips_nonexistent(client: TestClient):
    """Test that batch add skips nonexistent ingredient IDs."""
    ingredient1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Valid Ingredient", "base_unit": "g"},
    ).json()

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients/batch",
        json={"ingredient_ids": [ingredient1["id"], 9999]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == [ingredient1["id"]]
    assert data["skipped"] == [9999]


def test_batch_add_ingredients_nonexistent_session(client: TestClient):
    """Test batch add to a nonexistent session returns 404."""
    response = client.post(
        "/api/v1/tasting-sessions/9999/ingredients/batch",
        json={"ingredient_ids": [1, 2]},
    )
    assert response.status_code == 404


def test_batch_add_ingredients_empty_list(client: TestClient):
    """Test batch add with empty list returns empty result."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredients/batch",
        json={"ingredient_ids": []},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == []
    assert data["skipped"] == []


def test_get_session_ingredients_empty(client: TestClient):
    """Test getting ingredients from a session with no ingredients."""
    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Empty Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Get session ingredients - should return empty list
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredients")
    assert response.status_code == 200
    assert response.json() == []
