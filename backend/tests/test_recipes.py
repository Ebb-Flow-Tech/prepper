"""Tests for recipe endpoints."""

from fastapi.testclient import TestClient


def test_create_recipe(client: TestClient):
    """Test creating a new recipe."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Chocolate Cake",
            "yield_quantity": 12,
            "yield_unit": "portion",
            "created_by": "234",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Chocolate Cake"
    assert data["yield_quantity"] == 12
    assert data["status"] == "draft"
    assert data["created_by"] == "234"
    assert data["version"] == 1
    assert data["root_id"] is None
    assert data["rnd_started"] is False
    assert data["review_ready"] is False


def test_create_recipe_with_cost_price(client: TestClient):
    """Test creating a recipe with cost_price."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Expensive Cake",
            "yield_quantity": 10,
            "yield_unit": "portion",
            "cost_price": 25.50,
            "created_by": "234",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Expensive Cake"
    assert data["cost_price"] == 25.50


def test_update_recipe_cost_price(client: TestClient):
    """Test updating recipe cost_price."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update cost_price
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"cost_price": 15.75},
    )
    assert response.status_code == 200
    assert response.json()["cost_price"] == 15.75

    # Verify it persists
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["cost_price"] == 15.75


def test_update_recipe_status(client: TestClient):
    """Test updating recipe status."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update status
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}/status",
        json={"status": "active"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "active"


def test_update_recipe_rnd_started(client: TestClient):
    """Test updating recipe rnd_started flag."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Verify rnd_started is initially False
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["rnd_started"] is False

    # Update rnd_started to True
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"rnd_started": True},
    )
    assert response.status_code == 200
    assert response.json()["rnd_started"] is True

    # Verify it persists
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["rnd_started"] is True


def test_update_recipe_review_ready(client: TestClient):
    """Test updating recipe review_ready flag."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Verify review_ready is initially False
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["review_ready"] is False

    # Update review_ready to True
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"review_ready": True},
    )
    assert response.status_code == 200
    assert response.json()["review_ready"] is True

    # Verify it persists
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["review_ready"] is True


def test_update_recipe_summary_feedback(client: TestClient):
    """Test updating recipe with summary_feedback."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Verify summary_feedback is initially None
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["summary_feedback"] is None

    # Update summary_feedback
    feedback = "Great recipe, easy to follow"
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"summary_feedback": feedback},
    )
    assert response.status_code == 200
    assert response.json()["summary_feedback"] == feedback

    # Verify it persists
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    assert get_response.json()["summary_feedback"] == feedback


def test_update_recipe_multiple_fields_including_rnd_started(client: TestClient):
    """Test updating multiple fields including rnd_started."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Original Name", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update multiple fields
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={
            "name": "Updated Name",
            "selling_price_est": 15.99,
            "rnd_started": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["selling_price_est"] == 15.99
    assert data["rnd_started"] is True


def test_update_recipe_multiple_fields_including_summary_feedback(client: TestClient):
    """Test updating multiple fields including summary_feedback."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Original Name", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update multiple fields
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={
            "name": "Updated Name",
            "selling_price_est": 15.99,
            "summary_feedback": "Needs more salt",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["selling_price_est"] == 15.99
    assert data["summary_feedback"] == "Needs more salt"


def test_update_recipe_multiple_fields_including_review_ready(client: TestClient):
    """Test updating multiple fields including review_ready."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Original Name", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update multiple fields
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={
            "name": "Updated Name",
            "selling_price_est": 15.99,
            "review_ready": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["selling_price_est"] == 15.99
    assert data["review_ready"] is True


def test_update_recipe_multiple_fields_including_cost_price(client: TestClient):
    """Test updating multiple fields including cost_price."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Original Name", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update multiple fields
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={
            "name": "Updated Name",
            "cost_price": 25.50,
            "selling_price_est": 49.99,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["cost_price"] == 25.50
    assert data["selling_price_est"] == 49.99


def test_soft_delete_recipe(client: TestClient):
    """Test soft-deleting a recipe."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "To Delete", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Delete
    response = client.delete(f"/api/v1/recipes/{recipe_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "archived"


# ============ Fork Recipe Tests ============


def test_fork_recipe_basic(client: TestClient):
    """Test forking a recipe creates a copy with correct metadata."""
    # Create original recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Original Recipe",
            "yield_quantity": 4,
            "yield_unit": "servings",
            "owner_id": "user123",
        },
    )
    assert create_response.status_code == 201
    original = create_response.json()

    # Fork the recipe
    fork_response = client.post(f"/api/v1/recipes/{original['id']}/fork")
    assert fork_response.status_code == 201
    forked = fork_response.json()

    # Verify forked recipe has correct properties
    assert forked["name"] == "Original Recipe (Fork)"
    assert forked["yield_quantity"] == 4
    assert forked["yield_unit"] == "servings"
    assert forked["status"] == "draft"
    assert forked["is_public"] is False
    assert forked["id"] != original["id"]
    # Verify version and root_id
    assert forked["version"] == 2
    assert forked["root_id"] == original["id"]
    # Verify rnd_started is reset to False on fork
    assert forked["rnd_started"] is False
    # Verify review_ready is reset to False on fork
    assert forked["review_ready"] is False


def test_fork_recipe_with_new_owner(client: TestClient):
    """Test forking a recipe with a new owner ID."""
    # Create original recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Shared Recipe",
            "yield_quantity": 2,
            "yield_unit": "portion",
            "owner_id": "original_owner",
        },
    )
    original = create_response.json()

    # Fork with new owner
    fork_response = client.post(
        f"/api/v1/recipes/{original['id']}/fork",
        json={"new_owner_id": "new_owner"},
    )
    assert fork_response.status_code == 201
    forked = fork_response.json()

    assert forked["owner_id"] == "new_owner"
    assert forked["created_by"] == "new_owner"


