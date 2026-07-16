"""ADVERSARIAL AUDIT — cross-ORG leaks that survive a present-and-correct-looking check.

These are not "no check" bugs. Each route below resolves `current_user`, passes it to a service,
and the service really does consult `access.*`. The check asks the WRONG QUESTION.

Two orgs throughout: ORG_A (the victim, conftest's default ORG_ID) and ORG_B (the attacker's).
"""

import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Recipe, RecipeOutlet, RecipeStatus, TastingNote
from app.models.tasting import TastingSession
from app.passport import access
from tests.conftest import (
    ORG_ID,
    STAFF,
    create_user,
    make_brand_user,
    make_org_admin,
    seed_brand,
    use_user,
)

ORG_B = "org-attacker"
OTHER_ORG = ORG_B


class TestOrglessIsOrgAdminCrossOrgLeak:
    """`is_org_admin(session, subject)` with no org == "admin of ANY of your orgs".

    An Owner/Admin of ORG_B therefore takes the UNFILTERED branch while acting on ORG_A's data:
      - app/domain/ingredient_service.py:386
      - app/domain/supplier_service.py:143
    """

    def test_org_b_admin_reads_org_a_supplier_pricing(
        self, session: Session, client: TestClient
    ):
        # --- ORG_A (victim) seeds an ingredient + supplier priced at its own brand ---
        brand_a = seed_brand(session, "Victim Brand", org_id=ORG_ID)

        ing = client.post("/api/v1/ingredients", json={"name": "Truffle", "base_unit": "kg"})
        assert ing.status_code == 201
        ing_id = ing.json()["id"]

        sup = client.post("/api/v1/suppliers", json={"name": "Victim Secret Supplier"})
        assert sup.status_code == 201
        sup_id = sup.json()["id"]

        link = client.post(
            f"/api/v1/ingredients/{ing_id}/suppliers",
            json={
                "ingredient_id": ing_id,
                "supplier_id": sup_id,
                "unit_id": brand_a,
                "pack_size": 1.0,
                "pack_unit": "kg",
                "price_per_pack": 1234.56,
            },
        )
        assert link.status_code == 201, link.text

        # --- Control: a STAFF user of ORG_A with no role at brand_a sees nothing ---
        other_brand_a = seed_brand(session, "Other Brand Same Org", org_id=ORG_ID)
        use_user(session and client, make_brand_user(session, "staff-a", other_brand_a, STAFF, "staff-a"))
        control = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        assert control.status_code == 200
        print(f"\n[CONTROL] ORG_A staff, no role at victim brand -> {len(control.json())} rows (expect 0)")
        assert control.json() == [], "baseline broken — the unit filter does not work at all"

        # --- Attack: an ADMIN of a DIFFERENT ORG entirely ---
        seed_brand(session, "Attacker Brand", org_id=ORG_B)
        attacker = make_org_admin(
            session, "attacker-admin", "attacker", platform_user_id="pu-attacker", org_id=ORG_B
        )
        use_user(client, attacker)

        resp = client.get(f"/api/v1/ingredients/{ing_id}/suppliers")
        print(f"\n[ATTACK] GET /ingredients/{ing_id}/suppliers as ORG_B admin -> {resp.status_code}")
        print(f"  body: {resp.text[:600]}")
        assert resp.status_code == 200
        assert resp.json() == [], (
            "CROSS-ORG LEAK: an admin of ORG_B read ORG_A's supplier pricing "
            "via the org-less is_org_admin branch (ingredient_service.py:386)"
        )

    def test_org_b_admin_reads_org_a_supplier_ingredients(
        self, session: Session, client: TestClient
    ):
        """Same defect, mirrored in supplier_service.py:143."""
        brand_a = seed_brand(session, "Victim Brand 2", org_id=ORG_ID)

        ing_id = client.post(
            "/api/v1/ingredients", json={"name": "Caviar", "base_unit": "kg"}
        ).json()["id"]
        sup_id = client.post("/api/v1/suppliers", json={"name": "Victim Supplier 2"}).json()["id"]

        link = client.post(
            f"/api/v1/ingredients/{ing_id}/suppliers",
            json={
                "ingredient_id": ing_id,
                "supplier_id": sup_id,
                "unit_id": brand_a,
                "pack_size": 1.0,
                "pack_unit": "kg",
                "price_per_pack": 9999.99,
            },
        )
        assert link.status_code == 201, link.text

        seed_brand(session, "Attacker Brand 2", org_id=ORG_B)
        attacker = make_org_admin(
            session, "attacker-admin-2", "attacker2", platform_user_id="pu-attacker-2", org_id=ORG_B
        )
        use_user(client, attacker)

        resp = client.get(f"/api/v1/suppliers/{sup_id}/ingredients")
        print(f"\n[ATTACK] GET /suppliers/{sup_id}/ingredients as ORG_B admin -> {resp.status_code}")
        print(f"  body: {resp.text[:600]}")
        assert resp.status_code == 200
        assert resp.json() == [], (
            "CROSS-ORG LEAK: ORG_B admin read ORG_A's supplier catalogue "
            "(supplier_service.py:143)"
        )


