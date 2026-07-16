"""Every route addressing a recipe or a tasting session by id must authorise it.

This is the point of `app/api/guards.py`. Twenty-eight cross-brand leaks were found in one audit,
and every one had the same cause: the check was a hand-rolled `if` that each route had to remember
to write, and routes kept not writing it. A guard you can ASSERT the presence of turns "did anyone
remember?" into a test.

If you add a route under `/recipes/{recipe_id}` or `/tasting-sessions/{session_id}`, this fails
until you either take a guard or add a line to the allowlist below saying why you did not. The
allowlist is the point: an exception has to be argued in writing, not just omitted.
"""

import pytest

from app.main import app
from scripts.route_auth_census import _collect_with_paths, _routed_methods

GUARDS = frozenset(
    {
        "require_recipe_access",
        "require_recipe_access_or_tasting_participant",
        "require_session_access",
    }
)

# (method, path) -> why this route authorises WITHOUT a guard. Every entry has been checked by
# hand; none of them means "unprotected".
GUARD_EXEMPT: dict[tuple[str, str], str] = {
    ("GET", "/api/v1/recipes/{recipe_id}/versions"): (
        "Masking IS the access control: an unauthorised version comes back as a stub so the "
        "tree's shape survives. A guard would 403 the whole tree instead. Pinned by "
        "test_recipes.py::test_version_tree_user_of_another_brand_sees_masked_recipes."
    ),
    ("GET", "/api/v1/recipes/{recipe_id}/units"): "recipe_units checks accessible_unit_ids itself.",
    ("POST", "/api/v1/recipes/{recipe_id}/units"): "recipe_units requires Manager at the unit.",
    ("PATCH", "/api/v1/recipes/{recipe_id}/units/{unit_id}"): "recipe_units requires Manager at the unit.",
    ("DELETE", "/api/v1/recipes/{recipe_id}/units/{unit_id}"): "recipe_units requires Manager at the unit.",
    ("GET", "/api/v1/tasting-sessions/{session_id}"): "tastings.py calls _check_session_access.",
    ("GET", "/api/v1/tasting-sessions/{session_id}/stats"): "tastings.py calls _check_session_access.",
    ("PATCH", "/api/v1/tasting-sessions/{session_id}"): "tastings.py calls _check_session_access.",
    ("DELETE", "/api/v1/tasting-sessions/{session_id}"): "tastings.py calls _check_session_access.",
}


def _dependency_names(route) -> set[str]:
    names: set[str] = set()

    def walk(dependant) -> None:
        if dependant.call is not None:
            names.add(dependant.call.__name__)
        for sub in dependant.dependencies:
            walk(sub)

    walk(route.dependant)
    return names


def _routes_addressing(param: str) -> list[tuple[str, str, object]]:
    return [
        (method, full, route)
        for route, full in _collect_with_paths(app)
        if param in full
        for method in sorted(_routed_methods(route))
    ]


@pytest.mark.parametrize("method,path,route", _routes_addressing("{recipe_id}"))
def test_recipe_routes_are_guarded(method: str, path: str, route):
    """A route naming a recipe must prove the caller may have it.

    Reading a recipe's ingredients, costs, instructions, images or BOM tree IS reading the recipe.
    `GET /menu-items/{id}`, all three supplier-ingredient writes and a dozen recipe children each
    resolved a `User` and then never consulted it.
    """
    if (method, path) in GUARD_EXEMPT:
        pytest.skip(GUARD_EXEMPT[(method, path)])
    assert _dependency_names(route) & GUARDS, (
        f"{method} {path} addresses a recipe by id but takes no guard. Add "
        f"`Depends(require_recipe_access)`, or add it to GUARD_EXEMPT with the reason."
    )


@pytest.mark.parametrize("method,path,route", _routes_addressing("{session_id}"))
def test_tasting_session_routes_are_guarded(method: str, path: str, route):
    """CLAUDE.md: non-participants must not reach a session. That held in `tastings.py` and
    nowhere else — 19 of 30 routes around a session authorised nothing at all."""
    if (method, path) in GUARD_EXEMPT:
        pytest.skip(GUARD_EXEMPT[(method, path)])
    assert _dependency_names(route) & GUARDS, (
        f"{method} {path} addresses a tasting session by id but takes no guard. Add "
        f"`Depends(require_session_access)`, or add it to GUARD_EXEMPT with the reason."
    )


def test_the_exemption_list_has_no_dead_entries():
    """An exemption for a route that no longer exists is a stale excuse.

    Left unchecked it rots into a hole: the path gets reused, the entry still matches, and the new
    route is silently exempt from a check nobody remembers granting.
    """
    live = {(m, p) for m, p, _ in _routes_addressing("{recipe_id}") + _routes_addressing("{session_id}")}
    stale = set(GUARD_EXEMPT) - live
    assert stale == set(), f"GUARD_EXEMPT names routes that no longer exist: {stale}"
