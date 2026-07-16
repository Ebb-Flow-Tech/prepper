"""Tests for recipe endpoints."""

from fastapi.testclient import TestClient

from app.passport import access
from tests.conftest import (
    ADMIN_USER_ID,
    MANAGER,
    STAFF,
    create_user,
    make_brand_user,
    seed_brand,
    seed_outlet_unit,
    use_user,
)


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


def test_list_recipes_paginated(client: TestClient):
    """Test that listing recipes returns paginated response shape."""
    client.post(
        "/api/v1/recipes",
        json={"name": "Recipe A", "yield_quantity": 1, "yield_unit": "portion"},
    )
    client.post(
        "/api/v1/recipes",
        json={"name": "Recipe B", "yield_quantity": 2, "yield_unit": "portion"},
    )

    response = client.get("/api/v1/recipes")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_count" in data
    assert "page_number" in data
    assert "current_page_size" in data
    assert "total_pages" in data
    assert data["total_count"] == 2
    assert len(data["items"]) == 2
    assert data["page_number"] == 1


def test_list_recipes_pagination_params(client: TestClient):
    """Test pagination params (page_number, page_size)."""
    for i in range(5):
        client.post(
            "/api/v1/recipes",
            json={"name": f"Recipe {i}", "yield_quantity": 1, "yield_unit": "portion"},
        )

    # Page 1, size 2
    response = client.get("/api/v1/recipes", params={"page_size": 2, "page_number": 1})
    data = response.json()
    assert data["total_count"] == 5
    assert data["current_page_size"] == 2
    assert data["total_pages"] == 3
    assert data["page_number"] == 1

    # Page 3, size 2
    response = client.get("/api/v1/recipes", params={"page_size": 2, "page_number": 3})
    data = response.json()
    assert data["current_page_size"] == 1  # Only 1 item on last page


def test_list_recipes_search(client: TestClient):
    """Test search filter on recipe list."""
    client.post(
        "/api/v1/recipes",
        json={"name": "Chocolate Cake", "yield_quantity": 1, "yield_unit": "portion"},
    )
    client.post(
        "/api/v1/recipes",
        json={"name": "Vanilla Ice Cream", "yield_quantity": 1, "yield_unit": "portion"},
    )

    response = client.get("/api/v1/recipes", params={"search": "chocolate"})
    data = response.json()
    assert data["total_count"] == 1
    assert data["items"][0]["name"] == "Chocolate Cake"


def test_list_recipes_search_case_insensitive(client: TestClient):
    """Search is case-insensitive for recipe names."""
    client.post("/api/v1/recipes", json={"name": "Beef Stew", "yield_quantity": 1, "yield_unit": "portion"})
    client.post("/api/v1/recipes", json={"name": "Mushroom Risotto", "yield_quantity": 1, "yield_unit": "portion"})

    for term in ("beef", "BEEF", "Beef", "beEF"):
        response = client.get("/api/v1/recipes", params={"search": term})
        data = response.json()
        assert data["total_count"] == 1, f"Expected 1 result for '{term}', got {data['total_count']}"
        assert data["items"][0]["name"] == "Beef Stew"


def test_list_recipes_search_no_match(client: TestClient):
    """Search with a term that matches nothing returns empty list."""
    client.post("/api/v1/recipes", json={"name": "Pasta", "yield_quantity": 1, "yield_unit": "portion"})

    response = client.get("/api/v1/recipes", params={"search": "zzznomatch"})
    data = response.json()
    assert data["total_count"] == 0
    assert data["items"] == []


def test_list_recipes_search_partial_name(client: TestClient):
    """Partial name match returns correct recipes."""
    client.post("/api/v1/recipes", json={"name": "Grilled Salmon Fillet", "yield_quantity": 1, "yield_unit": "portion"})
    client.post("/api/v1/recipes", json={"name": "Pan-Seared Salmon", "yield_quantity": 1, "yield_unit": "portion"})
    client.post("/api/v1/recipes", json={"name": "Beef Burger", "yield_quantity": 1, "yield_unit": "portion"})

    response = client.get("/api/v1/recipes", params={"search": "salmon"})
    data = response.json()
    assert data["total_count"] == 2
    names = {item["name"] for item in data["items"]}
    assert names == {"Grilled Salmon Fillet", "Pan-Seared Salmon"}


