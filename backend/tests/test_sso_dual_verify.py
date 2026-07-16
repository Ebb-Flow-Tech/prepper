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
    # Bypass __init__ so no settings are read at all — these tests patch `get_settings` per-case.
    # (__init__ no longer builds a Supabase client; `client` is a lazy property. This `__new__` was
    # originally a workaround for exactly that eager construction.)
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
        user = deps._resolve_current_user(session, "Bearer sometoken")
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
        user = deps._resolve_current_user(session, "Bearer sometoken")
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
        user = deps._resolve_current_user(session, "Bearer t")

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
        deps._resolve_current_user(session, "Bearer t")


# --- 5.2 LOGIN-PROXY: Prepper's login page authenticates against Passport -----------------------


def _login_settings(**over):
    base = dict(
        sso_enabled=True,
        passport_supabase_url="https://passport.supabase.co",
        passport_supabase_anon_key="anon-key",
        supabase_url="https://prepper.supabase.co",
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_sso_login_works_without_preppers_own_supabase_key():
    """The SSO login-proxy must not depend on a client it never uses.

    `login_via_passport` talks to PASSPORT's project via `_get_passport_supabase_client`. Prepper's
    own client is only needed for storage and `auth.admin.create_user`. But `__init__` built it
    eagerly, so `SupabaseAuthService()` raised `ValueError("Supabase credentials not configured")`
    whenever `supabase_key` was unset — and `api/auth.py:49` turns that into a 503. The SSO path was
    fully configured and could not run, blocked by a client it would never have touched.

    Found by running the app: login 503'd with both PASSPORT_SUPABASE_* set and SSO on.
    """
    from app.domain import supabase_auth_service as mod

    mod._get_supabase_client.cache_clear()
    settings = _login_settings(supabase_key=None, supabase_jwt_secret=None)
    with patch("app.domain.supabase_auth_service.get_settings", return_value=settings):
        svc = SupabaseAuthService()  # must not raise
        assert svc.sso_login_enabled is True


def test_preppers_own_client_still_raises_when_actually_used():
    """Laziness must defer the error, not swallow it.

    A path that genuinely needs Prepper's project (storage, admin user creation) must still fail
    loudly when the key is absent — otherwise this fix trades a startup 503 for a confusing
    AttributeError deep inside the supabase SDK.
    """
    from app.domain import supabase_auth_service as mod

    mod._get_supabase_client.cache_clear()
    settings = _login_settings(supabase_key=None, supabase_jwt_secret=None)
    with patch("app.domain.supabase_auth_service.get_settings", return_value=settings):
        svc = SupabaseAuthService()
        with pytest.raises(ValueError, match="Supabase credentials not configured"):
            _ = svc.client


def test_sso_login_enabled_requires_flag_url_and_anon_key():
    """The proxy is active only when all three are set — any missing is a hard off (fallback)."""
    svc = _svc()
    with patch("app.domain.supabase_auth_service.get_settings", return_value=_login_settings()):
        assert svc.sso_login_enabled is True
    for missing, off in [
        ("sso_enabled", False),
        ("passport_supabase_url", None),
        ("passport_supabase_anon_key", None),
    ]:
        with patch(
            "app.domain.supabase_auth_service.get_settings",
            return_value=_login_settings(**{missing: off}),
        ):
            assert svc.sso_login_enabled is False, missing


def test_login_via_passport_authenticates_against_passport_and_returns_its_session():
    """Login hits PASSPORT's project and returns its sub + token — never Prepper's project."""
    svc = _svc()
    sess = SimpleNamespace(access_token="AT", refresh_token="RT", expires_in=3600)
    passport_user = SimpleNamespace(id="S_passport", email="chef@temper.sg")
    fake_client = SimpleNamespace(
        auth=SimpleNamespace(
            sign_in_with_password=lambda creds: SimpleNamespace(user=passport_user, session=sess)
        )
    )
    with patch(
        "app.domain.supabase_auth_service._get_passport_supabase_client", return_value=fake_client
    ) as gc:
        out = svc.login_via_passport("chef@temper.sg", "pw")
    gc.assert_called_once()  # the PASSPORT client, not Prepper's
    assert out["user_id"] == "S_passport"  # Passport sub — caller resolves locally by email
    assert out["email"] == "chef@temper.sg"
    assert (out["access_token"], out["refresh_token"]) == ("AT", "RT")


def test_login_via_passport_bad_credentials_maps_to_valueerror():
    """A GoTrue 'invalid login' becomes the same ValueError the endpoint turns into a 400."""
    svc = _svc()

    def _boom(_creds):
        raise Exception("Invalid login credentials")

    fake_client = SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=_boom))
    with patch(
        "app.domain.supabase_auth_service._get_passport_supabase_client", return_value=fake_client
    ):
        with pytest.raises(ValueError):
            svc.login_via_passport("chef@temper.sg", "wrong")


