"""Tests for the relational menu sketch endpoints (sections, items, comments)."""

import datetime

from fastapi.testclient import TestClient

from tests.conftest import ADMIN_USER_ID

SKETCHES = "/api/v1/menu-sketches"
SECTIONS = "/api/v1/menu-sketch-sections"
ITEMS = "/api/v1/menu-sketch-section-items"
COMMENTS = "/api/v1/menu-sketch-section-item-comments"
RECIPES = "/api/v1/recipes"
SESSIONS = "/api/v1/tasting-sessions"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_sketch(client: TestClient, name: str = "Test Menu") -> int:
    return client.post(SKETCHES, json={"name": name}).json()["id"]


def _make_section(client: TestClient, sketch_id: int, name: str = "Starters") -> int:
    return client.post(
        SECTIONS, json={"menu_sketch_id": sketch_id, "name": name}
    ).json()["id"]


def _make_item(
    client: TestClient, section_id: int, name: str = "Soup", recipe_id: int | None = None
) -> int:
    payload: dict = {"menu_sketch_section_id": section_id, "name": name}
    if recipe_id is not None:
        payload["recipe_id"] = recipe_id
    return client.post(ITEMS, json=payload).json()["id"]


def _make_recipe(client: TestClient, name: str = "Dish") -> int:
    """A recipe owned by the caller — the owner may always read their own recipe back.

    Access is Passport's now and fails closed: an ownerless recipe served at no unit is visible
    to nobody, org admin included.
    """
    return client.post(
        RECIPES,
        json={
            "name": name,
            "yield_quantity": 1,
            "yield_unit": "portion",
            "owner_id": ADMIN_USER_ID,
        },
    ).json()["id"]


def _add_tasting_note(client: TestClient, recipe_id: int) -> None:
    """Create a tasting session (with admin as participant) and add a note."""
    session_resp = client.post(
        SESSIONS,
        json={
            "name": "Test Session",
            "date": datetime.datetime.utcnow().isoformat(),
            # Include the test-admin-user so they can post notes
            "participant_ids": ["test-admin-user"],
        },
    )
    assert session_resp.status_code == 201, session_resp.text
    session_id = session_resp.json()["id"]
    note_resp = client.post(
        f"{SESSIONS}/{session_id}/notes",
        json={"recipe_id": recipe_id, "feedback": "Needs more salt"},
    )
    assert note_resp.status_code == 201, note_resp.text


# =============================================================================
# Sections
# =============================================================================


def test_create_section_validates_menu_sketch_id(client: TestClient):
    """Creating a section with a non-existent menu_sketch_id returns 404."""
    response = client.post(
        SECTIONS, json={"menu_sketch_id": 99999, "name": "Ghost Section"}
    )
    assert response.status_code == 404
    assert "Menu sketch not found" in response.json()["detail"]


