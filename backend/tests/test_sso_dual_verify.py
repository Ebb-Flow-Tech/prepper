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
        assert svc.verify_passport_email("tok") == "Chef@Temper.SG"
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
        assert svc.verify_passport_email("tok") is None
        vt.assert_not_called()  # never even attempts verification


def test_unconfigured_issuer_is_off():
    svc = _svc()
    with patch(
        "app.domain.supabase_auth_service.get_settings",
        return_value=_settings(passport_supabase_url=None),
    ):
        assert svc.verify_passport_email("tok") is None


@pytest.mark.parametrize("boom", [ValueError("bad"), RuntimeError("jwks")])
def test_a_bad_passport_token_falls_through_never_raises(boom):
    """A token that fails Passport verification must return None (→ caller falls back to the
    primary issuer), never 500. Adding an issuer must never reject what the primary path accepts."""
    svc = _svc()
    with (
        patch("app.domain.supabase_auth_service.get_settings", return_value=_settings()),
        patch("app.domain.supabase_auth_service._ebb_verify_token", side_effect=boom),
    ):
        assert svc.verify_passport_email("tok") is None


def test_get_current_user_resolves_a_passport_token_to_the_local_row(session: Session):
    """End to end through the request seam: a Passport token whose verified email matches a local
    user yields that user, keyed by the user's OWN id (no re-key)."""
    from app.api import deps

    _user(session, user_id="S_prepper_local", email="chef@temper.sg")

    # Patch the auth service the dep uses: Passport path returns the email, Prepper path is not hit.
    fake = SimpleNamespace(
        verify_passport_email=lambda _t: "chef@temper.sg",
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
        verify_passport_email=lambda _t: None,  # not a Passport token
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
