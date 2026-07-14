"""Mount the Passport sync receive endpoint.

``build_sync_router`` is the reference conforming receiver: raw body -> verify HMAC (401 on
failure — the worker pauses, correct backpressure) -> reject stale ``schema_version`` (400)
-> ``apply_event`` -> ``200`` only after the handler commits. Handler exceptions propagate
-> 500 -> retry. It handles the ``hmac-sha256=<sig>[,<sig2>]`` rotation-overlap header for
us — we never hand-roll signing.

The app's ``sync_url`` in the Passport dashboard must point at this route. Default path is
``/sync``; mounted here under the API prefix, so ``{API_V1_PREFIX}/passport/sync``.

Imports ``passport_client`` at module load — ``app.main`` imports this behind an
``ImportError`` guard, so the SDK's absence just leaves the endpoint unmounted.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from passport_client import build_sync_router

from app.config import get_settings
from app.passport.handlers import PassportHandlers

logger = logging.getLogger(__name__)

_SYNC_PREFIX = "/passport"


def _secret_provider() -> tuple[str, str | None]:
    """Return ``(current, previous_or_None)``. ``previous`` covers the 24h rotation
    overlap; ``None`` otherwise. The router verifies against both."""
    settings = get_settings()
    return (
        settings.passport_webhook_secret or "",
        settings.passport_webhook_secret_prev or None,
    )


def mount_passport_sync(app: FastAPI, *, api_prefix: str) -> bool:
    """Mount the sync receive endpoint if Passport is configured.

    Returns ``True`` if mounted, ``False`` if skipped (not configured). Requires only a webhook
    secret, to verify signatures.

    Rule 9: an org id is NOT required and is NOT a delivery filter. Passport delivers every org
    Prepper is entitled to and all of them are projected; the org is resolved per-request from the
    acting user's membership, never from config.
    """
    settings = get_settings()
    if not settings.passport_webhook_secret:
        logger.info("Passport sync not mounted: PASSPORT_WEBHOOK_SECRET unset")
        return False

    app.include_router(
        build_sync_router(
            handlers=PassportHandlers(),
            secret_provider=_secret_provider,
        ),
        prefix=f"{api_prefix}{_SYNC_PREFIX}",
    )
    logger.info("Passport sync endpoint mounted at %s%s/sync", api_prefix, _SYNC_PREFIX)
    return True
