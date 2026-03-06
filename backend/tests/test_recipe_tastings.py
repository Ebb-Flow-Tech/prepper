"""Tests for recipe-tasting session relationship endpoints."""

from fastapi.testclient import TestClient


def test_add_recipe_to_session(client: TestClient):
    """Test adding a recipe to a tasting session."""
    # Create a recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Carbonara", "yield_quantity": 4, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Menu Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add recipe to session
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe_id},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["tasting_session_id"] == session_id
    assert "id" in data
    assert "created_at" in data


def test_add_recipe_to_nonexistent_session(client: TestClient):
    """Test adding a recipe to a session that doesn't exist."""
    # Create a recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Try to add to nonexistent session
    response = client.post(
        "/api/v1/tasting-sessions/9999/recipes",
        json={"recipe_id": recipe_id},
    )
    assert response.status_code == 404


def test_add_nonexistent_recipe_to_session(client: TestClient):
    """Test adding a recipe that doesn't exist to a session."""
    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Try to add nonexistent recipe
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": 9999},
    )
    assert response.status_code == 400


def test_add_duplicate_recipe_to_session(client: TestClient):
    """Test that adding the same recipe twice fails."""
    # Create a recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add recipe first time - should succeed
    response1 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe_id},
    )
    assert response1.status_code == 201

    # Add recipe second time - should fail
    response2 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe_id},
    )
    assert response2.status_code == 400


def test_remove_recipe_from_session(client: TestClient):
    """Test removing a recipe from a tasting session."""
    # Create a recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add recipe to session
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe_id},
    )

    # Remove recipe from session
    response = client.delete(
        f"/api/v1/tasting-sessions/{session_id}/recipes/{recipe_id}"
    )
    assert response.status_code == 204


def test_remove_nonexistent_recipe_from_session(client: TestClient):
    """Test removing a recipe that isn't in the session."""
    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Try to remove a recipe that was never added
    response = client.delete(
        f"/api/v1/tasting-sessions/{session_id}/recipes/9999"
    )
    assert response.status_code == 404


def test_add_multiple_recipes_to_session(client: TestClient):
    """Test adding multiple recipes to a session."""
    # Create recipes
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 1", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe2 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 2", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe3 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 3", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Menu Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add all recipes
    for recipe in [recipe1, recipe2, recipe3]:
        response = client.post(
            f"/api/v1/tasting-sessions/{session_id}/recipes",
            json={"recipe_id": recipe["id"]},
        )
        assert response.status_code == 201


def test_get_session_recipes(client: TestClient):
    """Test getting all recipes associated with a tasting session."""
    # Create recipes
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 1", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe2 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 2", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Menu Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add recipes to session
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe1["id"]},
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe2["id"]},
    )

    # Get session recipes
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    recipe_ids = [r["recipe_id"] for r in data]
    assert recipe1["id"] in recipe_ids
    assert recipe2["id"] in recipe_ids


def test_batch_add_recipes_to_session(client: TestClient):
    """Test adding multiple recipes to a session in one call."""
    # Create recipes
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Batch Recipe 1", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe2 = client.post(
        "/api/v1/recipes",
        json={"name": "Batch Recipe 2", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe3 = client.post(
        "/api/v1/recipes",
        json={"name": "Batch Recipe 3", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Batch Tasting", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Batch add all recipes
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes/batch",
        json={"recipe_ids": [recipe1["id"], recipe2["id"], recipe3["id"]]},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["added"]) == 3
    assert len(data["skipped"]) == 0
    assert recipe1["id"] in data["added"]
    assert recipe2["id"] in data["added"]
    assert recipe3["id"] in data["added"]

    # Verify all recipes are in session
    get_response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert len(get_response.json()) == 3


def test_batch_add_recipes_skips_duplicates(client: TestClient):
    """Test that batch add skips already-added recipes."""
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Existing Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe2 = client.post(
        "/api/v1/recipes",
        json={"name": "New Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add recipe1 individually first
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe1["id"]},
    )

    # Batch add both - recipe1 should be skipped
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes/batch",
        json={"recipe_ids": [recipe1["id"], recipe2["id"]]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == [recipe2["id"]]
    assert data["skipped"] == [recipe1["id"]]


def test_batch_add_recipes_skips_nonexistent(client: TestClient):
    """Test that batch add skips nonexistent recipe IDs."""
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Valid Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes/batch",
        json={"recipe_ids": [recipe1["id"], 9999]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == [recipe1["id"]]
    assert data["skipped"] == [9999]


def test_batch_add_recipes_nonexistent_session(client: TestClient):
    """Test batch add to a nonexistent session returns 404."""
    response = client.post(
        "/api/v1/tasting-sessions/9999/recipes/batch",
        json={"recipe_ids": [1, 2]},
    )
    assert response.status_code == 404


def test_batch_add_recipes_empty_list(client: TestClient):
    """Test batch add with empty list returns empty result."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes/batch",
        json={"recipe_ids": []},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == []
    assert data["skipped"] == []


def test_get_session_recipes_empty(client: TestClient):
    """Test getting recipes from a session with no recipes."""
    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Empty Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Get session recipes - should return empty list
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert response.status_code == 200
    assert response.json() == []