def test_list_recipes_search_by_category_name(client: TestClient):
    """Searching by a category name returns recipes tagged with that category."""
    # Create categories
    breakfast = client.post("/api/v1/recipe-categories", json={"name": "Breakfast"}).json()
    desserts = client.post("/api/v1/recipe-categories", json={"name": "Desserts"}).json()

    # Create recipes
    r1 = client.post("/api/v1/recipes", json={"name": "Scrambled Eggs", "yield_quantity": 1, "yield_unit": "portion"}).json()
    r2 = client.post("/api/v1/recipes", json={"name": "Chocolate Mousse", "yield_quantity": 1, "yield_unit": "portion"}).json()
    r3 = client.post("/api/v1/recipes", json={"name": "Avocado Toast", "yield_quantity": 1, "yield_unit": "portion"}).json()

    # Tag r1 and r3 with Breakfast, r2 with Desserts
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r1["id"], "category_id": breakfast["id"]})
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r2["id"], "category_id": desserts["id"]})
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r3["id"], "category_id": breakfast["id"]})

    response = client.get("/api/v1/recipes", params={"search": "breakfast"})
    data = response.json()
    assert data["total_count"] == 2
    names = {item["name"] for item in data["items"]}
    assert names == {"Scrambled Eggs", "Avocado Toast"}


def test_list_recipes_search_by_category_name_case_insensitive(client: TestClient):
    """Category name search is case-insensitive."""
    cat = client.post("/api/v1/recipe-categories", json={"name": "Vegan"}).json()
    r = client.post("/api/v1/recipes", json={"name": "Lentil Soup", "yield_quantity": 1, "yield_unit": "portion"}).json()
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r["id"], "category_id": cat["id"]})

    for term in ("vegan", "VEGAN", "Vegan"):
        response = client.get("/api/v1/recipes", params={"search": term})
        data = response.json()
        assert data["total_count"] == 1, f"Expected 1 result for '{term}', got {data['total_count']}"
        assert data["items"][0]["name"] == "Lentil Soup"


def test_list_recipes_search_matches_name_and_category(client: TestClient):
    """Search returns union of name matches and category matches without duplicates."""
    cat = client.post("/api/v1/recipe-categories", json={"name": "Italian"}).json()

    # r1 matches by name AND is tagged Italian (should appear once)
    r1 = client.post("/api/v1/recipes", json={"name": "Italian Meatballs", "yield_quantity": 1, "yield_unit": "portion"}).json()
    # r2 matches only by category
    r2 = client.post("/api/v1/recipes", json={"name": "Tiramisu", "yield_quantity": 1, "yield_unit": "portion"}).json()
    # r3 matches neither
    client.post("/api/v1/recipes", json={"name": "Fish & Chips", "yield_quantity": 1, "yield_unit": "portion"})

    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r1["id"], "category_id": cat["id"]})
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r2["id"], "category_id": cat["id"]})

    response = client.get("/api/v1/recipes", params={"search": "italian"})
    data = response.json()
    assert data["total_count"] == 2
    names = {item["name"] for item in data["items"]}
    assert names == {"Italian Meatballs", "Tiramisu"}


