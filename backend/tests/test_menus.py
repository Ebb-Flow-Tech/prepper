"""Tests for menu endpoints."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import User, UserType, Outlet, OutletType, Recipe, RecipeStatus
from app.api.deps import get_current_user


# =============================================================================
# Helper Functions & Fixtures
# =============================================================================


def _create_outlet(client: TestClient, name: str, code: str, outlet_type: str = "brand"):
    """Helper to create an outlet."""
    response = client.post(
        "/api/v1/outlets",
        json={"name": name, "code": code, "outlet_type": outlet_type},
    )
    return response.json()["id"]


def _create_recipe(client: TestClient, name: str):
    """Helper to create a recipe."""
    response = client.post(
        "/api/v1/recipes",
        json={"name": name, "status": RecipeStatus.DRAFT},
    )
    return response.json()["id"]


def _setup_user(client: TestClient, session: Session, user_id: str, username: str, is_manager: bool = False, outlet_id: int | None = None, user_type: str = "normal"):
    """Helper to override current user."""
    user = User(
        id=user_id,
        email=f"{username}@test.com",
        username=username,
        user_type=UserType(user_type),
        is_manager=is_manager,
        outlet_id=outlet_id,
    )
    session.add(user)
    session.commit()

    def get_user_override():
        return user

    client.app.dependency_overrides[get_current_user] = get_user_override
    return user


# =============================================================================
# Menu CRUD Tests
# =============================================================================


def test_create_menu_as_admin(client: TestClient):
    """Test creating a new menu as admin."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Test Menu",
            "is_published": False,
            "outlet_ids": [outlet_id],
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


def test_create_menu_as_manager(client: TestClient, session: Session):
    """Test creating a menu as a manager."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    _setup_user(client, session, "manager-user", "manager", is_manager=True, outlet_id=outlet_id)

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Manager Menu",
            "outlet_ids": [outlet_id],
            "sections": [
                {
                    "name": "Mains",
                    "order_no": 1,
                    "items": [
                        {
                            "recipe_id": recipe_id,
                            "order_no": 1,
                        }
                    ],
                }
            ],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Manager Menu"


def test_create_menu_as_normal_user_fails(client: TestClient, session: Session):
    """Test that normal users cannot create menus."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    _setup_user(client, session, "normal-user", "normaluser", outlet_id=outlet_id)

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Should Fail",
            "outlet_ids": [outlet_id],
            "sections": [],
        },
    )
    assert response.status_code == 403
    assert "Only administrators and managers can create menus" in response.json()["detail"]


def test_create_menu_manager_inaccessible_outlet_fails(client: TestClient, session: Session):
    """Test that managers cannot assign menus to inaccessible outlets."""
    outlet1 = _create_outlet(client, "Outlet 1", "O1")
    outlet2 = _create_outlet(client, "Outlet 2", "O2")

    _setup_user(client, session, "manager-user", "manager", is_manager=True, outlet_id=outlet1)

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Invalid Menu",
            "outlet_ids": [outlet2],  # Different outlet
            "sections": [],
        },
    )
    assert response.status_code == 403
    assert "Cannot assign menu to inaccessible outlets" in response.json()["detail"]