def test_create_section_success(client: TestClient):
    """Section is created and returned with correct fields."""
    sketch_id = _make_sketch(client)
    response = client.post(
        SECTIONS, json={"menu_sketch_id": sketch_id, "name": "Mains"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Mains"
    assert data["menu_sketch_id"] == sketch_id
    assert "id" in data


def test_list_sections_ordered(client: TestClient):
    """Sections are returned ordered by order_no."""
    sketch_id = _make_sketch(client)
    client.post(SECTIONS, json={"menu_sketch_id": sketch_id, "name": "C", "order_no": 3})
    client.post(SECTIONS, json={"menu_sketch_id": sketch_id, "name": "A", "order_no": 1})
    client.post(SECTIONS, json={"menu_sketch_id": sketch_id, "name": "B", "order_no": 2})

    resp = client.get(SECTIONS, params={"menu_sketch_id": sketch_id})
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert names == ["A", "B", "C"]


def test_delete_section_not_found(client: TestClient):
    """Deleting a non-existent section returns 404."""
    response = client.delete(f"{SECTIONS}/99999")
    assert response.status_code == 404


def test_delete_section_cascades_items(client: TestClient):
    """Deleting a section hard-deletes it; FK cascade removes items in PostgreSQL.

    In SQLite (test env) cascade is not enforced, so we only assert the section
    itself is gone and the delete response is correct.
    """
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    _make_item(client, section_id)

    # Confirm item exists
    assert client.get(ITEMS, params={"section_id": section_id}).json() != []

    # Delete section
    resp = client.delete(f"{SECTIONS}/{section_id}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    # Section itself is gone — second delete returns 404
    assert client.delete(f"{SECTIONS}/{section_id}").status_code == 404


# =============================================================================
# Items
# =============================================================================


def test_create_item_without_recipe(client: TestClient):
    """Item created with name-only auto-creates a Recipe and links it."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)

    response = client.post(
        ITEMS, json={"menu_sketch_section_id": section_id, "name": "Mystery Dish"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_name"] == "Mystery Dish"
    assert data["recipe_id"] is not None


def test_create_item_with_recipe(client: TestClient):
    """Item can be linked to an existing recipe."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    recipe_id = _make_recipe(client, "Beef Wellington")

    response = client.post(
        ITEMS,
        json={
            "menu_sketch_section_id": section_id,
            "name": "Beef Wellington",
            "recipe_id": recipe_id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id


def test_create_item_section_not_found(client: TestClient):
    """Creating an item with a non-existent section returns 404."""
    response = client.post(
        ITEMS, json={"menu_sketch_section_id": 99999, "name": "Ghost Dish"}
    )
    assert response.status_code == 404
    assert "Section not found" in response.json()["detail"]


def test_update_item_no_feedback_updates_recipe(client: TestClient):
    """When a linked recipe has no tasting feedback, update_item edits its name in place."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    recipe_id = _make_recipe(client, "Original Dish")
    item_id = _make_item(client, section_id, "Original Dish", recipe_id)

    resp = client.patch(f"{ITEMS}/{item_id}", json={"name": "Updated Dish"})
    assert resp.status_code == 200
    data = resp.json()
    # recipe_id unchanged — same recipe, name updated in place
    assert data["recipe_id"] == recipe_id
    assert data["recipe_name"] == "Updated Dish"

    # Recipe itself should reflect the new name
    recipe = client.get(f"{RECIPES}/{recipe_id}").json()
    assert recipe["name"] == "Updated Dish"


def test_update_item_with_feedback_forks_recipe(client: TestClient):
    """When a linked recipe has tasting feedback, update_item forks the recipe."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    recipe_id = _make_recipe(client, "Pre-Feedback Dish")
    item_id = _make_item(client, section_id, "Pre-Feedback Dish", recipe_id)

    # Add tasting feedback to the recipe
    _add_tasting_note(client, recipe_id)

    # Now update the item name — should trigger a fork
    resp = client.patch(f"{ITEMS}/{item_id}", json={"name": "Post-Feedback Dish"})
    assert resp.status_code == 200
    data = resp.json()

    # item.recipe_id should now point to the forked recipe
    forked_recipe_id = data["recipe_id"]
    assert forked_recipe_id != recipe_id

    # Forked recipe should have version = 2 and root_id = original recipe_id
    forked = client.get(f"{RECIPES}/{forked_recipe_id}").json()
    assert forked["version"] == 2
    assert forked["root_id"] == recipe_id
    assert forked["name"] == "Post-Feedback Dish"


def test_delete_item_does_not_delete_recipe(client: TestClient):
    """Hard-deleting an item leaves the linked recipe intact."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    recipe_id = _make_recipe(client, "Surviving Recipe")
    item_id = _make_item(client, section_id, "Dish", recipe_id)

    resp = client.delete(f"{ITEMS}/{item_id}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    # Recipe must still exist
    assert client.get(f"{RECIPES}/{recipe_id}").status_code == 200


def test_delete_item_not_found(client: TestClient):
    """Deleting a non-existent item returns 404."""
    assert client.delete(f"{ITEMS}/99999").status_code == 404


# =============================================================================
# Comments
# =============================================================================


def test_create_comment_success(client: TestClient):
    """Comment is created and returned."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    item_id = _make_item(client, section_id)

    resp = client.post(
        COMMENTS,
        json={"menu_sketch_section_item_id": item_id, "text": "Needs more salt"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["text"] == "Needs more salt"
    assert data["resolved"] is False
    assert data["menu_sketch_section_item_id"] == item_id


def test_create_comment_item_not_found(client: TestClient):
    """Creating a comment for a non-existent item returns 404."""
    resp = client.post(
        COMMENTS,
        json={"menu_sketch_section_item_id": 99999, "text": "Ghost comment"},
    )
    assert resp.status_code == 404


def test_resolve_comment(client: TestClient):
    """Resolving a comment sets resolved = True."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    item_id = _make_item(client, section_id)
    comment_id = client.post(
        COMMENTS,
        json={"menu_sketch_section_item_id": item_id, "text": "Fix this"},
    ).json()["id"]

    resp = client.patch(f"{COMMENTS}/resolve/{comment_id}")
    assert resp.status_code == 200
    assert resp.json()["resolved"] is True


def test_update_comment_text(client: TestClient):
    """Updating a comment changes the text."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    item_id = _make_item(client, section_id)
    comment_id = client.post(
        COMMENTS,
        json={"menu_sketch_section_item_id": item_id, "text": "Original"},
    ).json()["id"]

    resp = client.patch(f"{COMMENTS}/{comment_id}", json={"text": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["text"] == "Updated"


def test_delete_comment(client: TestClient):
    """Deleting a comment returns 200 ok."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id)
    item_id = _make_item(client, section_id)
    comment_id = client.post(
        COMMENTS,
        json={"menu_sketch_section_item_id": item_id, "text": "To delete"},
    ).json()["id"]

    resp = client.delete(f"{COMMENTS}/{comment_id}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_get_comments_aggregated_response(client: TestClient):
    """Aggregated comments endpoint returns correct nested structure."""
    sketch_id = _make_sketch(client)
    section_id = _make_section(client, sketch_id, "Mains")
    item_id = _make_item(client, section_id, "Steak")

    client.post(COMMENTS, json={"menu_sketch_section_item_id": item_id, "text": "Too rare"})
    client.post(COMMENTS, json={"menu_sketch_section_item_id": item_id, "text": "Great sear"})

    resp = client.get(f"{COMMENTS}/menu-sketch/{sketch_id}")
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Should have one dish entry
    assert len(data) == 1
    dish = data[0]
    assert dish["menu_sketch_section_item_id"] == item_id
    assert dish["name"] == "Steak"
    assert len(dish["comments"]) == 2
    texts = {c["text"] for c in dish["comments"]}
    assert texts == {"Too rare", "Great sear"}


# =============================================================================
# Menu sketch soft-delete + fork root (covered via /menu-sketches tests but
# repeated here for clarity alongside the relational suite)
# =============================================================================


def test_soft_delete_menu_sketch(client: TestClient):
    """Soft-deleted sketch is excluded from the list but record remains."""
    sketch_id = _make_sketch(client, "Archived Menu")

    resp = client.delete(f"{SKETCHES}/{sketch_id}")
    assert resp.status_code == 200

    # Must not appear in list
    ids = {s["id"] for s in client.get(SKETCHES).json()}
    assert sketch_id not in ids


def test_fork_sets_root_id(client: TestClient):
    """Forked sketch has root set to the original sketch id."""
    original_id = _make_sketch(client, "Original")
    forked = client.post(f"{SKETCHES}/{original_id}/fork").json()
    assert forked["root"] == original_id
