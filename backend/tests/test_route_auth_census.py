"""The route census must resolve FULL paths — it has silently lied twice.

It is the tool used to decide how much of the API is unprotected, so a wrong number here becomes a
wrong number in a security decision. Both past failures were silent: the script ran, printed a
plausible table, and was wrong.

1. It counted `require_auth` as route-level auth. FastAPI merges app-level dependencies into every
   route's dependant, so `/health` (registered directly on `app.router`) reported gated while the
   included routes did not — the buckets measured different things.
2. It recovered full paths by matching relative suffixes against the OpenAPI schema. A route
   declared `@router.get("")` has a relative path of `""`, and `anything.endswith("")` is True, so
   every such route matched an arbitrary schema entry. It reported 22 allowlisted routes when 7
   are allowlisted.
"""

from app.api.deps import public_routes
from app.config import get_settings
from app.main import app
from scripts.route_auth_census import _collect_with_paths, census

NON_ROUTED = {"HEAD", "OPTIONS"}


def _schema_routes() -> set[tuple[str, str]]:
    return {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
        if method.upper() not in NON_ROUTED
    }


def test_every_route_resolves_to_its_full_mounted_path():
    """The census's paths must equal the app's own schema — no suffix guessing.

    `route.path` is router-relative on FastAPI >=0.139; the prefix lives on the _IncludedRouter's
    `include_context.prefix`. If that accumulation breaks, this catches it rather than the numbers
    quietly drifting.
    """
    collected = {
        (method, full)
        for route, full in _collect_with_paths(app)
        for method in (route.methods or set()) - NON_ROUTED
    }

    assert collected == _schema_routes()


def test_no_route_resolves_to_an_empty_or_relative_path():
    """A path that is empty or unprefixed means the walk lost its prefix.

    `@router.get("")` is the trap: its relative path is `""`, which silently matched everything
    under the old suffix-based resolution.
    """
    for route, full in _collect_with_paths(app):
        assert full, f"{route.endpoint.__name__} resolved to an empty path"
        assert full.startswith("/"), f"{route.endpoint.__name__} resolved to {full!r}"


def test_buckets_are_disjoint_and_sum_to_the_total():
    """public + route-level + gate-only must equal total, or a route is counted twice or lost."""
    r = census()
    assert r["public"] + r["route_level_auth"] + r["gate_only"] == r["total"]
    assert r["total"] == len(_schema_routes())


def test_public_count_matches_the_mounted_allowlist_exactly():
    """The headline bug: 22 reported public against an allowlist of 7.

    Some allowlist entries are conditionally mounted (`passport/sync` only exists when
    `passport_webhook_secret` is set), so the count is the INTERSECTION of the allowlist with what
    is actually mounted — never more.
    """
    mounted_public = public_routes(get_settings()) & _schema_routes()

    assert census()["public"] == len(mounted_public)
    assert census()["public"] <= len(public_routes(get_settings()))


def test_the_global_gate_is_not_counted_as_route_level_auth():
    """`require_auth` is on every route, so counting it would report 100% gated and measure nothing.

    The census answers "which routes resolve a User of their own" — the input to org scoping.
    """
    from scripts.route_auth_census import AUTH_DEPENDENCIES

    assert "require_auth" not in AUTH_DEPENDENCIES
    assert census()["gate_only"] > 0, (
        "if this is 0, the gate is being counted as route-level auth"
    )


def test_no_route_declares_a_user_and_ignores_it():
    """The signature of an authorised route with the behaviour of an unauthorised one.

    This exact shape produced three real cross-brand leaks — `/menu-items`, and both write paths on
    `/ingredients/{id}/suppliers`. Each took `current_user` and never passed it on, so the endpoint
    LOOKED authorised while scoping nothing. The reads on the same data were correctly scoped,
    which made the asymmetry invisible: you could destroy rows you were not allowed to see.

    If this fails, a route asks who is calling and then does not care. Either use the user, or drop
    the parameter and let the global gate do the authenticating.
    """
    from scripts.route_auth_census import (
        _collect_with_paths,
        declares_user_but_ignores_it,
    )

    offenders = [
        f"{sorted((route.methods or set()) - NON_ROUTED)} {full}"
        for route, full in _collect_with_paths(app)
        if declares_user_but_ignores_it(route)
    ]

    assert offenders == [], (
        "these routes take `current_user` and never reference it:\n  "
        + "\n  ".join(offenders)
    )
