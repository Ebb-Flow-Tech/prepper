"""Tests for menu sketch endpoints."""

from fastapi.testclient import TestClient

BASE = "/api/v1/menu-sketches"


# =============================================================================
# Create
# =============================================================================


def test_create_sketch_defaults(client: TestClient):
    """Creating without a name uses 'Untitled Menu' and starts at version 1."""
    response = client.post(BASE, json={})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Untitled Menu"
    assert data["version"] == 1
    assert data["status"] == "draft"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_sketch_with_name(client: TestClient):
    """Creating with an explicit name stores it correctly."""
    response = client.post(BASE, json={"name": "Summer Menu"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Summer Menu"
    assert data["version"] == 1


# =============================================================================
# Read
# =============================================================================


def test_get_sketch(client: TestClient):
    """Retrieve a single sketch by ID."""
    sketch_id = client.post(BASE, json={"name": "Fetch Me"}).json()["id"]

    response = client.get(f"{BASE}/{sketch_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Fetch Me"


def test_get_sketch_not_found(client: TestClient):
    """Non-existent sketch returns 404."""
    response = client.get(f"{BASE}/99999")
    assert response.status_code == 404
    assert "Sketch not found" in response.json()["detail"]


def test_list_sketches_empty(client: TestClient):
    """List returns an empty array when no sketches exist."""
    response = client.get(BASE)
    assert response.status_code == 200
    assert response.json() == []


def test_list_sketches_returns_all(client: TestClient):
    """List returns all created sketches."""
    client.post(BASE, json={"name": "A"})
    client.post(BASE, json={"name": "B"})
    client.post(BASE, json={"name": "C"})

    response = client.get(BASE)
    assert response.status_code == 200
    names = {s["name"] for s in response.json()}
    assert names == {"A", "B", "C"}


# =============================================================================
# Update
# =============================================================================


def test_update_sketch_name(client: TestClient):
    """Patching the name updates it."""
    sketch_id = client.post(BASE, json={"name": "Old Name"}).json()["id"]

    response = client.patch(f"{BASE}/{sketch_id}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_update_sketch_notes(client: TestClient):
    """Patching notes persists the value."""
    sketch_id = client.post(BASE, json={}).json()["id"]

    response = client.patch(f"{BASE}/{sketch_id}", json={"notes": "<p>Some notes</p>"})
    assert response.status_code == 200
    assert response.json()["notes"] == "<p>Some notes</p>"


def test_update_sketch_not_found(client: TestClient):
    """Patching a non-existent sketch returns 404."""
    response = client.patch(f"{BASE}/99999", json={"name": "Ghost"})
    assert response.status_code == 404
    assert "Sketch not found" in response.json()["detail"]


# =============================================================================
# Fork
# =============================================================================


def test_fork_sketch_increments_version(client: TestClient):
    """Fork creates a new sketch with version incremented by 1."""
    original = client.post(BASE, json={"name": "Original"}).json()
    assert original["version"] == 1

    response = client.post(f"{BASE}/{original['id']}/fork")
    assert response.status_code == 201
    forked = response.json()
    assert forked["version"] == 2
    assert forked["id"] != original["id"]


def test_fork_sketch_sets_root(client: TestClient):
    """Forked sketch has root pointing to the original sketch id."""
    original = client.post(BASE, json={"name": "Original"}).json()

    forked = client.post(f"{BASE}/{original['id']}/fork").json()
    assert forked["root"] == original["id"]


def test_fork_sketch_copies_name(client: TestClient):
    """Fork preserves the name from the source sketch."""
    sketch_id = client.post(BASE, json={"name": "Tasty Menu"}).json()["id"]

    forked = client.post(f"{BASE}/{sketch_id}/fork").json()
    assert forked["name"] == "Tasty Menu"


def test_fork_sketch_is_independent(client: TestClient):
    """Updating the fork does not affect the original sketch."""
    original_id = client.post(BASE, json={"name": "Base"}).json()["id"]
    forked_id = client.post(f"{BASE}/{original_id}/fork").json()["id"]

    client.patch(f"{BASE}/{forked_id}", json={"name": "Fork Renamed"})

    original = client.get(f"{BASE}/{original_id}").json()
    assert original["name"] == "Base"


def test_fork_sketch_not_found(client: TestClient):
    """Forking a non-existent sketch returns 404."""
    response = client.post(f"{BASE}/99999/fork")
    assert response.status_code == 404
    assert "Sketch not found" in response.json()["detail"]


def test_fork_multiple_times_increments_correctly(client: TestClient):
    """Successive forks keep incrementing the version number."""
    v1_id = client.post(BASE, json={"name": "Menu"}).json()["id"]
    v2 = client.post(f"{BASE}/{v1_id}/fork").json()
    assert v2["version"] == 2

    v3 = client.post(f"{BASE}/{v2['id']}/fork").json()
    assert v3["version"] == 3


# =============================================================================
# Delete (soft-delete — sets status to archived)
# =============================================================================


def test_delete_sketch(client: TestClient):
    """Deleting a sketch returns 200 ok and removes it from the list."""
    sketch_id = client.post(BASE, json={"name": "Delete Me"}).json()["id"]

    response = client.delete(f"{BASE}/{sketch_id}")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    # Archived sketch is excluded from the list
    ids = {s["id"] for s in client.get(BASE).json()}
    assert sketch_id not in ids


def test_delete_sketch_removed_from_list(client: TestClient):
    """Deleted sketch no longer appears in the list endpoint."""
    id_a = client.post(BASE, json={"name": "Keep"}).json()["id"]
    id_b = client.post(BASE, json={"name": "Remove"}).json()["id"]

    client.delete(f"{BASE}/{id_b}")

    ids = {s["id"] for s in client.get(BASE).json()}
    assert id_a in ids
    assert id_b not in ids


def test_delete_sketch_not_found(client: TestClient):
    """Deleting a non-existent sketch returns 404."""
    response = client.delete(f"{BASE}/99999")
    assert response.status_code == 404
    assert "Sketch not found" in response.json()["detail"]


def test_delete_sketch_idempotent_second_call(client: TestClient):
    """Soft-deleting the same sketch twice both succeed (idempotent)."""
    sketch_id = client.post(BASE, json={"name": "Once Only"}).json()["id"]

    assert client.delete(f"{BASE}/{sketch_id}").status_code == 200
    # Second call: sketch is already archived but still exists → 200 ok
    assert client.delete(f"{BASE}/{sketch_id}").status_code == 200
