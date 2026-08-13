"""Role write-back — let Prepper's own users assign ``Manager`` / ``Staff`` at a brand.

Mutations flow UP through the App API (this module) and come back DOWN through sync. Prepper
never writes ``passport_unit_app_membership`` itself: the write returns the new aggregate AND
echoes back as a ``unit_app_membership.*`` event, which the version-guarded handler applies
idempotently. **Never suppress that echo** — a "skip events I caused" filter would make the
delivery scope smaller than the snapshot scope, and nightly reconciliation would then report
permanent phantom drift.

Two gates, in this order:

1. **Prepper's own local role check, FIRST** (``_require_local_authority``). Passport is the
   final gate, not the only one.
2. **Passport's authority matrix**, applied after it verifies the forwarded end-user JWT:

   | actor              | assign            | change a role | remove       |
   |--------------------|-------------------|---------------|--------------|
   | org Owner/Admin    | either role       | yes           | yes          |
   | brand Manager      | ``Staff`` only    | no (403)      | ``Staff`` only |
   | brand Staff / none | no (403)          | no (403)      | no (403)     |

   A ``403`` is therefore a NORMAL outcome, not a bug. A ``409`` means the target unit is not
   a brand (outlets and entities never hold people).

**The acting user is PROVED, not asserted.** Every call forwards the end user's own Supabase
JWT as ``end_user_token`` (sent as ``X-End-User-Token``); an app API key authenticates the
*app* and names no user. There is no ``acting_subject`` kwarg and no ``X-Acting-Subject``
header. Prepper's ``issuer_url`` must be registered in Passport — unregistered ⇒ every call
is a ``403`` (fail closed).
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from passport_client import PassportAPIError, PassportClient
from sqlmodel import Session, select

from app.config import get_settings
from app.models import (
    PassportUnit,
    PassportUnitAppMembership,
    User,
)
from app.passport import access, gate

MANAGER = "Manager"
STAFF = "Staff"
_ROLES = (MANAGER, STAFF)  # the BRAND-app vocabulary

OWNER = "Owner"
ADMIN = "Admin"
MEMBER = "Member"
_ORG_ROLES = (OWNER, ADMIN, MEMBER)  # the ORG vocabulary — a DIFFERENT ladder. Never mix them.


def _require_configured() -> tuple[str, str]:
    """The APP's own credentials. Rule 9: no org id here — the org is an argument, resolved from
    the acting user's membership, because a user may belong to more than one."""
    settings = get_settings()
    if not (settings.passport_api_url and settings.passport_api_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Passport is not configured",
        )
    return settings.passport_api_url, settings.passport_api_key


def _require_local_authority(session: Session, actor: User, unit_id: str | None) -> None:
    """Prepper's OWN check, applied before we ever call Passport.

    Rule 8: read Passport's vocabulary directly. An org Owner/Admin may manage roles anywhere; a
    brand `Manager` may manage roles AT THAT BRAND. Everyone else is refused here.

    ``unit_id`` is the brand the write targets — the check is brand-SCOPED, because there is no
    global "manager": a Manager at Temper has no business assigning roles at Willow. When there is
    no unit in scope (a pure read), org-admin is the only bar.

    Passport re-checks all of this against the VERIFIED end user and applies its own §7 authority
    matrix — a 403 from Passport is a normal outcome. This gate only stops calls Prepper itself
    would never sanction, so that we do not ask Passport to refuse something we already know is
    wrong.
    """
    if access.is_org_admin(session, actor.id):
        return

    if unit_id is not None and access.role_at_unit(session, actor.id, unit_id) == MANAGER:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not permitted to manage roles at this brand",
    )


def _app_id(session: Session, org_id: str) -> str:
    """Prepper's own app UUID, read off the projected entitlement.

    Delivery is own-app scoped, so every entitlement Prepper receives names Prepper — there
    is nothing to configure and nothing to get wrong.

    A thin wrapper over :func:`gate.resolve_app_id`, which returns ``None`` instead of
    raising because the SSO start route cannot answer with a status code. The 503 belongs
    here, on the authenticated write path, not in the shared resolver.
    """
    app_id = gate.resolve_app_id(session, org_id=org_id)
    if app_id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Passport entitlement has not synced yet",
        )
    return app_id


def _org_for_unit(session: Session, unit_id: str) -> str:
    """The org owning a brand. Rule 9: a unit belongs to exactly one org, so the target itself
    names the org — no configured constant, and no way to act across an org boundary."""
    org_id = session.exec(
        select(PassportUnit.organization_id).where(PassportUnit.id == unit_id)
    ).first()
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unknown brand"
        )
    return org_id


def _org_for_assignment(session: Session, assignment_id: str) -> str:
    """The org owning an existing role row — same rule, resolved from the stored assignment."""
    org_id = session.exec(
        select(PassportUnitAppMembership.organization_id).where(
            PassportUnitAppMembership.id == assignment_id
        )
    ).first()
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unknown role assignment"
        )
    return org_id


def _unit_of_assignment(session: Session, assignment_id: str) -> str | None:
    """The brand an existing role row targets — so the local check can be brand-scoped."""
    return session.exec(
        select(PassportUnitAppMembership.unit_id).where(
            PassportUnitAppMembership.id == assignment_id
        )
    ).first()


