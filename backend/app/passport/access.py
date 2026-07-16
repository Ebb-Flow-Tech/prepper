"""Request-path access derivation, driven by the Passport projection.

**App access is DERIVED, never granted.** There is no per-user, per-app grant row. A person
may use Prepper in an org iff ALL of:

1. the org's **entitlement** is active (the org-level kill switch — trap 2), AND
2. the **brand** is active and carries a ``unit_app_access`` row for Prepper, AND
3. the user holds an active ``unit_app_membership`` at that brand — **or** is an org
   ``Owner``/``Admin``, who hold ``Manager`` everywhere by the **ladder**, with no role row.

That join is computed by ``passport_client.access``, never by hand. A hand-rolled version
drifts: it forgets ``brand.status``, or that a brand carrying no ``unit_app_access`` row
confers nothing even to an Owner, or the org filter — and, worst of all, forgetting the
``org_role`` argument silently DENIES every Owner and Admin, who have zero role rows. The
SDK helpers make both ``org_id`` and ``org_role`` required keyword arguments precisely so
that omission is a ``TypeError`` at the call site rather than a silent wrong answer.

**Fail-open until Passport is actually the source of truth.** When Passport is unconfigured,
or no entitlement row has synced yet for the org, nothing is blocked and no roles are
derived — Prepper's existing local grants keep working unchanged. Gating only begins once
entitlements are really flowing.
"""

from __future__ import annotations

from typing import Any

from passport_client.access import has_app_access, roles_at_brands
from passport_client.models import (
    UnitAppAccessPayload,
    UnitAppMembershipPayload,
    UnitPayload,
)
from sqlalchemy import func
from sqlmodel import Session, col, select

from app.models import (
    PassportEntitlement,
    PassportIdentityLink,
    PassportMembership,
    PassportUnit,
    PassportUnitAppAccess,
    PassportUnitAppMembership,
    PassportUnitRelation,
)

_ACTIVE = "active"


def orgs_for_platform_user(session: Session, platform_user_id: str) -> list[str]:
    """Every org this platform user actively belongs to, read from the PROJECTION.

    Rule 9: the org set comes from the DATA, never from a configured constant. Prepper holds units,
    switches and memberships for EVERY org it is entitled to, and a user may belong to more than one.
    """
    return list(
        session.exec(
            select(PassportMembership.organization_id).where(
                PassportMembership.platform_user_id == platform_user_id,
                PassportMembership.status == _ACTIVE,
            )
        ).all()
    )


def entitlement_status(session: Session, org_id: str) -> str | None:
    """The org's entitlement status, or ``None`` when no entitlement has synced yet.

    ``None`` is the not-yet-configured case (fail open). An org with rows but none active
    reports the non-active state — the kill switch (trap 2: revocation arrives as an
    ``entitlement.upserted`` with ``status != "active"``, never as a delete).
    """
    statuses = session.exec(
        select(PassportEntitlement.status).where(
            PassportEntitlement.organization_id == org_id
        )
    ).all()
    if not statuses:
        return None
    return _ACTIVE if _ACTIVE in statuses else statuses[0]


def is_org_blocked(session: Session, subject: str) -> bool:
    """Org-level kill switch for the user behind ``subject``: ``True`` when EVERY org they belong
    to has a synced, non-active entitlement.

    Rule 9: evaluated against the user's OWN orgs, not a configured one — a user entitled through
    any org may still use Prepper. Fail-open (``False``) when the user is not linked yet, belongs to
    no org, or no entitlement has synced: turning the projection on must not lock anyone out before
    the data has landed.
    """
    platform_user_id = platform_user_id_for(session, subject)
    if platform_user_id is None:
        return False  # not linked — Passport is not authoritative for this user

    orgs = orgs_for_platform_user(session, platform_user_id)
    if not orgs:
        return False

    known = [s for s in (entitlement_status(session, o) for o in orgs) if s is not None]
    if not known:
        return False  # nothing synced yet — do not block

    return all(status != _ACTIVE for status in known)


def platform_user_id_for(session: Session, subject: str) -> str | None:
    """Resolve a local ``users.id`` (the app's Supabase ``sub``) to a Passport platform user
    via the identity link. ``None`` until the link exists."""
    return session.exec(
        select(PassportIdentityLink.platform_user_id).where(
            PassportIdentityLink.subject == subject
        )
    ).first()


