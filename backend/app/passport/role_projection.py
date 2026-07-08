"""Role projection: map the Passport org role onto Prepper's local ``users`` row.

Two-dimension role model. The org role (``Owner`` / ``Admin`` / ``Member``, Passport-owned)
is projected onto ``users.user_type``. Prepper's tool-local grants (``is_manager``,
``outlet_id``) are separate — sync never *grants* them, but conformance rule 6 requires we
*revoke* them when a membership is removed.

Prepper adaptation (ADAPT decision, chosen default "map role + clear grants"):
- ``Owner`` / ``Admin`` -> ``user_type = admin``
- ``Member``           -> ``user_type = normal``
- No active membership  -> ``user_type = normal`` (demotion)
- ``membership.removed`` -> also clear ``is_manager`` and ``outlet_id`` (revoke unit-scoped
  grants), driven entirely by sync with no app-side admin action.

Account existence is never touched here — a removed member keeps their ``users`` row, just
demoted and de-granted. This module imports no ``passport_client`` symbols.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import (
    PassportIdentityLink,
    PassportMembership,
    User,
    UserType,
)

# Map the Passport org role string to Prepper's local account level.
_ROLE_MAP: dict[str, UserType] = {
    "Owner": UserType.ADMIN,
    "Admin": UserType.ADMIN,
    "Member": UserType.NORMAL,
}


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


def project_role(session: Session, *, platform_user_id: str, org_id: str) -> None:
    """Resolve org role -> ``user_type`` for the local user behind ``platform_user_id``.

    Re-run after ``membership.upserted``, ``identity_link.created``, and
    ``membership.removed`` — any of the three can change the resolved role. An unmatched
    membership (no local user yet) is a no-op and re-resolves when the link appears.
    """
    user = _local_user(session, platform_user_id)
    if user is None:
        return

    membership = _active_membership(session, platform_user_id, org_id)
    new_type = _ROLE_MAP.get(membership.role, UserType.NORMAL) if membership else UserType.NORMAL

    if user.user_type != new_type:
        user.user_type = new_type
        session.add(user)
        session.commit()


def revoke_local_grants(session: Session, *, platform_user_id: str) -> None:
    """Conformance rule 6: revoke Prepper's tool-local, unit-scoped grants for the user
    behind ``platform_user_id`` (clear ``is_manager`` and ``outlet_id``). Called from the
    ``membership.removed`` handler. No-op when there is no linked local user."""
    user = _local_user(session, platform_user_id)
    if user is None:
        return

    if user.is_manager or user.outlet_id is not None:
        user.is_manager = False
        user.outlet_id = None
        session.add(user)
        session.commit()
