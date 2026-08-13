"""Completing a Passport hosted-login callback: redeem → exchange → verify → provision → gate → link.

Extracted from ``api/auth_passport.py``, which was at ~499 of ``performance.md``'s 500-line limit
and carried this sequence — roughly a hundred lines of orchestration — inside a route handler,
against ``.claude/rules/backend.md`` ("don't push business logic into routers"). The router now
owns only the state cookie, the parameter caps and the redirect vocabulary; this module owns the
sequence, and the two meet at :class:`LoginOutcome`.

**It returns a value, it does not answer the request.** That split is not cosmetic. No exit from
``/passport/*`` may be anything but a redirect — those routes are reached by top-level browser
navigation, so a JSON body or a raised status renders as the entire login page — and a service
that built ``RedirectResponse`` objects would put half of that rule in a module with no routes in
it. Every refusal here is an ``error_code`` on the result; the router is the only thing that turns
one into a redirect, and its catch-all still covers the exceptions this module may raise.

**Layering wart, stated rather than hidden:** this imports ``resolve_or_provision_passport_user``
from ``app.api.deps``, so a passport module depends on the API layer. It is the same provisioning
the request-verify path uses, and duplicating it here would be an auth bug waiting to happen (see
that function's docstring). The honest fix is to move it down into this layer, which is a change of
behaviour-adjacent surface this refactor deliberately did not make.
"""

from __future__ import annotations

import logging
from typing import NamedTuple

from sqlmodel import Session

from app.api.deps import resolve_or_provision_passport_user
from app.config import Settings
from app.domain.supabase_auth_service import get_auth_service
from app.passport.gate import (
    has_prepper_access_for_platform_user,
    platform_user_id_for_email,
)
from app.passport.identity import bind_identity_link
from app.passport.pkce import pop_verifier
from app.passport.session_exchange import exchange_session_code

logger = logging.getLogger(__name__)

# The three failure codes the `/passport/*` routes may hand back (spec §4.2). They are the whole
# vocabulary: the frontend renders ONE shared message for all of them, and the distinction that
# matters for debugging lives in log lines — this module's for everything from the redemption
# onward, `api/auth_passport.py`'s for the input checks and the start-side refusals — never in the
# redirect.
#
# They live here rather than beside the redirect that carries them because two of the three are
# produced by `complete_passport_login`, and this module cannot import the router that imports it.
# Keeping the SET together is worth more than keeping it next to its one consumer: it is the spec's
# list, and a fourth code added to only one half is a code the frontend has no message for.
ERROR_UNAVAILABLE = "passport_unavailable"  # never left our app (start-side failure)
ERROR_SSO_FAILED = "passport_sso_failed"  # came back, but the exchange or verification failed
ERROR_NO_ACCESS = "passport_no_access"  # authenticated, but not a member / no derived access


class LoginOutcome(NamedTuple):
    """Either a refusal code or a minted Passport session — never both, never neither.

    ``error_code`` is one of the three constants above when the sign-in was refused, and ``None``
    when it succeeded; the tokens are meaningful only in the second case. A ``NamedTuple`` with a
    discriminating field rather than a raised exception, because a refusal here is an ORDINARY
    answer — an unknown state, a non-member, an org with no derived access — and an exception would
    have to be caught by the same handler that already catches the genuinely exceptional ones,
    where a missed ``except`` is a 500 rendered as the victim's whole login page.
    """

    error_code: str | None = None
    access_token: str = ""
    refresh_token: str = ""


