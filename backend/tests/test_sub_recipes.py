"""Tests for sub-recipe endpoints."""

from fastapi.testclient import TestClient


# ============ Helper Functions ============


def create_recipe(client: TestClient, name: str, **kwargs) -> dict:
    """Helper to create a recipe and return its data."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": name,
            "yield_quantity": kwargs.get("yield_quantity", 1),
            "yield_unit": kwargs.get("yield_unit", "portion"),
            **kwargs,
        },
    )
    assert response.status_code == 201
    return response.json()


# ============ List Sub-Recipes Tests ============


def test_list_sub_recipes_empty(client: TestClient):
    """Test listing sub-recipes for a recipe with no sub-recipes."""
    recipe = create_recipe(client, "Main Recipe")

    response = client.get(f"/api/v1/recipes/{recipe['id']}/sub-recipes")
    assert response.status_code == 200
    assert response.json() == []


def test_list_sub_recipes(client: TestClient):
    """Test listing sub-recipes returns items in correct order."""
    main = create_recipe(client, "Main Recipe")
    sub1 = create_recipe(client, "Sub Recipe 1")
    sub2 = create_recipe(client, "Sub Recipe 2")

    # Add sub-recipes
    client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub1["id"], "quantity": 2, "unit": "portion"},
    )
    client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub2["id"], "quantity": 1, "unit": "batch"},
    )

    response = client.get(f"/api/v1/recipes/{main['id']}/sub-recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["child_recipe_id"] == sub1["id"]
    assert data[1]["child_recipe_id"] == sub2["id"]


# ============ Add Sub-Recipe Tests ============


def test_add_sub_recipe(client: TestClient):
    """Test adding a sub-recipe to a recipe."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 2.5, "unit": "portion"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["parent_recipe_id"] == main["id"]
    assert data["child_recipe_id"] == sub["id"]
    assert data["quantity"] == 2.5
    assert data["unit"] == "portion"
    assert data["position"] == 1


def test_add_sub_recipe_auto_increment_position(client: TestClient):
    """Test that adding sub-recipes auto-increments position."""
    main = create_recipe(client, "Main Recipe")
    sub1 = create_recipe(client, "Sub Recipe 1")
    sub2 = create_recipe(client, "Sub Recipe 2")
    sub3 = create_recipe(client, "Sub Recipe 3")

    resp1 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub1["id"], "quantity": 1, "unit": "portion"},
    )
    resp2 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub2["id"], "quantity": 1, "unit": "portion"},
    )
    resp3 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub3["id"], "quantity": 1, "unit": "portion"},
    )

    assert resp1.json()["position"] == 1
    assert resp2.json()["position"] == 2
    assert resp3.json()["position"] == 3


