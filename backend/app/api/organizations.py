"""Organizations — the orgs the caller may act in.

The only route that returns org NAMES to the client. `passport.organization` has been projected
since the sync consumer landed and nothing read it, so the frontend carried `organization_id` on
three payloads and could never render a name.

Feeds the org switcher and Profile's Organisation section.
"""

from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import _platform_user_for, get_current_user, get_session
from app.models import User
from app.passport import directory

router = APIRouter()


@router.get("")
def list_organizations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[Any]:
    """Every org the caller actively belongs to, with its name and their role in it.

    Gated by ``get_current_user``, NOT ``get_org_context``: this is the route that tells the client
    which orgs it may select, so requiring an already-selected org would be circular. It is
    correctly org-agnostic — it returns the caller's own set by definition.

    Resolves the platform user via ``_platform_user_for`` (link, then verified email) so it agrees
    with ``get_org_context`` exactly. A freshly-logged-in SSO user has no identity link yet — the
    link is written asynchronously — and a link-only lookup here would hand them an empty list, so
    the app shell would have no org to select and they could not proceed, while every other route
    resolved them fine.

    An empty list is a valid answer, not an error: the caller is authenticated and simply belongs
    to nothing. A 403 would be indistinguishable from a bug to the client.
    """
    platform_user_id = _platform_user_for(session, current_user)
    if platform_user_id is None:
        return []
    return list(
        directory.organizations_for_user(
            session, current_user.id, platform_user_id=platform_user_id
        )
    )