class TestTastingHistoryImpersonationIDOR:
    """`GET /recipes/with-feedback` — app/api/tasting_history.py.

    It USED to take `{user_id}` from the URL path. The service scoped correctly via
    `access.accessible_unit_ids` — against whoever the caller named, so typing a colleague's id
    returned their confidential recipes. Full authorisation machinery wired to an
    attacker-supplied identity.

    The path parameter is gone rather than ignored: an unused `{user_id}` is an invitation to
    wire it back up. The identity now comes from the token, the only place it can come from.
    """

    def test_the_endpoint_takes_no_user_id(
        self, session: Session, client: TestClient
    ):
        brand_a = seed_brand(session, "Victim Brand 3", org_id=ORG_ID)
        brand_b = seed_brand(session, "Attacker Brand 3", org_id=ORG_ID)

        victim = make_brand_user(session, "victim-user", brand_a, STAFF, "victim")

        recipe = Recipe(
            name="Victim Confidential Recipe",
            owner_id=victim.id,
            is_public=False,
            status=RecipeStatus.ACTIVE,
            organization_id=ORG_ID,
            rnd_started=False,
        )
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        session.add(
            RecipeOutlet(
                recipe_id=recipe.id, unit_id=brand_a, organization_id=ORG_ID, is_active=True
            )
        )
        ts = TastingSession(
            name="Victim Session",
            date=datetime.datetime(2026, 1, 1),
            creator_id=victim.id,
            organization_id=ORG_ID,
        )
        session.add(ts)
        session.commit()
        session.refresh(ts)
        session.add(
            TastingNote(
                session_id=ts.id, recipe_id=recipe.id, user_id=victim.id, feedback="secret"
            )
        )
        session.commit()

        attacker = make_brand_user(session, "attacker-user", brand_b, STAFF, "attacker")
        use_user(client, attacker)

        # The caller gets their OWN feedback recipes, scoped to their brands — empty, since the
        # attacker holds no role at the victim's brand.
        own = client.get("/api/v1/recipes/with-feedback")
        assert own.status_code == 200
        assert own.json() == [], "attacker holds no role at the victim's brand"

        # The old attack was naming the victim in the path. That route must not exist AT ALL — a
        # 404 here IS the fix. An id-taking variant reappearing is the regression to catch:
        # however correctly the service scopes, scoping against a caller-supplied identity is
        # impersonation.
        gone = client.get(f"/api/v1/recipes/with-feedback/{victim.id}")
        assert gone.status_code == 404, (
            "the id-taking route is back — the identity must come from the token, not the URL"
        )

        # And the victim, asking honestly, still sees their own recipe: the fix must not have
        # simply broken the feature.
        use_user(client, victim)
        mine = client.get("/api/v1/recipes/with-feedback")
        assert mine.status_code == 200
        assert [r["name"] for r in mine.json()] == ["Victim Confidential Recipe"]


