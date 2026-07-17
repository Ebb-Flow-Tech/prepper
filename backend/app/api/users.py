"""User API routes."""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import OrgContext, get_current_user, get_org_context, get_session
from app.domain.user_service import UserService
from app.models.user import User, UserRead, UserUpdate

router = APIRouter()


@router.get("")
def list_users(
    email: str | None = Query(None),
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """People in the organisation the caller is acting in, paginated.

    This returned every user in the instance — email, username and phone number — to any
    authenticated caller, unpaginated, and `?email=` made it a targeted lookup oracle on top.

    Scoped to the ACTING org via the Passport projection. It used to return the union of the
    caller's orgs, which never exposed a stranger but did put two unrelated customers' rosters —
    email and phone — in one response for anyone who belonged to both.
    """
    from app.models.pagination import PaginatedResponse

    service = UserService(session)
    offset = (page_number - 1) * page_size
    items, total = service.list_users_paginated(
        current_user.id, org.organization_id, offset=offset, limit=page_size, email=email
    )
    return PaginatedResponse.create(
        items=[UserRead.model_validate(u) for u in items],
        total_count=total,
        page_number=page_number,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Get a user by ID, within the acting org.

    404 rather than 403 for someone outside it: that a person exists in another tenant is not
    yours to learn, and the response would otherwise confirm an email address by id.
    """
    service = UserService(session)
    user = service.get_user_in_org(user_id, current_user.id, org.organization_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a user. A user may only update themselves.

    403 rather than 404: the caller is authenticated and the row's existence is not a secret from
    them — they simply may not write to it.

    This route is deliberately NOT org-scoped. A brand-new registrant has no Passport identity
    link or membership yet, so no org context can be established for them, and
    `register/page.tsx` calls this immediately after login to set a phone number. It edits your
    own user row, which is org-agnostic by nature.
    """
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own account",
        )

    service = UserService(session)
    try:
        return service.update_user(user_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
