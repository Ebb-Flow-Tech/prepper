"""The 12 ``SyncHandlers`` methods — SDK-typed adapters over the pure ``store`` layer.

Each handler is a thin adapter: it enforces the single-org filter, unpacks the SDK payload
via ``payload.model_dump()``, and delegates the actual version-guarded persistence to
``app.passport.store`` (which is dialect-aware and fully unit-tested). The router returns
``2xx`` only after the handler commits; handler exceptions propagate -> 500 -> the delivery
worker retries. Nothing here is swallowed, and nothing logs the payload body.

THE THREE TRAPS (get these wrong and the integration silently breaks):
  1. ``remove_membership`` is a version-guarded UPSERT that KEEPS the row (``status=removed``)
     — never a delete — then revokes the user's local unit-scoped grants (rule 6).
  2. ``upsert_entitlement`` also carries REVOCATION (``status != "active"``); there is no
     entitlement-remove event. The incoming non-active state is applied, never filtered.
  3. ``resync_org`` (the manual per-org re-sync bundle) is UPSERT-ONLY: it fans the bundle's
     collections out through the same per-aggregate handlers and NEVER deletes local rows
     absent from the bundle. Its ``identity_links`` are a per-org SUBSET, never authoritative.

The SDK payload types are imported under ``TYPE_CHECKING`` only — with ``from __future__ import
annotations`` every annotation is a string, and the handlers touch payloads purely by duck-typed
attribute access / ``model_dump()``. So this module imports cleanly even without the private SDK
installed (the receiver in ``sync_router`` and the client in ``reconcile`` still need it, and both
are guarded). This also lets ``ResyncPayload`` — added in SDK 0.2.0 — be referenced on an older pin
without breaking the import: an unimplemented event is a no-op, and here the method is simply never
invoked until the pin carries ``org.resync``.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING

from sqlmodel import Session

from app.config import get_settings
from app.database import engine
from app.models import PassportMembership
from app.passport import role_projection, store

if TYPE_CHECKING:
    from passport_client import (
        EntitlementPayload,
        IdentityLinkPayload,
        MembershipPayload,
        OrgPayload,
        RelationPayload,
        ResyncPayload,
        UnitPayload,
        UserPayload,
    )


@contextmanager
def _session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def _org_id() -> str:
    org_id = get_settings().passport_org_id
    if not org_id:
        raise RuntimeError("PASSPORT_ORG_ID is not configured")
    return str(org_id)


def _wrong_org(organization_id: str) -> bool:
    return str(organization_id) != _org_id()


class PassportHandlers:
    """Implements the ``passport_client`` ``SyncHandlers`` protocol (all 13 methods).

    Persistence + commit happen inside each handler (via ``store``); the router acks
    ``2xx`` only after the commit succeeds.
    """

    # --- org --------------------------------------------------------------------------
    async def upsert_org(self, payload: OrgPayload) -> None:
        if _wrong_org(payload.id):  # the org payload's id IS the org id
            return
        with _session() as session:
            store.apply_org(session, payload.model_dump())

    async def archive_org(self, payload: OrgPayload) -> None:
        # Archived state is carried in ``status``; same version-guarded upsert.
        await self.upsert_org(payload)

    # --- units / relations (NOT projected — Prepper keeps its own outlets) ------------
    async def upsert_unit(self, payload: UnitPayload) -> None:
        return  # conforming no-op: Prepper does not project Passport units

    async def archive_unit(self, payload: UnitPayload) -> None:
        return  # conforming no-op

    async def create_relation(self, payload: RelationPayload) -> None:
        return  # conforming no-op

    async def remove_relation(self, payload: RelationPayload) -> None:
        return  # conforming no-op

    # --- users (apply only if already a member — the snapshot has no users) -----------
    async def upsert_user(self, payload: UserPayload) -> None:
        # ``user.upserted`` applies only once the user is already a member here; membership
        # already embeds email/display_name, so Prepper keeps no separate mirror. No-op
        # unless a membership row exists (kept for forward-compatibility / clarity).
        with _session() as session:
            if session.get(PassportMembership, payload.id) is None:
                return
            return

    # --- identity links (immutable) ---------------------------------------------------
    async def create_identity_link(self, payload: IdentityLinkPayload) -> None:
        with _session() as session:
            store.create_identity_link(session, payload.model_dump())
            role_projection.project_role(
                session, platform_user_id=payload.platform_user_id, org_id=_org_id()
            )

    async def remove_identity_link(self, payload: IdentityLinkPayload) -> None:
        with _session() as session:
            store.remove_identity_link(session, payload.id)

    # --- memberships ------------------------------------------------------------------
    async def upsert_membership(self, payload: MembershipPayload) -> None:
        if _wrong_org(payload.organization_id):
            return
        with _session() as session:
            store.apply_membership(session, payload.model_dump())
            role_projection.project_role(
                session, platform_user_id=payload.platform_user_id, org_id=_org_id()
            )

    async def remove_membership(self, payload: MembershipPayload) -> None:
        # TRAP 1: version-guarded UPSERT that KEEPS the row (status=removed), NOT a delete.
        if _wrong_org(payload.organization_id):
            return
        with _session() as session:
            store.apply_membership(session, payload.model_dump())
            # Rule 6: recompute role (demotes to normal) + revoke unit-scoped grants.
            role_projection.project_role(
                session, platform_user_id=payload.platform_user_id, org_id=_org_id()
            )
            role_projection.revoke_local_grants(
                session, platform_user_id=payload.platform_user_id
            )

    # --- entitlements -----------------------------------------------------------------
    async def upsert_entitlement(self, payload: EntitlementPayload) -> None:
        # TRAP 2: revocation arrives HERE with status != active. Apply it — never filter.
        if _wrong_org(payload.organization_id):
            return
        with _session() as session:
            store.apply_entitlement(session, payload.model_dump())

    # --- manual re-sync (own-app bundle, SDK 0.2.0+) ----------------------------------
    async def resync_org(self, payload: ResyncPayload) -> None:
        # TRAP 3: UPSERT-ONLY. ``org.resync`` re-emits one org's full current state to THIS
        # app so a drifted read model converges without a ``snapshot()`` pass. Apply every
        # collection through the SAME per-aggregate handlers, in FK-safe order
        # (org -> units -> relations -> memberships -> links -> entitlements). NEVER delete a
        # local row absent from the bundle, and never treat ``identity_links`` as
        # authoritative — they are a per-org SUBSET, not a reconciliation/pruning source.
        # Each per-aggregate handler re-applies its own ``_wrong_org`` filter; the bundle-level
        # guard below drops a mis-routed bundle wholesale (we still ack 2xx).
        if str(payload.org_id) != _org_id():
            return
        for org in payload.organizations:
            await self.upsert_org(org)
        for unit in payload.units:
            await self.upsert_unit(unit)  # no-op: Prepper does not project Passport units
        for relation in payload.unit_relations:
            await self.create_relation(relation)  # no-op
        for membership in payload.memberships:
            await self.upsert_membership(membership)
        for link in payload.identity_links:
            await self.create_identity_link(link)
        for entitlement in payload.entitlements:
            await self.upsert_entitlement(entitlement)