def test_list_recipes_search_excludes_inactive_category_links(client: TestClient):
    """Recipes tagged with a category that has been soft-deleted are NOT returned by category name search."""
    cat = client.post("/api/v1/recipe-categories", json={"name": "Seafood"}).json()
    r = client.post("/api/v1/recipes", json={"name": "Prawn Cocktail", "yield_quantity": 1, "yield_unit": "portion"}).json()

    # Link recipe to category, then soft-delete the link via DELETE endpoint
    link = client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r["id"], "category_id": cat["id"]}).json()
    client.delete(f"/api/v1/recipe-recipe-categories/{link['id']}")

    # Category search should NOT find the recipe after soft-delete
    response = client.get("/api/v1/recipes", params={"search": "seafood"})
    data = response.json()
    assert data["total_count"] == 0

    # Name search still works (recipe name doesn't contain "seafood")
    name_response = client.get("/api/v1/recipes", params={"search": "prawn"})
    assert name_response.json()["total_count"] == 1


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
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion", "owner_id": ADMIN_USER_ID},
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
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion", "owner_id": ADMIN_USER_ID},
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
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion", "owner_id": ADMIN_USER_ID},
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
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion", "owner_id": ADMIN_USER_ID},
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
        json={
            "name": "Recipe with Instructions",
            "yield_quantity": 1,
            "yield_unit": "batch",
            "owner_id": ADMIN_USER_ID,
        },
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
        json={
            "name": "Priced Recipe",
            "yield_quantity": 1,
            "yield_unit": "portion",
            "owner_id": ADMIN_USER_ID,
        },
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
    """Test that forking preserves ingredient insertion order."""
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
    assert orig["owner_id"] == ADMIN_USER_ID  # the caller owns what they create
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


# ============ Access Control Tests (Version Tree & Recipe) ============
# Structure is Passport's: a recipe is served at a UNIT (a brand, or an outlet under one), and a
# user reaches a unit by holding a role at its brand. There is no local outlet hierarchy to walk.


def test_version_tree_outlet_user_sees_their_brands_recipes(client: TestClient, session):
    """A user at an outlet sees its brand's recipes in full — the outlet INHERITS the brand."""
    brand_id = seed_brand(session, "Main Brand")
    outlet_id = seed_outlet_unit(session, brand_id, "Downtown Location")

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Brand Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_id, "is_active": True},
    )

    forked = client.post(f"/api/v1/recipes/{recipe['id']}/fork").json()
    client.post(
        f"/api/v1/recipes/{forked['id']}/units",
        json={"unit_id": brand_id, "is_active": True},
    )

    make_brand_user(session, "location-user-1", brand_id, STAFF, "location_user")
    assert outlet_id in access.accessible_unit_ids(session, "location-user-1")

    response = client.get(
        f"/api/v1/recipes/{recipe['id']}/versions"
    )
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2

    original = next(v for v in versions if v["id"] == recipe["id"])
    fork = next(v for v in versions if v["id"] == forked["id"])
    assert original["name"] == "Brand Recipe"
    assert fork["name"] == "Brand Recipe (Fork)"


def test_version_tree_user_of_another_brand_sees_masked_recipes(client: TestClient, session):
    """A role at brand A shows nothing of brand B — its recipes come back masked."""
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Brand B Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_b, "is_active": True},
    )

    forked = client.post(f"/api/v1/recipes/{recipe['id']}/fork").json()

    use_user(client, make_brand_user(session, "brand-a-user", brand_a, MANAGER, "brand_a_user"))

    response = client.get(
        f"/api/v1/recipes/{recipe['id']}/versions"
    )
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2

    original = next(v for v in versions if v["id"] == recipe["id"])
    fork = next(v for v in versions if v["id"] == forked["id"])
    assert original["name"] == ""
    assert fork["name"] == ""
    assert original["version"] == 1
    assert fork["version"] == 2


