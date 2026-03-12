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
    assert data["is_active"] is True
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
    assert data["is_active"] is True
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
    assert data["total_count"] == 2
    assert len(data["items"]) == 2


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
    """Test soft-deleting a recipe category (archive)."""
    # Create a category
    create_response = client.post(
        "/api/v1/recipe-categories",
        json={
            "name": "Category to Archive",
            "description": "This will be archived",
        },
    )
    category_id = create_response.json()["id"]

    # Soft-delete the category
    delete_response = client.delete(f"/api/v1/recipe-categories/{category_id}")
    assert delete_response.status_code == 200
    data = delete_response.json()
    assert data["is_active"] is False

    # Verify the category is excluded from default (active_only=true) listing
    list_response = client.get("/api/v1/recipe-categories")
    ids = [c["id"] for c in list_response.json()["items"]]
    assert category_id not in ids

    # Verify the category still exists and is accessible by ID
    get_response = client.get(f"/api/v1/recipe-categories/{category_id}")
    assert get_response.status_code == 200
    assert get_response.json()["is_active"] is False


def test_list_recipe_categories_active_only(client: TestClient):
    """Test that active_only filter excludes archived categories."""
    # Create two categories
    r1 = client.post("/api/v1/recipe-categories", json={"name": "Active Cat"})
    r2 = client.post("/api/v1/recipe-categories", json={"name": "Archived Cat"})
    active_id = r1.json()["id"]
    archived_id = r2.json()["id"]

    # Archive the second one
    client.delete(f"/api/v1/recipe-categories/{archived_id}")

    # Default list (active_only=true) should only show the active one
    response = client.get("/api/v1/recipe-categories")
    assert response.status_code == 200
    data = response.json()
    ids = [c["id"] for c in data["items"]]
    assert active_id in ids
    assert archived_id not in ids

    # active_only=false should show both
    response_all = client.get("/api/v1/recipe-categories?active_only=false")
    assert response_all.status_code == 200
    ids_all = [c["id"] for c in response_all.json()["items"]]
    assert active_id in ids_all
    assert archived_id in ids_all


def test_unarchive_recipe_category(client: TestClient):
    """Test restoring an archived recipe category via PATCH."""
    create_response = client.post("/api/v1/recipe-categories", json={"name": "Restore Me"})
    category_id = create_response.json()["id"]

    # Archive it
    client.delete(f"/api/v1/recipe-categories/{category_id}")

    # Restore via PATCH
    patch_response = client.patch(
        f"/api/v1/recipe-categories/{category_id}",
        json={"is_active": True},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["is_active"] is True

    # Should now appear in default listing again
    list_response = client.get("/api/v1/recipe-categories")
    ids = [c["id"] for c in list_response.json()["items"]]
    assert category_id in ids


def test_delete_nonexistent_recipe_category(client: TestClient):
    """Test deleting a nonexistent recipe category."""
    response = client.delete("/api/v1/recipe-categories/999")
    assert response.status_code == 404
    assert "Recipe category not found" in response.json()["detail"]