def _org_role(session: Session, platform_user_id: str, org_id: str) -> str | None:
    """The user's ACTIVE org role (``Owner`` | ``Admin`` | ``Member``), or ``None``.

    ``None`` when the membership was removed — the tombstone row is kept, but it confers
    nothing, and the ladder does not refill a role the user no longer holds.
    """
    return session.exec(
        select(PassportMembership.role).where(
            PassportMembership.organization_id == org_id,
            PassportMembership.platform_user_id == platform_user_id,
            PassportMembership.status == _ACTIVE,
        )
    ).first()


def _derivation_inputs(
    session: Session, platform_user_id: str, org_id: str
) -> dict[str, Any]:
    """Assemble the four facts the SDK helper needs, as SDK payload objects.

    ``memberships`` are the USER's role rows — the helper takes no ``platform_user_id`` and
    so cannot scope them itself. ``units`` / ``app_accesses`` are passed unscoped by org on
    purpose: the helper applies the org filter internally (a receiver legitimately holds
    rows for every org it is entitled to).
    """
    units = session.exec(select(PassportUnit)).all()
    accesses = session.exec(select(PassportUnitAppAccess)).all()
    memberships = session.exec(
        select(PassportUnitAppMembership).where(
            PassportUnitAppMembership.platform_user_id == platform_user_id
        )
    ).all()

    return {
        "org_id": org_id,
        "entitlement_status": entitlement_status(session, org_id) or "",
        "org_role": _org_role(session, platform_user_id, org_id),
        "memberships": [UnitAppMembershipPayload(**m.model_dump()) for m in memberships],
        "units_by_id": {u.id: UnitPayload(**u.model_dump()) for u in units},
        "app_accesses": [UnitAppAccessPayload(**a.model_dump()) for a in accesses],
    }


def brand_roles_for_platform_user(
    session: Session, platform_user_id: str, org_id: str
) -> dict[str, str]:
    """``{brand_id: "Manager" | "Staff"}`` for a platform user IN ONE ORG.

    Rule 9: ``org_id`` is a REQUIRED argument, never a setting. Omit the org scope and an Owner of
    org A becomes a Manager at every brand of org B — Prepper holds units and switches for every org
    it is entitled to.

    Empty when Passport is not yet the source of truth for that org (no entitlement synced) —
    callers must treat empty as "derive nothing", NOT as "deny". A user may hold different roles at
    different brands; there is no single effective role.
    """
    if entitlement_status(session, org_id) is None:
        return {}  # entitlements not synced yet — fail open, derive nothing

    roles: dict[str, str] = roles_at_brands(
        **_derivation_inputs(session, platform_user_id, org_id)
    )
    return roles


def brand_roles(session: Session, subject: str) -> dict[str, str]:
    """``{brand_id: role}`` for the local user behind ``subject``, ACROSS every org they belong to.

    Safe to union: a brand UUID belongs to exactly one org, so the maps cannot collide. That is why
    Prepper needs no "active org" concept — the brand key already carries the org.
    """
    platform_user_id = platform_user_id_for(session, subject)
    if platform_user_id is None:
        return {}

    roles: dict[str, str] = {}
    for org_id in orgs_for_platform_user(session, platform_user_id):
        roles.update(brand_roles_for_platform_user(session, platform_user_id, org_id))
    return roles


def has_prepper_access_for_platform_user(
    session: Session, platform_user_id: str
) -> bool:
    """Whether a platform user may use Prepper in ANY of their orgs — the derived-access emptiness
    test, keyed by ``platform_user_id`` directly.

    Used by the SSO login gate, which knows the member by **email → membership** (the identity link
    that :func:`platform_user_id_for` needs may not exist yet for an SSO user). Fail-open (``True``)
    until entitlements have synced, so turning the projection on never locks anyone out before the
    data lands.
    """
    orgs = orgs_for_platform_user(session, platform_user_id)
    if not orgs:
        return True
    scoped = [org_id for org_id in orgs if entitlement_status(session, org_id) is not None]
    if not scoped:
        return True  # entitlements not synced yet
    return any(
        has_app_access(**_derivation_inputs(session, platform_user_id, org_id))
        for org_id in scoped
    )


