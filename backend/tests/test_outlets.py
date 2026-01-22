"""Tests for outlet endpoints."""

from fastapi.testclient import TestClient


# =============================================================================
# Outlet CRUD Tests
# =============================================================================


def test_create_outlet(client: TestClient):
    """Test creating a new outlet."""
    response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Downtown Location",
            "code": "DT",
            "outlet_type": "location",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Downtown Location"
    assert data["code"] == "DT"
    assert data["outlet_type"] == "location"
    assert data["is_active"] is True
    assert data["parent_outlet_id"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_outlet_with_parent(client: TestClient):
    """Test creating a child outlet under a parent."""
    # Create parent outlet
    parent_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Main Brand",
            "code": "MB",
            "outlet_type": "brand",
        },
    )
    parent_id = parent_response.json()["id"]

    # Create child outlet
    response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Downtown Location",
            "code": "DT",
            "outlet_type": "location",
            "parent_outlet_id": parent_id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["parent_outlet_id"] == parent_id


def test_create_outlet_defaults_to_brand(client: TestClient):
    """Test that outlet_type defaults to 'brand'."""
    response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Test Outlet",
            "code": "TO",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["outlet_type"] == "brand"


def test_list_outlets(client: TestClient):
    """Test listing all outlets."""
    # Create three outlets
    client.post(
        "/api/v1/outlets",
        json={"name": "Outlet One", "code": "O1", "outlet_type": "brand"},
    )
    client.post(
        "/api/v1/outlets",
        json={"name": "Outlet Two", "code": "O2", "outlet_type": "location"},
    )
    client.post(
        "/api/v1/outlets",
        json={"name": "Outlet Three", "code": "O3", "outlet_type": "brand"},
    )

    response = client.get("/api/v1/outlets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["name"] == "Outlet One"
    assert data[1]["name"] == "Outlet Two"
    assert data[2]["name"] == "Outlet Three"


def test_list_outlets_empty(client: TestClient):
    """Test listing outlets when none exist."""
    response = client.get("/api/v1/outlets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_list_outlets_filter_by_active(client: TestClient):
    """Test listing outlets filtered by active status."""
    # Create two active outlets
    client.post(
        "/api/v1/outlets",
        json={"name": "Active One", "code": "A1", "outlet_type": "brand"},
    )
    client.post(
        "/api/v1/outlets",
        json={"name": "Active Two", "code": "A2", "outlet_type": "brand"},
    )

    # Create and deactivate one outlet
    create_response = client.post(
        "/api/v1/outlets",
        json={"name": "Inactive One", "code": "IN", "outlet_type": "brand"},
    )
    inactive_id = create_response.json()["id"]
    client.delete(f"/api/v1/outlets/{inactive_id}")

    # Filter by active=true
    response = client.get("/api/v1/outlets?is_active=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(outlet["is_active"] is True for outlet in data)

    # Filter by active=false
    response = client.get("/api/v1/outlets?is_active=false")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["is_active"] is False


def test_get_outlet(client: TestClient):
    """Test retrieving a single outlet by ID."""
    # Create outlet
    create_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Test Outlet",
            "code": "TO",
            "outlet_type": "location",
        },
    )
    outlet_id = create_response.json()["id"]

    # Get outlet
    response = client.get(f"/api/v1/outlets/{outlet_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == outlet_id
    assert data["name"] == "Test Outlet"
    assert data["code"] == "TO"
    assert data["outlet_type"] == "location"


def test_get_outlet_not_found(client: TestClient):
    """Test retrieving a non-existent outlet."""
    response = client.get("/api/v1/outlets/999")
    assert response.status_code == 404
    assert "Outlet not found" in response.json()["detail"]


def test_update_outlet(client: TestClient):
    """Test updating an outlet."""
    # Create outlet
    create_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Original Name",
            "code": "ON",
            "outlet_type": "brand",
        },
    )
    outlet_id = create_response.json()["id"]

    # Update outlet
    response = client.patch(
        f"/api/v1/outlets/{outlet_id}",
        json={
            "name": "Updated Name",
            "code": "UN",
            "outlet_type": "location",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == outlet_id
    assert data["name"] == "Updated Name"
    assert data["code"] == "UN"
    assert data["outlet_type"] == "location"


def test_update_outlet_partial(client: TestClient):
    """Test partial update of an outlet (only some fields)."""
    # Create outlet
    create_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Test Outlet",
            "code": "TO",
            "outlet_type": "brand",
        },
    )
    outlet_id = create_response.json()["id"]

    # Partial update - only name
    response = client.patch(
        f"/api/v1/outlets/{outlet_id}",
        json={"name": "New Name"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["code"] == "TO"  # Unchanged
    assert data["outlet_type"] == "brand"  # Unchanged


def test_update_outlet_not_found(client: TestClient):
    """Test updating a non-existent outlet."""
    response = client.patch(
        "/api/v1/outlets/999",
        json={"name": "Updated Name"},
    )
    assert response.status_code == 404
    assert "Outlet not found" in response.json()["detail"]


def test_deactivate_outlet(client: TestClient):
    """Test deactivating (soft-deleting) an outlet."""
    # Create outlet
    create_response = client.post(
        "/api/v1/outlets",
        json={"name": "Test Outlet", "code": "TO", "outlet_type": "brand"},
    )
    outlet_id = create_response.json()["id"]

    # Deactivate outlet
    response = client.delete(f"/api/v1/outlets/{outlet_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False

    # Verify outlet is deactivated
    get_response = client.get(f"/api/v1/outlets/{outlet_id}")
    assert get_response.status_code == 200
    assert get_response.json()["is_active"] is False


def test_deactivate_outlet_not_found(client: TestClient):
    """Test deactivating a non-existent outlet."""
    response = client.delete("/api/v1/outlets/999")
    assert response.status_code == 404
    assert "Outlet not found" in response.json()["detail"]


# =============================================================================
# Recipe-Outlet Relationship Tests
# =============================================================================


def _create_recipe(client: TestClient, name: str = "Test Recipe") -> int:
    """Helper to create a recipe and return its ID."""
    response = client.post(
        "/api/v1/recipes",
        json={"name": name, "yield_quantity": 1, "yield_unit": "portion"},
    )
    return response.json()["id"]


def _create_outlet(client: TestClient, name: str = "Test Outlet", code: str = "TO") -> int:
    """Helper to create an outlet and return its ID."""
    response = client.post(
        "/api/v1/outlets",
        json={"name": name, "code": code, "outlet_type": "brand"},
    )
    return response.json()["id"]


def test_add_recipe_to_outlet(client: TestClient):
    """Test adding a recipe to an outlet."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    response = client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["outlet_id"] == outlet_id
    assert data["is_active"] is True
    assert data["price_override"] is None
    assert "created_at" in data


def test_add_recipe_to_outlet_with_price_override(client: TestClient):
    """Test adding a recipe to an outlet with a price override."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    response = client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True, "price_override": 29.99},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["price_override"] == 29.99


def test_add_recipe_to_outlet_recipe_not_found(client: TestClient):
    """Test adding a non-existent recipe to an outlet."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    response = client.post(
        "/api/v1/recipes/999/outlets",
        json={"outlet_id": outlet_id},
    )
    assert response.status_code == 400
    assert "Recipe or outlet not found" in response.json()["detail"]


def test_add_recipe_to_outlet_outlet_not_found(client: TestClient):
    """Test adding a recipe to a non-existent outlet."""
    recipe_id = _create_recipe(client, "Test Recipe")

    response = client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": 999},
    )
    assert response.status_code == 400
    assert "Recipe or outlet not found" in response.json()["detail"]


def test_add_recipe_to_outlet_already_exists_updates(client: TestClient):
    """Test that adding a recipe to an outlet it's already in updates the link."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Add recipe to outlet first time
    first_response = client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True, "price_override": 10.0},
    )
    assert first_response.status_code == 201

    # Add same recipe to same outlet again (should update)
    second_response = client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": False, "price_override": 20.0},
    )
    assert second_response.status_code == 201
    data = second_response.json()
    assert data["is_active"] is False
    assert data["price_override"] == 20.0


