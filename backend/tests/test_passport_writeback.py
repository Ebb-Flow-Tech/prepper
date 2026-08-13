"""Tests for Passport role write-back.

Two things must hold and neither is observable from a green response:

- **The end user's own JWT is forwarded** as ``end_user_token``. The acting user is PROVED,
  not asserted — an app API key authenticates the *app* and names no user. Drop the token and
  Passport 403s everything; there is no ``acting_subject`` fallback.
- **Prepper's own role check runs FIRST.** Passport is the final gate, not the only one.

Passport's ``403`` (authority matrix / unregistered ``issuer_url``) and ``409`` (the unit is
not a brand) are NORMAL outcomes and must surface unchanged, not be swallowed.
"""

import asyncio
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from passport_client import PassportAPIError
from sqlmodel import Session, select

from app.models import User
from app.passport import store, writeback
from tests.conftest import grant_org_role, link_identity

ORG = "org-1"
BRAND = "brand-1"
TOKEN = "the-end-user-jwt"
ACTOR = "sub-1"
ACTOR_PU = "pu-actor"


class _FakeClient:
    """Records the kwargs the SDK was called with, so we can assert the token is forwarded."""

    calls: list[tuple] = []

    def __init__(self, *, raises: PassportAPIError | None = None):
        self._raises = raises

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def assign_unit_app_role(self, org_id, **kwargs):
        if self._raises:
            raise self._raises
        _FakeClient.calls.append(("assign", org_id, kwargs))
        return {"id": "uam-1", **kwargs}

    async def remove_unit_app_role(self, org_id, assignment_id, **kwargs):
        if self._raises:
            raise self._raises
        _FakeClient.calls.append(("remove", org_id, assignment_id, kwargs))
        return {"id": assignment_id, "status": "removed"}

    async def upsert_membership(self, org_id, **kwargs):
        if self._raises:
            raise self._raises
        _FakeClient.calls.append(("upsert_membership", org_id, kwargs))
        return {"id": "m-new", "organization_id": org_id, "status": "active", **kwargs}


def _configured():
    from types import SimpleNamespace

    return patch.object(
        writeback,
        "get_settings",
        return_value=SimpleNamespace(
            passport_api_url="https://passport.test",
            passport_api_key="key",
        ),
    )


ASSIGNMENT = "uam-1"


def _entitlement(session: Session) -> None:
    """The projected entitlement is where Prepper's own app_id comes from — delivery is
    own-app scoped, so the entitlement names us. Nothing to configure.

    Rule 9: also seeds the BRAND and an existing role row, because the org is now derived from the
    TARGET (a unit belongs to exactly one org; an assignment names its org) rather than from a
    configured constant. That is what makes acting across an org boundary unrepresentable.
    """
    store.apply_entitlement(
        session,
        {
            "id": "e-1",
            "organization_id": ORG,
            "app_id": "prepper-app-uuid",
            "status": "active",
            "tier": "pro",
            "source": "admin",
            "version": 1,
        },
    )
    store.apply_unit(
        session,
        {
            "id": BRAND,
            "organization_id": ORG,
            "type": "brand",
            "name": "Acme",
            "external_ref": None,
            "status": "active",
            "version": 1,
        },
    )
    store.apply_unit_app_membership(
        session,
        {
            "id": ASSIGNMENT,
            "organization_id": ORG,
            "platform_user_id": "pu-1",
            "unit_id": BRAND,
            "app_id": "prepper-app-uuid",
            "role": "Staff",
            "status": "active",
            "version": 1,
        },
    )


def _actor(session: Session, *, admin: bool = True) -> User:
    """The acting user. Their authority is Passport's, derived from the projection — the `users`
    row carries no role at all, so an admin actor is one we SEED an ``Admin`` membership for.

    A non-admin actor is seeded with nothing: no identity link, no membership, no brand role. They
    derive nothing and are refused — fail closed.
    """
    if admin:
        link_identity(session, ACTOR, ACTOR_PU)
        grant_org_role(session, ACTOR_PU, "Admin", org_id=ORG)

    return User(id=ACTOR, email="chef@acme.test", username="chef")


def test_assign_forwards_the_end_user_token_and_own_app_id(session: Session):
    _FakeClient.calls = []
    _entitlement(session)

    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        asyncio.run(
            writeback.assign_brand_role(
                session,
                actor=_actor(session),
                platform_user_id="pu-1",
                unit_id=BRAND,
                role="Staff",
                end_user_token=TOKEN,
            )
        )

    kind, org_id, kwargs = _FakeClient.calls[0]
    assert kind == "assign" and org_id == ORG
    assert kwargs["end_user_token"] == TOKEN, "the end user's own JWT must be forwarded"
    assert kwargs["app_id"] == "prepper-app-uuid"  # read off the projected entitlement
    assert kwargs["role"] == "Staff"


