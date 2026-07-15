"""SSO issuer cutover — the dark-launched dual-verify path (5.1).

Proves the ONE thing that must be true before the login cutover (5.2) can be a mere config flip:
a token from Passport's shared issuer resolves to the correct LOCAL user, BY VERIFIED EMAIL, and a
Prepper-issued token is entirely unaffected. See
passport docs/specs/2026-07-15-sso-issuer-cutover-prepper-pilot-design.md §4, §5.1.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlmodel import Session

from app.domain.supabase_auth_service import SupabaseAuthService
from app.models import User


def _user(session: Session, *, user_id: str, email: str) -> User:
    u = User(id=user_id, email=email, username=email.split("@")[0])
    session.add(u)
    session.commit()
    return u


def _svc() -> SupabaseAuthService:
    # Build without touching the real Supabase client (its __init__ creates one).
    return SupabaseAuthService.__new__(SupabaseAuthService)


def _settings(**over):
    base = dict(
        sso_enabled=True,
        passport_supabase_url="https://passport.supabase.co",
        supabase_url="https://prepper.supabase.co",
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_passport_token_resolves_by_verified_email():
    """A Passport-signed token's VERIFIED email is returned (the consumer then maps it locally).

    Sub-matching is impossible in a consumer — `platform_user.supabase_id` is never synced — so the
    email claim is the resolution key. The issuer vouches for it, so the match is trustworthy.
    """
    svc = _svc()
    verified = SimpleNamespace(user_id="S_passport", email="Chef@Temper.SG", raw_claims={})

    with (
        patch("app.domain.supabase_auth_service.get_settings", return_value=_settings()),
        patch(
            "app.domain.supabase_auth_service._ebb_verify_token", return_value=verified
        ) as vt,
    ):
        assert svc.verify_passport_identity("tok") == ("S_passport", "Chef@Temper.SG")
        # It verifies against PASSPORT's project, never Prepper's.
        assert vt.call_args.kwargs["supabase_url"] == "https://passport.supabase.co"


def test_disabled_flag_is_a_hard_off_switch():
    """With sso_enabled False the Passport path does nothing — this is the rollback guarantee."""
    svc = _svc()
    with (
        patch(
            "app.domain.supabase_auth_service.get_settings",
            return_value=_settings(sso_enabled=False),
        ),
        patch("app.domain.supabase_auth_service._ebb_verify_token") as vt,
    ):
        assert svc.verify_passport_identity("tok") is None
        vt.assert_not_called()  # never even attempts verification


def test_unconfigured_issuer_is_off():
    svc = _svc()
    with patch(
        "app.domain.supabase_auth_service.get_settings",
        return_value=_settings(passport_supabase_url=None),
    ):
        assert svc.verify_passport_identity("tok") is None


@pytest.mark.parametrize("boom", [ValueError("bad"), RuntimeError("jwks")])
def test_a_bad_passport_token_falls_through_never_raises(boom):
    """A token that fails Passport verification must return None (→ caller falls back to the
    primary issuer), never 500. Adding an issuer must never reject what the primary path accepts."""
    svc = _svc()
    with (
        patch("app.domain.supabase_auth_service.get_settings", return_value=_settings()),
        patch("app.domain.supabase_auth_service._ebb_verify_token", side_effect=boom),
    ):
        assert svc.verify_passport_identity("tok") is None


def test_get_current_user_resolves_a_passport_token_to_the_local_row(session: Session):
    """End to end through the request seam: a Passport token whose verified email matches a local
    user yields that user, keyed by the user's OWN id (no re-key)."""
    from app.api import deps

    _user(session, user_id="S_prepper_local", email="chef@temper.sg")

    # Patch the auth service the dep uses: Passport path returns the email, Prepper path is not hit.
    fake = SimpleNamespace(
        verify_passport_identity=lambda _t: ("S_passport_sub", "chef@temper.sg"),
        verify_token=lambda _t: None,
    )
    with (
        patch("app.api.deps.get_auth_service", return_value=fake),
        patch("app.api.deps.is_org_blocked", return_value=False),
    ):
        user = deps.get_current_user(
            authorization="Bearer sometoken", session=session
        )
    assert user.id == "S_prepper_local", "resolved to the local row, keyed by its own id"


