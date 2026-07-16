"""Read-model queries over the Passport projection: brands, and the brand-app role roster.

**Reads come from the PROJECTION, never from Passport's API.** The projected tables are not a cache
beside the real model — they ARE the model (conformance rule 2). Calling Passport on the request
path would undo the whole point of projecting: the page would die whenever Passport is down, it
would add a network hop to every render, and it would ``403`` for any user who has no identity link
yet. Mutations still go UP through ``writeback`` and come back DOWN via sync.

Everything here is scoped to the orgs the ACTING USER belongs to (rule 9), resolved from the
projection rather than from a configured constant — Prepper holds units and brand-app switches for
EVERY org it is entitled to, and an unscoped read would leak another tenant's brands.
"""

from __future__ import annotations

from sqlmodel import Session, col, select

from app.models import (
    PassportMembership,
    PassportOrganization,
    PassportUnit,
    PassportUnitAppAccess,
    PassportUnitAppMembership,
)
from app.passport import access

_ACTIVE = "active"
_BRAND = "brand"


def organizations_for_user(
    session: Session, subject: str, platform_user_id: str | None = None
) -> list[dict[str, object]]:
    """The orgs this user may act in, with names and their role in each.

    The only read of ``passport.organization``. It has been projected since the sync consumer
    landed and nothing ever queried it, so the client carried ``organization_id`` on three payloads
    with no way to render a name.

    ``platform_user_id`` may be passed by a caller that has already resolved it (including via the
    email fallback, for a user whose identity link has not synced yet). Omitting it falls back to
    the link alone, which returns ``[]`` for that user — so pass it.

    The role is read PER ORG. ``access.org_role``'s org-less form answers "your strongest role
    anywhere", which would report an Owner of org B as Owner of org A.
    """
    platform_user_id = platform_user_id or access.platform_user_id_for(session, subject)
    if platform_user_id is None:
        return []

    rows = session.exec(
        select(PassportOrganization, PassportMembership)
        .join(
            PassportMembership,
            col(PassportMembership.organization_id) == col(PassportOrganization.id),
        )
        .where(
            PassportMembership.platform_user_id == platform_user_id,
            PassportMembership.status == _ACTIVE,
        )
        .order_by(col(PassportOrganization.name))
    ).all()

    return [
        {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "status": org.status,
            "my_org_role": membership.role,
        }
        for org, membership in rows
    ]


def brands_for_user(
    session: Session, subject: str, organization_id: str
) -> list[dict[str, object]]:
    """Active brands that CARRY Prepper, in the acting user's orgs, with that user's role at each.

    A brand with no ``unit_app_access`` row confers access to nobody — not even an org Owner, whose
    ladder still requires a brand that carries the app — so a brand without one is not shown: it is
    not somewhere anyone can be given a role.

    ``my_role`` is ``Manager`` | ``Staff`` | ``None``, taken from the SAME derivation the request
    path uses (``roles_at_brands``), so the UI can never disagree with the permission check.
    """
    platform_user_id = access.platform_user_id_for(session, subject)
    if platform_user_id is None:
        return []

    org_ids = access.orgs_for_platform_user(session, platform_user_id)
    if organization_id not in org_ids:
        # Fail closed on our own rather than trusting the caller. `get_org_context` has already
        # verified the acting org against the projection, so this should be unreachable — but a
        # directory function that returns rows for any org it is handed is one refactor away from
        # being the leak, and the check costs a set membership.
        return []

    rows = session.exec(
        select(PassportUnit)
        .join(PassportUnitAppAccess, col(PassportUnitAppAccess.unit_id) == PassportUnit.id)
        .where(
            col(PassportUnit.organization_id) == organization_id,
            PassportUnit.type == _BRAND,
            PassportUnit.status == _ACTIVE,
        )
    ).all()

    my_roles = access.brand_roles(session, subject)
    return [
        {
            "id": unit.id,
            "name": unit.name,
            "organization_id": unit.organization_id,
            "my_role": my_roles.get(unit.id),
        }
        for unit in sorted(rows, key=lambda u: u.name.casefold())
    ]


def roster(
    session: Session, subject: str, organization_id: str
) -> list[dict[str, object]]:
    """Every brand-app role row in the acting user's orgs — the assignment roster.

    Delivery is own-app scoped, so every projected row is already Prepper's: do NOT filter by
    ``app_id`` locally. ``removed`` rows are KEPT as tombstones by the handler (trap 1) and are
    excluded here — a tombstone confers nothing, and showing it would read as an active grant.

    Email / display name come from ``passport_membership``, which EMBEDS them; there is no separate
    user aggregate to join (the snapshot has no users collection).
    """
    platform_user_id = access.platform_user_id_for(session, subject)
    if platform_user_id is None:
        return []

    org_ids = access.orgs_for_platform_user(session, platform_user_id)
    if organization_id not in org_ids:
        # Fail closed on our own rather than trusting the caller. `get_org_context` has already
        # verified the acting org against the projection, so this should be unreachable — but a
        # directory function that returns rows for any org it is handed is one refactor away from
        # being the leak, and the check costs a set membership.
        return []

    rows = session.exec(
        select(PassportUnitAppMembership, PassportUnit, PassportMembership)
        .join(PassportUnit, col(PassportUnit.id) == PassportUnitAppMembership.unit_id)
        .join(
            PassportMembership,
            col(PassportMembership.platform_user_id)
            == PassportUnitAppMembership.platform_user_id,
        )
        .where(
            col(PassportUnitAppMembership.organization_id) == organization_id,
            PassportUnitAppMembership.status == _ACTIVE,
            col(PassportMembership.organization_id)
            == PassportUnitAppMembership.organization_id,
        )
    ).all()

    return [
        {
            "assignment_id": assignment.id,
            "platform_user_id": assignment.platform_user_id,
            "email": membership.email,
            "display_name": membership.display_name,
            "unit_id": assignment.unit_id,
            "unit_name": unit.name,
            "role": assignment.role,
            "org_role": membership.role,
            "organization_id": assignment.organization_id,
        }
        for assignment, unit, membership in rows
    ]


def assignable_members(
    session: Session, subject: str, organization_id: str
) -> list[dict[str, object]]:
    """Org members who could be given a brand role, in the acting user's orgs.

    A person can only hold a brand-app role if Passport knows them as an org member, so the
    candidate list is the membership roster — NOT Prepper's local ``users`` table, which may contain
    accounts Passport has never heard of. ``removed`` memberships are tombstones and excluded.
    """
    platform_user_id = access.platform_user_id_for(session, subject)
    if platform_user_id is None:
        return []

    org_ids = access.orgs_for_platform_user(session, platform_user_id)
    if organization_id not in org_ids:
        # Fail closed on our own rather than trusting the caller. `get_org_context` has already
        # verified the acting org against the projection, so this should be unreachable — but a
        # directory function that returns rows for any org it is handed is one refactor away from
        # being the leak, and the check costs a set membership.
        return []

    rows = session.exec(
        select(PassportMembership).where(
            col(PassportMembership.organization_id) == organization_id,
            PassportMembership.status == _ACTIVE,
        )
    ).all()

    return [
        {
            "platform_user_id": m.platform_user_id,
            "email": m.email,
            "display_name": m.display_name,
            "org_role": m.role,
            "organization_id": m.organization_id,
        }
        for m in sorted(rows, key=lambda m: (m.email or "").casefold())
    ]