def test_get_menu(client: TestClient):
    """Test retrieving a single menu."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    # Create menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Get Test Menu",
            "outlet_ids": [outlet_id],
            "sections": [
                {
                    "name": "Desserts",
                    "order_no": 1,
                    "items": [
                        {"recipe_id": recipe_id, "order_no": 1, "display_price": 8.99}
                    ],
                }
            ],
        },
    )
    menu_id = create_response.json()["id"]

    # Get menu
    response = client.get(f"/api/v1/menus/{menu_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Get Test Menu"
    assert len(data["sections"]) == 1


def test_get_menu_not_found(client: TestClient):
    """Test retrieving a non-existent menu returns 404."""
    response = client.get("/api/v1/menus/99999")
    assert response.status_code == 404
    assert "Menu not found" in response.json()["detail"]


def test_get_menu_inaccessible_fails(client: TestClient, session: Session):
    """Test that normal users cannot access menus from inaccessible outlets."""
    outlet1 = _create_outlet(client, "Outlet 1", "O1")
    outlet2 = _create_outlet(client, "Outlet 2", "O2")
    recipe_id = _create_recipe(client, "Test Recipe")

    # Admin creates menu for outlet1
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Private Menu",
            "outlet_ids": [outlet1],
            "sections": [
                {
                    "name": "Items",
                    "order_no": 1,
                    "items": [{"recipe_id": recipe_id, "order_no": 1}],
                }
            ],
        },
    )
    menu_id = create_response.json()["id"]

    # Normal user with outlet2 tries to access
    _setup_user(client, session, "user2", "user2", outlet_id=outlet2)

    response = client.get(f"/api/v1/menus/{menu_id}")
    assert response.status_code == 404


def test_list_menus_admin_sees_all(client: TestClient):
    """Test that admin users see all menus."""
    outlet1 = _create_outlet(client, "Outlet 1", "O1")
    outlet2 = _create_outlet(client, "Outlet 2", "O2")
    recipe_id = _create_recipe(client, "Test Recipe")

    # Create two menus
    client.post(
        "/api/v1/menus",
        json={
            "name": "Menu 1",
            "outlet_ids": [outlet1],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    client.post(
        "/api/v1/menus",
        json={
            "name": "Menu 2",
            "outlet_ids": [outlet2],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )

    response = client.get("/api/v1/menus")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_list_menus_normal_user_filtered(client: TestClient, session: Session):
    """Test that normal users see only menus from accessible outlets."""
    outlet1 = _create_outlet(client, "Outlet 1", "O1")
    outlet2 = _create_outlet(client, "Outlet 2", "O2")

    # Admin creates menus
    client.post(
        "/api/v1/menus",
        json={
            "name": "Menu 1",
            "outlet_ids": [outlet1],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    client.post(
        "/api/v1/menus",
        json={
            "name": "Menu 2",
            "outlet_ids": [outlet2],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )

    # User with outlet1 access
    _setup_user(client, session, "user1", "user1", outlet_id=outlet1)

    response = client.get("/api/v1/menus")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Menu 1"


def test_update_menu(client: TestClient):
    """Test updating a menu."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    # Create menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Original Name",
            "is_published": False,
            "outlet_ids": [outlet_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    menu_id = create_response.json()["id"]

    # Update menu
    response = client.patch(
        f"/api/v1/menus/{menu_id}",
        json={
            "name": "Updated Name",
            "is_published": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["is_published"] is True


def test_fork_menu(client: TestClient):
    """Test forking a menu (creating new version)."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    # Create menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Original Menu",
            "outlet_ids": [outlet_id],
            "sections": [
                {
                    "name": "Appetizers",
                    "order_no": 1,
                    "items": [{"recipe_id": recipe_id, "order_no": 1}],
                }
            ],
        },
    )
    menu_id = create_response.json()["id"]
    original_version = create_response.json()["version_no"]

    # Fork menu
    response = client.post(f"/api/v1/menus/{menu_id}/fork")
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Original Menu"
    assert data["version_no"] == original_version + 1
    assert len(data["sections"]) == 1


def test_delete_menu(client: TestClient):
    """Test soft-deleting a menu."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Create menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "To Delete",
            "outlet_ids": [outlet_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    menu_id = create_response.json()["id"]

    # Delete menu
    response = client.patch(f"/api/v1/menus/{menu_id}/delete")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False


# =============================================================================
# Menu-Outlet Tests
# =============================================================================


def test_get_menus_by_outlet(client: TestClient):
    """Test retrieving menus for an outlet."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Create menu
    client.post(
        "/api/v1/menus",
        json={
            "name": "Outlet Menu",
            "outlet_ids": [outlet_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )

    response = client.get(f"/api/v1/menu-outlets/{outlet_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Outlet Menu"


def test_location_outlet_inherits_brand_menus(client: TestClient):
    """Test that location outlets inherit menus from parent brand."""
    # Create brand and location
    brand_id = _create_outlet(client, "Brand", "BR", "brand")
    location_id = _create_outlet(client, "Location", "LO", "location")

    # Set location parent to brand (need to update)
    client.patch(
        f"/api/v1/outlets/{location_id}",
        json={"parent_outlet_id": brand_id},
    )

    # Create menu for brand
    client.post(
        "/api/v1/menus",
        json={
            "name": "Brand Menu",
            "outlet_ids": [brand_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )

    # Location should see brand's menus
    response = client.get(f"/api/v1/menu-outlets/{location_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Brand Menu"


# =============================================================================
# Menu-Items Tests
# =============================================================================


def test_get_items_by_section(client: TestClient):
    """Test retrieving items for a section."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    # Create menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Test Menu",
            "outlet_ids": [outlet_id],
            "sections": [
                {
                    "name": "Appetizers",
                    "order_no": 1,
                    "items": [
                        {
                            "recipe_id": recipe_id,
                            "order_no": 1,
                            "display_price": 10.00,
                        }
                    ],
                }
            ],
        },
    )

    section_id = create_response.json()["sections"][0]["id"]

    response = client.get(f"/api/v1/menu-items/{section_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["display_price"] == 10.00


def test_menu_item_with_substitution(client: TestClient):
    """Test creating menu item with substitution field."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")
    recipe_id = _create_recipe(client, "Test Recipe")

    response = client.post(
        "/api/v1/menus",
        json={
            "name": "Menu with Substitution",
            "outlet_ids": [outlet_id],
            "sections": [
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
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["sections"]) == 1
    assert len(data["sections"][0]["items"]) == 1
    item = data["sections"][0]["items"][0]
    assert item["substitution"] == "Can be made gluten-free"
    assert item["additional_info"] == "Served warm"
    assert item["key_highlights"] == "House special"


# =============================================================================
# Authorization Tests
# =============================================================================


def test_fork_menu_as_normal_user_fails(client: TestClient, session: Session):
    """Test that normal users cannot fork menus."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Admin creates menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Test Menu",
            "outlet_ids": [outlet_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    menu_id = create_response.json()["id"]

    # Switch to normal user
    _setup_user(client, session, "normal-user", "normaluser", outlet_id=outlet_id)

    response = client.post(f"/api/v1/menus/{menu_id}/fork")
    assert response.status_code == 403


def test_update_menu_as_normal_user_fails(client: TestClient, session: Session):
    """Test that normal users cannot update menus."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Admin creates menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Test Menu",
            "outlet_ids": [outlet_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    menu_id = create_response.json()["id"]

    # Switch to normal user
    _setup_user(client, session, "normal-user", "normaluser", outlet_id=outlet_id)

    response = client.patch(
        f"/api/v1/menus/{menu_id}",
        json={"name": "Should Fail"},
    )
    assert response.status_code == 403


def test_delete_menu_as_normal_user_fails(client: TestClient, session: Session):
    """Test that normal users cannot delete menus."""
    outlet_id = _create_outlet(client, "Test Outlet", "TO")

    # Admin creates menu
    create_response = client.post(
        "/api/v1/menus",
        json={
            "name": "Test Menu",
            "outlet_ids": [outlet_id],
            "sections": [{"name": "S1", "order_no": 1, "items": []}],
        },
    )
    menu_id = create_response.json()["id"]

    # Switch to normal user
    _setup_user(client, session, "normal-user", "normaluser", outlet_id=outlet_id)

    response = client.patch(f"/api/v1/menus/{menu_id}/delete")
    assert response.status_code == 403