def test_prepper_token_still_works_when_passport_path_misses(session: Session):
    """A Prepper-issued token (Passport path returns None) resolves by the fallback, unchanged."""
    from app.api import deps

    _user(session, user_id="S_prepper_local", email="chef@temper.sg")
    fake = SimpleNamespace(
        verify_passport_identity=lambda _t: None,  # not a Passport token
        verify_token=lambda _t: "S_prepper_local",  # Prepper issuer resolves the sub
    )
    with (
        patch("app.api.deps.get_auth_service", return_value=fake),
        patch("app.api.deps.is_org_blocked", return_value=False),
    ):
        user = deps.get_current_user(
            authorization="Bearer sometoken", session=session
        )
    assert user.id == "S_prepper_local"


def test_sso_login_provisions_a_local_row_for_a_new_member(session: Session):
    """§5.2 — a verified Passport MEMBER with no local row is provisioned at login, keyed by the
    Passport sub. This is the shared `ensure_user` path (also used by interim auto-provisioning)."""
    from app.api import deps
    from app.passport import store

    store.apply_membership(
        session,
        {
            "id": "m-1",
            "organization_id": "org-1",
            "platform_user_id": "pu-1",
            "role": "Member",
            "status": "active",
            "version": 1,
            "email": "newbie@temper.sg",
            "display_name": "Newbie",
        },
    )
    fake = SimpleNamespace(
        verify_passport_identity=lambda _t: ("S_passport_newbie", "newbie@temper.sg"),
        verify_token=lambda _t: None,
    )
    with (
        patch("app.api.deps.get_auth_service", return_value=fake),
        patch("app.api.deps.is_org_blocked", return_value=False),
    ):
        user = deps.get_current_user(authorization="Bearer t", session=session)

    assert user.id == "S_passport_newbie", "new member keyed by the Passport sub"
    assert user.email == "newbie@temper.sg"


def test_sso_login_does_not_provision_a_non_member(session: Session):
    """A verified email that is NOT a Prepper member must not mint a local account — the shared
    issuer can sign tokens for people who aren't members here."""
    from app.api import deps

    fake = SimpleNamespace(
        verify_passport_identity=lambda _t: ("S_passport_x", "stranger@elsewhere.com"),
        verify_token=lambda _t: None,  # not a Prepper token either
    )
    with (
        patch("app.api.deps.get_auth_service", return_value=fake),
        patch("app.api.deps.is_org_blocked", return_value=False),
        pytest.raises(Exception),  # 401: no local user, not a member, no fallback
    ):
        deps.get_current_user(authorization="Bearer t", session=session)


def test_auto_provision_off_is_a_no_op(session: Session):
    """Interim auto-provisioning: with the flag off, a membership event mints nothing."""
    from app.domain import provisioning

    invited = []
    fake_auth = SimpleNamespace(invite_member=lambda e: invited.append(e))
    with (
        patch("app.domain.provisioning.get_settings", return_value=SimpleNamespace(auto_provision_members=False)),
        patch("app.domain.provisioning.get_auth_service", return_value=fake_auth),
    ):
        provisioning.provision_member_login(session, email="x@y.z", display_name=None)
    assert invited == []


def test_auto_provision_creates_a_login_for_a_new_member(session: Session):
    """Flag on + unknown email -> invite + local user created, keyed by the minted Supabase sub."""
    from app.domain import provisioning
    from app.models import User

    fake_auth = SimpleNamespace(invite_member=lambda _e: "minted-sub-123")
    with (
        patch("app.domain.provisioning.get_settings", return_value=SimpleNamespace(auto_provision_members=True)),
        patch("app.domain.provisioning.get_auth_service", return_value=fake_auth),
    ):
        provisioning.provision_member_login(
            session, email="fresh@temper.sg", display_name="Fresh"
        )

    from sqlmodel import select

    row = session.exec(select(User).where(User.email == "fresh@temper.sg")).first()
    assert row is not None and row.id == "minted-sub-123"


def test_auto_provision_skips_an_existing_user(session: Session):
    """Idempotent: a re-synced membership for someone who already has a Prepper login never re-invites."""
    from app.domain import provisioning

    _user(session, user_id="existing", email="already@temper.sg")
    calls = []
    fake_auth = SimpleNamespace(invite_member=lambda e: calls.append(e) or "should-not-be-used")
    with (
        patch("app.domain.provisioning.get_settings", return_value=SimpleNamespace(auto_provision_members=True)),
        patch("app.domain.provisioning.get_auth_service", return_value=fake_auth),
    ):
        provisioning.provision_member_login(session, email="already@temper.sg", display_name=None)
    assert calls == [], "must not invite someone who already has an account"
