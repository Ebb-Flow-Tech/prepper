"""Route auth census — which routes resolve the acting user THEMSELVES.

Counts ROUTE-LEVEL auth only, deliberately ignoring the app-level ``require_auth`` gate. Since
that gate covers every route, counting it would report 100% gated and say nothing. What this
answers instead is: which routes lean on the global gate alone, and therefore have no ``User`` to
authorise against?

That is the input to the org-scoping work: a route with no route-level user cannot check "may
THIS caller see THIS row". Authentication is not authorisation — ``GET /menu-items/{section_id}``
took ``get_current_user`` and still leaked every org's menu items, because it never used it.

**This is not the authentication test.** ``tests/test_default_deny_auth.py`` enforces that; it
asserts a real 401 from the running app for every non-public route. This script is a survey.

Why it builds the app rather than grepping: file-level greps miss routes mounted through a
separate ``include_router`` call (``batch_router``, and ``menus.py``'s three routers), and
``app.routes`` on FastAPI 0.139 yields ``_IncludedRouter`` wrappers rather than routes. Every
hand-typed count in the design doc was wrong at least once (14, then 127, against 124 actual).

Run it rather than counting by hand:

    python -m scripts.route_auth_census            # summary
    python -m scripts.route_auth_census --list     # every route with no route-level auth

Note the census is environment-dependent: ``POST /api/v1/passport/sync`` is mounted only when
``passport_webhook_secret`` is set, so the total is 182 without it and 183 with it.
"""

from __future__ import annotations

import argparse
from collections import Counter
from typing import TypedDict

from fastapi import FastAPI
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.api.deps import public_routes
from app.config import get_settings
from app.main import create_app


class Census(TypedDict):
    total: int
    route_level_auth: int
    public: int
    gate_only: int
    by_module: Counter[str]
    routes: list[tuple[str, str, str]]


# Route-level auth dependencies — the ones that hand the endpoint a `User` it can authorise with.
#
# `require_auth` is EXCLUDED on purpose. It is the app-level gate, so FastAPI merges it into every
# route's dependant; counting it would report 100% gated and measure nothing. Its enforcement is
# tested in tests/test_default_deny_auth.py, not surveyed here.
#
# `get_bearer_token` is also excluded: it asserts the header is present and forwards the raw string
# to Passport write-back, but never verifies it. Omitting both errs toward reporting a route as
# lacking auth, which is the safe direction for a security survey.
AUTH_DEPENDENCIES = frozenset({"get_current_user", "get_org_context"})

NON_ROUTED_METHODS = frozenset({"HEAD", "OPTIONS"})


def _routed_methods(route: APIRoute) -> set[str]:
    """The HTTP methods this route actually serves. ``methods`` is ``set[str] | None`` on the
    Starlette base class; an APIRoute always populates it, but narrow the type rather than assume."""
    return (route.methods or set()) - NON_ROUTED_METHODS


def _collect_api_routes(app: FastAPI) -> list[APIRoute]:
    """Every APIRoute, descending through _IncludedRouter wrappers.

    FastAPI >=0.139 does not flatten included routers onto the app; it appends an
    ``_IncludedRouter`` whose ``original_router`` holds the real routes.
    """
    return [route for route, _ in _collect_with_paths(app)]


def _collect_with_paths(app: FastAPI) -> list[tuple[APIRoute, str]]:
    """Every APIRoute paired with its FULL mounted path.

    ``route.path`` is router-RELATIVE on FastAPI >=0.139 (``/login``, or ``""`` for
    ``@router.get("")``), so it cannot be compared to an allowlist of full paths. The mounted
    prefix lives on the ``_IncludedRouter``'s ``include_context.prefix``, so accumulate it.

    Do NOT try to recover the full path by matching relative suffixes against the OpenAPI schema:
    ``@router.get("")`` has a relative path of ``""``, and ``anything.endswith("")`` is True, so
    every such route silently matches an arbitrary schema entry. That bug made this script report
    22 allowlisted routes when 7 are.
    """
    found: list[tuple[APIRoute, str]] = []

    def walk(node: object, prefix: str) -> None:
        for route in getattr(node, "routes", []) or []:
            if isinstance(route, APIRoute):
                found.append((route, prefix + route.path))
                continue
            inner = getattr(route, "original_router", None)
            if inner is None:
                walk(route, prefix)
                continue
            context = getattr(route, "include_context", None)
            walk(inner, prefix + getattr(context, "prefix", "") or prefix)

    walk(app, "")
    return found


def _has_route_level_auth(route: APIRoute) -> bool:
    """Whether the endpoint resolves a `User` of its own — not merely that it is authenticated."""
    hits: list[str] = []

    def walk(dependant: Dependant) -> None:
        call = getattr(dependant, "call", None)
        if call is not None and call.__name__ in AUTH_DEPENDENCIES:
            hits.append(call.__name__)
        for sub in dependant.dependencies:
            walk(sub)

    walk(route.dependant)
    return bool(hits)


def census() -> Census:
    app = create_app()
    allowlist = public_routes(get_settings())

    total = route_level = public = 0
    gate_only_by_module: Counter[str] = Counter()
    gate_only_routes: list[tuple[str, str, str]] = []

    for route, full in _collect_with_paths(app):
        module = route.endpoint.__module__.split(".")[-1]
        has_auth = _has_route_level_auth(route)
        for method in sorted(_routed_methods(route)):
            total += 1
            if (method, full) in allowlist:
                public += 1
            elif has_auth:
                route_level += 1
            else:
                gate_only_by_module[module] += 1
                gate_only_routes.append((method, full, module))

    return {
        "total": total,
        "route_level_auth": route_level,
        "public": public,
        "gate_only": sum(gate_only_by_module.values()),
        "by_module": gate_only_by_module,
        "routes": gate_only_routes,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--list", action="store_true", help="list every route with no route-level auth"
    )
    args = parser.parse_args()

    result = census()
    print(f"total routes                {result['total']}")
    print(f"  public (allowlisted)      {result['public']}")
    print(f"  route-level auth          {result['route_level_auth']}")
    print(f"  global gate only          {result['gate_only']}")
    print(
        "\nEvery non-public route is authenticated by the app-level gate "
        "(tests/test_default_deny_auth.py enforces it)."
    )
    print(
        "'global gate only' = no User at the endpoint, so nothing to authorise against."
    )

    if args.list:
        print("\nroutes with no route-level auth:")
        for method, path, module in sorted(
            result["routes"], key=lambda r: (r[2], r[1])
        ):
            print(f"  {method:7s} {path:55s} {module}")
    else:
        print("\nglobal-gate-only by module:")
        for module, count in result["by_module"].most_common():
            print(f"  {module:40s} {count}")


if __name__ == "__main__":
    main()
