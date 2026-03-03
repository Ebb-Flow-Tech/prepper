"""Tests for outlet-scoped supplier ingredient visibility."""

from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.api.deps import get_session, get_current_user
from app.database import get_session as db_get_session
from app.models import User, UserType


def _make_client(session: Session, user: User) -> TestClient:
    """Create a test client with a specific user override."""
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[db_get_session] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: user

    storage_patches = [
        patch("app.api.recipe_images.is_storage_configured", return_value=True),
        patch("app.api.recipe_images.StorageService"),
    ]

    with storage_patches[0]:
        with storage_patches[1] as mock_storage_class:
            mock_storage = MagicMock()

            async def async_upload(*args, **kwargs):
                return "https://example.com/storage/recipe_images/test.png"

            mock_storage.upload_image_from_base64 = MagicMock(side_effect=async_upload)
            mock_storage_class.return_value = mock_storage

            client = TestClient(app)
            yield client

    app.dependency_overrides.clear()


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def admin_user():
    return User(
        id="admin-user",
        email="admin@test.com",
        username="admin",
        user_type=UserType.ADMIN,
        outlet_id=None,
    )


@pytest.fixture
def admin_client(session, admin_user):
    yield from _make_client(session, admin_user)


def _create_outlet(client, name, code, parent_id=None):
    data = {"name": name, "code": code, "outlet_type": "brand"}
    if parent_id:
        data["parent_outlet_id"] = parent_id
    resp = client.post("/api/v1/outlets", json=data)
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_ingredient(client, name="Tomato"):
    resp = client.post("/api/v1/ingredients", json={"name": name, "base_unit": "kg"})
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_supplier(client, name="Fresh Farms"):
    resp = client.post("/api/v1/suppliers", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


def _add_supplier_ingredient(client, ing_id, sup_id, outlet_id, pack_size=5.0, price=10.0):
    resp = client.post(
        f"/api/v1/ingredients/{ing_id}/suppliers",
        json={
            "ingredient_id": ing_id,
            "supplier_id": sup_id,
            "outlet_id": outlet_id,
            "pack_size": pack_size,
            "pack_unit": "kg",
            "price_per_pack": price,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestOutletScopedSupplierIngredients:
    """Test outlet-scoped visibility for supplier ingredients."""

    def test_child_sees_parent_supplier_ingredients(self, session, admin_client):
        """Location user sees supplier_ingredients from the parent brand."""
        # Setup: brand → location hierarchy
        brand_id = _create_outlet(admin_client, "Brand A", "BA")
        location_id = _create_outlet(admin_client, "Location 1", "L1", parent_id=brand_id)

        ing_id = _create_ingredient(admin_client)
        sup_id = _create_supplier(admin_client)

        # Add supplier_ingredient to parent brand
        _add_supplier_ingredient(admin_client, ing_id, sup_id, brand_id)

        # Query as location user
        location_user = User(
            id="location-user",
            email="loc@test.com",
            username="locuser",
            user_type=UserType.NORMAL,
            outlet_id=location_id,
        )
        for c in _make_client(session, location_user):
            resp = c.get(f"/api/v1/ingredients/{ing_id}/suppliers")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["outlet_id"] == brand_id

    def test_parent_sees_child_supplier_ingredients(self, session, admin_client):
        """Brand user sees supplier_ingredients from child locations."""
        brand_id = _create_outlet(admin_client, "Brand B", "BB")
        location_id = _create_outlet(admin_client, "Location 2", "L2", parent_id=brand_id)

        ing_id = _create_ingredient(admin_client, "Onion")
        sup_id = _create_supplier(admin_client, "Local Farms")

        # Add supplier_ingredient to child location
        _add_supplier_ingredient(admin_client, ing_id, sup_id, location_id)

        # Query as brand user
        brand_user = User(
            id="brand-user",
            email="brand@test.com",
            username="branduser",
            user_type=UserType.NORMAL,
            outlet_id=brand_id,
        )
        for c in _make_client(session, brand_user):
            resp = c.get(f"/api/v1/ingredients/{ing_id}/suppliers")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["outlet_id"] == location_id

    def test_admin_sees_all(self, session, admin_client):
        """Admin user (no outlet) sees all supplier_ingredients."""
        outlet_a = _create_outlet(admin_client, "Outlet A", "OA")
        outlet_b = _create_outlet(admin_client, "Outlet B", "OB")

        ing_id = _create_ingredient(admin_client, "Garlic")
        sup_id = _create_supplier(admin_client, "Global Supply")

        _add_supplier_ingredient(admin_client, ing_id, sup_id, outlet_a)
        # Same supplier but different outlet is allowed with the new unique constraint
        sup_id2 = _create_supplier(admin_client, "Another Supply")
        _add_supplier_ingredient(admin_client, ing_id, sup_id2, outlet_b)

        resp = admin_client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_no_outlet_user_sees_nothing(self, session, admin_client):
        """Normal user with no outlet sees no supplier_ingredients."""
        outlet_id = _create_outlet(admin_client, "Some Outlet", "SO")
        ing_id = _create_ingredient(admin_client, "Pepper")
        sup_id = _create_supplier(admin_client, "Pepper Co")
        _add_supplier_ingredient(admin_client, ing_id, sup_id, outlet_id)

        # Normal user without outlet
        no_outlet_user = User(
            id="no-outlet-user",
            email="nooutlet@test.com",
            username="nooutlet",
            user_type=UserType.NORMAL,
            outlet_id=None,
        )
        for c in _make_client(session, no_outlet_user):
            resp = c.get(f"/api/v1/ingredients/{ing_id}/suppliers")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_cross_tree_isolation(self, session, admin_client):
        """User in tree A cannot see supplier_ingredients from tree B."""
        tree_a_root = _create_outlet(admin_client, "Tree A", "TA")
        tree_b_root = _create_outlet(admin_client, "Tree B", "TB")

        ing_id = _create_ingredient(admin_client, "Carrot")
        sup_id = _create_supplier(admin_client, "Carrot Farm")

        # Add supplier_ingredient to tree B only
        _add_supplier_ingredient(admin_client, ing_id, sup_id, tree_b_root)

        # Query as tree A user
        tree_a_user = User(
            id="tree-a-user",
            email="treea@test.com",
            username="treeauser",
            user_type=UserType.NORMAL,
            outlet_id=tree_a_root,
        )
        for c in _make_client(session, tree_a_user):
            resp = c.get(f"/api/v1/ingredients/{ing_id}/suppliers")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_supplier_endpoint_outlet_filtering(self, session, admin_client):
        """Supplier ingredients endpoint also respects outlet scoping."""
        outlet_a = _create_outlet(admin_client, "Outlet AA", "AA")
        outlet_b = _create_outlet(admin_client, "Outlet BB", "BB")

        ing_id = _create_ingredient(admin_client, "Rice")
        sup_id = _create_supplier(admin_client, "Rice Supply")

        _add_supplier_ingredient(admin_client, ing_id, sup_id, outlet_a)

        # User in outlet_b should not see outlet_a's supplier_ingredients
        user_b = User(
            id="user-b",
            email="userb@test.com",
            username="userb",
            user_type=UserType.NORMAL,
            outlet_id=outlet_b,
        )
        for c in _make_client(session, user_b):
            resp = c.get(f"/api/v1/suppliers/{sup_id}/ingredients")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_non_admin_cannot_change_outlet(self, session, admin_client):
        """Non-admin user cannot change outlet_id on a supplier-ingredient link."""
        outlet_id = _create_outlet(admin_client, "Test Out", "TX")
        ing_id = _create_ingredient(admin_client, "Basil")
        sup_id = _create_supplier(admin_client, "Herb Co")
        si_id = _add_supplier_ingredient(admin_client, ing_id, sup_id, outlet_id)

        other_outlet = _create_outlet(admin_client, "Other Out", "OX")

        normal_user = User(
            id="normal-user",
            email="normal@test.com",
            username="normaluser",
            user_type=UserType.NORMAL,
            outlet_id=outlet_id,
        )
        for c in _make_client(session, normal_user):
            resp = c.patch(
                f"/api/v1/ingredients/{ing_id}/suppliers/{si_id}",
                json={"outlet_id": other_outlet},
            )
            assert resp.status_code == 403
