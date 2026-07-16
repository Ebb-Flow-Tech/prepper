"""ADVERSARIAL AUDIT — cross-brand reads/writes on the recipe family.

Baseline: `GET /recipes/{id}` IS scoped (owner | public | served at a visible unit). Every test
here asserts that a sibling route reaching the SAME recipe enforces the SAME scope. Where it does
not, the assertion documents the leak.

Setup in every test: recipe R is owned by a user at Brand A, not public, served only at Brand A.
The caller is Staff at Brand B and holds no role at Brand A whatsoever.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Recipe, RecipeOutlet, RecipeStatus
from tests.conftest import (
    ORG_ID,
    STAFF,
    make_brand_user,
    seed_brand,
    use_user,
)


@pytest.fixture(name="two_brands")
def two_brands_fixture(session: Session, client: TestClient):
    """Recipe R at Brand A. Caller = Staff at Brand B, no role at Brand A.

    Returns (recipe_id, brand_a, brand_b, intruder).
    """
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")

    owner = make_brand_user(session, "owner-a", brand_a, STAFF, "owner-a")

    recipe = Recipe(
        name="Brand A Secret Sauce",
        owner_id=owner.id,
        is_public=False,
        status=RecipeStatus.ACTIVE,
        organization_id=ORG_ID,
        cost_price=42.5,
        selling_price_est=99.0,
        instructions_raw="Brand A proprietary method",
    )
    session.add(recipe)
    session.commit()
    session.refresh(recipe)

    session.add(
        RecipeOutlet(
            recipe_id=recipe.id,
            unit_id=brand_a,
            organization_id=ORG_ID,
            is_active=True,
        )
    )
    session.commit()

    intruder = make_brand_user(session, "intruder-b", brand_b, STAFF, "intruder-b")
    use_user(client, intruder)

    return recipe.id, brand_a, brand_b, intruder


class TestBaseline:
    def test_get_recipe_is_scoped(self, two_brands, client: TestClient):
        """The control. This route checks, and must 403."""
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}")
        assert resp.status_code == 403, f"baseline broken: {resp.status_code} {resp.text}"


class TestCostingLeak:
    def test_costing_read(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/costing")
        print(f"\nGET /recipes/{recipe_id}/costing -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_costing_recompute_write(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.post(f"/api/v1/recipes/{recipe_id}/costing/recompute")
        print(f"\nPOST /recipes/{recipe_id}/costing/recompute -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestRecipeCoreLeak:
    def test_get_recipe_for_tasting(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/tasting/{recipe_id}")
        print(f"\nGET /recipes/tasting/{recipe_id} -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_patch_recipe(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.patch(f"/api/v1/recipes/{recipe_id}", json={"name": "PWNED"})
        print(f"\nPATCH /recipes/{recipe_id} -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_delete_recipe(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.delete(f"/api/v1/recipes/{recipe_id}")
        print(f"\nDELETE /recipes/{recipe_id} -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_patch_recipe_status(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.patch(f"/api/v1/recipes/{recipe_id}/status", json={"status": "archived"})
        print(f"\nPATCH /recipes/{recipe_id}/status -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_fork_recipe(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.post(f"/api/v1/recipes/{recipe_id}/fork", json={})
        print(f"\nPOST /recipes/{recipe_id}/fork -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_get_versions(self, two_brands, client: TestClient):
        """NOT a leak: /versions masks rather than refusing, and that is the design.

        A caller who cannot see a version gets a stub — id, root_id, version — so the tree's SHAPE
        survives while its content does not. Asserting 403 read the status and never the body.
        `test_recipes.py::test_version_tree_user_of_another_brand_sees_masked_recipes` pins the
        intended behaviour.

        The real hole here was the `?user_id=` query parameter deciding the masking, so
        `?user_id=<victim>` unmasked their versions. Fixed separately: identity comes from the
        token now.
        """
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/versions")

        assert resp.status_code == 200
        for version in resp.json():
            assert version["name"] == "", "another brand's recipe name must be masked"
            assert version["instructions_raw"] is None
            assert version["cost_price"] is None


class TestRecipeIngredientsLeak:
    def test_list_ingredients(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/ingredients")
        print(f"\nGET /recipes/{recipe_id}/ingredients -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestInstructionsLeak:
    def test_patch_structured_instructions(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.patch(
            f"/api/v1/recipes/{recipe_id}/instructions/structured",
            json={"steps": [{"text": "PWNED"}]},
        )
        print(f"\nPATCH /recipes/{recipe_id}/instructions/structured -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_post_raw_instructions(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.post(
            f"/api/v1/recipes/{recipe_id}/instructions/raw",
            json={"text": "PWNED"},
        )
        print(f"\nPOST /recipes/{recipe_id}/instructions/raw -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestSubRecipesLeak:
    def test_list_sub_recipes(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/sub-recipes")
        print(f"\nGET /recipes/{recipe_id}/sub-recipes -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_bom_tree(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/bom-tree")
        print(f"\nGET /recipes/{recipe_id}/bom-tree -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_used_in(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/used-in")
        print(f"\nGET /recipes/{recipe_id}/used-in -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestRecipeImagesLeak:
    def test_list_images(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipe-images/{recipe_id}")
        print(f"\nGET /recipe-images/{recipe_id} -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestTastingHistoryLeak:
    def test_recipe_tasting_notes(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/tasting-notes")
        print(f"\nGET /recipes/{recipe_id}/tasting-notes -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403

    def test_recipe_tasting_summary(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/tasting-summary")
        print(f"\nGET /recipes/{recipe_id}/tasting-summary -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestRecipeAllergensLeak:
    def test_recipe_allergens(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipes/{recipe_id}/allergens")
        print(f"\nGET /recipes/{recipe_id}/allergens -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403


class TestRecipeCategoriesLeak:
    def test_recipe_categories(self, two_brands, client: TestClient):
        recipe_id, *_ = two_brands
        resp = client.get(f"/api/v1/recipe-recipe-categories/recipe/{recipe_id}")
        print(f"\nGET /recipe-recipe-categories/recipe/{recipe_id} -> {resp.status_code}: {resp.text[:400]}")
        assert resp.status_code == 403
