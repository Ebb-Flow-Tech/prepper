"""Every route requires a token unless it is explicitly public.

This is the only test that can observe the global auth gate. `conftest._override_deps` overrides
the very dependency under test on every other client fixture, so the rest of the suite would stay
green with the gate removed entirely.

The route list is GENERATED from the running app, never hand-written. Earlier drafts of this work
counted ungated routes by hand and were wrong three times (14, then 127, against 124 actual) — a
hand-listed subset goes green while dozens of routes stay open, which is worse than no test.
"""

import re

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.api.deps import public_routes, require_auth
from app.config import get_settings
from app.main import app
from scripts.route_auth_census import _collect_api_routes

PATH_PARAM = re.compile(r"\{[^}]+\}")


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
