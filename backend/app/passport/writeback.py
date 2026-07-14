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
    PassportEntitlement,
    PassportUnit,
    PassportUnitAppMembership,
    User,
    UserType,
)
from app.passport import access

MANAGER = "Manager"
STAFF = "Staff"
_ROLES = (MANAGER, STAFF)


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


def _require_local_authority(actor: User) -> None:
    """Prepper's OWN check, applied before we ever call Passport.

    Admins and managers may attempt a role change; everyone else is refused here. Passport
    still re-checks against the verified end user — this gate only stops calls Prepper itself
    would never sanction.
    """
    if actor.user_type != UserType.ADMIN and not actor.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted to manage roles",
        )


def _app_id(session: Session, org_id: str) -> str:
    """Prepper's own app UUID, read off the projected entitlement.

    Delivery is own-app scoped, so every entitlement Prepper receives names Prepper — there
    is nothing to configure and nothing to get wrong.
    """
    app_id = session.exec(
        select(PassportEntitlement.app_id).where(
            PassportEntitlement.organization_id == org_id
        )
    ).first()
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


def _client(base_url: str, api_key: str) -> PassportClient:
    return PassportClient(base_url=base_url, api_key=api_key)


def _reraise(exc: PassportAPIError) -> HTTPException:
    """Surface Passport's verdict verbatim. ``403`` (authority matrix / unregistered issuer)
    and ``409`` (unit is not a brand) are expected outcomes and are passed straight through;
    the detail never carries a token."""
    return HTTPException(status_code=exc.status_code, detail=str(exc.detail))


async def list_brand_roles(
    session: Session, *, actor: User, end_user_token: str
) -> list[Any]:
    """Every brand-app role row across every org the actor belongs to (own-app scoped by
    delivery). Rule 9: fanned out over the actor's orgs, not a configured one."""
    base_url, api_key = _require_configured()
    _require_local_authority(actor)

    rows: list[Any] = []
    try:
        async with _client(base_url, api_key) as pc:
            for org_id in _actor_orgs(session, actor):
                page = await pc.list_unit_app_memberships(
                    org_id, end_user_token=end_user_token
                )
                rows.extend(page.items)
    except PassportAPIError as exc:
        raise _reraise(exc) from exc

    return rows


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
    _require_local_authority(actor)
    _require_role(role)
    org_id = _org_for_unit(session, unit_id)  # rule 9: the brand names its org
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
    _require_local_authority(actor)
    _require_role(role)
    org_id = _org_for_assignment(session, assignment_id)  # rule 9: the row names its org

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
    _require_local_authority(actor)
    org_id = _org_for_assignment(session, assignment_id)  # rule 9: the row names its org

    try:
        async with _client(base_url, api_key) as pc:
            return await pc.remove_unit_app_role(
                org_id, assignment_id, end_user_token=end_user_token
            )
    except PassportAPIError as exc:
        raise _reraise(exc) from exc
