"""The email-first login routing decision — and nothing else.

Deliberately ONE function with ONE boolean input, so there is no code path that could
distinguish "not a member" from "this email does not exist". That indistinguishability is
the whole non-committal property, and it is enforced by structure rather than by care:
once this becomes a chain of ``if``s returning three values, the fourth (``suspended``,
``sso_required``, ``wrong_tenant``) arrives as an obvious small follow-up and each one is
individually defensible.

The endpoint in front of this DOES deliberately disclose membership — the UI cannot choose
between redirecting to Passport and rendering a password field without it, so the response
*is* the routing decision. What it must never disclose is **account existence**. The test
for any proposed change: does the extra answer change what the UI does? ``unknown`` and
``app-native`` both render a password field, so a third route is pure disclosure.
"""

from __future__ import annotations

from typing import Literal

from sqlmodel import Session

from app.passport.gate import is_active_member

LoginRoute = Literal["passport", "app-native"]


def resolve_login_route(session: Session, email: str, *, sso_active: bool) -> LoginRoute:
    """Where this address signs in. Two values, ever.

    ``sso_active`` is the break-glass switch (spec D11). With it false, everyone routes
    ``app-native`` — including members. Routing a member to a Passport the operator has just
    switched off would leave the branch admitting nobody, which is the opposite of a kill
    switch. The D9 refusals on the password endpoints are gated on the same value, so the
    two halves cannot disagree.
    """
    if sso_active and is_active_member(session, email):
        return "passport"
    return "app-native"
