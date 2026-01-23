"""Tests for recipe-recipe category endpoints."""

from fastapi.testclient import TestClient


def create_test_recipe(client: TestClient, name: str = "Test Recipe") -> int:
    """Helper to create a test recipe and return its ID."""
    response = client.post(
        "/api/v1/recipes",
        json={"name": name},
    )
    return response.json()["id"]


def create_test_category(client: TestClient, name: str = "Test Category") -> int:
    """Helper to create a test recipe category and return its ID."""
    response = client.post(
        "/api/v1/recipe-categories",
        json={"name": name},
    )
    return response.json()["id"]


def test_create_recipe_category_link(client: TestClient):
    """Test creating a link between a recipe and a recipe category."""
    recipe_id = create_test_recipe(client, "Pasta Dish")
    category_id = create_test_category(client, "Main Courses")

    response = client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["category_id"] == category_id
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_recipe_category_link_duplicate(client: TestClient):
    """Test creating a duplicate link returns existing link."""
    recipe_id = create_test_recipe(client, "Pizza")
    category_id = create_test_category(client, "Appetizers")

    # Create first link
    response1 = client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    assert response1.status_code == 201
    link_id_1 = response1.json()["id"]

    # Create same link again
    response2 = client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    assert response2.status_code == 201
    link_id_2 = response2.json()["id"]

    # Should return same link
    assert link_id_1 == link_id_2


def test_list_recipe_categories(client: TestClient):
    """Test listing all recipe-category links."""
    recipe_id = create_test_recipe(client, "Soup")
    category1_id = create_test_category(client, "Soups")
    category2_id = create_test_category(client, "Starters")

    # Create two links
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category1_id,
            "is_active": True,
        },
    )
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category2_id,
            "is_active": False,
        },
    )

    response = client.get("/api/v1/recipe-recipe-categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_get_recipe_category_link(client: TestClient):
    """Test getting a single recipe-category link."""
    recipe_id = create_test_recipe(client, "Salad")
    category_id = create_test_category(client, "Salads")

    # Create link
    create_response = client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    link_id = create_response.json()["id"]

    # Get link
    response = client.get(f"/api/v1/recipe-recipe-categories/{link_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == link_id
    assert data["recipe_id"] == recipe_id
    assert data["category_id"] == category_id


def test_get_nonexistent_recipe_category_link(client: TestClient):
    """Test getting a nonexistent recipe-category link."""
    response = client.get("/api/v1/recipe-recipe-categories/999")
    assert response.status_code == 404
    assert "Recipe-category link not found" in response.json()["detail"]


def test_list_categories_by_recipe(client: TestClient):
    """Test listing all categories for a specific recipe."""
    recipe_id = create_test_recipe(client, "Burger")
    category1_id = create_test_category(client, "Burgers")
    category2_id = create_test_category(client, "Fast Food")

    # Create links
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category1_id,
            "is_active": True,
        },
    )
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category2_id,
            "is_active": True,
        },
    )

    response = client.get(f"/api/v1/recipe-recipe-categories/recipe/{recipe_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(link["recipe_id"] == recipe_id for link in data)


def test_list_recipes_by_category(client: TestClient):
    """Test listing all recipes in a specific category."""
    recipe1_id = create_test_recipe(client, "Recipe 1")
    recipe2_id = create_test_recipe(client, "Recipe 2")
    category_id = create_test_category(client, "Desserts")

    # Create links
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe1_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe2_id,
            "category_id": category_id,
            "is_active": True,
        },
    )

    response = client.get(
        f"/api/v1/recipe-recipe-categories/category/{category_id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(link["category_id"] == category_id for link in data)


def test_update_recipe_category_link(client: TestClient):
    """Test updating a recipe-category link."""
    recipe_id = create_test_recipe(client, "Fish")
    category_id = create_test_category(client, "Seafood")

    # Create link
    create_response = client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    link_id = create_response.json()["id"]

    # Update link
    update_response = client.patch(
        f"/api/v1/recipe-recipe-categories/{link_id}",
        json={"is_active": False},
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["is_active"] is False


def test_update_nonexistent_recipe_category_link(client: TestClient):
    """Test updating a nonexistent recipe-category link."""
    response = client.patch(
        "/api/v1/recipe-recipe-categories/999",
        json={"is_active": False},
    )
    assert response.status_code == 404
    assert "Recipe-category link not found" in response.json()["detail"]


def test_delete_recipe_category_link(client: TestClient):
    """Test deleting a recipe-category link."""
    recipe_id = create_test_recipe(client, "Vegetables")
    category_id = create_test_category(client, "Sides")

    # Create link
    create_response = client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    link_id = create_response.json()["id"]

    # Delete link
    delete_response = client.delete(f"/api/v1/recipe-recipe-categories/{link_id}")
    assert delete_response.status_code == 204

    # Verify deletion
    get_response = client.get(f"/api/v1/recipe-recipe-categories/{link_id}")
    assert get_response.status_code == 404


def test_delete_nonexistent_recipe_category_link(client: TestClient):
    """Test deleting a nonexistent recipe-category link."""
    response = client.delete("/api/v1/recipe-recipe-categories/999")
    assert response.status_code == 404
    assert "Recipe-category link not found" in response.json()["detail"]


def test_delete_all_categories_for_recipe(client: TestClient):
    """Test deleting all categories for a specific recipe."""
    recipe_id = create_test_recipe(client, "Rice Dish")
    category1_id = create_test_category(client, "Rice")
    category2_id = create_test_category(client, "Asian")

    # Create links
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category1_id,
            "is_active": True,
        },
    )
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe_id,
            "category_id": category2_id,
            "is_active": True,
        },
    )

    # Delete all for recipe
    response = client.delete(
        f"/api/v1/recipe-recipe-categories/recipe/{recipe_id}"
    )
    assert response.status_code == 204

    # Verify all deleted
    list_response = client.get(
        f"/api/v1/recipe-recipe-categories/recipe/{recipe_id}"
    )
    data = list_response.json()
    assert len(data) == 0


def test_delete_all_recipes_in_category(client: TestClient):
    """Test deleting all recipes in a specific category."""
    recipe1_id = create_test_recipe(client, "Cake")
    recipe2_id = create_test_recipe(client, "Pie")
    category_id = create_test_category(client, "Pastries")

    # Create links
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe1_id,
            "category_id": category_id,
            "is_active": True,
        },
    )
    client.post(
        "/api/v1/recipe-recipe-categories",
        json={
            "recipe_id": recipe2_id,
            "category_id": category_id,
            "is_active": True,
        },
    )

    # Delete all for category
    response = client.delete(
        f"/api/v1/recipe-recipe-categories/category/{category_id}"
    )
    assert response.status_code == 204

    # Verify all deleted
    list_response = client.get(
        f"/api/v1/recipe-recipe-categories/category/{category_id}"
    )
    data = list_response.json()
    assert len(data) == 0
