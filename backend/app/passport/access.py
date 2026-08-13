"""Request-path role derivation, driven by the Passport projection: **what may they see, where?**

The admission half — "may this person be in Prepper at all?" — lives in :mod:`app.passport.gate`
(the SSO switch, membership-by-email lookups, the app id, ``SubjectScope``, the entitlement kill
switch and the derived-access gate). It imports this module for the SDK inputs below; nothing here
imports it back, and that direction is deliberate — see that module's docstring.

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

from passport_client.access import roles_at_brands
from passport_client.models import (
    UnitAppAccessPayload,
    UnitAppMembershipPayload,
    UnitPayload,
)
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
    session: Session,
    platform_user_id: str,
    org_id: str,
    *,
    known_status: str | None = None,
) -> dict[str, Any]:
    """Assemble the four facts the SDK helper needs, as SDK payload objects.

    ``memberships`` are the USER's role rows — the helper takes no ``platform_user_id`` and
    so cannot scope them itself.

    ``units`` / ``app_accesses`` are read **filtered to ``org_id``**, which is a pure narrowing:
    ``roles_at_brands`` still applies its own org filter internally and discards every row whose
    ``organization_id`` differs, so the rows dropped here are exactly the rows it would drop. The
    SDK's filter is NOT being replaced — do not remove it, and do not read this as permission to
    trust a caller's scoping; that is the mistake its own docstring warns about.

    They were previously read unscoped, which on the request-path gate meant ``SELECT`` over every
    unit and every ``unit_app_access`` row in every org, once per entitled org, each row then
    materialised as an ORM object and ``model_dump()``ed into a payload. ``performance.md`` forbids
    loading a whole table when a subset suffices; ``organization_id`` is indexed on both.

    ``known_status`` is the org's entitlement status when the caller has already read it — see
    :class:`SubjectScope`. Named for the caller's knowledge rather than the field so it does not
    shadow :func:`entitlement_status` in this scope.
    """
    status = known_status if known_status is not None else entitlement_status(session, org_id)
    units = session.exec(
        select(PassportUnit).where(PassportUnit.organization_id == org_id)
    ).all()
    accesses = session.exec(
        select(PassportUnitAppAccess).where(
            PassportUnitAppAccess.organization_id == org_id
        )
    ).all()
    memberships = session.exec(
        select(PassportUnitAppMembership).where(
            PassportUnitAppMembership.platform_user_id == platform_user_id
        )
    ).all()

    return {
        "org_id": org_id,
        "entitlement_status": status or "",
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


def brand_roles_for_org_members(
    session: Session, org_id: str
) -> dict[str, dict[str, str]]:
    """``{platform_user_id: {brand_id: "Manager" | "Staff"}}`` for every ACTIVE member of ONE org.

    The batched form of :func:`brand_roles_for_platform_user`, for the roster. Identical derivation
    — the SDK's ``roles_at_brands``, once per member — but the inputs are read ONCE and sliced in
    memory instead of re-read per member.

    The single form costs SIX queries per member: ``entitlement_status``, then
    ``_derivation_inputs`` runs ``unit`` and ``unit_app_access`` (both UNFILTERED full scans), the
    member's role rows, ``entitlement_status`` AGAIN, and ``_org_role``. Staging's 20 members are
    ~120 queries and 40 full scans for one roster load. This is four, whatever the member count.

    Still the SDK's answer, never a local one. Re-deriving the ladder here — or in TypeScript —
    would let the roster disagree with the request-path check, which is the failure the
    single-derivation rule exists to prevent. Note the ladder is a FLOOR FOR GAPS: an explicit row
    beats it, so an Owner carrying a ``Staff`` row is ``Staff`` at that brand.

    Empty when the entitlement has not synced — "derive nothing", NOT "deny", matching the single
    form. Fail open until Passport is genuinely authoritative.
    """
    status = entitlement_status(session, org_id)
    if status is None:
        return {}  # entitlements not synced yet — fail open, derive nothing

    units_by_id = {
        u.id: UnitPayload(**u.model_dump()) for u in session.exec(select(PassportUnit)).all()
    }
    app_accesses = [
        UnitAppAccessPayload(**a.model_dump())
        for a in session.exec(select(PassportUnitAppAccess)).all()
    ]

    # Unscoped by org, deliberately: `_derivation_inputs` passes a user's rows unscoped because the
    # SDK helper applies the org filter itself, and a receiver legitimately holds rows for every org
    # it is entitled to. Scoping here would silently diverge from the single form.
    rows_by_user: dict[str, list[UnitAppMembershipPayload]] = {}
    for row in session.exec(select(PassportUnitAppMembership)).all():
        rows_by_user.setdefault(row.platform_user_id, []).append(
            UnitAppMembershipPayload(**row.model_dump())
        )

    members = session.exec(
        select(PassportMembership).where(
            col(PassportMembership.organization_id) == org_id,
            PassportMembership.status == _ACTIVE,
        )
    ).all()

    return {
        m.platform_user_id: roles_at_brands(
            org_id=org_id,
            entitlement_status=status,
            org_role=m.role,
            memberships=rows_by_user.get(m.platform_user_id, []),
            units_by_id=units_by_id,
            app_accesses=app_accesses,
        )
        for m in members
    }


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


def org_role(session: Session, subject: str, organization_id: str | None = None) -> str | None:
    """The user's ACTIVE org role: ``Owner`` | ``Admin`` | ``Member``.

    Pass ``organization_id`` to ask the only question that has a correct answer — a role is held IN
    an org. Omitting it falls back to "strongest role across ALL your orgs", which is **wrong** and
    retained only so the 13 existing callers keep working until each is given an active org (they
    cannot supply one until their route takes ``get_org_context``).

    The org-less form is the live cross-org bug: an Owner of org B is reported Owner while acting in
    org A, and so takes the unfiltered branch in ``api/tastings.py:109``,
    ``ingredient_service.py:383`` and ``supplier_service.py:143``. Do not add callers to it.

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

    if organization_id is not None:
        return _org_role(session, platform_user_id, organization_id)

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


