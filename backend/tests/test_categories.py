"""Tests for category endpoints."""

from fastapi.testclient import TestClient


def test_create_category(client: TestClient):
    """Test creating a new category."""
    response = client.post(
        "/api/v1/categories",
        json={
            "name": "Proteins",
            "description": "Meat, fish, and other protein sources",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Proteins"
    assert data["description"] == "Meat, fish, and other protein sources"
    assert data["is_active"] is True
    assert "id" in data


def test_create_category_without_description(client: TestClient):
    """Test creating a category with optional description omitted."""
    response = client.post(
        "/api/v1/categories",
        json={"name": "Vegetables"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Vegetables"
    assert data["description"] is None
    assert data["is_active"] is True


def test_create_category_duplicate_name(client: TestClient):
    """Test that creating a category with duplicate name fails."""
    client.post(
        "/api/v1/categories",
        json={"name": "Dairy"},
    )

    # Try to create another category with the same name
    response = client.post(
        "/api/v1/categories",
        json={"name": "Dairy"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_create_category_duplicate_name_case_insensitive(client: TestClient):
    """Test that category name uniqueness is case-insensitive."""
    client.post(
        "/api/v1/categories",
        json={"name": "Grains"},
    )

    # Try to create with different case
    response = client.post(
        "/api/v1/categories",
        json={"name": "GRAINS"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]

    # Try with mixed case
    response = client.post(
        "/api/v1/categories",
        json={"name": "gRaInS"},
    )
    assert response.status_code == 409


def test_list_categories(client: TestClient):
    """Test listing categories."""
    # Create two categories
    client.post(
        "/api/v1/categories",
        json={"name": "Fruits", "description": "Fresh fruits"},
    )
    client.post(
        "/api/v1/categories",
        json={"name": "Spices", "description": "Seasonings and spices"},
    )

    response = client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_list_categories_excludes_soft_deleted(client: TestClient):
    """Test that listing categories excludes soft-deleted ones by default."""
    # Create and delete a category
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "To Delete"},
    )
    category_id = create_response.json()["id"]
    client.delete(f"/api/v1/categories/{category_id}")

    # Create an active category
    client.post(
        "/api/v1/categories",
        json={"name": "Active Category"},
    )

    # List should only show active category
    response = client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Active Category"


def test_list_categories_include_inactive(client: TestClient):
    """Test listing categories with inactive ones included."""
    # Create and delete a category
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Inactive"},
    )
    category_id = create_response.json()["id"]
    client.delete(f"/api/v1/categories/{category_id}")

    # Create an active category
    client.post(
        "/api/v1/categories",
        json={"name": "Active"},
    )

    # List with active_only=false
    response = client.get("/api/v1/categories?active_only=false")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_category(client: TestClient):
    """Test getting a category by ID."""
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Beverages", "description": "Drinks and liquids"},
    )
    category_id = create_response.json()["id"]

    response = client.get(f"/api/v1/categories/{category_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Beverages"
    assert data["description"] == "Drinks and liquids"


def test_get_category_not_found(client: TestClient):
    """Test getting a non-existent category."""
    response = client.get("/api/v1/categories/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Category not found"


def test_update_category(client: TestClient):
    """Test updating a category."""
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Original Name", "description": "Original description"},
    )
    category_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/categories/{category_id}",
        json={"name": "Updated Name", "description": "Updated description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


def test_update_category_partial(client: TestClient):
    """Test partial update of a category (only name)."""
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Partial", "description": "Keep this"},
    )
    category_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/categories/{category_id}",
        json={"name": "Partially Updated"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Partially Updated"
    assert data["description"] == "Keep this"


def test_update_category_duplicate_name(client: TestClient):
    """Test that updating to a duplicate name fails."""
    # Create two categories
    client.post(
        "/api/v1/categories",
        json={"name": "First"},
    )
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Second"},
    )
    category_id = create_response.json()["id"]

    # Try to update second to have the same name as first
    response = client.patch(
        f"/api/v1/categories/{category_id}",
        json={"name": "First"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_update_category_same_name_allowed(client: TestClient):
    """Test that updating a category with its own name is allowed."""
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Same Name"},
    )
    category_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/categories/{category_id}",
        json={"name": "Same Name", "description": "Added description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Same Name"
    assert data["description"] == "Added description"


def test_update_category_not_found(client: TestClient):
    """Test updating a non-existent category."""
    response = client.patch(
        "/api/v1/categories/999",
        json={"name": "Does not exist"},
    )
    assert response.status_code == 404


def test_delete_category_soft_delete(client: TestClient):
    """Test that delete performs a soft delete."""
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Soft Delete Me"},
    )
    category_id = create_response.json()["id"]

    response = client.delete(f"/api/v1/categories/{category_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False

    # Category should still be retrievable by ID
    get_response = client.get(f"/api/v1/categories/{category_id}")
    assert get_response.status_code == 200
    assert get_response.json()["is_active"] is False


def test_delete_category_not_found(client: TestClient):
    """Test deleting a non-existent category."""
    response = client.delete("/api/v1/categories/999")
    assert response.status_code == 404


def test_duplicate_name_allowed_after_soft_delete(client: TestClient):
    """Test that a name can be reused after the original is soft-deleted."""
    # Create and soft-delete a category
    create_response = client.post(
        "/api/v1/categories",
        json={"name": "Recyclable Name"},
    )
    category_id = create_response.json()["id"]
    client.delete(f"/api/v1/categories/{category_id}")

    # Create a new category with the same name
    response = client.post(
        "/api/v1/categories",
        json={"name": "Recyclable Name"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Recyclable Name"
    assert data["is_active"] is True