def test_version_tree_owner_sees_own_recipe_unmasked(client: TestClient, session):
    """The owner always sees their own recipe, whatever Passport says.

    Acts AS the owner throughout. It used to create the recipe under a fabricated `owner_id`, fork
    it as the admin, and then pass `?user_id=` to "become" the owner for the read — which only
    worked because fork had no access check and the masking trusted a query string. Both are gone.
    """
    owner = create_user(session, "recipe-owner-user", "owner")
    use_user(client, owner)

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Owned Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    forked = client.post(
        f"/api/v1/recipes/{recipe['id']}/fork",
        json={"new_owner_id": "other-admin-user"},
    ).json()

    response = client.get(f"/api/v1/recipes/{recipe['id']}/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2

    original = next(v for v in versions if v["id"] == recipe["id"])
    assert original["name"] == "Owned Recipe"

    fork = next(v for v in versions if v["id"] == forked["id"])
    assert fork["name"] == ""


def test_version_tree_user_with_no_passport_role_sees_masked_recipes(
    client: TestClient, session
):
    """FAIL CLOSED — no identity link, no membership, no brand role: nothing is visible.

    The old model treated an empty scope as "see everything". It now derives nothing.
    """
    # Built by the admin (who owns what they create), then READ as someone with no Passport role
    # at all. Forking under a fabricated `owner_id` used to work only because fork had no access
    # check — it is a 403 now, correctly.
    recipe = client.post(
        "/api/v1/recipes",
        json={
            "name": "Other User Recipe",
            "yield_quantity": 1,
            "yield_unit": "batch",
            "is_public": False,
        },
    ).json()

    forked = client.post(f"/api/v1/recipes/{recipe['id']}/fork").json()

    use_user(client, create_user(session, "unrelated-user", "unrelated"))

    response = client.get(f"/api/v1/recipes/{recipe['id']}/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2

    original = next(v for v in versions if v["id"] == recipe["id"])
    fork = next(v for v in versions if v["id"] == forked["id"])
    assert original["name"] == ""
    assert fork["name"] == ""


def test_get_recipe_outlet_user_can_access_their_brands_recipe(
    client: TestClient, session
):
    """An outlet inherits its brand, so a recipe served at the brand is reachable from the site."""
    brand_id = seed_brand(session, "Brand X")
    seed_outlet_unit(session, brand_id, "Location X")

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Brand Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_id, "is_active": True},
    )

    use_user(client, make_brand_user(session, "loc-user-1", brand_id, STAFF, "locuser"))

    response = client.get(f"/api/v1/recipes/{recipe['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == recipe["id"]
    assert data["name"] == "Brand Recipe"


def test_get_recipe_user_of_another_brand_is_refused(client: TestClient, session):
    """Brand scoping on the read path: brand A's role reaches nothing served only at brand B."""
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Brand B Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_b, "is_active": True},
    )

    use_user(client, make_brand_user(session, "brand-a-user", brand_a, MANAGER, "branduser"))

    response = client.get(f"/api/v1/recipes/{recipe['id']}")
    assert response.status_code == 403
    assert "do not have permission" in response.json()["detail"].lower()


def test_get_recipe_user_with_no_passport_role_is_refused(client: TestClient, session):
    """FAIL CLOSED — an empty unit scope reaches no recipe at all."""
    brand_id = seed_brand(session, "Brand Z")

    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Scoped Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_id, "is_active": True},
    )

    use_user(client, create_user(session, "no-role-user", "norole"))

    response = client.get(f"/api/v1/recipes/{recipe['id']}")
    assert response.status_code == 403


# ============ Recipe <-> Passport unit links ============


def test_add_recipe_to_unit_requires_manager_at_that_unit(client: TestClient, session):
    """`Staff` cannot place a recipe at a brand — that is a Manager's write."""
    brand_id = seed_brand(session, "Brand M")
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Unit Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    use_user(client, make_brand_user(session, "staff-user", brand_id, STAFF, "staffuser"))

    response = client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_id, "is_active": True},
    )
    assert response.status_code == 403


def test_manager_of_one_brand_cannot_place_a_recipe_at_another(client: TestClient, session):
    """Brand-scoped, again: `Manager` at brand A grants nothing at brand B."""
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Unit Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    use_user(client, make_brand_user(session, "manager-a", brand_a, MANAGER, "managera"))

    assert (
        client.post(
            f"/api/v1/recipes/{recipe['id']}/units",
            json={"unit_id": brand_b, "is_active": True},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/recipes/{recipe['id']}/units",
            json={"unit_id": brand_a, "is_active": True},
        ).status_code
        == 201
    )


def test_list_recipe_units_is_scoped_to_visible_units(client: TestClient, session):
    """The links a caller may see are the ones at units they can reach."""
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Shared Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    for brand in (brand_a, brand_b):
        client.post(
            f"/api/v1/recipes/{recipe['id']}/units",
            json={"unit_id": brand, "is_active": True},
        )

    # The org admin manages both brands and sees both links.
    assert len(client.get(f"/api/v1/recipes/{recipe['id']}/units").json()) == 2

    use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))
    links = client.get(f"/api/v1/recipes/{recipe['id']}/units").json()
    assert [link["unit_id"] for link in links] == [brand_a]