def test_fork_recipe_copies_instructions(client: TestClient):
    """Test that forking copies raw and structured instructions."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe with Instructions", "yield_quantity": 1, "yield_unit": "batch"},
    )
    recipe_id = create_response.json()["id"]

    # Add raw instructions
    instructions_raw = "1. Mix ingredients\n2. Bake at 350F"
    client.post(
        f"/api/v1/recipes/{recipe_id}/instructions/raw",
        json={"instructions_raw": instructions_raw},
    )

    # Get updated recipe
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    original = get_response.json()

    # Fork the recipe
    fork_response = client.post(f"/api/v1/recipes/{recipe_id}/fork")
    forked = fork_response.json()

    assert forked["instructions_raw"] == original["instructions_raw"]


def test_fork_recipe_copies_ingredients(client: TestClient):
    """Test that forking copies all recipe ingredients."""
    # Create an ingredient first
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Flour", "base_unit": "g", "cost_per_base_unit": 0.002},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe with Ingredients", "yield_quantity": 1, "yield_unit": "loaf"},
    )
    recipe_id = recipe_response.json()["id"]

    # Add ingredient to recipe
    client.post(
        f"/api/v1/recipes/{recipe_id}/ingredients",
        json={"ingredient_id": ingredient_id, "quantity": 500, "unit": "g"},
    )

    # Get original recipe ingredients
    original_ingredients_response = client.get(f"/api/v1/recipes/{recipe_id}/ingredients")
    original_ingredients = original_ingredients_response.json()
    assert len(original_ingredients) == 1

    # Fork the recipe
    fork_response = client.post(f"/api/v1/recipes/{recipe_id}/fork")
    forked_id = fork_response.json()["id"]

    # Get forked recipe ingredients
    forked_ingredients_response = client.get(f"/api/v1/recipes/{forked_id}/ingredients")
    forked_ingredients = forked_ingredients_response.json()

    assert len(forked_ingredients) == 1
    assert forked_ingredients[0]["ingredient_id"] == ingredient_id
    assert forked_ingredients[0]["quantity"] == 500
    assert forked_ingredients[0]["unit"] == "g"
    assert forked_ingredients[0]["recipe_id"] == forked_id


def test_fork_recipe_not_found(client: TestClient):
    """Test forking a non-existent recipe returns 404."""
    response = client.post("/api/v1/recipes/99999/fork")
    assert response.status_code == 404
    assert response.json()["detail"] == "Recipe not found"


def test_fork_recipe_preserves_selling_price(client: TestClient):
    """Test that forking preserves the selling price estimate."""
    # Create recipe with selling price
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Priced Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update selling price
    client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"selling_price_est": 25.50},
    )

    # Get updated recipe
    get_response = client.get(f"/api/v1/recipes/{recipe_id}")
    original = get_response.json()

    # Fork the recipe
    fork_response = client.post(f"/api/v1/recipes/{recipe_id}/fork")
    forked = fork_response.json()

    assert forked["selling_price_est"] == original["selling_price_est"]


def test_fork_recipe_multiple_ingredients_preserves_order(client: TestClient):
    """Test that forking preserves ingredient sort order."""
    # Create ingredients
    ing1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient A", "base_unit": "g", "cost_per_base_unit": 0.01},
    ).json()
    ing2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient B", "base_unit": "ml", "cost_per_base_unit": 0.02},
    ).json()
    ing3 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient C", "base_unit": "g", "cost_per_base_unit": 0.03},
    ).json()

    # Create recipe
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Multi-ingredient Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Add ingredients in order
    client.post(
        f"/api/v1/recipes/{recipe['id']}/ingredients",
        json={"ingredient_id": ing1["id"], "quantity": 100, "unit": "g"},
    )
    client.post(
        f"/api/v1/recipes/{recipe['id']}/ingredients",
        json={"ingredient_id": ing2["id"], "quantity": 200, "unit": "ml"},
    )
    client.post(
        f"/api/v1/recipes/{recipe['id']}/ingredients",
        json={"ingredient_id": ing3["id"], "quantity": 50, "unit": "g"},
    )

    # Fork the recipe
    forked = client.post(f"/api/v1/recipes/{recipe['id']}/fork").json()

    # Get forked ingredients
    forked_ingredients = client.get(f"/api/v1/recipes/{forked['id']}/ingredients").json()

    # Verify order is preserved
    assert len(forked_ingredients) == 3
    assert forked_ingredients[0]["ingredient_id"] == ing1["id"]
    assert forked_ingredients[1]["ingredient_id"] == ing2["id"]
    assert forked_ingredients[2]["ingredient_id"] == ing3["id"]


def test_fork_recipe_copies_sub_recipes(client: TestClient):
    """Test that forking copies all sub-recipe links."""
    # Create sub-recipes (child recipes)
    child1 = client.post(
        "/api/v1/recipes",
        json={"name": "Hollandaise Sauce", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    child2 = client.post(
        "/api/v1/recipes",
        json={"name": "Poached Eggs", "yield_quantity": 4, "yield_unit": "portion"},
    ).json()

    # Create parent recipe
    parent = client.post(
        "/api/v1/recipes",
        json={"name": "Eggs Benedict", "yield_quantity": 4, "yield_unit": "portion"},
    ).json()

    # Add sub-recipes to parent
    client.post(
        f"/api/v1/recipes/{parent['id']}/sub-recipes",
        json={"child_recipe_id": child1["id"], "quantity": 0.5, "unit": "batch"},
    )
    client.post(
        f"/api/v1/recipes/{parent['id']}/sub-recipes",
        json={"child_recipe_id": child2["id"], "quantity": 4, "unit": "portion"},
    )

    # Get original sub-recipes
    original_sub_recipes = client.get(f"/api/v1/recipes/{parent['id']}/sub-recipes").json()
    assert len(original_sub_recipes) == 2

    # Fork the recipe
    forked = client.post(f"/api/v1/recipes/{parent['id']}/fork").json()

    # Get forked sub-recipes
    forked_sub_recipes = client.get(f"/api/v1/recipes/{forked['id']}/sub-recipes").json()

    # Verify sub-recipes are copied
    assert len(forked_sub_recipes) == 2
    assert forked_sub_recipes[0]["child_recipe_id"] == child1["id"]
    assert forked_sub_recipes[0]["quantity"] == 0.5
    assert forked_sub_recipes[0]["unit"] == "batch"
    assert forked_sub_recipes[1]["child_recipe_id"] == child2["id"]
    assert forked_sub_recipes[1]["quantity"] == 4
    assert forked_sub_recipes[1]["unit"] == "portion"

    # Verify sub-recipes belong to the forked recipe (not original)
    assert forked_sub_recipes[0]["parent_recipe_id"] == forked["id"]
    assert forked_sub_recipes[1]["parent_recipe_id"] == forked["id"]


def test_fork_recipe_preserves_sub_recipe_order(client: TestClient):
    """Test that forking preserves sub-recipe position order."""
    # Create three sub-recipes
    child1 = client.post(
        "/api/v1/recipes",
        json={"name": "Sub A", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    child2 = client.post(
        "/api/v1/recipes",
        json={"name": "Sub B", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    child3 = client.post(
        "/api/v1/recipes",
        json={"name": "Sub C", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Create parent recipe
    parent = client.post(
        "/api/v1/recipes",
        json={"name": "Complex Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Add sub-recipes in order
    client.post(
        f"/api/v1/recipes/{parent['id']}/sub-recipes",
        json={"child_recipe_id": child1["id"], "quantity": 1, "unit": "batch"},
    )
    client.post(
        f"/api/v1/recipes/{parent['id']}/sub-recipes",
        json={"child_recipe_id": child2["id"], "quantity": 1, "unit": "batch"},
    )
    client.post(
        f"/api/v1/recipes/{parent['id']}/sub-recipes",
        json={"child_recipe_id": child3["id"], "quantity": 1, "unit": "batch"},
    )

    # Fork the recipe
    forked = client.post(f"/api/v1/recipes/{parent['id']}/fork").json()

    # Get forked sub-recipes
    forked_sub_recipes = client.get(f"/api/v1/recipes/{forked['id']}/sub-recipes").json()

    # Verify order is preserved
    assert len(forked_sub_recipes) == 3
    assert forked_sub_recipes[0]["child_recipe_id"] == child1["id"]
    assert forked_sub_recipes[1]["child_recipe_id"] == child2["id"]
    assert forked_sub_recipes[2]["child_recipe_id"] == child3["id"]


def test_fork_recipe_chain_tracks_parent(client: TestClient):
    """Test that forking sets root_id to the direct parent and increments version."""
    # Create original recipe (v1)
    original = client.post(
        "/api/v1/recipes",
        json={"name": "Original", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    assert original["version"] == 1
    assert original["root_id"] is None

    # Fork the original (v2)
    fork1 = client.post(f"/api/v1/recipes/{original['id']}/fork").json()
    assert fork1["version"] == 2
    assert fork1["root_id"] == original["id"]

    # Fork the fork (v3) - root_id points to fork1 (the direct parent)
    fork2 = client.post(f"/api/v1/recipes/{fork1['id']}/fork").json()
    assert fork2["version"] == 3
    assert fork2["root_id"] == fork1["id"]

    # Fork v3 again (v4) - root_id points to fork2
    fork3 = client.post(f"/api/v1/recipes/{fork2['id']}/fork").json()
    assert fork3["version"] == 4
    assert fork3["root_id"] == fork2["id"]


# ============ Version Tree Tests ============


def test_get_version_tree_single_recipe(client: TestClient):
    """Test version tree for a recipe with no forks returns just the recipe."""
    # Create a standalone recipe
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Standalone Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Get version tree
    response = client.get(f"/api/v1/recipes/{recipe['id']}/versions")
    assert response.status_code == 200
    versions = response.json()

    assert len(versions) == 1
    assert versions[0]["id"] == recipe["id"]
    assert versions[0]["version"] == 1


def test_get_version_tree_linear_chain(client: TestClient):
    """Test version tree for a linear fork chain returns all versions."""
    # Create original recipe (v1)
    original = client.post(
        "/api/v1/recipes",
        json={"name": "Original", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Fork to create v2
    fork1 = client.post(f"/api/v1/recipes/{original['id']}/fork").json()

    # Fork to create v3
    fork2 = client.post(f"/api/v1/recipes/{fork1['id']}/fork").json()

    # Get version tree from any recipe in the chain
    for recipe_id in [original["id"], fork1["id"], fork2["id"]]:
        response = client.get(f"/api/v1/recipes/{recipe_id}/versions")
        assert response.status_code == 200
        versions = response.json()

        assert len(versions) == 3
        # Should be sorted by version number
        assert versions[0]["id"] == original["id"]
        assert versions[0]["version"] == 1
        assert versions[1]["id"] == fork1["id"]
        assert versions[1]["version"] == 2
        assert versions[2]["id"] == fork2["id"]
        assert versions[2]["version"] == 3


def test_get_version_tree_branching(client: TestClient):
    """Test version tree with branches (multiple forks from same parent)."""
    # Create original recipe (v1)
    original = client.post(
        "/api/v1/recipes",
        json={"name": "Original", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Create two forks from original (both v2)
    fork1 = client.post(f"/api/v1/recipes/{original['id']}/fork").json()
    fork2 = client.post(f"/api/v1/recipes/{original['id']}/fork").json()

    # Get version tree from any recipe
    response = client.get(f"/api/v1/recipes/{original['id']}/versions")
    assert response.status_code == 200
    versions = response.json()

    assert len(versions) == 3
    version_ids = {v["id"] for v in versions}
    assert original["id"] in version_ids
    assert fork1["id"] in version_ids
    assert fork2["id"] in version_ids


def test_get_version_tree_complex_branching(client: TestClient):
    """Test version tree with complex branching (fork of a fork)."""
    # Create original recipe (v1)
    original = client.post(
        "/api/v1/recipes",
        json={"name": "Original", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Fork original to create v2
    fork1 = client.post(f"/api/v1/recipes/{original['id']}/fork").json()

    # Fork original again to create another v2
    fork2 = client.post(f"/api/v1/recipes/{original['id']}/fork").json()

    # Fork fork1 to create v3
    fork1_1 = client.post(f"/api/v1/recipes/{fork1['id']}/fork").json()

    # Get version tree - should include all 4 recipes
    response = client.get(f"/api/v1/recipes/{fork1_1['id']}/versions")
    assert response.status_code == 200
    versions = response.json()

    assert len(versions) == 4
    version_ids = {v["id"] for v in versions}
    assert original["id"] in version_ids
    assert fork1["id"] in version_ids
    assert fork2["id"] in version_ids
    assert fork1_1["id"] in version_ids


def test_get_version_tree_not_found(client: TestClient):
    """Test version tree for non-existent recipe returns 404."""
    response = client.get("/api/v1/recipes/99999/versions")
    assert response.status_code == 404
    assert response.json()["detail"] == "Recipe not found"


def test_get_version_tree_preserves_recipe_data(client: TestClient):
    """Test that version tree returns full recipe data."""
    # Create recipe with specific data
    recipe = client.post(
        "/api/v1/recipes",
        json={
            "name": "Detailed Recipe",
            "yield_quantity": 4,
            "yield_unit": "servings",
            "owner_id": "user123",
        },
    ).json()

    # Fork it
    forked = client.post(f"/api/v1/recipes/{recipe['id']}/fork").json()

    # Get version tree
    response = client.get(f"/api/v1/recipes/{recipe['id']}/versions")
    versions = response.json()

    # Verify original recipe data
    orig = next(v for v in versions if v["id"] == recipe["id"])
    assert orig["name"] == "Detailed Recipe"
    assert orig["yield_quantity"] == 4
    assert orig["yield_unit"] == "servings"
    assert orig["owner_id"] == "user123"
    assert orig["version"] == 1
    assert orig["root_id"] is None

    # Verify forked recipe data
    fork = next(v for v in versions if v["id"] == forked["id"])
    assert fork["name"] == "Detailed Recipe (Fork)"
    assert fork["version"] == 2
    assert fork["root_id"] == recipe["id"]


# ============ Wastage Percentage Tests ============


def test_add_ingredient_with_wastage_percentage(client: TestClient):
    """Test adding an ingredient with wastage_percentage."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Tomatoes", "base_unit": "g", "cost_per_base_unit": 0.005},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Tomato Sauce", "yield_quantity": 1, "yield_unit": "batch"},
    )
    recipe_id = recipe_response.json()["id"]

    # Add ingredient with wastage_percentage
    response = client.post(
        f"/api/v1/recipes/{recipe_id}/ingredients",
        json={
            "ingredient_id": ingredient_id,
            "quantity": 1000,
            "unit": "g",
            "wastage_percentage": 15.5,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["wastage_percentage"] == 15.5


def test_add_ingredient_with_default_wastage_percentage(client: TestClient):
    """Test that wastage_percentage defaults to 0 when not provided."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Flour", "base_unit": "g", "cost_per_base_unit": 0.002},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Bread", "yield_quantity": 1, "yield_unit": "loaf"},
    )
    recipe_id = recipe_response.json()["id"]

    # Add ingredient without wastage_percentage
    response = client.post(
        f"/api/v1/recipes/{recipe_id}/ingredients",
        json={"ingredient_id": ingredient_id, "quantity": 500, "unit": "g"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["wastage_percentage"] == 0


def test_update_ingredient_wastage_percentage(client: TestClient):
    """Test updating wastage_percentage for a recipe ingredient."""
    # Create an ingredient
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Chicken", "base_unit": "g", "cost_per_base_unit": 0.01},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create recipe and add ingredient
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Chicken Dish", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    add_response = client.post(
        f"/api/v1/recipes/{recipe_id}/ingredients",
        json={"ingredient_id": ingredient_id, "quantity": 300, "unit": "g"},
    )
    ri_id = add_response.json()["id"]

    # Update wastage_percentage
    update_response = client.patch(
        f"/api/v1/recipes/{recipe_id}/ingredients/{ri_id}",
        json={"wastage_percentage": 20},
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["wastage_percentage"] == 20

    # Verify the update persists
    get_response = client.get(f"/api/v1/recipes/{recipe_id}/ingredients")
    ingredients = get_response.json()
    found_ingredient = next(
        (ing for ing in ingredients if ing["id"] == ri_id), None
    )
    assert found_ingredient is not None
    assert found_ingredient["wastage_percentage"] == 20


def test_fork_recipe_preserves_wastage_percentage(client: TestClient):
    """Test that forking preserves wastage_percentage for all ingredients."""
    # Create ingredients
    ing1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient A", "base_unit": "g", "cost_per_base_unit": 0.01},
    ).json()
    ing2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient B", "base_unit": "ml", "cost_per_base_unit": 0.02},
    ).json()

    # Create recipe and add ingredients with wastage
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe with Wastage", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    client.post(
        f"/api/v1/recipes/{recipe['id']}/ingredients",
        json={
            "ingredient_id": ing1["id"],
            "quantity": 100,
            "unit": "g",
            "wastage_percentage": 10,
        },
    )
    client.post(
        f"/api/v1/recipes/{recipe['id']}/ingredients",
        json={
            "ingredient_id": ing2["id"],
            "quantity": 200,
            "unit": "ml",
            "wastage_percentage": 5,
        },
    )

    # Fork the recipe
    forked = client.post(f"/api/v1/recipes/{recipe['id']}/fork").json()

    # Get forked ingredients
    forked_ingredients = client.get(f"/api/v1/recipes/{forked['id']}/ingredients").json()

    # Verify wastage_percentage is preserved
    assert len(forked_ingredients) == 2
    ing_a = next((ing for ing in forked_ingredients if ing["ingredient_id"] == ing1["id"]), None)
    ing_b = next((ing for ing in forked_ingredients if ing["ingredient_id"] == ing2["id"]), None)

    assert ing_a is not None
    assert ing_a["wastage_percentage"] == 10

    assert ing_b is not None
    assert ing_b["wastage_percentage"] == 5