def is_org_admin(
    session: Session, subject: str, organization_id: str | None = None
) -> bool:
    """``True`` for an org ``Owner`` or ``Admin``.

    **Pass ``organization_id`` whenever a ROW is in scope.** Without it this answers "an admin of
    ANY of your orgs", so an Owner of org B administers org A. Every caller that read or wrote a
    specific row and asked the org-less question was a cross-org leak; use :func:`admins_row` (one
    row) or :func:`admin_org_ids` (a list query) instead.

    The org-less form legitimately survives in three places, and only these:

    - ``writeback.py`` — a pre-filter. Passport re-checks against the VERIFIED end user and applies
      its own authority matrix, so it is the real gate; this only avoids asking for something we
      already know it will refuse.
    - the FMH/buy-catalogue imports in ``api/suppliers.py`` and ``api/ingredients.py`` — they
      rewrite GLOBAL master data. Suppliers and ingredients carry no enforced org scope yet, so
      "admin of any org" matches the scope the data actually has.
    - ``api/menus.py`` — the fallback for a menu placed at no unit at all.

    All three become wrong the moment that data is org-scoped, and each then needs the acting org
    from ``get_org_context``. They are not row bypasses today, which is why they are not leaks.
    """
    return org_role(session, subject, organization_id) in ("Owner", "Admin")


def admin_org_ids(session: Session, subject: str) -> set[str]:
    """Every org this user administers (``Owner`` or ``Admin``).

    For scoping an admin bypass to the orgs it should actually apply to. ``is_org_admin`` answers a
    yes/no about ONE org; this answers "which ones", which is what a list query needs.
    """
    platform_user_id = platform_user_id_for(session, subject)
    if platform_user_id is None:
        return set()

    return {
        org_id
        for org_id, role in session.exec(
            select(
                PassportMembership.organization_id, PassportMembership.role
            ).where(
                PassportMembership.platform_user_id == platform_user_id,
                PassportMembership.status == _ACTIVE,
            )
        ).all()
        if role in ("Owner", "Admin")
    }


def admins_row(session: Session, subject: str, row_organization_id: str) -> bool:
    """Whether ``subject`` administers the org that owns this row.

    Always the org-scoped question: an Owner of org B is not an admin of org A's row.

    This used to fall back to the org-less `is_org_admin(session, subject)` — "admin of ANY of your
    orgs" — when the row's org was NULL. That branch was a known cross-org defect, kept deliberately
    because a NULL org carries nothing to scope by and answering False would have revoked every
    admin bypass while the backfill was outstanding. `q3orgnn3t4u` made the column NOT NULL, so a
    NULL row no longer exists and the fallback is gone. `row_organization_id` is now required, which
    is what stops it coming back by accident.
    """
    return is_org_admin(session, subject, row_organization_id)


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
