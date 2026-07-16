"""Org context — which organisation is the caller acting in, and may they?

Prepper projects EVERY org Passport delivers, and a user may belong to more than one. Brand-scoped
reads need no active org (a brand id already carries its org), but everything not brand-scoped does
— so the org travels on `X-Organization-Id` and is proved against the projection per request.

The header PROPOSES; the projection DISPOSES. A forged header is a 403, not a scope.
"""

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.deps import get_org_context
from app.passport import access
from tests.conftest import (
    ORG_ID,
    create_user,
    grant_org_role,
    link_identity,
    make_org_admin,
    seed_entitlement,
    store,
)

OTHER_ORG = "org-other"


def _member_of(session: Session, user_id: str, *orgs: str) -> str:
    """A user with an ACTIVE membership in each of `orgs`. Returns their platform_user_id."""
    create_user(session, user_id, user_id)
    pu_id = f"pu-{user_id}"
    link_identity(session, user_id, pu_id)
    for org in orgs:
        grant_org_role(session, pu_id, "Member", org_id=org)
        seed_entitlement(session, org)
    return pu_id


# =============================================================================
# is_org_admin / org_role — the cross-org bug
# =============================================================================


def test_owner_of_one_org_is_not_admin_of_another(session: Session):
    """THE BUG: `org_role` selected memberships with no `organization_id` predicate.

    An Owner of org B was therefore an "org admin" while acting in org A, and took the unfiltered
    branch in tasting sessions, the ingredient service and the supplier service.
    """
    pu_id = f"pu-{'owner-b'}"
    create_user(session, "owner-b", "ownerb")
    link_identity(session, "owner-b", pu_id)
    grant_org_role(session, pu_id, "Owner", org_id=OTHER_ORG)
    grant_org_role(session, pu_id, "Member", org_id=ORG_ID)

    assert access.is_org_admin(session, "owner-b", OTHER_ORG) is True
    assert access.is_org_admin(session, "owner-b", ORG_ID) is False, (
        "an Owner of another org must not administer this one"
    )


def test_org_role_is_read_per_org(session: Session):
    """The role is per-org, so it must be asked per-org — not 'strongest across all orgs'."""
    pu_id = "pu-multi"
    create_user(session, "multi", "multi")
    link_identity(session, "multi", pu_id)
    grant_org_role(session, pu_id, "Owner", org_id=OTHER_ORG)
    grant_org_role(session, pu_id, "Member", org_id=ORG_ID)

    assert access.org_role(session, "multi", OTHER_ORG) == "Owner"
    assert access.org_role(session, "multi", ORG_ID) == "Member"


def test_org_role_is_none_for_an_org_the_user_does_not_belong_to(session: Session):
    create_user(session, "solo", "solo")
    link_identity(session, "solo", "pu-solo")
    grant_org_role(session, "pu-solo", "Owner", org_id=ORG_ID)

    assert access.org_role(session, "solo", OTHER_ORG) is None
    assert access.is_org_admin(session, "solo", OTHER_ORG) is False


# =============================================================================
# get_org_context — selecting the acting org
# =============================================================================


def test_single_org_user_needs_no_header(session: Session):
    """A user with exactly one org never has to think about org selection."""
    user = make_org_admin(session, "solo-admin", "soloadmin")

    ctx = get_org_context(user=user, x_organization_id=None, session=session)

    assert ctx.organization_id == ORG_ID
    assert ctx.user.id == user.id


def test_multi_org_user_must_name_the_org(session: Session):
    """With more than one org there is no safe default — refuse rather than guess.

    Picking one arbitrarily would silently write a recipe into the wrong tenant.
    """
    _member_of(session, "multi-user", ORG_ID, OTHER_ORG)
    user = create_user(session, "multi-user", "multi-user")

    with pytest.raises(HTTPException) as exc:
        get_org_context(user=user, x_organization_id=None, session=session)

    assert exc.value.status_code == 400


