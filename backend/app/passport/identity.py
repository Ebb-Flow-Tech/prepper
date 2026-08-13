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
from uuid import uuid4

from sqlmodel import Session, select

from app.config import get_settings
from app.models import PassportIdentityLink
from app.passport.gate import resolve_app_id

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


def bind_identity_link(session: Session, *, subject: str, platform_user_id: str) -> None:
    """Write the ``(app, subject) -> platform_user`` link DIRECTLY, for the Model 3 callback.

    :func:`report_identity_link_safe` cannot do this job: it forwards the caller's token so Passport
    can verify it against PREPPER's registered ``issuer_url``, and a Passport-issued token has the
    wrong issuer — a guaranteed no-op on that path. So the row is written locally instead.

    ``platform_user_id`` must come from the MEMBERSHIP projection, never from the token's ``sub``.
    Those are different UUID spaces (Passport's Supabase auth-user id vs. Passport's own internal
    id), and a link written from the wrong one resolves to nobody: every brand-scoped check then
    denies the user **silently**, because the projection still looks populated.

    Idempotent per ``(subject, app_id)``. A row naming a different platform user is REPLACED rather
    than updated, because identity-link rows are immutable per row.

    **The self-healing is one-directional, and that is a known gap.** The replacement row is minted
    with a local ``uuid4``, so Passport has never seen its id: a later ``identity_link.removed`` for
    the id Passport knows will not match it, and ``reconcile`` cannot pair them either. A revocation
    on Passport's side therefore leaves this row in place. It heals a wrong ``platform_user_id``; it
    does not survive a revocation. Closing that means writing the id Passport issues, which needs an
    API this app does not have today.
    """
    app_id = resolve_app_id(session)
    if app_id is None:
        logger.warning(
            "passport callback: identity link not written — no app id in the entitlement projection"
        )
        return

    existing = session.exec(
        select(PassportIdentityLink).where(
            PassportIdentityLink.subject == subject,
            PassportIdentityLink.app_id == app_id,
        )
    ).first()
    if existing is not None:
        if existing.platform_user_id == platform_user_id:
            return
        session.delete(existing)
        session.flush()

    session.add(
        PassportIdentityLink(
            id=str(uuid4()),
            platform_user_id=platform_user_id,
            app_id=app_id,
            subject=subject,
            linked_via="manual",
        )
    )
    session.commit()