def platform_user_id_for_email(session: Session, email: str) -> str | None:
    """An ACTIVE member's ``platform_user_id`` resolved straight from their email.

    The SSO login path: the member is known by the verified email (the identity link may not exist
    yet), and the membership projection carries the ``platform_user_id``. ``None`` if not a member.
    """
    return session.exec(
        select(PassportMembership.platform_user_id).where(
            func.lower(PassportMembership.email) == email.lower(),
            PassportMembership.status == _ACTIVE,
        )
    ).first()


def has_prepper_access(session: Session, subject: str) -> bool:
    """Whether the user behind ``subject`` (a local ``users.id``) may use Prepper in ANY org.

    Fail-open (``True``) until Passport is genuinely the source of truth — not linked, no org, or no
    entitlement synced — so that turning the projection on does not lock everyone out.
    """
    platform_user_id = platform_user_id_for(session, subject)
    if platform_user_id is None:
        return True  # not linked yet — Passport is not authoritative for this user
    return has_prepper_access_for_platform_user(session, platform_user_id)


def org_role(session: Session, subject: str) -> str | None:
    """The user's strongest ACTIVE org role across their orgs: ``Owner`` | ``Admin`` | ``Member``.

    Rule 8: Passport's vocabulary, read verbatim. This replaces Prepper's `user_type` — but note it
    is NOT the same question. `user_type == admin` used to mean "superuser of this app"; the org role
    means "governs the ORGANISATION in Passport". Passport's own model says an org Owner/Admin holds
    `Manager` **in** each app (the ladder) — it does not make them an app superuser. Use this only
    for genuinely org-wide administration; for anything that touches a brand's data, ask
    ``role_at_unit`` instead.
    """
    platform_user_id = platform_user_id_for(session, subject)
    if platform_user_id is None:
        return None

    roles = {
        r
        for r in session.exec(
            select(PassportMembership.role).where(
                PassportMembership.platform_user_id == platform_user_id,
                PassportMembership.status == _ACTIVE,
            )
        ).all()
    }
    for strongest in ("Owner", "Admin", "Member"):
        if strongest in roles:
            return strongest
    return None


def is_org_admin(session: Session, subject: str) -> bool:
    """``True`` for an org ``Owner`` or ``Admin`` — the people who administer the organisation."""
    return org_role(session, subject) in ("Owner", "Admin")


def _brand_of(session: Session, unit_id: str) -> str | None:
    """The brand a unit belongs to. A brand IS its own brand; an outlet resolves through its
    ``belongs_to_brand`` edge. Entities hold no people and resolve to nothing.

    People are assigned to BRANDS only — an outlet is a physical site that *inherits* its brand's
    apps. So any question about a role at an outlet is really a question about its brand.
    """
    unit = session.get(PassportUnit, unit_id)
    if unit is None:
        return None
    if unit.type == "brand":
        return unit_id

    return session.exec(
        select(PassportUnitRelation.to_unit_id).where(
            PassportUnitRelation.from_unit_id == unit_id,
            PassportUnitRelation.relation == "belongs_to_brand",
        )
    ).first()


def role_at_unit(session: Session, subject: str, unit_id: str) -> str | None:
    """``Manager`` | ``Staff`` | ``None`` for this user AT THIS UNIT (brand or outlet).

    **The request-path check.** ``None`` means no access *here* — the user may well be `Manager`
    somewhere else, which is exactly why a single global flag cannot express this and why
    ``is_manager`` is being deleted.
    """
    brand_id = _brand_of(session, unit_id)
    if brand_id is None:
        return None
    return brand_roles(session, subject).get(brand_id)


def accessible_unit_ids(session: Session, subject: str) -> set[str]:
    """Every unit whose data this user may see: the brands they hold a role at, plus the OUTLETS
    under those brands.

    This replaces the old `outlets` hierarchy walk. An outlet inherits its brand — that is Passport's
    structure, not a convention Prepper invents — so holding a role at a brand grants sight of its
    sites. Empty means "no access anywhere", which for a user with no identity link is the correct,
    fail-closed answer.
    """
    brand_ids = set(brand_roles(session, subject))
    if not brand_ids:
        return set()

    outlet_ids = set(
        session.exec(
            select(PassportUnitRelation.from_unit_id).where(
                col(PassportUnitRelation.to_unit_id).in_(brand_ids),
                PassportUnitRelation.relation == "belongs_to_brand",
            )
        ).all()
    )
    return brand_ids | outlet_ids