class TestOrgScopedAdminBypass:
    """The admin bypasses are scoped to the orgs actually administered.

    `is_org_admin(session, user)` with no org means "admin of ANY of your orgs", so an Owner of
    org B dropped the filter on org A's data. The bypasses are real — an org admin is meant to see
    unassigned drafts the brand ladder cannot reach — so they are scoped rather than removed.
    """

    def test_admin_org_ids_returns_only_administered_orgs(self, session: Session):
        from tests.conftest import grant_org_role, link_identity

        create_user(session, "multi-admin", "multiadmin")
        link_identity(session, "multi-admin", "pu-multi-admin")
        grant_org_role(session, "pu-multi-admin", "Admin", org_id=ORG_ID)
        grant_org_role(session, "pu-multi-admin", "Member", org_id=OTHER_ORG)

        assert access.admin_org_ids(session, "multi-admin") == {ORG_ID}, (
            "being a plain Member of another org must not make you its admin"
        )

    def test_admins_row_scopes_to_the_rows_org(self, session: Session):
        from tests.conftest import grant_org_role, link_identity

        create_user(session, "owner-b", "ownerb")
        link_identity(session, "owner-b", "pu-owner-b")
        grant_org_role(session, "pu-owner-b", "Owner", org_id=OTHER_ORG)
        grant_org_role(session, "pu-owner-b", "Member", org_id=ORG_ID)

        assert access.admins_row(session, "owner-b", OTHER_ORG) is True
        assert access.admins_row(session, "owner-b", ORG_ID) is False, (
            "an Owner of org B must not administer org A's rows"
        )

    def test_admins_row_falls_back_when_the_row_has_no_org(self, session: Session):
        """A NULL org carries nothing to scope by — the pre-backfill state.

        Deliberately falls back to the org-less question rather than answering False, which would
        silently revoke every documented admin bypass the moment this shipped. The fallback
        disappears as `q2orgfill1r2s` lands, with no further code change.
        """
        from tests.conftest import grant_org_role, link_identity

        create_user(session, "some-admin", "someadmin")
        link_identity(session, "some-admin", "pu-some-admin")
        grant_org_role(session, "pu-some-admin", "Admin", org_id=ORG_ID)

        assert access.admins_row(session, "some-admin", None) is True

    def test_a_non_admin_is_not_admitted_by_the_null_fallback(self, session: Session):
        """The fallback must widen the bypass to admins only — not to everyone."""
        from tests.conftest import grant_org_role, link_identity

        create_user(session, "plain-member", "plainmember")
        link_identity(session, "plain-member", "pu-plain-member")
        grant_org_role(session, "pu-plain-member", "Member", org_id=ORG_ID)

        assert access.admins_row(session, "plain-member", None) is False
        assert access.admin_org_ids(session, "plain-member") == set()


