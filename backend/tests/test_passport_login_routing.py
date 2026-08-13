"""Email-first login routing, and the two helpers it stands on.

The routing decision is the unauthenticated front door, so its security property is
structural rather than defensive: ONE boolean in, TWO values out, and nowhere for a third
branch to hide. A non-member and an address that does not exist must be indistinguishable
— `app-native` means "type a password", never "this account exists".
"""

from types import SimpleNamespace

from sqlmodel import Session

from app.models import PassportMembership
from app.passport.gate import is_active_member, sso_active
from app.passport.login_routing import resolve_login_route

ORG = "org-1"


def _member(session: Session, email: str, *, status: str = "active") -> None:
    session.add(
        PassportMembership(
            id=f"m-{email}",
            organization_id=ORG,
            platform_user_id=f"pu-{email}",
            role="Member",
            status=status,
            version=1,
            email=email,
        )
    )
    session.commit()


class TestSsoActive:
    def test_requires_flag_and_url(self) -> None:
        assert sso_active(
            SimpleNamespace(sso_enabled=True, passport_supabase_url="https://p.supabase.co")
        )
        assert not sso_active(
            SimpleNamespace(sso_enabled=False, passport_supabase_url="https://p.supabase.co")
        )
        assert not sso_active(SimpleNamespace(sso_enabled=True, passport_supabase_url=None))

    def test_ignores_backend_anon_key(self) -> None:
        """Model 3 never signs into Passport's GoTrue from the backend — the code exchange
        authenticates with X-API-Key — so the backend anon key is not part of the gate.

        If it were, an operator who correctly dropped the now-unused key would silently route
        every member `app-native`: the kill switch tripping itself.

        `Settings.passport_supabase_anon_key` is now deleted outright, so this stub carries a
        field the real settings object no longer has. That is the point: the test stops being
        about a live setting and becomes the guard against the key being reintroduced INTO THE
        GATE, which is the shape the mistake would take if someone re-added the setting.
        """
        assert sso_active(
            SimpleNamespace(
                sso_enabled=True,
                passport_supabase_url="https://p.supabase.co",
                passport_supabase_anon_key=None,
            )
        )


class TestIsActiveMember:
    def test_active_member(self, session: Session) -> None:
        _member(session, "chef@brand.test")
        assert is_active_member(session, "chef@brand.test")

    def test_case_insensitive(self, session: Session) -> None:
        _member(session, "chef@brand.test")
        assert is_active_member(session, "CHEF@Brand.TEST")

    def test_removed_member_is_not_active(self, session: Session) -> None:
        """`membership.removed` is a tombstone, not a delete — the row survives with
        status=removed, so a status filter is the only thing separating the two."""
        _member(session, "gone@brand.test", status="removed")
        assert not is_active_member(session, "gone@brand.test")

    def test_unknown_email(self, session: Session) -> None:
        assert not is_active_member(session, "nobody@brand.test")


class TestResolveLoginRoute:
    def test_active_member_routes_to_passport(self, session: Session) -> None:
        _member(session, "chef@brand.test")
        assert resolve_login_route(session, "chef@brand.test", sso_active=True) == "passport"

    def test_non_member_routes_app_native(self, session: Session) -> None:
        _member(session, "chef@brand.test")
        assert resolve_login_route(session, "outsider@x.test", sso_active=True) == "app-native"

    def test_unknown_address_is_indistinguishable_from_non_member(self, session: Session) -> None:
        """The whole point of two routes. A third value here — "unknown", "invalid" —
        is the enumeration oracle, reintroduced by someone improving an error message."""
        _member(session, "chef@brand.test")
        non_member = resolve_login_route(session, "outsider@x.test", sso_active=True)
        never_existed = resolve_login_route(session, "nobody@nowhere.test", sso_active=True)
        assert non_member == never_existed == "app-native"

    def test_removed_member_routes_app_native(self, session: Session) -> None:
        _member(session, "gone@brand.test", status="removed")
        assert resolve_login_route(session, "gone@brand.test", sso_active=True) == "app-native"

    def test_kill_switch_routes_everyone_app_native(self, session: Session) -> None:
        """D11. With SSO off the router must send members `app-native` too, or the
        break-glass branch admits nobody — the switch would send them to a Passport that
        is exactly what the operator just turned off."""
        _member(session, "chef@brand.test")
        assert resolve_login_route(session, "chef@brand.test", sso_active=False) == "app-native"

    def test_only_two_values_are_reachable(self, session: Session) -> None:
        _member(session, "chef@brand.test")
        seen = {
            resolve_login_route(session, email, sso_active=flag)
            for email in ("chef@brand.test", "outsider@x.test", "", "not-an-email")
            for flag in (True, False)
        }
        assert seen <= {"passport", "app-native"}
