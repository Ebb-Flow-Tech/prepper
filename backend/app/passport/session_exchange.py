"""Redeem a Passport hosted-login authorization code for a session (Model 3, OAuth 2.1 + PKCE).

A hand-rolled ``httpx`` call rather than the SDK, and deliberately so: ``passport_client`` exposes
no ``session_exchange``, and it is async-only, while this runs from a synchronous request path.
That justifies the raw call — it does not justify making a router hold it, which is why this is a
module in the passport layer rather than a helper beside the route (`backend.md`: routers call
services, they do not talk to external APIs themselves).

Its own module for a second reason: this is the ONLY server-side record of *why* a Model 3 login
failed. The redirect the caller receives is deliberately flat, so every way the exchange can fail
must log from one place, and none of those log lines may carry the code, the verifier or a token.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

_SESSION_EXCHANGE_PATH = "/api/v1/apps/me/session-exchange"
_TIMEOUT_SECONDS = 10.0


def exchange_session_code(
    settings: Settings, *, code: str, verifier: str
) -> dict[str, Any] | None:
    """POST Passport's session-exchange. ``None`` on ANY transport or HTTP failure.

    A drifted ``SSO_CALLBACK_URL`` — the classic misconfiguration, since it must match Passport's
    per-app allow-list byte for byte — surfaces here as a non-2xx, not as an exception.
    """
    api_url = settings.passport_api_url
    if not api_url or not settings.passport_api_key or not settings.sso_callback_url:
        logger.warning("passport callback: refused — the Passport API is not configured")
        return None

    try:
        # `rstrip("/")` is load-bearing: a configured trailing slash yields `//api/v1/...`, which
        # is a flat 404 that looks nothing like a configuration error.
        response = httpx.post(
            f"{api_url.rstrip('/')}{_SESSION_EXCHANGE_PATH}",
            headers={"X-API-Key": settings.passport_api_key},
            json={
                "code": code,
                "code_verifier": verifier,
                # Re-sent, not redundant (RFC 6749 §4.1.3): repeating the redirect_uri at the
                # token request is what stops a code issued for one registered callback being
                # redeemed against another.
                "redirect_uri": settings.sso_callback_url,
            },
            timeout=_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        logger.warning("passport callback: refused — session-exchange request failed: %s", exc)
        return None
    except ValueError as exc:
        logger.warning("passport callback: refused — session-exchange body was not JSON: %s", exc)
        return None

    # Valid JSON that is not an object (`[]`, `"ok"`, `42`) would blow up the caller's `.get` with
    # an AttributeError — the raw 500 the callback route exists to avoid. Same refusal as malformed.
    if not isinstance(payload, dict):
        logger.warning(
            "passport callback: refused — session-exchange returned a non-object body (%s)",
            type(payload).__name__,
        )
        return None

    exchanged: dict[str, Any] = payload
    return exchanged
