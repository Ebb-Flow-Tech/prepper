"""Brand-app role management — write-back to Passport.

Prepper does not own these rows: the write goes UP to Passport via the SDK and the result
comes back DOWN through sync, which is what actually updates
``passport_unit_app_membership``. These routes therefore return Passport's aggregate directly
and write nothing locally.

Every route forwards the caller's own Supabase JWT so Passport can prove who is acting. A
``403`` from Passport (its authority matrix, or Prepper's ``issuer_url`` not being registered)
and a ``409`` (the target unit is not a brand) are passed through unchanged — they are normal
outcomes, not failures to paper over.
"""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import (
    OrgContext,
    get_bearer_token,
    get_current_user,
    get_org_context,
    get_session,
)
from app.models import User
from app.passport import directory, writeback

router = APIRouter()


class AssignRoleRequest(BaseModel):
    """``unit_id`` MUST be a brand — outlets and entities never hold people."""

    platform_user_id: str
    unit_id: str
    role: str  # Manager | Staff


class SetRoleRequest(BaseModel):
    role: str  # Manager | Staff


@router.get("")
def list_brand_roles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> list[Any]:
    """The brand-app role roster, READ FROM THE PROJECTION — not from Passport.

    Deliberately does not call Passport on the request path: the projection IS the model, so this
    survives a Passport outage, adds no network hop, and does not ``403`` for a user who has no
    identity link yet. Mutations below still go up via write-back.
    """
    return list(directory.roster(session, current_user.id, org.organization_id))


@router.get("/brands")
def list_brands(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> list[Any]:
    """Active brands carrying Prepper in the ACTING org, with the caller's role at each.

    Narrowed to the org being acted in, not the union of the caller's orgs — the switcher is
    what changes this list, so a union would make the switcher decorative.

    Brands are where people are assigned — outlets and entities never hold roles. A brand with no
    ``unit_app_access`` row is omitted: it confers access to nobody, so it is not somewhere a role
    can be given.
    """
    return list(directory.brands_for_user(session, current_user.id, org.organization_id))


@router.get("/members")
def list_members(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> list[Any]:
    """Org members who can be given a brand role — from Passport's membership roster, NOT from
    Prepper's local ``users`` table (which may hold accounts Passport has never heard of)."""
    return list(directory.assignable_members(session, current_user.id, org.organization_id))


@router.post("", status_code=201)
async def assign_brand_role(
    data: AssignRoleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_bearer_token),
) -> Any:
    """Assign ``Manager``/``Staff`` to a platform user at a brand."""
    return await writeback.assign_brand_role(
        session,
        actor=current_user,
        platform_user_id=data.platform_user_id,
        unit_id=data.unit_id,
        role=data.role,
        end_user_token=token,
    )


@router.patch("/{assignment_id}")
async def change_brand_role(
    assignment_id: str,
    data: SetRoleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_bearer_token),
) -> Any:
    """Change an existing assignment's role (Owner/Admin only, per Passport's matrix)."""
    return await writeback.change_brand_role(
        session,
        actor=current_user,
        assignment_id=assignment_id,
        role=data.role,
        end_user_token=token,
    )


@router.delete("/{assignment_id}")
async def remove_brand_role(
    assignment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_bearer_token),
) -> Any:
    """Remove an assignment. Passport returns the FINAL aggregate (``status="removed"``) — a
    tombstone, not a delete."""
    return await writeback.remove_brand_role(
        session,
        actor=current_user,
        assignment_id=assignment_id,
        end_user_token=token,
    )
