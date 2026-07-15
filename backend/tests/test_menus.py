"""Tests for menu endpoints.

Menus hang off Passport UNITS and every write is authorised AT THE UNITS THE MENU TOUCHES. There
is no global "manager" any more: `Manager` at brand A grants nothing at brand B. Two things are
pinned here and nowhere else — that brand scoping, and the fail-closed default (a user with no
Passport role sees nothing at all).
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import RecipeStatus
from tests.conftest import (
    MANAGER,
    STAFF,
    create_user,
    make_brand_user,
    seed_brand,
    seed_outlet_unit,
    use_user,
)

# =============================================================================
# Helper Functions
# =============================================================================


def _create_recipe(client: TestClient, name: str) -> int:
    response = client.post(
        "/api/v1/recipes",
        json={"name": name, "status": RecipeStatus.DRAFT},
    )
    return response.json()["id"]


def _create_menu(client: TestClient, name: str, unit_ids: list[str], sections=None) -> dict:
    response = client.post(
        "/api/v1/menus",
        json={
            "name": name,
            "unit_ids": unit_ids,
            "sections": sections if sections is not None else [],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


# =============================================================================
# Menu CRUD Tests
# =============================================================================


def test_create_menu_as_org_admin(client: TestClient, brand_id: str):
    """An org Owner/Admin holds `Manager` at every brand through Passport's ladder."""
    recipe_id = _create_recipe(client, "Test Recipe")

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Test Menu",
            "is_published": False,
            "unit_ids": [brand_id],
            "sections": [
                {
                    "name": "Appetizers",
                    "order_no": 1,
                    "items": [
                        {
                            "recipe_id": recipe_id,
                            "order_no": 1,
                            "display_price": 10.00,
                            "additional_info": "Served warm",
                        }
                    ],
                }
            ],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Menu"
    assert data["is_published"] is False
    assert len(data["sections"]) == 1
    assert data["sections"][0]["name"] == "Appetizers"
    assert len(data["sections"][0]["items"]) == 1


def test_create_menu_as_brand_manager(client: TestClient, session: Session, brand_id: str):
    """A `Manager` at the brand the menu is for may create it."""
    recipe_id = _create_recipe(client, "Test Recipe")
    use_user(
        client, make_brand_user(session, "manager-user", brand_id, MANAGER, "manager")
    )

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Manager Menu",
            "unit_ids": [brand_id],
            "sections": [
                {
                    "name": "Mains",
                    "order_no": 1,
                    "items": [{"recipe_id": recipe_id, "order_no": 1}],
                }
            ],
        },
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Manager Menu"


def test_create_menu_as_staff_fails(client: TestClient, session: Session, brand_id: str):
    """`Staff` at the brand is not `Manager` — writing a menu is refused."""
    use_user(client, make_brand_user(session, "staff-user", brand_id, STAFF, "staffuser"))

    response = client.post(
        "/api/v1/menus",
        json={"name": "Should Fail", "unit_ids": [brand_id], "sections": []},
    )
    assert response.status_code == 403
    assert "not a manager" in response.json()["detail"]


def test_create_menu_as_user_with_no_passport_role_fails(
    client: TestClient, session: Session, brand_id: str
):
    """FAIL CLOSED — no Passport role, no access. A null scope is not a wildcard."""
    use_user(client, create_user(session, "no-role-user", "norole"))

    response = client.post(
        "/api/v1/menus",
        json={"name": "Should Fail", "unit_ids": [brand_id], "sections": []},
    )
    assert response.status_code == 403


def test_manager_of_one_brand_cannot_create_a_menu_at_another(
    client: TestClient, session: Session
):
    """THE BUG THE GLOBAL `is_manager` FLAG CREATED — a manager at brand A must not reach brand B.

    A single boolean granted at every brand what was granted at one. Roles are brand-scoped now,
    and this is the only test that catches a regression to the old behaviour.
    """
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    use_user(client, make_brand_user(session, "manager-a", brand_a, MANAGER, "managera"))

    response = client.post(
        "/api/v1/menus",
        json={"name": "Invalid Menu", "unit_ids": [brand_b], "sections": []},
    )
    assert response.status_code == 403
    assert "not a manager" in response.json()["detail"]


