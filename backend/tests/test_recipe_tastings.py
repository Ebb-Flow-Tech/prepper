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


# ============ Recipe Ingredients in Session Recipes Response ============


def _create_ingredient(client: TestClient, name: str, base_unit: str = "g") -> dict:
    """Helper to create an ingredient."""
    response = client.post(
        "/api/v1/ingredients",
        json={"name": name, "base_unit": base_unit},
    )
    assert response.status_code == 201
    return response.json()


def _create_recipe_with_ingredients(
    client: TestClient, recipe_name: str, ingredient_ids: list[int]
) -> int:
    """Helper to create a recipe and add ingredients to it."""
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": recipe_name, "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    for ing_id in ingredient_ids:
        client.post(
            f"/api/v1/recipes/{recipe['id']}/ingredients",
            json={"ingredient_id": ing_id, "quantity": 100, "unit": "g"},
        )
    return recipe["id"]


def _create_session_with_recipes(
    client: TestClient, session_name: str, recipe_ids: list[int]
) -> int:
    """Helper to create a tasting session and add recipes to it."""
    session = client.post(
        "/api/v1/tasting-sessions",
        json={"name": session_name, "date": "2024-12-15"},
    ).json()
    if recipe_ids:
        client.post(
            f"/api/v1/tasting-sessions/{session['id']}/recipes/batch",
            json={"recipe_ids": recipe_ids},
        )
    return session["id"]


def test_session_recipes_include_ingredients(client: TestClient):
    """Test that session recipes response includes ingredients for each recipe."""
    ing1 = _create_ingredient(client, "Garlic")
    ing2 = _create_ingredient(client, "Olive Oil", "ml")
    recipe_id = _create_recipe_with_ingredients(
        client, "Aglio Olio", [ing1["id"], ing2["id"]]
    )
    session_id = _create_session_with_recipes(client, "Tasting", [recipe_id])

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    recipe_entry = data[0]
    assert recipe_entry["recipe_name"] == "Aglio Olio"
    assert "ingredients" in recipe_entry
    assert len(recipe_entry["ingredients"]) == 2

    ing_names = {i["name"] for i in recipe_entry["ingredients"]}
    assert ing_names == {"Garlic", "Olive Oil"}

    # Check ingredient fields
    for ing in recipe_entry["ingredients"]:
        assert "id" in ing
        assert "name" in ing
        assert "base_unit" in ing
        assert "is_halal" in ing


def test_session_recipes_empty_ingredients(client: TestClient):
    """Test that a recipe with no ingredients returns empty ingredients list."""
    recipe = client.post(
        "/api/v1/recipes",
        json={"name": "Empty Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    session_id = _create_session_with_recipes(client, "Tasting", [recipe["id"]])

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["ingredients"] == []


def test_session_recipes_multiple_recipes_with_ingredients(client: TestClient):
    """Test ingredients are correctly grouped per recipe."""
    salt = _create_ingredient(client, "Salt")
    pepper = _create_ingredient(client, "Pepper")
    butter = _create_ingredient(client, "Butter")

    recipe1_id = _create_recipe_with_ingredients(
        client, "Pasta", [salt["id"], pepper["id"]]
    )
    recipe2_id = _create_recipe_with_ingredients(
        client, "Steak", [salt["id"], butter["id"]]
    )
    session_id = _create_session_with_recipes(
        client, "Dinner Tasting", [recipe1_id, recipe2_id]
    )

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    recipes_by_name = {r["recipe_name"]: r for r in data}

    # Pasta has Salt and Pepper
    pasta_ings = {i["name"] for i in recipes_by_name["Pasta"]["ingredients"]}
    assert pasta_ings == {"Salt", "Pepper"}

    # Steak has Salt and Butter
    steak_ings = {i["name"] for i in recipes_by_name["Steak"]["ingredients"]}
    assert steak_ings == {"Salt", "Butter"}


def test_session_recipes_shared_ingredient_appears_in_both(client: TestClient):
    """Test that a shared ingredient appears in both recipes' ingredient lists."""
    salt = _create_ingredient(client, "Salt")

    recipe1_id = _create_recipe_with_ingredients(client, "Pasta", [salt["id"]])
    recipe2_id = _create_recipe_with_ingredients(client, "Steak", [salt["id"]])
    session_id = _create_session_with_recipes(
        client, "Tasting", [recipe1_id, recipe2_id]
    )

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    data = response.json()

    # Salt should appear in both recipe ingredient lists
    for recipe_entry in data:
        ing_names = {i["name"] for i in recipe_entry["ingredients"]}
        assert "Salt" in ing_names


def test_session_recipes_ingredients_update_on_recipe_change(client: TestClient):
    """Test that ingredients reflect recipe additions and removals."""
    ing1 = _create_ingredient(client, "Tomato")
    ing2 = _create_ingredient(client, "Basil")

    recipe1_id = _create_recipe_with_ingredients(client, "Marinara", [ing1["id"]])
    recipe2_id = _create_recipe_with_ingredients(client, "Caprese", [ing1["id"], ing2["id"]])

    session_id = _create_session_with_recipes(client, "Italian Tasting", [recipe1_id])

    # Initially only Marinara with Tomato
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["ingredients"]) == 1

    # Add Caprese recipe
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/recipes",
        json={"recipe_id": recipe2_id},
    )

    # Now two recipes with their ingredients
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    data = response.json()
    assert len(data) == 2

    # Remove Marinara
    client.delete(f"/api/v1/tasting-sessions/{session_id}/recipes/{recipe1_id}")

    # Only Caprese left with Tomato and Basil
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    data = response.json()
    assert len(data) == 1
    assert data[0]["recipe_name"] == "Caprese"
    ing_names = {i["name"] for i in data[0]["ingredients"]}
    assert ing_names == {"Tomato", "Basil"}


def test_session_recipes_no_recipes_returns_empty(client: TestClient):
    """Test empty session returns empty list."""
    session_id = _create_session_with_recipes(client, "Empty Session", [])

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    assert response.status_code == 200
    assert response.json() == []


def test_session_recipes_ingredient_base_unit(client: TestClient):
    """Test that ingredient base_unit is correctly returned."""
    ing_ml = _create_ingredient(client, "Olive Oil", "ml")
    ing_g = _create_ingredient(client, "Flour", "g")
    ing_pcs = _create_ingredient(client, "Eggs", "pcs")

    recipe_id = _create_recipe_with_ingredients(
        client, "Recipe", [ing_ml["id"], ing_g["id"], ing_pcs["id"]]
    )
    session_id = _create_session_with_recipes(client, "Tasting", [recipe_id])

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/recipes")
    data = response.json()
    ingredients = data[0]["ingredients"]

    units_by_name = {i["name"]: i["base_unit"] for i in ingredients}
    assert units_by_name["Olive Oil"] == "ml"
    assert units_by_name["Flour"] == "g"
    assert units_by_name["Eggs"] == "pcs"
