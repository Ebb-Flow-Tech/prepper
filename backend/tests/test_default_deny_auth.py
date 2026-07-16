"""Every route requires a token unless it is explicitly public.

This is the only test that can observe the global auth gate. `conftest._override_deps` overrides
the very dependency under test on every other client fixture, so the rest of the suite would stay
green with the gate removed entirely.

The route list is GENERATED from the running app, never hand-written. Earlier drafts of this work
counted ungated routes by hand and were wrong three times (14, then 127, against 124 actual) — a
hand-listed subset goes green while dozens of routes stay open, which is worse than no test.
"""

import re
from unittest.mock import patch

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.api.deps import public_routes, require_auth
from app.config import get_settings
from app.main import app
from scripts.route_auth_census import _collect_api_routes, mounted_paths

PATH_PARAM = re.compile(r"\{[^}]+\}")

# FastAPI mounts these itself, outside any router.
DOCS_PATHS = frozenset({"/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"})


def _schema_routes() -> list[tuple[str, str]]:
    """Every (method, path) in the app, from its own OpenAPI schema.

    `app.routes` is useless here: on FastAPI 0.139 it yields `_IncludedRouter` wrappers with no
    `.path`/`.methods`, so iterating it silently produces only the four doc routes.
    """
    paths = app.openapi()["paths"]
    return [
        (method.upper(), path)
        for path, operations in paths.items()
        for method in operations
        if method.upper() not in ("HEAD", "OPTIONS")
    ]


def _non_public_routes() -> list[tuple[str, str]]:
    allowlist = public_routes(get_settings())
    return [r for r in _schema_routes() if r not in allowlist]


@pytest.fixture(name="anon_client")
def anon_client_fixture(session):
    """A client with NO auth override — the gate runs for real.

    Mirrors `test_auth.py`'s auth_client: only the session is overridden.
    """
    from app.api.deps import get_session
    from app.database import get_session as db_get_session

    assert require_auth not in app.dependency_overrides, (
        "require_auth is overridden — a leaked fixture teardown would make this whole "
        "module certify a hole that is wide open"
    )
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[db_get_session] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_schema_covers_every_route():
    """The OpenAPI schema must see every route the census sees.

    `include_in_schema=False` routes are invisible to `app.openapi()`, so they would never be
    asserted below and this module would stay green around them. None exist today; this pins that.
    """
    schema_count = len(_schema_routes())
    census_count = sum(len(r.methods - {"HEAD", "OPTIONS"}) for r in _collect_api_routes(app))
    assert schema_count == census_count


@pytest.mark.parametrize("method,path", _non_public_routes())
def test_route_requires_authentication(anon_client: TestClient, method: str, path: str):
    """No token, no entry — 401 and nothing else.

    200 means the handler ran. 404/422 mean routing or validation ran before the gate. Any of
    those is a hole.
    """
    url = PATH_PARAM.sub("1", path)
    response = anon_client.request(method, url)
    assert response.status_code == 401, (
        f"{method} {path} returned {response.status_code} without a token"
    )


@pytest.mark.parametrize("method,path", sorted(public_routes(get_settings())))
def test_public_route_passes_the_gate(session, method: str, path: str):
    """The gate must let every allowlisted route through — a typo here locks everyone out of login.

    This asserts the GATE's decision directly rather than the response status. Status is useless
    here: `logout` (auth.py:380) and `oauth-complete` raise their OWN 401 on a missing header, so
    a "not 401" assertion fails even when the allowlist is perfect. `require_auth` returning None
    is the actual contract — credentials not inspected, request passed through.
    """
    request = Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": [],
            "query_string": b"",
        }
    )
    assert require_auth(request, authorization=None, session=session) is None


def test_login_is_reachable_without_a_token(anon_client: TestClient):
    """The end-to-end proof that the allowlist works through the real stack.

    Login must not 401 at the gate. It 4xx's for its own reasons on an empty body; all this owns
    is that it is not the gate's 401 — hence asserting the specific detail is absent.
    """
    response = anon_client.post("/api/v1/auth/login", json={})
    assert response.status_code != 401


def test_health_is_reachable_without_a_token(anon_client: TestClient):
    """Fly's liveness probe carries no token. `/health` is a real APIRoute, so the app-level
    dependency applies to it — without the allowlist entry it would 401 and fail the deploy."""
    response = anon_client.get("/health")
    assert response.status_code == 200


# =============================================================================
# The docs routes — the hole the fixture above cannot see
# =============================================================================


def test_docs_routes_are_not_exposed_when_debug_is_off():
    """`/docs`, `/redoc` and `/openapi.json` served the full API schema with no token.

    FastAPI registers them as plain Starlette `Route`s, not `APIRoute`s, so the app-level
    `dependencies=[Depends(require_auth)]` never applies to them. `main.py` claimed "every route
    requires a JWT unless allowlisted" — untrue for exactly these four, and they were not
    allowlisted.

    `test_route_requires_authentication` CANNOT catch this by construction: it enumerates
    `app.openapi()["paths"]`, and the docs routes do not appear in the schema they serve.

    Gated by `debug` rather than by the allowlist: an anonymous JWT-less caller cannot be given a
    login form by a JSON API, so there is no useful 401 to return — the honest fix is not to serve
    them in production at all. `app.openapi()` still works, so the fixtures above are unaffected.
    """
    from app.config import get_settings
    from app.main import create_app

    settings = get_settings()
    assert settings.debug is False, "this test asserts the production default"

    docs_paths = mounted_paths(create_app()) & DOCS_PATHS

    assert docs_paths == set(), f"docs routes must not be mounted when debug is off: {docs_paths}"


def test_docs_are_available_in_development():
    """Turning them off in production must not take them away from developers.

    CLAUDE.md documents Swagger at localhost:8000/docs as part of the workflow.
    """
    from app.main import create_app

    with patch("app.main.settings") as mock_settings:
        mock_settings.app_name = "test"
        mock_settings.debug = True
        mock_settings.cors_origins = []
        mock_settings.api_v1_prefix = "/api/v1"
        dev_app = create_app()

    assert mounted_paths(dev_app) & DOCS_PATHS == DOCS_PATHS


def test_unconfigured_auth_service_is_503_not_an_unhandled_500(anon_client: TestClient):
    """A misconfigured auth service must fail as a 503, not an unhandled exception.

    `get_auth_service()` raises `ValueError("Supabase credentials not configured")` when the keys
    are missing. `_resolve_current_user` let it propagate, so FastAPI returned a bare 500 — with no
    CORS headers, which makes a browser report it as a CORS failure and sends the next person
    hunting the wrong bug entirely. (It sent me hunting it for ten minutes.)

    Default-deny raised the stakes: the 124 previously-ungated routes never touched auth, so a
    missing key was survivable. Now EVERY route resolves a user, so one absent env var takes the
    whole API down with a misleading error.

    `api/auth.py:47-53` already does this correctly for login — same failure, same 503.
    """
    with patch(
        "app.api.deps.get_auth_service",
        side_effect=ValueError("Supabase credentials not configured"),
    ):
        response = anon_client.get("/api/v1/ingredients", headers={"Authorization": "Bearer x"})

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()