def test_manager_of_one_brand_cannot_edit_another_brands_menu(
    client: TestClient, session: Session
):
    """Same rule, on the update path: brand B's existing menu is not brand A's manager's to edit."""
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    menu = _create_menu(client, "Brand B Menu", [brand_b])

    use_user(client, make_brand_user(session, "manager-a", brand_a, MANAGER, "managera"))

    response = client.patch(f"/api/v1/menus/{menu['id']}", json={"name": "Hijacked"})
    assert response.status_code == 404  # brand B's menu is not even visible to brand A

    response = client.patch(f"/api/v1/menus/{menu['id']}/delete")
    assert response.status_code == 404


def test_get_menu(client: TestClient, brand_id: str):
    recipe_id = _create_recipe(client, "Test Recipe")
    menu = _create_menu(
        client,
        "Get Test Menu",
        [brand_id],
        sections=[
            {
                "name": "Desserts",
                "order_no": 1,
                "items": [{"recipe_id": recipe_id, "order_no": 1, "display_price": 8.99}],
            }
        ],
    )

    response = client.get(f"/api/v1/menus/{menu['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Get Test Menu"
    assert len(data["sections"]) == 1


def test_get_menu_not_found(client: TestClient):
    response = client.get("/api/v1/menus/99999")
    assert response.status_code == 404
    assert "Menu not found" in response.json()["detail"]


def test_get_menu_at_another_brand_is_invisible(client: TestClient, session: Session):
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")
    recipe_id = _create_recipe(client, "Test Recipe")

    menu = _create_menu(
        client,
        "Private Menu",
        [brand_a],
        sections=[
            {"name": "Items", "order_no": 1, "items": [{"recipe_id": recipe_id, "order_no": 1}]}
        ],
    )

    use_user(client, make_brand_user(session, "user-b", brand_b, STAFF, "userb"))

    response = client.get(f"/api/v1/menus/{menu['id']}")
    assert response.status_code == 404


def test_list_menus_org_admin_sees_all(client: TestClient, session: Session):
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    _create_menu(client, "Menu 1", [brand_a], [{"name": "S1", "order_no": 1, "items": []}])
    _create_menu(client, "Menu 2", [brand_b], [{"name": "S1", "order_no": 1, "items": []}])

    response = client.get("/api/v1/menus")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_list_menus_is_scoped_to_the_users_brand(client: TestClient, session: Session):
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    _create_menu(client, "Menu 1", [brand_a], [{"name": "S1", "order_no": 1, "items": []}])
    _create_menu(client, "Menu 2", [brand_b], [{"name": "S1", "order_no": 1, "items": []}])

    use_user(client, make_brand_user(session, "user-a", brand_a, STAFF, "usera"))

    response = client.get("/api/v1/menus")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Menu 1"


def test_list_menus_with_no_passport_role_is_empty(
    client: TestClient, session: Session, brand_id: str
):
    """FAIL CLOSED — previously a null `outlet_id` meant "see every outlet". It now means none."""
    _create_menu(client, "Menu 1", [brand_id], [{"name": "S1", "order_no": 1, "items": []}])

    use_user(client, create_user(session, "no-role-user", "norole"))

    response = client.get("/api/v1/menus")
    assert response.status_code == 200
    assert response.json() == []


def test_update_menu(client: TestClient, brand_id: str):
    menu = _create_menu(
        client, "Original Name", [brand_id], [{"name": "S1", "order_no": 1, "items": []}]
    )

    response = client.patch(
        f"/api/v1/menus/{menu['id']}",
        json={"name": "Updated Name", "is_published": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["is_published"] is True


def test_fork_menu(client: TestClient, brand_id: str):
    recipe_id = _create_recipe(client, "Test Recipe")
    menu = _create_menu(
        client,
        "Original Menu",
        [brand_id],
        [
            {
                "name": "Appetizers",
                "order_no": 1,
                "items": [{"recipe_id": recipe_id, "order_no": 1}],
            }
        ],
    )

    response = client.post(f"/api/v1/menus/{menu['id']}/fork")
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Original Menu"
    assert data["version_no"] == menu["version_no"] + 1
    assert len(data["sections"]) == 1


def test_delete_menu(client: TestClient, brand_id: str):
    menu = _create_menu(
        client, "To Delete", [brand_id], [{"name": "S1", "order_no": 1, "items": []}]
    )

    response = client.patch(f"/api/v1/menus/{menu['id']}/delete")
    assert response.status_code == 200
    assert response.json()["is_active"] is False


# =============================================================================
# Menu-Unit Tests
# =============================================================================


def test_get_menus_by_unit(client: TestClient, brand_id: str):
    _create_menu(client, "Unit Menu", [brand_id], [{"name": "S1", "order_no": 1, "items": []}])

    response = client.get(f"/api/v1/menu-outlets/{brand_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Unit Menu"


def test_outlet_inherits_brand_menus(client: TestClient, session: Session, brand_id: str):
    """An outlet inherits its brand's menus through Passport's `belongs_to_brand` edge."""
    outlet_id = seed_outlet_unit(session, brand_id, "Location")

    _create_menu(client, "Brand Menu", [brand_id], [{"name": "S1", "order_no": 1, "items": []}])

    response = client.get(f"/api/v1/menu-outlets/{outlet_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Brand Menu"


# =============================================================================
# Menu-Items Tests
# =============================================================================


def test_get_items_by_section(client: TestClient, brand_id: str):
    recipe_id = _create_recipe(client, "Test Recipe")
    menu = _create_menu(
        client,
        "Test Menu",
        [brand_id],
        [
            {
                "name": "Appetizers",
                "order_no": 1,
                "items": [{"recipe_id": recipe_id, "order_no": 1, "display_price": 10.00}],
            }
        ],
    )

    section_id = menu["sections"][0]["id"]

    response = client.get(f"/api/v1/menu-items/{section_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["display_price"] == 10.00


def test_menu_item_with_substitution(client: TestClient, brand_id: str):
    recipe_id = _create_recipe(client, "Test Recipe")
    menu = _create_menu(
        client,
        "Menu with Substitution",
        [brand_id],
        [
            {
                "name": "Appetizers",
                "order_no": 1,
                "items": [
                    {
                        "recipe_id": recipe_id,
                        "order_no": 1,
                        "display_price": 12.00,
                        "additional_info": "Served warm",
                        "key_highlights": "House special",
                        "substitution": "Can be made gluten-free",
                    }
                ],
            }
        ],
    )

    item = menu["sections"][0]["items"][0]
    assert item["substitution"] == "Can be made gluten-free"
    assert item["additional_info"] == "Served warm"
    assert item["key_highlights"] == "House special"


# =============================================================================
# Authorization Tests
# =============================================================================


def test_fork_menu_as_staff_fails(client: TestClient, session: Session, brand_id: str):
    menu = _create_menu(
        client, "Test Menu", [brand_id], [{"name": "S1", "order_no": 1, "items": []}]
    )

    use_user(client, make_brand_user(session, "staff-user", brand_id, STAFF, "staffuser"))

    response = client.post(f"/api/v1/menus/{menu['id']}/fork")
    assert response.status_code == 403


def test_update_menu_as_staff_fails(client: TestClient, session: Session, brand_id: str):
    menu = _create_menu(
        client, "Test Menu", [brand_id], [{"name": "S1", "order_no": 1, "items": []}]
    )

    use_user(client, make_brand_user(session, "staff-user", brand_id, STAFF, "staffuser"))

    response = client.patch(f"/api/v1/menus/{menu['id']}", json={"name": "Should Fail"})
    assert response.status_code == 403


def test_delete_menu_as_staff_fails(client: TestClient, session: Session, brand_id: str):
    menu = _create_menu(
        client, "Test Menu", [brand_id], [{"name": "S1", "order_no": 1, "items": []}]
    )

    use_user(client, make_brand_user(session, "staff-user", brand_id, STAFF, "staffuser"))

    response = client.patch(f"/api/v1/menus/{menu['id']}/delete")
    assert response.status_code == 403
