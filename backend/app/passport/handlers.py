"""The 17 ``SyncHandlers`` methods — SDK-typed adapters over the pure ``store`` layer.

Each handler is a thin adapter: it enforces the single-org filter, unpacks the SDK payload
via ``payload.model_dump()``, and delegates the actual version-guarded persistence to
``app.passport.store`` (which is dialect-aware and fully unit-tested). The router returns
``2xx`` only after the handler commits; handler exceptions propagate -> 500 -> the delivery
worker retries. Nothing here is swallowed, and nothing logs the payload body.

**A MISNAMED HANDLER IS A SILENT NO-OP.** ``apply_event`` resolves handlers with
``getattr(handlers, name, None)`` and skips when absent — that guard is what makes unknown
event types forward-compatible, which means a typo'd method name does not raise, it silently
drops every event of that type. ``tests/test_passport_sync.py`` asserts this class implements
exactly the SDK's dispatch table; if you rename a method, that test fails. Do not "fix" it by
renaming the test.

THE TRAPS (get these wrong and the integration silently breaks):
  1. ``remove_membership`` is a version-guarded UPSERT that KEEPS the row (``status=removed``)
     — never a delete — then revokes the user's local unit-scoped grants (rule 6).
     ``remove_unit_app_membership`` is the same keep-the-row upsert.
  2. ``upsert_entitlement`` also carries REVOCATION (``status != "active"``); there is no
     entitlement-remove event. The incoming non-active state is applied, never filtered, and
     it deletes NOTHING: role rows go dormant and access dies by arithmetic, so a restored
     entitlement brings the roster back losslessly.
  3. ``resync_org`` (the manual per-org re-sync bundle) is UPSERT-ONLY. ``ResyncFanoutMixin``
     implements it by fanning the bundle's eight collections out through the per-aggregate
     handlers below, in FK-safe order, and never deletes a local row absent from the bundle.

The four ``unit_app_*`` handlers ARE the access model. App access is DERIVED (entitlement +
org-role ladder + brand-app switch + role row), never granted — omit one of these and
``has_app_access`` is ``False`` forever. See ``app/passport/access.py``.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING

from passport_client import ResyncFanoutMixin
from sqlmodel import Session

from app.database import engine
from app.domain import provisioning
from app.models import PassportMembership
from app.passport import store

if TYPE_CHECKING:
    from passport_client import (
        EntitlementPayload,
        IdentityLinkPayload,
        MembershipPayload,
        OrgPayload,
        RelationPayload,
        ResyncPayload,
        UnitAppAccessPayload,
        UnitAppMembershipPayload,
        UnitPayload,
        UserPayload,
    )


@contextmanager
def _session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session



class PassportHandlers(ResyncFanoutMixin):  # type: ignore[misc]  # SDK ships no type stubs
    """Implements the ``passport_client`` ``SyncHandlers`` protocol (all 17 methods).

    ``resync_org`` comes from ``ResyncFanoutMixin``, which fans the bundle out through the
    per-aggregate handlers below. Persistence + commit happen inside each handler (via
    ``store``); the router acks ``2xx`` only after the commit succeeds.

    MULTI-ORG (rule 9): there is deliberately NO org filter here. Passport delivers every org
    Prepper is entitled to, and all of them are projected. Dropping a "foreign" org's events
    would silently put permanent holes in the read model the day a second org buys Prepper —
    nothing would error. ``organization_id`` is stored on every row and is a REQUEST-PATH
    argument (resolved from the acting user's membership), never a configured constant.
    """

    # --- manual re-sync (own-app bundle) ----------------------------------------------
    async def resync_org(self, payload: ResyncPayload) -> None:
        # TRAP 3: UPSERT-ONLY. The mixin fans the bundle's eight collections out through the
        # per-aggregate handlers below in FK-safe order and deletes nothing; the bundle's
        # ``identity_links`` are a per-org SUBSET, never authoritative, so this must never be
        # fed into a pruning path.
        await super().resync_org(payload)

    # --- org --------------------------------------------------------------------------
    async def upsert_org(self, payload: OrgPayload) -> None:
        with _session() as session:
            store.apply_org(session, payload.model_dump())

    async def archive_org(self, payload: OrgPayload) -> None:
        # Archived state is carried in ``status``; same version-guarded upsert.
        await self.upsert_org(payload)

    # --- units / relations ------------------------------------------------------------
    # Projected because the access derivation reads a brand's ``status`` and org. Prepper's
    # own ``outlets`` table is untouched — a brand links to an outlet via ``external_ref``.
    async def upsert_unit(self, payload: UnitPayload) -> None:
        with _session() as session:
            store.apply_unit(session, payload.model_dump())

    async def archive_unit(self, payload: UnitPayload) -> None:
        # Archived state is carried in ``status``; an archived brand confers no access.
        await self.upsert_unit(payload)

    async def create_relation(self, payload: RelationPayload) -> None:
        with _session() as session:
            store.create_relation(session, payload.model_dump())

    async def remove_relation(self, payload: RelationPayload) -> None:
        with _session() as session:
            store.remove_relation(session, payload.id)

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

    async def remove_identity_link(self, payload: IdentityLinkPayload) -> None:
        with _session() as session:
            store.remove_identity_link(session, payload.id)

    # --- memberships ------------------------------------------------------------------
    async def upsert_membership(self, payload: MembershipPayload) -> None:
        with _session() as session:
            store.apply_membership(session, payload.model_dump())

        # Auto-provision a Prepper login for a newly-added member (best-effort, AFTER the projection
        # commits above so a provisioning failure never rolls the membership back or 500s the
        # webhook). No-op unless `auto_provision_members` is on. Its own session, own error handling.
        with _session() as session:
            provisioning.provision_member_login(
                session, email=payload.email, display_name=payload.display_name
            )

    async def remove_membership(self, payload: MembershipPayload) -> None:
        # TRAP 1: version-guarded UPSERT that KEEPS the row (status=removed), NOT a delete.
        with _session() as session:
            store.apply_membership(session, payload.model_dump())
            # Rule 6 needs no action now: the user row carries NO grant to revoke (rule 8).
            # A removed membership means no active org role, so `access` derives no brand roles
            # for them — access dies by arithmetic, and the tombstone row below is the record.

    # --- entitlements -----------------------------------------------------------------
    async def upsert_entitlement(self, payload: EntitlementPayload) -> None:
        # TRAP 2: revocation arrives HERE with status != active. Apply it — never filter,
        # and never cascade: nothing is deleted, access simply stops deriving.
        with _session() as session:
            store.apply_entitlement(session, payload.model_dump())

    # --- unit-app access (the brand-app switch; immutable) ----------------------------
    async def create_unit_app_access(self, payload: UnitAppAccessPayload) -> None:
        with _session() as session:
            store.create_unit_app_access(session, payload.model_dump())

    async def remove_unit_app_access(self, payload: UnitAppAccessPayload) -> None:
        with _session() as session:
            store.remove_unit_app_access(session, payload.id)

    # --- unit-app memberships (the (user, brand, app) role row) -----------------------
    async def upsert_unit_app_membership(
        self, payload: UnitAppMembershipPayload
    ) -> None:
        # Delivery is own-app scoped: every row here is already Prepper's. Never filter by
        # app_id locally. This is also where YOUR OWN write-back echoes back — applying it
        # is idempotent under the >= version guard, so never suppress the echo.
        with _session() as session:
            store.apply_unit_app_membership(session, payload.model_dump())

    async def remove_unit_app_membership(
        self, payload: UnitAppMembershipPayload
    ) -> None:
        # Same as trap 1: a keep-the-row upsert (status=removed + bumped version), never a
        # delete. The projection below re-derives the user's roles without this brand.
        with _session() as session:
            store.apply_unit_app_membership(session, payload.model_dump())