def test_get_recipe_outlets(client: TestClient):
    """Test getting all outlets for a recipe."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet1_id = _create_outlet(client, "Outlet One", "O1")
    outlet2_id = _create_outlet(client, "Outlet Two", "O2")

    # Add recipe to two outlets
    client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet1_id, "is_active": True},
    )
    client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet2_id, "is_active": False, "price_override": 25.0},
    )

    response = client.get(f"/api/v1/recipes/{recipe_id}/outlets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["outlet_id"] == outlet1_id
    assert data[0]["is_active"] is True
    assert data[1]["outlet_id"] == outlet2_id
    assert data[1]["is_active"] is False
    assert data[1]["price_override"] == 25.0


def test_get_recipe_outlets_empty(client: TestClient):
    """Test getting outlets for a recipe with no outlets."""
    recipe_id = _create_recipe(client, "Test Recipe")

    response = client.get(f"/api/v1/recipes/{recipe_id}/outlets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_update_recipe_outlet(client: TestClient):
    """Test updating a recipe-outlet link."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Add recipe to outlet
    client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True, "price_override": 10.0},
    )

    # Update the link
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}/outlets/{outlet_id}",
        json={"is_active": False, "price_override": 15.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["outlet_id"] == outlet_id
    assert data["is_active"] is False
    assert data["price_override"] == 15.0


def test_update_recipe_outlet_partial(client: TestClient):
    """Test partial update of a recipe-outlet link."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Add recipe to outlet
    client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True, "price_override": 10.0},
    )

    # Update only is_active
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}/outlets/{outlet_id}",
        json={"is_active": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    assert data["price_override"] == 10.0  # Unchanged


def test_update_recipe_outlet_not_found(client: TestClient):
    """Test updating a recipe-outlet link that doesn't exist."""
    response = client.patch(
        "/api/v1/recipes/999/outlets/999",
        json={"is_active": False},
    )
    assert response.status_code == 404
    assert "Recipe-outlet link not found" in response.json()["detail"]


def test_remove_recipe_from_outlet(client: TestClient):
    """Test removing a recipe from an outlet."""
    recipe_id = _create_recipe(client, "Test Recipe")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Add recipe to outlet
    client.post(
        f"/api/v1/recipes/{recipe_id}/outlets",
        json={"outlet_id": outlet_id},
    )

    # Remove recipe from outlet
    response = client.delete(f"/api/v1/recipes/{recipe_id}/outlets/{outlet_id}")
    assert response.status_code == 204

    # Verify it's removed
    get_response = client.get(f"/api/v1/recipes/{recipe_id}/outlets")
    data = get_response.json()
    assert len(data) == 0


def test_remove_recipe_from_outlet_not_found(client: TestClient):
    """Test removing a recipe-outlet link that doesn't exist."""
    response = client.delete("/api/v1/recipes/999/outlets/999")
    assert response.status_code == 404
    assert "Recipe-outlet link not found" in response.json()["detail"]


def test_get_outlet_recipes(client: TestClient):
    """Test getting all recipes for an outlet."""
    recipe1_id = _create_recipe(client, "Recipe One")
    recipe2_id = _create_recipe(client, "Recipe Two")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Add both recipes to outlet
    client.post(
        f"/api/v1/recipes/{recipe1_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True},
    )
    client.post(
        f"/api/v1/recipes/{recipe2_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": False, "price_override": 50.0},
    )

    response = client.get(f"/api/v1/outlets/{outlet_id}/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["recipe_id"] == recipe1_id
    assert data[0]["is_active"] is True
    assert data[1]["recipe_id"] == recipe2_id
    assert data[1]["is_active"] is False
    assert data[1]["price_override"] == 50.0


def test_get_outlet_recipes_filter_by_active(client: TestClient):
    """Test getting recipes for an outlet filtered by active status."""
    recipe1_id = _create_recipe(client, "Recipe One")
    recipe2_id = _create_recipe(client, "Recipe Two")
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Add recipes with different active states
    client.post(
        f"/api/v1/recipes/{recipe1_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": True},
    )
    client.post(
        f"/api/v1/recipes/{recipe2_id}/outlets",
        json={"outlet_id": outlet_id, "is_active": False},
    )

    # Get only active recipes
    response = client.get(f"/api/v1/outlets/{outlet_id}/recipes?is_active=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["recipe_id"] == recipe1_id

    # Get only inactive recipes
    response = client.get(f"/api/v1/outlets/{outlet_id}/recipes?is_active=false")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["recipe_id"] == recipe2_id


def test_get_outlet_recipes_empty(client: TestClient):
    """Test getting recipes for an outlet with no recipes."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    response = client.get(f"/api/v1/outlets/{outlet_id}/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


# =============================================================================
# Hierarchy Tests
# =============================================================================


def test_get_outlet_hierarchy_single(client: TestClient):
    """Test getting hierarchy for a single outlet (no children)."""
    outlet_id = _create_outlet(client, "Standalone Outlet", "SO")

    response = client.get(f"/api/v1/outlets/{outlet_id}/hierarchy")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == outlet_id
    assert data["name"] == "Standalone Outlet"
    assert data["code"] == "SO"
    assert data["is_active"] is True
    assert data["children"] == []


def test_get_outlet_hierarchy_with_children(client: TestClient):
    """Test getting hierarchy for an outlet with children."""
    # Create parent
    parent_id = _create_outlet(client, "Parent Brand", "PB")

    # Create children
    child1_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Child One",
            "code": "C1",
            "outlet_type": "location",
            "parent_outlet_id": parent_id,
        },
    )
    child1_id = child1_response.json()["id"]

    child2_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Child Two",
            "code": "C2",
            "outlet_type": "location",
            "parent_outlet_id": parent_id,
        },
    )
    child2_id = child2_response.json()["id"]

    # Get hierarchy
    response = client.get(f"/api/v1/outlets/{parent_id}/hierarchy")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == parent_id
    assert data["name"] == "Parent Brand"
    assert len(data["children"]) == 2
    assert data["children"][0]["id"] == child1_id
    assert data["children"][0]["name"] == "Child One"
    assert data["children"][1]["id"] == child2_id
    assert data["children"][1]["name"] == "Child Two"
    # Children should have no children
    assert data["children"][0]["children"] == []
    assert data["children"][1]["children"] == []


def test_get_outlet_hierarchy_nested(client: TestClient):
    """Test getting hierarchy for a nested structure (grandparent -> parent -> child)."""
    # Create grandparent
    grandparent_response = client.post(
        "/api/v1/outlets",
        json={"name": "Grandparent", "code": "GP", "outlet_type": "brand"},
    )
    grandparent_id = grandparent_response.json()["id"]

    # Create parent
    parent_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Parent",
            "code": "P",
            "outlet_type": "location",
            "parent_outlet_id": grandparent_id,
        },
    )
    parent_id = parent_response.json()["id"]

    # Create child
    child_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Child",
            "code": "C",
            "outlet_type": "location",
            "parent_outlet_id": parent_id,
        },
    )
    child_id = child_response.json()["id"]

    # Get grandparent hierarchy
    response = client.get(f"/api/v1/outlets/{grandparent_id}/hierarchy")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == grandparent_id
    assert data["name"] == "Grandparent"
    assert len(data["children"]) == 1
    assert data["children"][0]["id"] == parent_id
    assert len(data["children"][0]["children"]) == 1
    assert data["children"][0]["children"][0]["id"] == child_id


def test_get_outlet_hierarchy_not_found(client: TestClient):
    """Test getting hierarchy for a non-existent outlet."""
    response = client.get("/api/v1/outlets/999/hierarchy")
    assert response.status_code == 404
    assert "Outlet not found" in response.json()["detail"]


# =============================================================================
# Edge Cases
# =============================================================================


def test_prevent_circular_parent_child_outlets(client: TestClient):
    """Test that circular parent-child relationships cannot be created.

    EDGE CASE: This test documents a missing validation in the current implementation.

    Once A has B as parent, you cannot add A as B's parent (which would create a cycle).
    Similarly, once A -> B -> C hierarchy exists, you cannot set C's parent to A.

    Valid hierarchy: Grandparent -> Parent -> Child (one direction only)

    CURRENT BEHAVIOR: The system currently allows circular references to be created.
    This test documents the expected behavior that SHOULD be implemented.

    TODO: Add cycle detection to update_outlet() method in OutletService to prevent:
    1. Setting outlet X's parent to outlet Y if Y is already a child of X
    2. More generally, if creating this parent relationship would form a cycle
    """
    # Create two independent outlets
    outlet_a_response = client.post(
        "/api/v1/outlets",
        json={"name": "Outlet A", "code": "OA", "outlet_type": "brand"},
    )
    outlet_a_id = outlet_a_response.json()["id"]

    outlet_b_response = client.post(
        "/api/v1/outlets",
        json={"name": "Outlet B", "code": "OB", "outlet_type": "location"},
    )
    outlet_b_id = outlet_b_response.json()["id"]

    # Set B as A's parent: A -> B (B is parent of A)
    update_response = client.patch(
        f"/api/v1/outlets/{outlet_a_id}",
        json={"parent_outlet_id": outlet_b_id},
    )
    assert update_response.status_code == 200
    assert update_response.json()["parent_outlet_id"] == outlet_b_id

    # Now try to set A as B's parent: B -> A
    # This would create a cycle: A -> B -> A
    # This should be rejected with a 400 error
    update_response = client.patch(
        f"/api/v1/outlets/{outlet_b_id}",
        json={"parent_outlet_id": outlet_a_id},
    )
    assert update_response.status_code == 400
    assert "cycle" in update_response.json()["detail"].lower()

    # Now reset B to have A as parent (this should work since A doesn't have B as parent anymore)
    # First, clear A's parent
    client.patch(
        f"/api/v1/outlets/{outlet_a_id}",
        json={"parent_outlet_id": None},
    )

    # Now set B's parent to A
    update_response = client.patch(
        f"/api/v1/outlets/{outlet_b_id}",
        json={"parent_outlet_id": outlet_a_id},
    )
    assert update_response.status_code == 200
    assert update_response.json()["parent_outlet_id"] == outlet_a_id

    # Create a deeper hierarchy: A -> B <- C (C's parent is B)
    outlet_c_response = client.post(
        "/api/v1/outlets",
        json={
            "name": "Outlet C",
            "code": "OC",
            "outlet_type": "location",
            "parent_outlet_id": outlet_b_id,  # C's parent is B
        },
    )
    outlet_c_id = outlet_c_response.json()["id"]

    # Now try to set C as A's parent
    # This would create: A -> B -> C -> A (cycle)
    # This should be rejected with a 400 error
    update_response = client.patch(
        f"/api/v1/outlets/{outlet_a_id}",
        json={"parent_outlet_id": outlet_c_id},
    )
    assert update_response.status_code == 400
    assert "cycle" in update_response.json()["detail"].lower()
