"""Route registration order is load-bearing in `main.py`, and nothing else would catch a reorder.

Several routers mount at the SAME prefix. `recipes.router` declares `GET /{recipe_id}`, which
matches any single path segment — so a static route like `GET /with-feedback` registered after it
is swallowed and 422s with "unable to parse 'with-feedback' as an integer". Starlette matches in
registration order, so specific paths must precede parameterised ones.

This is invisible: `main.py` reads as a flat list of `include_router` calls, an alphabetical tidy-up
would break it, and the failure is a confusing 422 on a route that plainly exists. Introduced while
removing an impersonation IDOR — the old path was `/with-feedback/{user_id}` (two segments, no
clash), and taking the id out created the collision.
"""

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_USER_ID, create_user, use_user

# (method, path, the router it must resolve to) for paths that are shadowed by a sibling
# router's catch-all if registered in the wrong order.
COLLISION_PRONE = [
    ("GET", "/api/v1/recipes/with-feedback", "tasting_history"),
]


@pytest.mark.parametrize("method,path,expected_module", COLLISION_PRONE)
def test_static_route_is_not_swallowed_by_a_sibling_catch_all(
    method: str, path: str, expected_module: str
):
    """The static path must resolve to its OWN router, not to `/{recipe_id}`."""
    from app.main import app
    from scripts.route_auth_census import _collect_with_paths

    matches = [
        route
        for route, full in _collect_with_paths(app)
        if full == path and method in (route.methods or set())
    ]
    assert matches, f"{method} {path} is not mounted at all"
    assert matches[0].endpoint.__module__.split(".")[-1] == expected_module


def test_with_feedback_is_not_swallowed_by_recipe_id(client: TestClient, session):
    """End-to-end: the real symptom was a 422 int_parsing, not a 404 — easy to misread as a bug
    in the handler rather than in the mount order."""
    use_user(client, create_user(session, ADMIN_USER_ID, "admin"))

    response = client.get("/api/v1/recipes/with-feedback")

    assert response.status_code != 422, (
        "'with-feedback' is being parsed as a recipe_id — tasting_history.router must be "
        "registered BEFORE recipes.router in main.py"
    )
    assert response.status_code == 200
