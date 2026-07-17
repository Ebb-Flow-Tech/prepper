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
    """The brands this user CAN REACH in the acting org — never the org's full brand list.

    A brand with no ``unit_app_access`` row confers access to nobody — not even an org Owner, whose
    ladder still requires a brand that carries the app — so a brand without one is not shown: it is
    not somewhere anyone can be given a role.

    **Scoped to the caller's own access.** This used to return every app-carrying brand in the org
    with ``my_role: None`` on the ones the caller could not reach, so a Staff at one brand saw all
    of them. Passport cannot catch that: these reads are served from Prepper's projection and never
    reach it. An org Owner/Admin still sees every app-carrying brand — via the LADDER, not via an
    exception here, which is why scoping costs them nothing.

    ``my_role`` is ``Manager`` | ``Staff``, never ``None``, and comes from the SAME derivation the
    request path uses (``roles_at_brands``) — so the UI cannot disagree with the permission check,
    and "can see it" and "holds a role at it" cannot drift apart.
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
            "my_role": my_roles[unit.id],
        }
        for unit in sorted(rows, key=lambda u: u.name.casefold())
        if unit.id in my_roles
    ]


def roster(
    session: Session, subject: str, organization_id: str
) -> list[dict[str, object]]:
    """Everyone who can reach each brand THE CALLER can reach — assigned AND derived.

    Not "the brand-app role rows we store". An org Owner/Admin holds ``Manager`` at every
    app-carrying brand with NO ``unit_app_membership`` row (the ladder), so a stored-rows-only
    roster could show an empty brand while every Owner had full access. That is not a hypothetical:
    on staging it listed 3 rows against ~190 real grants, and the page carried a paragraph
    apologising for it. Derived holders are rows now, and the apology is gone.

    ``source`` is ``'assigned'`` iff an ACTIVE row exists for ``(platform_user_id, unit_id)``, else
    ``'derived'``. It keys on the ROW, never on the org role: the ladder is a floor for GAPS, so an
    Owner carrying an explicit ``Staff`` row is ``Staff`` there — a real demotion, on a real row,
    which must keep its ``assignment_id`` and stay removable. Key it on org role instead and you
    strip the controls off a live assignment.

    ``role`` always comes from ``access.brand_roles_for_org_members`` — never from the stored row's
    own ``role`` — so precedence stays inside the SDK, the one place that decides it.

    Brand-scoped to the CALLER, like :func:`brands_for_user`: a Staff at one brand has no business
    learning who works at a brand they cannot reach. An org Owner/Admin sees everything here, but
    through the ladder rather than a bypass.

    Delivery is own-app scoped, so every projected row is already Prepper's: do NOT filter by
    ``app_id`` locally. ``removed`` rows are KEPT as tombstones by the handler (trap 1) and confer
    nothing. Email / display name come from ``passport_membership``, which EMBEDS them; there is no
    separate user aggregate to join (the snapshot has no users collection).
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

    derived = access.brand_roles_for_org_members(session, organization_id)

    # Scoped to the brands the CALLER can reach — not the org's. Without this a Staff at one brand
    # is handed the name and email of everyone at every brand: 190 rows on staging, where the
    # unscoped version only ever showed 3 because it listed stored rows alone. Derived rows made an
    # existing hole worth closing. `my_reach` is the caller's own derivation; `derived` is everyone
    # else's — two different questions that both go through `roles_at_brands`.
    my_reach = set(access.brand_roles(session, subject))

    # Brands that CARRY Prepper — the same predicate `brands_for_user` uses. A brand with no
    # `unit_app_access` row is somewhere nobody can hold a role, ladder included.
    brands = [
        unit
        for unit in session.exec(
            select(PassportUnit)
            .join(
                PassportUnitAppAccess,
                col(PassportUnitAppAccess.unit_id) == PassportUnit.id,
            )
            .where(
                col(PassportUnit.organization_id) == organization_id,
                PassportUnit.type == _BRAND,
                PassportUnit.status == _ACTIVE,
            )
        ).all()
        if unit.id in my_reach
    ]

    members = {
        m.platform_user_id: m
        for m in session.exec(
            select(PassportMembership).where(
                col(PassportMembership.organization_id) == organization_id,
                PassportMembership.status == _ACTIVE,
            )
        ).all()
    }

    assignments = {
        (a.platform_user_id, a.unit_id): a
        for a in session.exec(
            select(PassportUnitAppMembership).where(
                col(PassportUnitAppMembership.organization_id) == organization_id,
                PassportUnitAppMembership.status == _ACTIVE,
            )
        ).all()
    }

    rows: list[dict[str, object]] = []
    for unit in sorted(brands, key=lambda u: u.name.casefold()):
        for pu, membership in members.items():
            role = derived.get(pu, {}).get(unit.id)
            if role is None:
                continue
            assignment = assignments.get((pu, unit.id))
            rows.append(
                {
                    "assignment_id": assignment.id if assignment else None,
                    "source": "assigned" if assignment else "derived",
                    "platform_user_id": pu,
                    "email": membership.email,
                    "display_name": membership.display_name,
                    "unit_id": unit.id,
                    "unit_name": unit.name,
                    "role": role,
                    "org_role": membership.role,
                    "organization_id": organization_id,
                }
            )
    return rows


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
