"""Tests for allergen endpoints."""

from fastapi.testclient import TestClient


def test_create_allergen(client: TestClient):
    """Test creating a new allergen."""
    response = client.post(
        "/api/v1/allergens",
        json={
            "name": "Milk",
            "description": "Dairy products containing milk",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Milk"
    assert data["description"] == "Dairy products containing milk"
    assert data["is_active"] is True
    assert "id" in data


def test_create_allergen_without_description(client: TestClient):
    """Test creating an allergen with optional description omitted."""
    response = client.post(
        "/api/v1/allergens",
        json={"name": "Peanuts"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Peanuts"
    assert data["description"] is None
    assert data["is_active"] is True


def test_create_allergen_duplicate_name(client: TestClient):
    """Test that creating an allergen with duplicate name fails."""
    client.post(
        "/api/v1/allergens",
        json={"name": "Eggs"},
    )

    # Try to create another allergen with the same name
    response = client.post(
        "/api/v1/allergens",
        json={"name": "Eggs"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_create_allergen_duplicate_name_case_insensitive(client: TestClient):
    """Test that allergen name uniqueness is case-insensitive."""
    client.post(
        "/api/v1/allergens",
        json={"name": "Fish"},
    )

    # Try to create with different case
    response = client.post(
        "/api/v1/allergens",
        json={"name": "FISH"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]

    # Try with mixed case
    response = client.post(
        "/api/v1/allergens",
        json={"name": "FiSh"},
    )
    assert response.status_code == 409


def test_list_allergens(client: TestClient):
    """Test listing allergens."""
    # Create two allergens
    client.post(
        "/api/v1/allergens",
        json={"name": "Shellfish", "description": "Crustaceans and mollusks"},
    )
    client.post(
        "/api/v1/allergens",
        json={"name": "Tree Nuts", "description": "Almonds, walnuts, etc."},
    )

    response = client.get("/api/v1/allergens")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_list_allergens_excludes_soft_deleted(client: TestClient):
    """Test that listing allergens excludes soft-deleted ones by default."""
    # Create and delete an allergen
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "To Delete"},
    )
    allergen_id = create_response.json()["id"]
    client.delete(f"/api/v1/allergens/{allergen_id}")

    # Create an active allergen
    client.post(
        "/api/v1/allergens",
        json={"name": "Active Allergen"},
    )

    # List should only show active allergen
    response = client.get("/api/v1/allergens")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Active Allergen"


def test_list_allergens_include_inactive(client: TestClient):
    """Test listing allergens with inactive ones included."""
    # Create and delete an allergen
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Inactive"},
    )
    allergen_id = create_response.json()["id"]
    client.delete(f"/api/v1/allergens/{allergen_id}")

    # Create an active allergen
    client.post(
        "/api/v1/allergens",
        json={"name": "Active"},
    )

    # List with active_only=false
    response = client.get("/api/v1/allergens?active_only=false")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_allergen(client: TestClient):
    """Test getting an allergen by ID."""
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Wheat", "description": "Gluten-containing grain"},
    )
    allergen_id = create_response.json()["id"]

    response = client.get(f"/api/v1/allergens/{allergen_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Wheat"
    assert data["description"] == "Gluten-containing grain"


def test_get_allergen_not_found(client: TestClient):
    """Test getting a non-existent allergen."""
    response = client.get("/api/v1/allergens/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Allergen not found"


def test_update_allergen(client: TestClient):
    """Test updating an allergen."""
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Original Name", "description": "Original description"},
    )
    allergen_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/allergens/{allergen_id}",
        json={"name": "Updated Name", "description": "Updated description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


def test_update_allergen_partial(client: TestClient):
    """Test partial update of an allergen (only name)."""
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Partial", "description": "Keep this"},
    )
    allergen_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/allergens/{allergen_id}",
        json={"name": "Partially Updated"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Partially Updated"
    assert data["description"] == "Keep this"


def test_update_allergen_duplicate_name(client: TestClient):
    """Test that updating to a duplicate name fails."""
    # Create two allergens
    client.post(
        "/api/v1/allergens",
        json={"name": "First"},
    )
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Second"},
    )
    allergen_id = create_response.json()["id"]

    # Try to update second to have the same name as first
    response = client.patch(
        f"/api/v1/allergens/{allergen_id}",
        json={"name": "First"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_update_allergen_same_name_allowed(client: TestClient):
    """Test that updating an allergen with its own name is allowed."""
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Same Name"},
    )
    allergen_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/allergens/{allergen_id}",
        json={"name": "Same Name", "description": "Added description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Same Name"
    assert data["description"] == "Added description"


def test_update_allergen_not_found(client: TestClient):
    """Test updating a non-existent allergen."""
    response = client.patch(
        "/api/v1/allergens/999",
        json={"name": "Does not exist"},
    )
    assert response.status_code == 404


def test_delete_allergen_soft_delete(client: TestClient):
    """Test that delete performs a soft delete."""
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Soft Delete Me"},
    )
    allergen_id = create_response.json()["id"]

    response = client.delete(f"/api/v1/allergens/{allergen_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False

    # Allergen should still be retrievable by ID
    get_response = client.get(f"/api/v1/allergens/{allergen_id}")
    assert get_response.status_code == 200
    assert get_response.json()["is_active"] is False


def test_delete_allergen_not_found(client: TestClient):
    """Test deleting a non-existent allergen."""
    response = client.delete("/api/v1/allergens/999")
    assert response.status_code == 404


def test_duplicate_name_allowed_after_soft_delete(client: TestClient):
    """Test that a name can be reused after the original is soft-deleted."""
    # Create and soft-delete an allergen
    create_response = client.post(
        "/api/v1/allergens",
        json={"name": "Recyclable Name"},
    )
    allergen_id = create_response.json()["id"]
    client.delete(f"/api/v1/allergens/{allergen_id}")

    # Create a new allergen with the same name
    response = client.post(
        "/api/v1/allergens",
        json={"name": "Recyclable Name"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Recyclable Name"
    assert data["is_active"] is True