def test_local_role_check_runs_before_passport_is_called(session: Session):
    _FakeClient.calls = []
    _entitlement(session)

    # A plain user is refused by PREPPER — Passport is never even contacted.
    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.assign_brand_role(
                    session,
                    actor=_actor(session, admin=False),
                    platform_user_id="pu-1",
                    unit_id=BRAND,
                    role="Staff",
                    end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 403
    assert _FakeClient.calls == [], "Prepper must refuse locally before calling Passport"


def test_passport_403_surfaces_unchanged(session: Session):
    """A 403 is a NORMAL outcome (the authority matrix, or an unregistered issuer_url) — it
    must reach the caller, not be swallowed into a 500 or silently ignored."""
    _entitlement(session)
    denied = PassportAPIError(403, "brand Manager cannot change a peer's role")

    with _configured(), patch.object(
        writeback, "_client", lambda *_: _FakeClient(raises=denied)
    ):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.remove_brand_role(
                    session,
                    actor=_actor(session),
                    assignment_id="uam-1",
                    end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 403


def test_invalid_role_is_rejected_before_the_call(session: Session):
    _FakeClient.calls = []
    _entitlement(session)

    # Manager | Staff is the brand-app vocabulary — Owner/Admin/Member is the ORG one. Never
    # conflate them.
    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.assign_brand_role(
                    session,
                    actor=_actor(session),
                    platform_user_id="pu-1",
                    unit_id=BRAND,
                    role="Admin",
                    end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 422
    assert _FakeClient.calls == []


# --- invite_member: org membership, written UP -----------------------------------------------
# The ORG vocabulary (Owner|Admin|Member), NOT the brand one (Manager|Staff). The two tuples look
# identical at a glance and mean unrelated things — models/passport.py:164-186 says so outright.
#
# Ordering matters beyond this module: assign_unit_app_role 409s if the target holds no active org
# membership, so a brand role cannot bootstrap a member. Invite first, assign second.

INVITEE = "newchef@acme.test"


def test_invite_member_forwards_the_end_user_token(session: Session):
    _FakeClient.calls = []

    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        asyncio.run(
            writeback.invite_member(
                session,
                actor=_actor(session),
                organization_id=ORG,
                email=INVITEE,
                display_name="New Chef",
                role="Member",
                end_user_token=TOKEN,
            )
        )

    kind, org_id, kwargs = _FakeClient.calls[0]
    assert kind == "upsert_membership" and org_id == ORG
    assert kwargs["end_user_token"] == TOKEN, "the end user's own JWT must be forwarded"
    assert kwargs["email"] == INVITEE
    assert kwargs["role"] == "Member"
    # EXACTLY ONE identifier: the SDK raises ValueError if email and platform_user_id are both set.
    assert "platform_user_id" not in kwargs


def test_invite_member_refuses_a_non_admin_before_calling_passport(session: Session):
    """Prepper's own check runs FIRST. Passport is the final gate, not the only one."""
    _FakeClient.calls = []

    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.invite_member(
                    session,
                    actor=_actor(session, admin=False),
                    organization_id=ORG,
                    email=INVITEE,
                    display_name=None,
                    role="Member",
                    end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 403
    assert _FakeClient.calls == [], "must not reach the SDK at all"


@pytest.mark.parametrize("bad_role", ["Manager", "Staff", "owner", "", "Superuser"])
def test_invite_member_rejects_the_brand_vocabulary(session: Session, bad_role: str):
    """Manager/Staff are BRAND roles. An org membership takes Owner|Admin|Member."""
    _FakeClient.calls = []

    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.invite_member(
                    session,
                    actor=_actor(session),
                    organization_id=ORG,
                    email=INVITEE,
                    display_name=None,
                    role=bad_role,
                    end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 422
    assert _FakeClient.calls == []


def test_invite_member_writes_nothing_locally(session: Session):
    """Prepper NEVER writes the projection — the sync echo does. Suppressing that echo would make
    delivery scope smaller than snapshot scope and reconcile would report permanent phantom drift.
    """
    from app.models import PassportMembership

    actor = _actor(session)
    before = len(session.exec(select(PassportMembership)).all())

    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient()):
        asyncio.run(
            writeback.invite_member(
                session,
                actor=actor,
                organization_id=ORG,
                email=INVITEE,
                display_name=None,
                role="Member",
                end_user_token=TOKEN,
            )
        )

    assert len(session.exec(select(PassportMembership)).all()) == before


def test_invite_member_surfaces_passports_verdict_verbatim(session: Session):
    """A 403 is a NORMAL outcome — Passport's authority matrix, applied to the verified end user."""
    err = PassportAPIError(status_code=403, detail="actor may not grant Owner")

    with _configured(), patch.object(writeback, "_client", lambda *_: _FakeClient(raises=err)):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                writeback.invite_member(
                    session,
                    actor=_actor(session),
                    organization_id=ORG,
                    email=INVITEE,
                    display_name=None,
                    role="Owner",
                    end_user_token=TOKEN,
                )
            )

    assert exc.value.status_code == 403
    assert "may not grant Owner" in str(exc.value.detail)
    assert TOKEN not in str(exc.value.detail), "never echo the end user's token"
