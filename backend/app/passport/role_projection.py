"""Project Passport facts onto Prepper's local ``users`` row.

Three dimensions, all DERIVED from the projection (never granted locally once Passport is
authoritative):

- ``user_type`` <- the **org** role (``Owner``/``Admin`` -> ``admin``, ``Member`` -> ``normal``,
  no active membership -> ``normal``).
- ``is_manager`` <- the **brand-app** roles: ``True`` iff the user holds ``Manager`` at any
  brand, including via the Owner/Admin **ladder** (which grants ``Manager`` everywhere with
  no role row at all). Derived through ``passport_client.access`` — never hand-rolled.
- ``outlet_id`` <- the brand the user holds a role at, mapped to a local outlet by
  ``outlets.passport_unit_id`` (resolved from ``PassportUnit.external_ref == outlets.code``).

**Non-destructive while the mapping is incomplete.** Outlet scope is only ever written when
the derivation actually resolves a mapped outlet. A brand with no ``external_ref``, or one
whose ref matches no outlet, leaves ``outlet_id`` exactly as it was — so switching Passport
on does not wipe existing outlet assignments before the refs are populated. ``is_manager`` is
likewise left alone until brand roles genuinely derive.

The one place local grants ARE cleared is ``membership.removed`` (conformance rule 6): a
removed member loses ``is_manager`` and ``outlet_id`` outright. The ``users`` row itself is
never deleted — a removed member keeps their account, demoted and de-granted.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import (
    Outlet,
    PassportIdentityLink,
    PassportMembership,
    User,
    UserType,
)
from app.passport import access

# Map the Passport ORG role string to Prepper's local account level.
_ROLE_MAP: dict[str, UserType] = {
    "Owner": UserType.ADMIN,
    "Admin": UserType.ADMIN,
    "Member": UserType.NORMAL,
}

_MANAGER = "Manager"


def _local_user(session: Session, platform_user_id: str) -> User | None:
    """Resolve the local ``users`` row behind a Passport platform user via the identity
    link (``link.subject == users.id``). Returns ``None`` until the link — and a matching
    local user — exist; projection re-runs when the link later arrives."""
    link = session.exec(
        select(PassportIdentityLink).where(
            PassportIdentityLink.platform_user_id == platform_user_id
        )
    ).first()
    if link is None:
        return None
    return session.get(User, link.subject)


def _active_membership(
    session: Session, platform_user_id: str, org_id: str
) -> PassportMembership | None:
    return session.exec(
        select(PassportMembership).where(
            PassportMembership.platform_user_id == platform_user_id,
            PassportMembership.organization_id == org_id,
            PassportMembership.status == "active",
        )
    ).first()


def _mapped_outlet_id(session: Session, user: User, brand_ids: list[str]) -> int | None:
    """Pick the local outlet for the brands the user holds a role at.

    ``None`` means "no opinion" — no brand mapped to an outlet, so the caller must leave the
    user's existing ``outlet_id`` untouched. When several brands map, the user's current
    outlet wins if it is among them (stability across re-projections); otherwise the lowest
    outlet id is chosen deterministically, so the same facts always yield the same answer.
    """
    if not brand_ids:
        return None

    outlets = session.exec(
        select(Outlet).where(Outlet.passport_unit_id.in_(brand_ids))  # type: ignore[union-attr]
    ).all()
    outlet_ids = sorted(o.id for o in outlets if o.id is not None)
    if not outlet_ids:
        return None

    if user.outlet_id in outlet_ids:
        return user.outlet_id
    return outlet_ids[0]


def project_user(session: Session, *, platform_user_id: str, org_id: str) -> None:
    """Re-derive ``user_type`` / ``is_manager`` / ``outlet_id`` for one platform user.

    Re-run after any event that can change the answer: ``membership.upserted`` / ``.removed``,
    ``identity_link.created``, and ``unit_app_membership.upserted`` / ``.removed``. An
    unmatched user (no local account yet) is a no-op and re-resolves when the link appears.
    """
    user = _local_user(session, platform_user_id)
    if user is None:
        return

    membership = _active_membership(session, platform_user_id, org_id)
    new_type = (
        _ROLE_MAP.get(membership.role, UserType.NORMAL) if membership else UserType.NORMAL
    )

    roles = access.brand_roles_for_platform_user(session, platform_user_id, org_id)

    changed = False
    if user.user_type != new_type:
        user.user_type = new_type
        changed = True

    # Only assert brand-derived facts once brand roles actually derive. An empty map means
    # Passport is not yet authoritative here (unconfigured / not synced / no brands carry the
    # app), and must not be read as "revoke everything".
    if roles:
        is_manager = _MANAGER in roles.values()
        if user.is_manager != is_manager:
            user.is_manager = is_manager
            changed = True

        outlet_id = _mapped_outlet_id(session, user, list(roles))
        if outlet_id is not None and user.outlet_id != outlet_id:
            user.outlet_id = outlet_id
            changed = True

    if changed:
        session.add(user)
        session.commit()


def revoke_local_grants(session: Session, *, platform_user_id: str) -> None:
    """Conformance rule 6: revoke Prepper's unit-scoped grants for the user behind
    ``platform_user_id`` (clear ``is_manager`` and ``outlet_id``). Called from the
    ``membership.removed`` handler. No-op when there is no linked local user."""
    user = _local_user(session, platform_user_id)
    if user is None:
        return

    if user.is_manager or user.outlet_id is not None:
        user.is_manager = False
        user.outlet_id = None
        session.add(user)
        session.commit()