def complete_passport_login(
    session: Session, settings: Settings, *, code: str, state: str
) -> LoginOutcome:
    """Everything from redeeming the state onward, so ONE ``try`` in the caller can cover it.

    Deliberately begins at ``pop_verifier`` rather than at the top of the handler: the ``?error=``
    and missing-code/state branches above it are pure input checks that cannot raise, and leaving
    them outside keeps their specific log lines instead of collapsing them into the catch-all's
    generic one.

    **The login-CSRF state-cookie check also sits above this boundary, and must stay there.**
    Redeeming first would let an attacker burn a victim's in-flight attempt simply by making their
    browser load the callback URL. Because the redemption is the FIRST statement of this function,
    "the cookie is checked before the state is redeemed" stays checkable by inspection rather than
    by tracing two branches of one long handler.

    Returns an outcome on every path, including every refusal. It may still raise — the caller
    converts that to a redirect too, which is the point of the split.
    """
    verifier = pop_verifier(session, state=state)
    if verifier is None:
        logger.warning("passport callback: refused — state unknown, already redeemed, or expired")
        return LoginOutcome(ERROR_SSO_FAILED)

    exchanged = exchange_session_code(settings, code=code, verifier=verifier)
    if exchanged is None:
        return LoginOutcome(ERROR_SSO_FAILED)  # already logged, specifically

    access_token = exchanged.get("access_token")
    refresh_token = exchanged.get("refresh_token")
    if not access_token or not refresh_token:
        logger.warning(
            "passport callback: refused — session-exchange returned an incomplete session"
        )
        return LoginOutcome(ERROR_SSO_FAILED)

    try:
        auth_service = get_auth_service()
    except (RuntimeError, ValueError):
        logger.warning("passport callback: refused — the authentication service is unavailable")
        return LoginOutcome(ERROR_SSO_FAILED)

    # The exchange is a trusted server-to-server call, but its token is still verified through the
    # SAME path every request already uses — reused, not duplicated. `verify_passport_identity`
    # answers None for a token that fails verification AND for verified claims carrying no email;
    # both are the same refusal, so they share this branch rather than being split by a check that
    # could never fire.
    identity = auth_service.verify_passport_identity(access_token)
    if identity is None:
        logger.warning(
            "passport callback: refused — the exchanged token failed verification against "
            "Passport's issuer, or its verified claims carried no email"
        )
        return LoginOutcome(ERROR_SSO_FAILED)
    subject, email = identity

    user = resolve_or_provision_passport_user(session, subject, email)
    if user is None:
        # The address itself is never logged; the category is what an operator acts on.
        logger.warning(
            "passport callback: refused — no local user (not an active member, or an ambiguous "
            "case-variant email match)"
        )
        return LoginOutcome(ERROR_NO_ACCESS)

    # The D10 access gate, on the only path that mints a Model 3 session. Membership alone is not
    # access, and a valid Passport token proves who the caller is, never that they may be here.
    # `platform_user_id_for_email` resolves by MEMBERSHIP because an SSO user may have no identity
    # link yet on their first login — they always have a membership. It fails OPEN until
    # entitlements sync, matching the request-path derivation.
    platform_user_id = platform_user_id_for_email(session, email)
    if platform_user_id is None or not has_prepper_access_for_platform_user(
        session, platform_user_id
    ):
        logger.warning("passport callback: refused — no derived Prepper access for this member")
        return LoginOutcome(ERROR_NO_ACCESS)

    try:
        bind_identity_link(session, subject=user.id, platform_user_id=platform_user_id)
    except Exception:
        # DECISION: a link failure is NOT a refusal — the sign-in continues.
        #
        # The link is an optimisation, not the authorisation. `deps._platform_user_for` falls back
        # to resolving the platform user by `users.email` against the membership projection, so a
        # user with no link still derives access normally; Passport's own `identity_link.created`
        # webhook and the nightly reconcile will land the row later regardless. And the access gate
        # immediately above has ALREADY answered "may this person be here?" with yes — refusing now
        # would re-answer a settled question on the strength of an unrelated database hiccup, and
        # lock out a member who is entitled and verified.
        #
        # Rollback first: the failed `commit()` leaves the session unusable for the redirect below.
        session.rollback()
        logger.warning(
            "passport callback: identity link not written — signing in anyway", exc_info=True
        )

    # Nothing fallible may follow this line: the tokens are real from here on, and a failure after
    # them would hide a session that already exists. The caller turns this into the redirect that
    # carries them, and does nothing else fallible either.
    return LoginOutcome(access_token=access_token, refresh_token=refresh_token)
