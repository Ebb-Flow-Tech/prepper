"""Nightly reconciliation via ``snapshot()`` — a server-side job, never client polling.

``snapshot()`` is ONE call returning EIGHT collections that mirror the sync payloads
byte-for-byte. The snapshot scope == the delivery filter, so a correct receiver at steady
state has a read model EQUAL to the snapshot per collection. Re-applying the snapshot through
the SAME handler logic is idempotent (the ``>=`` version guard makes already-current rows a
no-op), so this repairs drift from a missed or out-of-order delivery.

Do NOT reconcile by fanning out per-aggregate list endpoints — there are none
(``list_entitlements()`` etc. do not exist). One ``snapshot()``, eight collections, applied in
FK-safe order (org -> units -> relations -> memberships -> links -> entitlements ->
unit_app_access -> unit_app_membership) so a role row never lands before the brand it names.

There is NO ``users`` collection in the snapshot — memberships embed the user fields.

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
    """Fetch the snapshot and re-apply it ENTIRELY through the live handler logic.

    Rule 9 — no org filter. The snapshot's scope IS the delivery filter, so a correct receiver's
    read model equals the snapshot per collection, across EVERY org Prepper is entitled to.
    Filtering to one configured org would report permanent phantom drift on every other and never
    heal it. Counts are logged without any PII (no emails, no payload bodies).
    """
    from passport_client import PassportClient  # lazy: keeps CLI import light

    settings = get_settings()

    async with PassportClient(
        base_url=settings.passport_api_url, api_key=settings.passport_api_key
    ) as pc:
        snap = await pc.snapshot()

    handlers = PassportHandlers()

    # FK-safe order — the same order ``ResyncFanoutMixin`` uses for the resync bundle.
    for org in snap.organizations:
        await handlers.upsert_org(org)
    for unit in snap.units:
        await handlers.upsert_unit(unit)
    for relation in snap.unit_relations:
        await handlers.create_relation(relation)
    for membership in snap.memberships:
        await handlers.upsert_membership(membership)
    for link in snap.identity_links:
        await handlers.create_identity_link(link)
    for entitlement in snap.entitlements:
        await handlers.upsert_entitlement(entitlement)
    for app_access in snap.unit_app_accesses:
        await handlers.create_unit_app_access(app_access)
    for role in snap.unit_app_memberships:
        await handlers.upsert_unit_app_membership(role)

    logger.info(
        "Passport reconciliation complete: orgs=%d units=%d relations=%d memberships=%d "
        "links=%d entitlements=%d app_accesses=%d app_memberships=%d",
        len(snap.organizations),
        len(snap.units),
        len(snap.unit_relations),
        len(snap.memberships),
        len(snap.identity_links),
        len(snap.entitlements),
        len(snap.unit_app_accesses),
        len(snap.unit_app_memberships),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(reconcile_nightly())