def test_update_and_remove_recipe_unit_link(client: TestClient, brand_id: str):
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Priced Recipe", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()
    client.post(
        f"/api/v1/recipes/{recipe['id']}/units",
        json={"unit_id": brand_id, "is_active": True},
    )

    response = client.patch(
        f"/api/v1/recipes/{recipe['id']}/units/{brand_id}",
        json={"price_override": 12.5, "is_active": False},
    )
    assert response.status_code == 200
    assert response.json()["price_override"] == 12.5
    assert response.json()["is_active"] is False

    assert (
        client.delete(f"/api/v1/recipes/{recipe['id']}/units/{brand_id}").status_code == 204
    )
    assert client.get(f"/api/v1/recipes/{recipe['id']}/units").json() == []


# -------------------------------------------------------------------------
# Server-Side Filter tests
# -------------------------------------------------------------------------


def test_list_recipes_search_by_sub_dish_name(client: TestClient):
    """Searching by a sub-dish name should also return the parent dish."""
    # Create a child (sub-dish) recipe
    child = client.post(
        "/api/v1/recipes",
        json={"name": "Hollandaise Sauce", "yield_quantity": 1, "yield_unit": "batch"},
    ).json()

    # Create a parent recipe that uses the child as a sub-dish
    parent = client.post(
        "/api/v1/recipes",
        json={"name": "Eggs Benedict", "yield_quantity": 4, "yield_unit": "portion"},
    ).json()

    # Link child as sub-recipe of parent
    client.post(
        f"/api/v1/recipes/{parent['id']}/sub-recipes",
        json={"child_recipe_id": child["id"], "quantity": 0.5, "unit": "batch"},
    )

    # Create an unrelated recipe to verify it is excluded
    client.post(
        "/api/v1/recipes",
        json={"name": "Caesar Salad", "yield_quantity": 1, "yield_unit": "portion"},
    )

    # Searching by the sub-dish name should return both the child AND the parent
    resp = client.get("/api/v1/recipes?search=Hollandaise")
    data = resp.json()
    names = {item["name"] for item in data["items"]}
    assert "Hollandaise Sauce" in names, "Child dish should appear in results"
    assert "Eggs Benedict" in names, "Parent dish containing the sub-dish should appear in results"
    assert "Caesar Salad" not in names, "Unrelated dish should be excluded"


def test_list_recipes_filter_by_category_ids(client: TestClient):
    """Test filtering recipes by category_ids."""
    # Create recipe categories
    cat1 = client.post("/api/v1/recipe-categories", json={"name": "Desserts"}).json()
    cat2 = client.post("/api/v1/recipe-categories", json={"name": "Mains"}).json()

    # Create recipes
    r1 = client.post("/api/v1/recipes", json={"name": "Cake", "yield_quantity": 1, "yield_unit": "portion"}).json()
    r2 = client.post("/api/v1/recipes", json={"name": "Steak", "yield_quantity": 1, "yield_unit": "portion"}).json()
    r3 = client.post("/api/v1/recipes", json={"name": "Salad", "yield_quantity": 1, "yield_unit": "portion"}).json()

    # Link recipes to categories
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r1["id"], "category_id": cat1["id"]})
    client.post("/api/v1/recipe-recipe-categories", json={"recipe_id": r2["id"], "category_id": cat2["id"]})

    # Filter by single category
    resp = client.get(f"/api/v1/recipes?category_ids={cat1['id']}")
    data = resp.json()
    assert data["total_count"] == 1
    assert data["items"][0]["name"] == "Cake"

    # Filter by multiple categories
    resp2 = client.get(f"/api/v1/recipes?category_ids={cat1['id']},{cat2['id']}")
    data2 = resp2.json()
    assert data2["total_count"] == 2

    # No filter returns all
    resp3 = client.get("/api/v1/recipes")
    data3 = resp3.json()
    assert data3["total_count"] == 3