def _actor_orgs(session: Session, actor: User) -> list[str]:
    """Every org the acting user belongs to (rule 9 — a user may belong to more than one)."""
    platform_user_id = access.platform_user_id_for(session, actor.id)
    if platform_user_id is None:
        return []
    return access.orgs_for_platform_user(session, platform_user_id)


def _require_role(role: str) -> None:
    if role not in _ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"role must be one of {', '.join(_ROLES)}",
        )


def _require_org_role(role: str) -> None:
    """The ORG vocabulary. :func:`_require_role` is the BRAND one — two functions, not one
    parametrised guard, because passing a role to the wrong one yields a 422 that reads correct."""
    if role not in _ORG_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"role must be one of {', '.join(_ORG_ROLES)}",
        )


def _client(base_url: str, api_key: str) -> PassportClient:
    return PassportClient(base_url=base_url, api_key=api_key)


def _reraise(exc: PassportAPIError) -> HTTPException:
    """Surface Passport's verdict verbatim. ``403`` (authority matrix / unregistered issuer)
    and ``409`` (unit is not a brand) are expected outcomes and are passed straight through;
    the detail never carries a token."""
    return HTTPException(status_code=exc.status_code, detail=str(exc.detail))



async def assign_brand_role(
    session: Session,
    *,
    actor: User,
    platform_user_id: str,
    unit_id: str,
    role: str,
    end_user_token: str,
) -> Any:
    """Assign ``role`` to a platform user at a BRAND. ``409`` if the unit is not a brand."""
    base_url, api_key = _require_configured()
    org_id = _org_for_unit(session, unit_id)  # rule 9: the brand names its org
    _require_local_authority(session, actor, unit_id)
    _require_role(role)
    app_id = _app_id(session, org_id)

    try:
        async with _client(base_url, api_key) as pc:
            return await pc.assign_unit_app_role(
                org_id,
                platform_user_id=platform_user_id,
                unit_id=unit_id,
                app_id=app_id,
                role=role,
                end_user_token=end_user_token,
            )
    except PassportAPIError as exc:
        raise _reraise(exc) from exc


async def change_brand_role(
    session: Session,
    *,
    actor: User,
    assignment_id: str,
    role: str,
    end_user_token: str,
) -> Any:
    """Change an existing assignment's role. Brand Managers cannot do this (``403``) —
    changing a role is Owner/Admin territory. No ``app_id``: the server reads it off the row."""
    base_url, api_key = _require_configured()
    org_id = _org_for_assignment(session, assignment_id)  # rule 9: the row names its org
    _require_local_authority(session, actor, _unit_of_assignment(session, assignment_id))
    _require_role(role)

    try:
        async with _client(base_url, api_key) as pc:
            return await pc.set_unit_app_role(
                org_id, assignment_id, role=role, end_user_token=end_user_token
            )
    except PassportAPIError as exc:
        raise _reraise(exc) from exc


async def remove_brand_role(
    session: Session, *, actor: User, assignment_id: str, end_user_token: str
) -> Any:
    """Remove an assignment. Returns ``200`` with the FINAL aggregate (``status="removed"``)
    — a tombstone, not a delete; the projection keeps the row."""
    base_url, api_key = _require_configured()
    org_id = _org_for_assignment(session, assignment_id)  # rule 9: the row names its org
    _require_local_authority(session, actor, _unit_of_assignment(session, assignment_id))

    try:
        async with _client(base_url, api_key) as pc:
            return await pc.remove_unit_app_role(
                org_id, assignment_id, end_user_token=end_user_token
            )
    except PassportAPIError as exc:
        raise _reraise(exc) from exc


async def invite_member(
    session: Session,
    *,
    actor: User,
    organization_id: str,
    email: str,
    display_name: str | None,
    role: str,
    end_user_token: str,
) -> Any:
    """Invite someone into the org — or update their org role if Passport already knows them.

    ``role`` is the ORG vocabulary: ``Owner`` | ``Admin`` | ``Member``. NOT ``Manager``/``Staff``.

    Passing ``email`` for someone Passport has never seen is what CREATES the platform user; the
    SDK has no separate ``create_user``. Exactly one of email / platform_user_id may be sent — it
    raises ``ValueError`` otherwise — and this only ever sends email.

    **Writes NOTHING locally.** The call returns the aggregate AND Passport echoes a
    ``membership.*`` event that the version-guarded handler applies. Writing the returned aggregate
    into the projection here is the suppressed-echo mistake this module's header forbids. The
    practical consequence for callers: the new member does not appear until sync delivers them, so
    the UI must say so rather than insert optimistically.

    Unlike :func:`_require_local_authority`, this asks the ORG-SCOPED admin question. That helper's
    org-less ``is_org_admin`` call is a sanctioned exception only because Passport re-checks against
    the verified end user; there is no reason to inherit it when the caller has an acting org in
    hand, and the org-less form would let an Owner of org B invite into org A.

    Passport applies its own authority matrix after this one, so a ``403`` is a NORMAL outcome —
    an Admin may not necessarily grant ``Owner``.
    """
    base_url, api_key = _require_configured()
    if not access.is_org_admin(session, actor.id, organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted to manage members of this organisation",
        )
    _require_org_role(role)

    try:
        async with _client(base_url, api_key) as pc:
            return await pc.upsert_membership(
                organization_id,
                email=email,
                display_name=display_name,
                role=role,
                end_user_token=end_user_token,
            )
    except PassportAPIError as exc:
        raise _reraise(exc) from exc
