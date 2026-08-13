"""Brand-app role roster — READ ONLY, served entirely from the projection.

**Prepper writes nothing to Passport.** Roles and memberships are created, changed and revoked in
Passport's own dashboard; this app projects them and reads them. The write-back routes that used to
live here (assign / change / remove a brand role, and invite a member) were deleted on 2026-08-13
when the app became a read-only consumer — the SDK treats write-back as optional, so this is a
conforming shape rather than a reduced one.

Nothing here calls Passport on the request path. The projection IS the model, so these reads survive
a Passport outage, add no network hop, and do not ``403`` a user who has no identity link yet.
"""

from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import (
    OrgContext,
    get_current_user,
    get_org_context,
    get_session,
)
from app.models import User
from app.passport import directory

router = APIRouter()


@router.get("")
def list_brand_roles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> list[Any]:
    """The brand-app role roster, read from the projection.

    Includes holders derived from the org ladder (an Owner/Admin holds ``Manager`` at every brand
    carrying the app with no stored row at all), not just stored assignments — reading only stored
    rows once showed 3 holders where 190 existed.
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

    A brand with no ``unit_app_access`` row is omitted: it confers access to nobody.
    """
    return list(directory.brands_for_user(session, current_user.id, org.organization_id))


@router.get("/members")
def list_members(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> list[Any]:
    """The org's members, from Passport's membership roster — NOT from Prepper's local ``users``
    table, which may hold accounts Passport has never heard of."""
    return list(directory.assignable_members(session, current_user.id, org.organization_id))