class TestGlobalCataloguesAreOrgScoped:
    """`ingredients`, `suppliers`, `categories` and `menus_sketch` were GLOBAL.

    Not "scoped by the wrong question" like the leaks above — scoped by nothing at all. Every
    authenticated user of every org listed every row: the whole ingredient catalogue with costs,
    every supplier name, every menu sketch. This was the largest cross-org exposure in the app and
    the least visible, because a list endpoint returning rows looks exactly like a list endpoint
    working.

    `organization_id` has existed on these tables since `q1orgcol9p0q` and creates have stamped it
    since v0.0.64. These tests are about the queries finally reading it.
    """

    def _seed_org_b_rows(self, session: Session) -> None:
        """Rows that belong to ORG_B, written directly — the API cannot create them.

        `get_org_context` takes the org from the token, so there is no request that creates a row
        in an org you are not acting in. That is the point; it also means the fixture has to reach
        past the API to set up the attack.
        """
        from app.models import Category, Ingredient, Supplier
        from app.models.menu_sketch import MenuSketch

        session.add(Ingredient(name="ORG_B Secret Ingredient", base_unit="kg", organization_id=ORG_B))
        session.add(Supplier(name="ORG_B Secret Supplier", organization_id=ORG_B))
        session.add(Category(name="ORG_B Secret Category", organization_id=ORG_B))
        session.add(MenuSketch(name="ORG_B Secret Sketch", organization_id=ORG_B))
        session.commit()

    def test_org_a_user_does_not_see_org_b_catalogues(
        self, session: Session, client: TestClient
    ):
        self._seed_org_b_rows(session)

        # The default client acts as an ORG_A user (conftest pins OrgContext to ORG_ID).
        for path in ("ingredients", "suppliers", "categories", "menu-sketches"):
            resp = client.get(f"/api/v1/{path}")
            assert resp.status_code == 200, resp.text
            assert "ORG_B Secret" not in resp.text, (
                f"CROSS-ORG LEAK: GET /{path} returned another org's rows — "
                f"the list query does not filter on organization_id"
            )

    def test_org_a_user_still_sees_its_own_rows(self, session: Session, client: TestClient):
        """The filter must scope, not empty the app.

        Worth its own test: a predicate that matches nothing passes the leak test perfectly.
        """
        self._seed_org_b_rows(session)

        created = client.post("/api/v1/categories", json={"name": "ORG_A Own Category"})
        assert created.status_code == 201, created.text

        resp = client.get("/api/v1/categories")
        assert resp.status_code == 200
        assert "ORG_A Own Category" in resp.text, "the org filter hid the caller's own row"

    def test_two_orgs_may_each_have_a_category_of_the_same_name(self, session: Session):
        """Uniqueness is per-org, not global.

        Driven at the service rather than through the API because the org comes from the token and
        conftest pins the client to one org — there is no request that acts as ORG_B.

        Unscoped, the 409 was a side channel: "Desserts already exists" told you another tenant had
        a category called Desserts, and stopped you from ever creating your own.
        """
        from app.domain.category_service import CategoryService
        from app.models.category import CategoryCreate

        CategoryService(session, ORG_ID).create_category(CategoryCreate(name="Desserts"))
        other = CategoryService(session, ORG_B).create_category(CategoryCreate(name="Desserts"))

        assert other.id is not None
        assert other.organization_id == ORG_B

    def test_pre_backfill_rows_stay_visible(self, session: Session, client: TestClient):
        """A NULL org is "not yet assigned", not "belongs to nobody".

        `organization_id` is nullable until migration 3, so rows written before `q2orgfill1r2s`
        carry NULL. A bare `organization_id == active_org` would erase them from the UI — the
        entire existing catalogue vanishing on deploy. See `domain/org_scope.py`.
        """
        from app.models import Ingredient

        session.add(Ingredient(name="Legacy Ingredient", base_unit="kg", organization_id=None))
        session.commit()

        resp = client.get("/api/v1/ingredients")
        assert resp.status_code == 200
        assert "Legacy Ingredient" in resp.text, (
            "a pre-backfill row disappeared — the IS NULL arm of org_scope() is missing"
        )


