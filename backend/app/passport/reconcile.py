"""Nightly reconciliation via ``snapshot()`` — a server-side job, never client polling.

``snapshot()`` is ONE call returning six collections that mirror the sync payloads
byte-for-byte. The snapshot scope == the delivery filter, so a correct receiver at steady
state has a read model EQUAL to the snapshot per collection. Re-applying the snapshot
through the SAME handler logic is idempotent (the version guard makes already-current rows
a no-op), so this corrects any drift from a missed or out-of-order delivery.

There is NO ``users`` collection in the snapshot (memberships embed the user fields) and no
per-aggregate list endpoints — do not reach for ``list_entitlements()`` etc.; they do not
exist.

Invoke from a scheduled server-side job (cron / scheduled task). Prepper does not ship a
scheduler in-process, so wire this to your infra's nightly runner:
``python -m app.passport.reconcile``.
"""

from __future__ import annotations

import asyncio
import logging

from app.config import get_settings
from app.passport.handlers import PassportHandlers

logger = logging.getLogger(__name__)


async def reconcile_nightly() -> None:
    """Fetch the snapshot, filter to the configured org, and re-apply through the live
    handler logic. Drift is only visible as rows that actually changed; counts are logged
    without any PII (no emails, no payload bodies)."""
    from passport_client import PassportClient  # lazy: SDK is an optional private dep

    settings = get_settings()
    org_id = str(settings.passport_org_id)

    async with PassportClient(
        base_url=settings.passport_api_url, api_key=settings.passport_api_key
    ) as pc:
        snap = await pc.snapshot()

    handlers = PassportHandlers()

    for org in (o for o in snap.organizations if o.id == org_id):
        await handlers.upsert_org(org)
    for membership in (m for m in snap.memberships if m.organization_id == org_id):
        await handlers.upsert_membership(membership)
    for entitlement in (e for e in snap.entitlements if e.organization_id == org_id):
        await handlers.upsert_entitlement(entitlement)
    for link in snap.identity_links:  # already scoped to this app
        await handlers.create_identity_link(link)

    logger.info(
        "Passport reconciliation complete: orgs=%d memberships=%d entitlements=%d links=%d",
        sum(1 for o in snap.organizations if o.id == org_id),
        sum(1 for m in snap.memberships if m.organization_id == org_id),
        sum(1 for e in snap.entitlements if e.organization_id == org_id),
        len(snap.identity_links),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(reconcile_nightly())