def test_resolve_matches_local_user_by_email_ignoring_sub(session: Session):
    """An existing local row is found by verified email, case-insensitively; the Passport sub is not
    used as a key (it is not this app's sub)."""
    from app.api.deps import resolve_or_provision_passport_user

    _user(session, user_id="local-1", email="chef@temper.sg")
    resolved = resolve_or_provision_passport_user(session, "S_passport_unused", "CHEF@Temper.SG")
    assert resolved is not None and resolved.id == "local-1"


def test_resolve_provisions_active_member_keyed_by_passport_sub(session: Session):
    from app.api.deps import resolve_or_provision_passport_user
    from app.models import PassportMembership

    session.add(
        PassportMembership(
            id="m1", organization_id="o1", platform_user_id="pu1",
            role="Owner", status="active", version=1, email="new@temper.sg",
        )
    )
    session.commit()
    resolved = resolve_or_provision_passport_user(session, "S_new", "new@temper.sg")
    assert resolved is not None and resolved.id == "S_new"  # keyed by the Passport sub


def test_resolve_rejects_a_non_member(session: Session):
    """A valid Passport identity that is not an active member here mints nothing → None (403)."""
    from app.api.deps import resolve_or_provision_passport_user

    assert resolve_or_provision_passport_user(session, "S_x", "stranger@nowhere.com") is None


def test_resolve_fails_closed_on_ambiguous_case_variant_emails(session: Session):
    """Two local rows differing only by email case must NOT resolve to an arbitrary one — on a
    token-minting path, refuse to guess (return None → 403) rather than map to the wrong person."""
    from app.api.deps import resolve_or_provision_passport_user

    _user(session, user_id="u-lower", email="chef@temper.sg")
    _user(session, user_id="u-upper", email="CHEF@temper.sg")  # case-variant duplicate
    assert resolve_or_provision_passport_user(session, "S_x", "chef@temper.sg") is None


def _member(session: Session, *, email: str, platform_user_id: str, role: str = "Owner"):
    from app.models import PassportMembership

    session.add(
        PassportMembership(
            id=f"m-{platform_user_id}", organization_id="o1", platform_user_id=platform_user_id,
            role=role, status="active", version=1, email=email,
        )
    )
    session.commit()


def test_platform_user_id_for_email_resolves_active_member(session: Session):
    from app.passport.access import platform_user_id_for_email

    _member(session, email="chef@temper.sg", platform_user_id="pu-1")
    assert platform_user_id_for_email(session, "CHEF@Temper.SG") == "pu-1"  # case-insensitive
    assert platform_user_id_for_email(session, "nobody@x.com") is None


def test_removed_member_does_not_resolve_so_the_login_gate_denies(session: Session):
    """A removed member returns None (active-only) — the login gate treats None as 'not a member' and
    denies, so a removed member cannot keep a session via a legacy local `users` row."""
    from app.models import PassportMembership
    from app.passport.access import platform_user_id_for_email

    session.add(
        PassportMembership(
            id="m-removed", organization_id="o1", platform_user_id="pu-removed",
            role="Owner", status="removed", version=2, email="gone@temper.sg",
        )
    )
    session.commit()
    assert platform_user_id_for_email(session, "gone@temper.sg") is None


def test_login_gate_fails_open_before_entitlements_sync(session: Session):
    """A member whose org has NO entitlement row yet is NOT blocked — Passport is not authoritative
    for that org until the data lands (matches the request-path derivation)."""
    from app.passport.access import has_prepper_access_for_platform_user

    _member(session, email="chef@temper.sg", platform_user_id="pu-1")  # no entitlement projected
    assert has_prepper_access_for_platform_user(session, "pu-1") is True


def test_login_gate_blocks_member_with_no_access_once_entitled(session: Session):
    """Entitlement active but the member holds no brand role and is a plain Member (no ladder) and
    no brand carries the app → derived access is empty → the gate blocks (403 at login)."""
    from app.models import PassportEntitlement
    from app.passport.access import has_prepper_access_for_platform_user

    _member(session, email="staff@temper.sg", platform_user_id="pu-2", role="Member")
    session.add(
        PassportEntitlement(
            id="e1", organization_id="o1", app_id="app-prepper",
            status="active", tier=None, source="admin", version=1,
        )
    )
    session.commit()
    # no PassportUnit / unit_app_access / unit_app_membership → roles_at_brands is empty
    assert has_prepper_access_for_platform_user(session, "pu-2") is False