class TestPublicRecipesAreOrgScoped:
    """`is_public` meant public to the INSTANCE, not to the org.

    `_visible_recipe_conditions` admits a recipe when you own it, when it is assigned to a unit you
    can see, **or when `is_public` is true** — and that last clause has no org predicate under it.
    Every other tenant's public recipes were therefore readable by everyone, which is the one
    visibility rule a chef would reasonably assume means "public within my company".

    The same clause is duplicated in `guards.py:_may_see_recipe`, so the list and the by-id read
    have to be fixed together — fixing only the list leaves `GET /recipes/{id}` open.
    """

    def _org_b_public_recipe(self, session: Session) -> Recipe:
        recipe = Recipe(
            name="ORG_B Public Recipe",
            owner_id="org-b-chef",
            is_public=True,
            status=RecipeStatus.ACTIVE,
            organization_id=ORG_B,
        )
        session.add(recipe)
        session.commit()
        session.refresh(recipe)
        return recipe

    def test_org_a_user_does_not_list_org_b_public_recipes(
        self, session: Session, client: TestClient
    ):
        self._org_b_public_recipe(session)

        resp = client.get("/api/v1/recipes")

        assert resp.status_code == 200, resp.text
        assert "ORG_B Public Recipe" not in resp.text, (
            "CROSS-ORG LEAK: another org's public recipe appears in the list — "
            "the is_public clause needs an org predicate above it"
        )

    def test_org_a_user_cannot_read_an_org_b_public_recipe_by_id(
        self, session: Session, client: TestClient
    ):
        recipe = self._org_b_public_recipe(session)

        resp = client.get(f"/api/v1/recipes/{recipe.id}")

        assert resp.status_code == 404, (
            "CROSS-ORG LEAK: guards._may_see_recipe honours is_public without an org predicate"
        )

    def test_the_owner_still_sees_their_own_public_recipe(
        self, session: Session, client: TestClient
    ):
        """The predicate must scope, not break `is_public` outright."""
        created = client.post("/api/v1/recipes", json={"name": "ORG_A Public Recipe"})
        assert created.status_code == 201, created.text
        recipe_id = created.json()["id"]

        patched = client.patch(f"/api/v1/recipes/{recipe_id}", json={"is_public": True})
        assert patched.status_code == 200, patched.text

        listed = client.get("/api/v1/recipes")
        assert listed.status_code == 200
        assert "ORG_A Public Recipe" in listed.text, "the org predicate hid the caller's own recipe"
        assert client.get(f"/api/v1/recipes/{recipe_id}").status_code == 200


class TestTastingSessionsAreOrgScoped:
    """Tasting sessions were scoped by participation, which is not the same as scoped by org.

    Participation scoping is real and mostly holds the line — you cannot list a session you are not
    in. The gap is the admin branch: `admin_org_ids` widens the list to every session in the orgs
    you administer, and that set is a UNION across orgs. An Admin of ORG_B acting in ORG_A got
    ORG_B's sessions mixed into ORG_A's list.
    """

    def _org_b_session(self, session: Session, creator_id: str) -> TastingSession:
        ts = TastingSession(
            name="ORG_B Secret Tasting",
            date=datetime.datetime(2026, 3, 1),
            creator_id=creator_id,
            organization_id=ORG_B,
        )
        session.add(ts)
        session.commit()
        session.refresh(ts)
        return ts

    def test_an_admin_of_both_orgs_does_not_see_org_b_sessions_while_acting_in_org_a(
        self, session: Session, client: TestClient
    ):
        """The caller legitimately administers ORG_B — they simply are not acting in it.

        This is the subtle one: every check passes, the user really is an admin, and the session
        really is theirs to see *in another context*. The active org is what makes it wrong here.
        """
        from tests.conftest import grant_org_role, link_identity

        admin = create_user(session, "dual-admin", "dualadmin")
        link_identity(session, "dual-admin", "pu-dual-admin")
        grant_org_role(session, "pu-dual-admin", "Admin", org_id=ORG_ID)
        grant_org_role(session, "pu-dual-admin", "Admin", org_id=ORG_B)
        self._org_b_session(session, creator_id="someone-else")
        use_user(client, admin)  # conftest pins the acting org to ORG_ID

        resp = client.get("/api/v1/tasting-sessions")

        assert resp.status_code == 200, resp.text
        assert "ORG_B Secret Tasting" not in resp.text, (
            "CROSS-ORG LEAK: admin_org_ids is a union across orgs — the list must be narrowed to "
            "the org actually being acted in"
        )


