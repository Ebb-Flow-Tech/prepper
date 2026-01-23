"""Tests for recipe category endpoints."""

from fastapi.testclient import TestClient


def test_create_recipe_category(client: TestClient):
    """Test creating a new recipe category."""
    response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Main Courses",
            "description": "Primary dishes served as the main course",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Main Courses"
    assert data["description"] == "Primary dishes served as the main course"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_recipe_category_without_description(client: TestClient):
    """Test creating a recipe category without description."""
    response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Desserts",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Desserts"
    assert data["description"] is None
    assert "id" in data


def test_list_recipe_categories(client: TestClient):
    """Test listing recipe categories."""
    # Create two categories
    client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Appetizers",
            "description": "Small dishes to start a meal",
        },
    )
    client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Soups",
            "description": "Liquid-based dishes",
        },
    )

    response = client.get("/api/v1/recipe-categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_recipe_category(client: TestClient):
    """Test getting a single recipe category."""
    # Create a category
    create_response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Salads",
            "description": "Cold dishes with fresh vegetables",
        },
    )
    category_id = create_response.json()["id"]

    # Get the category
    response = client.get(f"/api/v1/recipe-categories/{category_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == category_id
    assert data["name"] == "Salads"
    assert data["description"] == "Cold dishes with fresh vegetables"


def test_get_nonexistent_recipe_category(client: TestClient):
    """Test getting a nonexistent recipe category."""
    response = client.get("/api/v1/recipe-categories/999")
    assert response.status_code == 404
    assert "Recipe category not found" in response.json()["detail"]


def test_update_recipe_category(client: TestClient):
    """Test updating a recipe category."""
    # Create a category
    create_response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Original Name",
            "description": "Original description",
        },
    )
    category_id = create_response.json()["id"]

    # Update the category
    update_response = client.patch(
        f"/api/v1/recipe-categories/{category_id}",
        json={
            "name": "Updated Name",
            "description": "Updated description",
        },
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


def test_update_recipe_category_partial(client: TestClient):
    """Test partial update of a recipe category."""
    # Create a category
    create_response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Original Name",
            "description": "Original description",
        },
    )
    category_id = create_response.json()["id"]

    # Update only the name
    update_response = client.patch(
        f"/api/v1/recipe-categories/{category_id}",
        json={
            "name": "New Name",
        },
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "New Name"
    assert data["description"] == "Original description"


def test_update_nonexistent_recipe_category(client: TestClient):
    """Test updating a nonexistent recipe category."""
    response = client.patch(
        "/api/v1/recipe-categories/999",
        json={
            "name": "Updated Name",
        },
    )
    assert response.status_code == 404
    assert "Recipe category not found" in response.json()["detail"]


def test_delete_recipe_category(client: TestClient):
    """Test deleting a recipe category."""
    # Create a category
    create_response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Category to Delete",
            "description": "This will be deleted",
        },
    )
    category_id = create_response.json()["id"]

    # Delete the category
    delete_response = client.delete(f"/api/v1/recipe-categories/{category_id}")
    assert delete_response.status_code == 204

    # Verify the category is deleted
    get_response = client.get(f"/api/v1/recipe-categories/{category_id}")
    assert get_response.status_code == 404


def test_delete_nonexistent_recipe_category(client: TestClient):
    """Test deleting a nonexistent recipe category."""
    response = client.delete("/api/v1/recipe-categories/999")
    assert response.status_code == 404
    assert "Recipe category not found" in response.json()["detail"]
