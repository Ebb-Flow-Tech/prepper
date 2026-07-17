"""ADVERSARIAL AUDIT — recipe-child routes, proven with SEEDED CONTENT.

The sibling-route tests prove 200-vs-403. That alone is weak evidence for routes whose tables are
empty: an empty list leaks nothing. Here the children are actually populated, so a 200 returns
Brand A's real composition, costs and BOM to a Brand B user.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import (
    Ingredient,
    Recipe,
    RecipeImage,
    RecipeIngredient,
    RecipeOutlet,
    RecipeRecipe,
    RecipeStatus,
)
from tests.conftest import ORG_ID, STAFF, make_brand_user, seed_brand, use_user


@pytest.fixture(name="populated")
def populated_fixture(session: Session, client: TestClient):
    """Recipe R at Brand A with REAL children. Caller = Staff at Brand B."""
    brand_a = seed_brand(session, "Brand A")
    brand_b = seed_brand(session, "Brand B")
    owner = make_brand_user(session, "owner-a", brand_a, STAFF, "owner-a")

    recipe = Recipe(
        name="Brand A Signature Dish",
        owner_id=owner.id,
        is_public=False,
        status=RecipeStatus.ACTIVE,
        organization_id=ORG_ID,
    )
    child = Recipe(
        name="Brand A Secret Sub-Sauce",
        owner_id=owner.id,
        is_public=False,
        status=RecipeStatus.ACTIVE,
        organization_id=ORG_ID,
    )
    session.add(recipe)
    session.add(child)
    session.commit()
    session.refresh(recipe)
    session.refresh(child)

    session.add(
        RecipeOutlet(
            recipe_id=recipe.id, unit_id=brand_a, organization_id=ORG_ID, is_active=True
        )
    )

    ingredient = Ingredient(organization_id=ORG_ID, name="Confidential Wagyu A5", base_unit="kg")
    session.add(ingredient)
    session.commit()
    session.refresh(ingredient)

    session.add(
        RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ingredient.id,
            quantity=2.5,
            unit="kg",
            base_unit="kg",
            unit_price=310.0,
            wastage_percentage=12.0,
        )
    )
    session.add(
        RecipeRecipe(parent_recipe_id=recipe.id, child_recipe_id=child.id, quantity=1.0)
    )
    session.add(
        RecipeImage(
            recipe_id=recipe.id,
            image_url="https://storage/brand-a-private-plating.png",
            is_main=True,
        )
    )
    session.commit()

    use_user(client, make_brand_user(session, "intruder-b", brand_b, STAFF, "intruder-b"))
    return recipe.id


def test_baseline_get_recipe_still_403(populated, client: TestClient):
    assert client.get(f"/api/v1/recipes/{populated}").status_code == 403


def test_recipe_ingredients_content_leak(populated, client: TestClient):
    resp = client.get(f"/api/v1/recipes/{populated}/ingredients")
    print(f"\nGET /recipes/{populated}/ingredients -> {resp.status_code}\n  {resp.text[:500]}")
    assert resp.status_code == 403 or resp.json() == []


def test_sub_recipes_content_leak(populated, client: TestClient):
    resp = client.get(f"/api/v1/recipes/{populated}/sub-recipes")
    print(f"\nGET /recipes/{populated}/sub-recipes -> {resp.status_code}\n  {resp.text[:500]}")
    assert resp.status_code == 403 or resp.json() == []


def test_bom_tree_content_leak(populated, client: TestClient):
    resp = client.get(f"/api/v1/recipes/{populated}/bom-tree")
    print(f"\nGET /recipes/{populated}/bom-tree -> {resp.status_code}\n  {resp.text[:500]}")
    assert resp.status_code == 403, "BOM tree leaks the full sub-recipe composition"


def test_costing_content_leak(populated, client: TestClient):
    resp = client.get(f"/api/v1/recipes/{populated}/costing")
    print(f"\nGET /recipes/{populated}/costing -> {resp.status_code}\n  {resp.text[:700]}")
    assert resp.status_code == 403, "costing leaks per-ingredient unit prices and wastage"


def test_recipe_images_content_leak(populated, client: TestClient):
    resp = client.get(f"/api/v1/recipe-images/{populated}")
    print(f"\nGET /recipe-images/{populated} -> {resp.status_code}\n  {resp.text[:500]}")
    assert resp.status_code == 403 or resp.json() == []


def test_sub_recipe_write_leak(populated, session: Session, client: TestClient):
    """WRITE: can a Brand B user graft a sub-recipe onto Brand A's recipe?"""
    evil = Recipe(organization_id=ORG_ID, name="Attacker Payload", is_public=False, status=RecipeStatus.ACTIVE)
    session.add(evil)
    session.commit()
    session.refresh(evil)

    resp = client.post(
        f"/api/v1/recipes/{populated}/sub-recipes",
        json={"child_recipe_id": evil.id, "quantity": 1.0, "unit": "portion"},
    )
    print(f"\nPOST /recipes/{populated}/sub-recipes -> {resp.status_code}\n  {resp.text[:400]}")
    assert resp.status_code == 403, "Brand B user mutated Brand A's BOM"