def test_add_sub_recipe_self_reference_rejected(client: TestClient):
    """Test that adding a recipe as its own sub-recipe is rejected."""
    recipe = create_recipe(client, "Self-Referencing Recipe")

    response = client.post(
        f"/api/v1/recipes/{recipe['id']}/sub-recipes",
        json={"child_recipe_id": recipe["id"], "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 400
    assert "circular reference" in response.json()["detail"].lower()


def test_add_sub_recipe_direct_cycle_rejected(client: TestClient):
    """Test that adding a sub-recipe that would create a direct cycle is rejected."""
    recipe_a = create_recipe(client, "Recipe A")
    recipe_b = create_recipe(client, "Recipe B")

    # A -> B (OK)
    response = client.post(
        f"/api/v1/recipes/{recipe_a['id']}/sub-recipes",
        json={"child_recipe_id": recipe_b["id"], "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 201

    # B -> A (would create cycle: A -> B -> A)
    response = client.post(
        f"/api/v1/recipes/{recipe_b['id']}/sub-recipes",
        json={"child_recipe_id": recipe_a["id"], "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 400
    assert "circular reference" in response.json()["detail"].lower()


def test_add_sub_recipe_indirect_cycle_rejected(client: TestClient):
    """Test that adding a sub-recipe that would create an indirect cycle is rejected."""
    recipe_a = create_recipe(client, "Recipe A")
    recipe_b = create_recipe(client, "Recipe B")
    recipe_c = create_recipe(client, "Recipe C")

    # A -> B (OK)
    client.post(
        f"/api/v1/recipes/{recipe_a['id']}/sub-recipes",
        json={"child_recipe_id": recipe_b["id"], "quantity": 1, "unit": "portion"},
    )
    # B -> C (OK)
    client.post(
        f"/api/v1/recipes/{recipe_b['id']}/sub-recipes",
        json={"child_recipe_id": recipe_c["id"], "quantity": 1, "unit": "portion"},
    )

    # C -> A (would create cycle: A -> B -> C -> A)
    response = client.post(
        f"/api/v1/recipes/{recipe_c['id']}/sub-recipes",
        json={"child_recipe_id": recipe_a["id"], "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 400
    assert "circular reference" in response.json()["detail"].lower()


def test_add_sub_recipe_parent_not_found(client: TestClient):
    """Test adding sub-recipe to non-existent parent returns 400."""
    sub = create_recipe(client, "Sub Recipe")

    response = client.post(
        "/api/v1/recipes/99999/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_add_sub_recipe_child_not_found(client: TestClient):
    """Test adding non-existent child recipe returns 400."""
    main = create_recipe(client, "Main Recipe")

    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": 99999, "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_add_sub_recipe_duplicate_rejected(client: TestClient):
    """Test adding the same sub-recipe twice is rejected."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    # First add (OK)
    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 1, "unit": "portion"},
    )
    assert response.status_code == 201

    # Second add (duplicate)
    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 2, "unit": "batch"},
    )
    assert response.status_code == 400
    assert "already a sub-recipe" in response.json()["detail"].lower()


# ============ Update Sub-Recipe Tests ============


def test_update_sub_recipe_quantity(client: TestClient):
    """Test updating sub-recipe quantity."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    # Add sub-recipe
    add_response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 1, "unit": "portion"},
    )
    link_id = add_response.json()["id"]

    # Update quantity
    response = client.put(
        f"/api/v1/recipes/{main['id']}/sub-recipes/{link_id}",
        json={"quantity": 5.0},
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 5.0
    assert response.json()["unit"] == "portion"  # unchanged


def test_update_sub_recipe_unit(client: TestClient):
    """Test updating sub-recipe unit."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    # Add sub-recipe
    add_response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 1, "unit": "portion"},
    )
    link_id = add_response.json()["id"]

    # Update unit
    response = client.put(
        f"/api/v1/recipes/{main['id']}/sub-recipes/{link_id}",
        json={"unit": "g"},
    )
    assert response.status_code == 200
    assert response.json()["unit"] == "g"
    assert response.json()["quantity"] == 1.0  # unchanged


def test_update_sub_recipe_both_fields(client: TestClient):
    """Test updating both quantity and unit."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    # Add sub-recipe
    add_response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 1, "unit": "portion"},
    )
    link_id = add_response.json()["id"]

    # Update both
    response = client.put(
        f"/api/v1/recipes/{main['id']}/sub-recipes/{link_id}",
        json={"quantity": 250.0, "unit": "ml"},
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 250.0
    assert response.json()["unit"] == "ml"


def test_update_sub_recipe_not_found(client: TestClient):
    """Test updating non-existent sub-recipe link returns 404."""
    main = create_recipe(client, "Main Recipe")

    response = client.put(
        f"/api/v1/recipes/{main['id']}/sub-recipes/99999",
        json={"quantity": 5.0},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============ Remove Sub-Recipe Tests ============


def test_remove_sub_recipe(client: TestClient):
    """Test removing a sub-recipe from a recipe."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    # Add sub-recipe
    add_response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"], "quantity": 1, "unit": "portion"},
    )
    link_id = add_response.json()["id"]

    # Remove sub-recipe
    response = client.delete(f"/api/v1/recipes/{main['id']}/sub-recipes/{link_id}")
    assert response.status_code == 204

    # Verify it's gone
    list_response = client.get(f"/api/v1/recipes/{main['id']}/sub-recipes")
    assert list_response.json() == []


def test_remove_sub_recipe_not_found(client: TestClient):
    """Test removing non-existent sub-recipe link returns 404."""
    main = create_recipe(client, "Main Recipe")

    response = client.delete(f"/api/v1/recipes/{main['id']}/sub-recipes/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============ Reorder Sub-Recipes Tests ============


def test_reorder_sub_recipes(client: TestClient):
    """Test reordering sub-recipes within a recipe."""
    main = create_recipe(client, "Main Recipe")
    sub1 = create_recipe(client, "Sub Recipe 1")
    sub2 = create_recipe(client, "Sub Recipe 2")
    sub3 = create_recipe(client, "Sub Recipe 3")

    # Add sub-recipes (will be positions 1, 2, 3)
    link1 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub1["id"], "quantity": 1, "unit": "portion"},
    ).json()
    link2 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub2["id"], "quantity": 1, "unit": "portion"},
    ).json()
    link3 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub3["id"], "quantity": 1, "unit": "portion"},
    ).json()

    # Reorder to: 3, 1, 2
    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes/reorder",
        json={"ordered_ids": [link3["id"], link1["id"], link2["id"]]},
    )
    assert response.status_code == 200
    data = response.json()

    assert len(data) == 3
    assert data[0]["id"] == link3["id"]
    assert data[0]["position"] == 0
    assert data[1]["id"] == link1["id"]
    assert data[1]["position"] == 1
    assert data[2]["id"] == link2["id"]
    assert data[2]["position"] == 2


def test_reorder_sub_recipes_partial_list(client: TestClient):
    """Test reordering with partial list only updates specified items."""
    main = create_recipe(client, "Main Recipe")
    sub1 = create_recipe(client, "Sub Recipe 1")
    sub2 = create_recipe(client, "Sub Recipe 2")

    link1 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub1["id"], "quantity": 1, "unit": "portion"},
    ).json()
    link2 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub2["id"], "quantity": 1, "unit": "portion"},
    ).json()

    # Only reorder link2
    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes/reorder",
        json={"ordered_ids": [link2["id"]]},
    )
    assert response.status_code == 200


# ============ Used-In Tests ============


def test_get_used_in_empty(client: TestClient):
    """Test used-in for recipe not used anywhere."""
    recipe = create_recipe(client, "Standalone Recipe")

    response = client.get(f"/api/v1/recipes/{recipe['id']}/used-in")
    assert response.status_code == 200
    assert response.json() == []


def test_get_used_in(client: TestClient):
    """Test used-in returns all parent recipes."""
    component = create_recipe(client, "Component Recipe")
    main1 = create_recipe(client, "Main Recipe 1")
    main2 = create_recipe(client, "Main Recipe 2")

    # Add component to both main recipes
    client.post(
        f"/api/v1/recipes/{main1['id']}/sub-recipes",
        json={"child_recipe_id": component["id"], "quantity": 1, "unit": "portion"},
    )
    client.post(
        f"/api/v1/recipes/{main2['id']}/sub-recipes",
        json={"child_recipe_id": component["id"], "quantity": 2, "unit": "batch"},
    )

    response = client.get(f"/api/v1/recipes/{component['id']}/used-in")
    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    parent_ids = {item["parent_recipe_id"] for item in data}
    assert parent_ids == {main1["id"], main2["id"]}


# ============ BOM Tree Tests ============


def test_get_bom_tree_no_sub_recipes(client: TestClient):
    """Test BOM tree for recipe with no sub-recipes."""
    recipe = create_recipe(client, "Simple Recipe")

    response = client.get(f"/api/v1/recipes/{recipe['id']}/bom-tree")
    assert response.status_code == 200
    data = response.json()

    assert data["recipe_id"] == recipe["id"]
    assert data["recipe_name"] == "Simple Recipe"
    assert data["sub_recipes"] == []


def test_get_bom_tree_single_level(client: TestClient):
    """Test BOM tree with single level of sub-recipes."""
    main = create_recipe(client, "Main Recipe")
    sub1 = create_recipe(client, "Sub Recipe 1")
    sub2 = create_recipe(client, "Sub Recipe 2")

    link1 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub1["id"], "quantity": 2, "unit": "portion"},
    ).json()
    link2 = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub2["id"], "quantity": 100, "unit": "g"},
    ).json()

    response = client.get(f"/api/v1/recipes/{main['id']}/bom-tree")
    assert response.status_code == 200
    data = response.json()

    assert data["recipe_id"] == main["id"]
    assert data["recipe_name"] == "Main Recipe"
    assert len(data["sub_recipes"]) == 2

    # Verify first sub-recipe
    sr1 = data["sub_recipes"][0]
    assert sr1["link_id"] == link1["id"]
    assert sr1["quantity"] == 2
    assert sr1["unit"] == "portion"
    assert sr1["child"]["recipe_id"] == sub1["id"]
    assert sr1["child"]["recipe_name"] == "Sub Recipe 1"
    assert sr1["child"]["sub_recipes"] == []


def test_get_bom_tree_nested(client: TestClient):
    """Test BOM tree with nested sub-recipes."""
    # Create a 3-level hierarchy: Main -> Component -> Base
    base = create_recipe(client, "Base Recipe")
    component = create_recipe(client, "Component Recipe")
    main = create_recipe(client, "Main Recipe")

    # Component uses Base
    client.post(
        f"/api/v1/recipes/{component['id']}/sub-recipes",
        json={"child_recipe_id": base["id"], "quantity": 1, "unit": "batch"},
    )
    # Main uses Component
    client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": component["id"], "quantity": 2, "unit": "portion"},
    )

    response = client.get(f"/api/v1/recipes/{main['id']}/bom-tree")
    assert response.status_code == 200
    data = response.json()

    assert data["recipe_name"] == "Main Recipe"
    assert len(data["sub_recipes"]) == 1

    component_node = data["sub_recipes"][0]["child"]
    assert component_node["recipe_name"] == "Component Recipe"
    assert len(component_node["sub_recipes"]) == 1

    base_node = component_node["sub_recipes"][0]["child"]
    assert base_node["recipe_name"] == "Base Recipe"
    assert base_node["sub_recipes"] == []


def test_get_bom_tree_recipe_not_found(client: TestClient):
    """Test BOM tree for non-existent recipe returns error structure."""
    response = client.get("/api/v1/recipes/99999/bom-tree")
    assert response.status_code == 200
    data = response.json()

    assert data["recipe_id"] == 99999
    assert data["error"] == "not_found"


# ============ Edge Cases ============


def test_different_units_for_sub_recipes(client: TestClient):
    """Test that different unit types work correctly."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    units = ["portion", "batch", "g", "ml"]
    for unit in units:
        # Remove existing if any
        list_response = client.get(f"/api/v1/recipes/{main['id']}/sub-recipes")
        for item in list_response.json():
            client.delete(f"/api/v1/recipes/{main['id']}/sub-recipes/{item['id']}")

        # Add with new unit
        response = client.post(
            f"/api/v1/recipes/{main['id']}/sub-recipes",
            json={"child_recipe_id": sub["id"], "quantity": 1, "unit": unit},
        )
        assert response.status_code == 201
        assert response.json()["unit"] == unit


def test_sub_recipe_default_quantity_and_unit(client: TestClient):
    """Test that default quantity and unit are applied."""
    main = create_recipe(client, "Main Recipe")
    sub = create_recipe(client, "Sub Recipe")

    response = client.post(
        f"/api/v1/recipes/{main['id']}/sub-recipes",
        json={"child_recipe_id": sub["id"]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["quantity"] == 1.0
    assert data["unit"] == "portion"