def test_multi_org_user_gets_the_org_they_name(session: Session):
    _member_of(session, "multi-user", ORG_ID, OTHER_ORG)
    user = create_user(session, "multi-user", "multi-user")

    assert (
        get_org_context(
            user=user, x_organization_id=OTHER_ORG, session=session
        ).organization_id
        == OTHER_ORG
    )
    assert (
        get_org_context(
            user=user, x_organization_id=ORG_ID, session=session
        ).organization_id
        == ORG_ID
    )


def test_a_forged_org_header_is_rejected(session: Session):
    """The header is client-supplied. Membership is re-derived from the projection every request,
    so naming an org you do not belong to is a 403 — never a scope."""
    make_org_admin(session, "solo-admin", "soloadmin")
    user = create_user(session, "solo-admin", "soloadmin")

    with pytest.raises(HTTPException) as exc:
        get_org_context(user=user, x_organization_id=OTHER_ORG, session=session)

    assert exc.value.status_code == 403


def test_user_with_no_orgs_is_refused(session: Session):
    """No membership, no org, no scope. Fail closed."""
    user = create_user(session, "orphan", "orphan")
    link_identity(session, "orphan", "pu-orphan")

    with pytest.raises(HTTPException) as exc:
        get_org_context(user=user, x_organization_id=None, session=session)

    assert exc.value.status_code == 403


def test_user_with_no_passport_identity_is_refused(session: Session):
    """Org scoping is derived from Passport. Someone Passport has never heard of cannot be scoped,
    and inventing a local org concept is precisely what this architecture refuses."""
    user = create_user(session, "stranger", "stranger", email="stranger@nowhere.com")

    with pytest.raises(HTTPException) as exc:
        get_org_context(user=user, x_organization_id=None, session=session)

    assert exc.value.status_code == 403


def test_unlinked_user_resolves_by_email(session: Session):
    """The SSO sync-lag window: `report_identity_link_safe` is best-effort and asynchronous
    (auth.py:98-100), so a freshly-logged-in SSO user has NO identity link on this request.

    Without the email fallback every such user would 403 on every org-scoped route until sync
    landed. `auth.py:90` already trusts this exact resolution at login.
    """
    create_user(session, "sso-user", "ssouser", email="chef@temper.sg")
    # A membership exists (Passport knows them) but the identity link has not synced yet.
    store.apply_membership(
        session,
        {
            "id": "mem-sso",
            "organization_id": ORG_ID,
            "platform_user_id": "pu-sso",
            "role": "Member",
            "status": "active",
            "version": 1,
            "email": "chef@temper.sg",
            "display_name": "Chef",
        },
    )
    seed_entitlement(session, ORG_ID)
    user = create_user(session, "sso-user", "ssouser", email="chef@temper.sg")

    assert access.platform_user_id_for(session, "sso-user") is None, (
        "precondition: no link yet"
    )

    ctx = get_org_context(user=user, x_organization_id=None, session=session)

    assert ctx.organization_id == ORG_ID


# =============================================================================
# Entitlement kill switch — now per-org
# =============================================================================


def test_suspended_org_is_blocked_even_when_another_org_is_healthy(session: Session):
    """`is_org_blocked` only 403s when EVERY org is suspended — it is an any-org question.

    Under org context the question is per-org: acting in a suspended org is blocked regardless of
    how healthy your other orgs are. That is what an entitlement kill switch means.
    """
    pu_id = _member_of(session, "multi-user", ORG_ID)
    grant_org_role(session, pu_id, "Member", org_id=OTHER_ORG)
    store.apply_entitlement(
        session,
        {
            "id": "ent-suspended",
            "organization_id": OTHER_ORG,
            "app_id": "prepper",
            "status": "suspended",
            "tier": "pro",
            "source": "admin",
            "version": 1,
        },
    )
    user = create_user(session, "multi-user", "multi-user")

    # The healthy org still works.
    assert (
        get_org_context(
            user=user, x_organization_id=ORG_ID, session=session
        ).organization_id
        == ORG_ID
    )

    with pytest.raises(HTTPException) as exc:
        get_org_context(user=user, x_organization_id=OTHER_ORG, session=session)

    assert exc.value.status_code == 403
