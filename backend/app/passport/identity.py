"""Report the (app, subject) identity link to Passport on login.

On every login / user provisioning, report the identity so Passport can create the
``(app, subject) -> platform_user`` link. The resulting ``identity_link.created`` event flows
back only to this app and populates ``passport_identity_link``, which is what lets the
projection resolve a Passport membership to a local user. The report is idempotent per
``(app, subject)`` — a repeat returns the existing link and emits nothing.

**The call forwards the end user's OWN Supabase JWT and sends NO body.** An app API key
authenticates the *app* and names no user, so an app cannot assert a user it did not
authenticate: Passport verifies the token against Prepper's registered ``issuer_url`` and
takes both ``sub`` and ``email`` from the VERIFIED claims. There is no ``subject=`` /
``email=`` argument — passing identity in the body is exactly what this design removes.

Prerequisite: Prepper's ``issuer_url`` (its Supabase project) must be registered in Passport.
Unregistered ⇒ every call is a ``403`` (unconfigured, therefore refused — fail closed).

Best-effort, and it must NEVER break the login path: a no-op when Passport is unconfigured,
and transport/API errors are logged (never the token) and swallowed — Passport being down
must not block a Prepper login.
"""

from __future__ import annotations

import asyncio
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


async def _report(token: str) -> None:
    from passport_client import (
        PassportClient,  # lazy: keeps the login path import-light
    )

    from app.database import engine
    from app.passport import store

    settings = get_settings()
    async with PassportClient(
        base_url=settings.passport_api_url, api_key=settings.passport_api_key
    ) as pc:
        link = await pc.report_identity_link(token=token)

    # Apply the returned link to the projection IMMEDIATELY — do not wait for the webhook.
    #
    # The link is the ONLY bridge from this app's Supabase `sub` to a Passport platform user: with no
    # link, the user resolves to no orgs, no brands and no roles, and every brand-scoped check denies
    # them. Webhook delivery is asynchronous, so relying on it alone leaves a window right after login
    # in which the user is authenticated but has no access — the worst possible moment for it.
    #
    # This is an insert-if-absent upsert, exactly like the `identity_link.created` handler, so the
    # webhook re-applying it moments later is a harmless no-op. Provision user-facing state
    # synchronously; let the webhook be the backstop, not the primary path.
    from sqlmodel import Session

    with Session(engine) as session:
        store.create_identity_link(session, link.model_dump())


def report_identity_link_safe(token: str) -> None:
    """Fire-and-forget identity report from a synchronous request path.

    ``token`` is the end user's freshly minted Supabase access token. No-op unless Passport
    is fully configured. Any failure (network, API error) is logged and swallowed — the
    token is never logged.
    """
    settings = get_settings()
    if not (settings.passport_api_url and settings.passport_api_key):
        return

    try:
        asyncio.run(_report(token))
    except Exception:  # noqa: BLE001 — best-effort; login must not fail on Passport
        logger.warning("Passport identity-link report failed", exc_info=True)
