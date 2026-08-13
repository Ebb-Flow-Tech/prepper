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
        pytest.raises(Exception),  # 401: no local user, not a member, no fallback
    ):
        deps._resolve_current_user(session, "Bearer t")


# --- The login-proxy is GONE (Model 3 replaces it) ---------------------------------------------


@pytest.mark.parametrize(
    "gone",
    [
        "login_via_passport",
        "refresh_via_passport",
        "sso_login_enabled",
        "register",
        # Not part of the proxy, but the same rule: the browser's Supabase client owns refresh, and
        # a backend that also redeems refresh tokens is a second session authority.
        "refresh_token",
    ],
)
def test_the_password_proxy_no_longer_exists(gone: str):
    """Regression. `login_via_passport` replayed the user's PASSPORT password through Prepper's
    backend, so a Prepper compromise harvested credentials valid for every app on the platform —
    and `sign_in_with_password` is non-interactive, so it structurally could not present MFA.
    Deleting it is the entire point of the Model 3 work.

    Asserted on the CLASS rather than by patching a call site: a test that only proved the login
    route stopped calling it would go green again the moment someone reintroduced the method and
    wired it up somewhere new.
    """
    assert not hasattr(SupabaseAuthService, gone)


def test_no_client_points_at_passports_gotrue_any_more():
    """The proxy's other half. Under Model 3 the exchange authenticates with `X-API-Key` and the
    hosted login happens in the BROWSER, so this backend has no reason to hold a client for
    Passport's project — and holding one is how a password path grows back."""
    from app.domain import supabase_auth_service as mod

    assert not hasattr(mod, "_get_passport_supabase_client")


def test_no_backend_setting_survives_for_passports_anon_key():
    """`Settings.passport_supabase_anon_key` is deleted, not merely unread.

    The backend never calls Passport's GoTrue under Model 3, so the key has no reader — and a
    stale setting for a credential nothing uses is exactly what gets wired back into an auth path
    by someone tidying up an unused variable. The frontend owns it now, as
    `NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY`.
    """
    from app.config import Settings

    assert "passport_supabase_anon_key" not in Settings.model_fields
    assert "passport_org_id" not in Settings.model_fields


def _login_settings(**over):
    base = dict(
        sso_enabled=True,
        passport_supabase_url="https://passport.supabase.co",
        supabase_url="https://prepper.supabase.co",
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_the_service_builds_without_preppers_own_supabase_key():
    """Prepper's own client must stay lazy.

    `__init__` used to build it eagerly, so `SupabaseAuthService()` raised
    `ValueError("Supabase credentials not configured")` whenever `supabase_key` was unset — and
    `api/auth.py` turns that into a 503. That took down paths which never touch Prepper's project
    at all; under Model 3 that is the whole callback, which only ever calls
    `verify_passport_identity`.

    Found by running the app: login 503'd with both PASSPORT_SUPABASE_* set and SSO on.
    """
    from app.domain import supabase_auth_service as mod

    mod._get_supabase_client.cache_clear()
    settings = _login_settings(supabase_key=None, supabase_jwt_secret=None)
    with patch("app.domain.supabase_auth_service.get_settings", return_value=settings):
        svc = SupabaseAuthService()  # must not raise
        assert svc.verify_passport_identity.__self__ is svc


def test_preppers_own_client_still_raises_when_actually_used():
    """Laziness must defer the error, not swallow it.

    A path that genuinely needs Prepper's project (storage, app-native sign-in, password recovery)
    must still fail loudly when the key is absent — otherwise this fix trades a startup 503 for a
    confusing AttributeError deep inside the supabase SDK.
    """
    from app.domain import supabase_auth_service as mod

    mod._get_supabase_client.cache_clear()
    settings = _login_settings(supabase_key=None, supabase_jwt_secret=None)
    with patch("app.domain.supabase_auth_service.get_settings", return_value=settings):
        svc = SupabaseAuthService()
        with pytest.raises(ValueError, match="Supabase credentials not configured"):
            _ = svc.client


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
    from app.passport.gate import platform_user_id_for_email

    _member(session, email="chef@temper.sg", platform_user_id="pu-1")
    assert platform_user_id_for_email(session, "CHEF@Temper.SG") == "pu-1"  # case-insensitive
    assert platform_user_id_for_email(session, "nobody@x.com") is None


def test_removed_member_does_not_resolve_so_the_login_gate_denies(session: Session):
    """A removed member returns None (active-only) — the login gate treats None as 'not a member' and
    denies, so a removed member cannot keep a session via a legacy local `users` row."""
    from app.models import PassportMembership
    from app.passport.gate import platform_user_id_for_email

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
    from app.passport.gate import has_prepper_access_for_platform_user

    _member(session, email="chef@temper.sg", platform_user_id="pu-1")  # no entitlement projected
    assert has_prepper_access_for_platform_user(session, "pu-1") is True


def test_login_gate_blocks_member_with_no_access_once_entitled(session: Session):
    """Entitlement active but the member holds no brand role and is a plain Member (no ladder) and
    no brand carries the app → derived access is empty → the gate blocks (403 at login)."""
    from app.models import PassportEntitlement
    from app.passport.gate import has_prepper_access_for_platform_user

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


@pytest.mark.parametrize(
    "method,path",
    [("POST", "/api/v1/auth/register"), ("POST", "/api/v1/auth/refresh-token")],
)
def test_the_deleted_routes_no_longer_answer(method: str, path: str):
    """The `hasattr` guards above pin the SERVICE methods; nothing pinned the ROUTES.

    Asserted through the app rather than by grepping the source, because the routers are mounted
    as wrapper objects — a route can be perfectly absent from a text search and still be served.
    404 is the only acceptable answer: a 401 would mean the route still exists behind the gate,
    and a 405 would mean the path is live under another method.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        assert client.request(method, path, json={}).status_code == 404
        # Control: a route that IS mounted must not also answer 404 through this same call, or
        # the assertion above would pass for a broken client rather than for a deleted route.
        assert client.post("/api/v1/auth/login", json={}).status_code != 404
