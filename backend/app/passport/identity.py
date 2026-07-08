"""Report the (app, subject) identity link to Passport on login.

Establishing the link: on every login / user provisioning, report the identity so Passport
can create the ``(app, subject) -> platform_user`` link. The resulting
``identity_link.created`` event flows back only to this app and populates
``passport_identity_link``, which is what lets role projection resolve a membership to a
local user. The report is idempotent per ``(app, subject)`` — a repeat returns the existing
link and emits nothing.

This is best-effort and must NEVER break the login path: it is a no-op when Passport is not
configured, imports the SDK lazily (so the module loads even when the private SDK is
absent), and swallows transport errors after logging (Passport being down must not block a
Prepper login). ``subject`` is the app's Supabase ``sub`` — i.e. ``users.id``.
"""

from __future__ import annotations

import asyncio
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


async def _report(subject: str, email: str) -> None:
    from passport_client import PassportClient  # lazy: SDK is an optional private dep

    settings = get_settings()
    async with PassportClient(
        base_url=settings.passport_api_url, api_key=settings.passport_api_key
    ) as pc:
        await pc.report_identity_link(subject=subject, email=email)


def report_identity_link_safe(subject: str, email: str) -> None:
    """Fire-and-forget identity report from a synchronous request path.

    No-op unless Passport is fully configured. Any failure (SDK missing, network, API
    error) is logged and swallowed — reporting the link must not affect the caller.
    """
    settings = get_settings()
    if not (settings.passport_api_url and settings.passport_api_key):
        return

    try:
        asyncio.run(_report(subject, email))
    except Exception:  # noqa: BLE001 — best-effort; login must not fail on Passport
        logger.warning("Passport identity-link report failed for subject", exc_info=True)