class TestMenusAreOrgScoped:
    """The last of the seven tables whose reads filtered on nothing.

    Same two defects as recipes, in the same shapes: `admin_org_ids` is a union across orgs, so an
    Admin of ORG_B listed ORG_B's menus while acting in ORG_A; and `get_menu` resolved by primary
    key alone.
    """

    def _org_b_menu(self, session: Session):
        from app.models.menu import Menu

        menu = Menu(
            name="ORG_B Secret Menu",
            organization_id=ORG_B,
            is_active=True,
            created_by="org-b-chef",
        )
        session.add(menu)
        session.commit()
        session.refresh(menu)
        return menu

    def test_a_dual_org_admin_does_not_list_org_b_menus_while_acting_in_org_a(
        self, session: Session, client: TestClient
    ):
        from tests.conftest import grant_org_role, link_identity

        admin = create_user(session, "menu-admin", "menuadmin")
        link_identity(session, "menu-admin", "pu-menu-admin")
        grant_org_role(session, "pu-menu-admin", "Admin", org_id=ORG_ID)
        grant_org_role(session, "pu-menu-admin", "Admin", org_id=ORG_B)
        self._org_b_menu(session)
        use_user(client, admin)  # conftest pins the acting org to ORG_ID

        resp = client.get("/api/v1/menus")

        assert resp.status_code == 200, resp.text
        assert "ORG_B Secret Menu" not in resp.text, (
            "CROSS-ORG LEAK: admin_org_ids is a union — the menu list must be narrowed to the "
            "org actually being acted in"
        )


class TestTastingNoteImageIDOR:
    """`tasting-note-images` resolved NO user on any route.

    `DELETE /{image_id}` destroyed a row and the storage object behind it on a bare integer, for
    any account, on anyone's session. The `sync/*` routes were worse: the image ids came from the
    REQUEST BODY and were deleted without ever being checked against the note in the path — an
    IDOR nested inside an unauthorised route.
    """

    def _seed_note_with_image(self, session: Session, client: TestClient, brand: str):
        """A recipe + session + note + image, all owned by `victim` at `brand`."""
        from app.models import TastingNoteImage

        victim = make_brand_user(session, "img-victim", brand, STAFF, "imgvictim")
        recipe = Recipe(name="Victim Dish", owner_id=victim.id, status=RecipeStatus.ACTIVE)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        ts = TastingSession(
            name="Victim Session", date=datetime.datetime(2026, 1, 1), creator_id=victim.id
        )
        session.add(ts)
        session.commit()
        session.refresh(ts)

        note = TastingNote(session_id=ts.id, recipe_id=recipe.id, user_id=victim.id)
        session.add(note)
        session.commit()
        session.refresh(note)

        image = TastingNoteImage(tasting_note_id=note.id, image_url="https://x/secret.png")
        session.add(image)
        session.commit()
        session.refresh(image)
        return note, image

    def test_cannot_delete_an_image_from_a_session_you_are_not_in(
        self, session: Session, client: TestClient
    ):
        from app.models import TastingNoteImage

        brand_a = seed_brand(session, "Img Brand A", org_id=ORG_ID)
        brand_b = seed_brand(session, "Img Brand B", org_id=ORG_ID)
        _note, image = self._seed_note_with_image(session, client, brand_a)

        use_user(client, make_brand_user(session, "img-attacker", brand_b, STAFF, "imgattacker"))

        resp = client.delete(f"/api/v1/tasting-note-images/{image.id}")

        assert resp.status_code == 404, "an image on someone else's session is not yours to delete"
        session.expire_all()
        assert session.get(TastingNoteImage, image.id) is not None, "the image must survive"

    def test_cannot_list_images_of_a_session_you_are_not_in(
        self, session: Session, client: TestClient
    ):
        brand_a = seed_brand(session, "Img Brand C", org_id=ORG_ID)
        brand_b = seed_brand(session, "Img Brand D", org_id=ORG_ID)
        note, _image = self._seed_note_with_image(session, client, brand_a)

        use_user(client, make_brand_user(session, "img-peeker", brand_b, STAFF, "imgpeeker"))

        resp = client.get(f"/api/v1/tasting-note-images/{note.id}")

        assert resp.status_code == 404
        assert "secret.png" not in resp.text, "the storage URL must not leak"
