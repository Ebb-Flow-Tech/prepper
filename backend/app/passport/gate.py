"""The admission gate: may this person be in Prepper AT ALL, and who are they in Passport?

Split out of :mod:`app.passport.access`, which had grown past ``performance.md``'s 500-line limit
by carrying two questions that are asked at different moments by different callers:

* **This module — "may they be here?"** The SSO switch, membership lookups by verified email, the
  app id, the per-request :class:`SubjectScope`, and the two gates built on it (the org-level
  entitlement kill switch and derived Prepper access). Asked once at the door
  (``/auth/passport/callback``) and again on every request (``deps._resolve_current_user``).
* **:mod:`app.passport.access` — "what may they see, where?"** Brand-role derivation, unit
  scoping, and the org-admin helpers. Asked per resource, after the gate has already said yes.

The dependency runs ONE WAY, ``gate`` → ``access``: both gates are computed from the same four
SDK inputs the role derivation assembles (``access._derivation_inputs``), because
``has_app_access`` and ``roles_at_brands`` are two answers off one join. Nothing in ``access``
imports this module, and it must stay that way — the derivation cannot be allowed to depend on
whether the caller has passed the door, or the two would be able to disagree.

**Fail-open until Passport is actually the source of truth.** When Passport is unconfigured, or no
entitlement row has synced yet for the org, nothing is blocked — see :mod:`app.passport.access` for
why the same rule governs the derivation half.
"""

from __future__ import annotations

import logging
from typing import Any, NamedTuple

from passport_client.access import has_app_access
from sqlalchemy import func
from sqlmodel import Session, select

from app.models import PassportEntitlement, PassportMembership
from app.passport.access import (
    _ACTIVE,
    _derivation_inputs,
    entitlement_status,
    orgs_for_platform_user,
    platform_user_id_for,
)


def sso_active(settings: Any) -> bool:
    """The SINGLE definition of "SSO is on" — the flag AND Passport's project URL.

    Deliberately NOT the backend anon key. Under Model 3 the backend never signs into
    Passport's GoTrue: the hosted login happens in the browser and the code exchange
    authenticates with ``X-API-Key``. The anon key is a frontend concern
    (``NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY``). The retired ``sso_login_enabled`` DID
    require it, because the login-proxy called ``sign_in_with_password`` server-side — so
    inheriting that definition would mean an operator who correctly dropped the now-unused
    backend key silently routed every member ``app-native``: the kill switch tripping itself.

    Gates the router, all three D9 refusals, and the Passport-issuer verify path. One
    definition rather than three, so they cannot drift.
    """
    return bool(settings.sso_enabled and settings.passport_supabase_url)


def is_active_member(session: Session, email: str) -> bool:
    """Whether a verified email belongs to an ACTIVE Passport member in the projection.

    Promoted from ``deps._is_active_member``: the routing decision lives in this layer, and
    a passport module importing a private symbol from the API layer inverts the dependency
    direction. Same query, same semantics — ``membership.removed`` is a tombstone rather
    than a delete, so the status filter is the only thing separating a removed member from
    a current one.

    **``email`` must be a VERIFIED email**, never a value the caller can write — see
    :func:`platform_user_id_for_email` for why that distinction is load-bearing.

    **Normalisation happens HERE, so that no caller can forget it.** Case was never the gap — the
    comparison already lowercases both sides — but nothing trimmed, and GoTrue trims before it
    authenticates. A member posting ``" chef@…"`` to ``/auth/login`` therefore missed this lookup
    and then signed in perfectly normally, walking straight through the D9 refusal. The fix lived
    in the API layer for exactly one commit, which left ``login_routing.resolve_login_route``
    reintroducing the same hole the moment it gained a second caller. Callers that also strip (to
    build a rate-limit key, say) are harmless: stripping twice is a no-op.
    """
    return (
        session.exec(
            select(PassportMembership).where(
                func.lower(PassportMembership.email) == email.strip().lower(),
                PassportMembership.status == _ACTIVE,
            )
        ).first()
        is not None
    )


def resolve_app_id(session: Session, *, org_id: str | None = None) -> str | None:
    """Prepper's own app UUID, read off the projected entitlement.

    Returns ``None`` rather than raising, because ``GET /auth/passport/start`` is
    unauthenticated, has no org, and must ALWAYS redirect rather than surface a JSON error —
    it is reached by top-level browser navigation, so a raised exception renders as the whole
    page. (``writeback._app_id`` used to wrap this and keep a 503 for the authenticated write path;
    write-back was deleted on 2026-08-13, so returning ``None`` is now the only contract.)

    The org-less form is **not** the unscoped cross-org read ``CLAUDE.md`` warns about.
    Entitlement delivery is own-app scoped, so every entitlement Prepper holds names Prepper
    and the app id is identical across orgs — this resolves the APP, never a tenant's rows.
    The org filter is kept for the write-back path, where the caller already has an org and
    the narrower query is free.
    """
    stmt = select(PassportEntitlement.app_id)
    if org_id is not None:
        stmt = stmt.where(PassportEntitlement.organization_id == org_id)
    return session.exec(stmt).first()


class SubjectScope(NamedTuple):
    """The Passport facts BOTH request-path gates need, resolved once.

    ``is_org_blocked`` and ``has_prepper_access`` ask overlapping questions — who is this platform
    user, which orgs do they belong to, is each org's entitlement synced — and running them back to
    back re-issued every one of those lookups. On ``GET /auth/me`` for a single-org member that was
    5 of the gate's 11 queries, on every request to every gated route.

    ``entitlement_statuses`` holds ONLY orgs with a synced entitlement. Absent is the not-yet-
    configured case that both gates fail open on, so "missing key" and "no data" are the same
    thing here by construction rather than by two separate ``is None`` checks.
    """

    platform_user_id: str | None
    org_ids: tuple[str, ...]
    entitlement_statuses: dict[str, str]


_UNSCOPED = SubjectScope(None, (), {})


def scope_for_platform_user(session: Session, platform_user_id: str) -> SubjectScope:
    """The org/entitlement half of a scope, for a caller who already knows the platform user."""
    org_ids = tuple(orgs_for_platform_user(session, platform_user_id))
    statuses = {}
    for org_id in org_ids:
        status = entitlement_status(session, org_id)
        if status is not None:
            statuses[org_id] = status
    return SubjectScope(platform_user_id, org_ids, statuses)


def subject_scope(session: Session, subject: str) -> SubjectScope:
    """Resolve a local ``users.id`` to its Passport scope. One call, then ask both gates."""
    platform_user_id = platform_user_id_for(session, subject)
    if platform_user_id is None:
        return _UNSCOPED  # not linked — Passport is not authoritative for this user
    return scope_for_platform_user(session, platform_user_id)


def is_org_blocked_in_scope(scope: SubjectScope) -> bool:
    """The kill switch, against an already-resolved scope. Pure — issues no queries."""
    if scope.platform_user_id is None or not scope.org_ids:
        return False
    if not scope.entitlement_statuses:
        return False  # nothing synced yet — do not block
    return all(status != _ACTIVE for status in scope.entitlement_statuses.values())


def has_prepper_access_in_scope(session: Session, scope: SubjectScope) -> bool:
    """Derived access, against an already-resolved scope.

    Fail-open at every step where Passport is not yet authoritative, matching the login gate.
    """
    if scope.platform_user_id is None or not scope.org_ids:
        return True
    if not scope.entitlement_statuses:
        return True  # entitlements not synced yet
    return any(
        has_app_access(
            **_derivation_inputs(
                session, scope.platform_user_id, org_id, known_status=status
            )
        )
        for org_id, status in scope.entitlement_statuses.items()
    )


def is_org_blocked(session: Session, subject: str) -> bool:
    """Org-level kill switch for the user behind ``subject``: ``True`` when EVERY org they belong
    to has a synced, non-active entitlement.

    Rule 9: evaluated against the user's OWN orgs, not a configured one — a user entitled through
    any org may still use Prepper. Fail-open (``False``) when the user is not linked yet, belongs to
    no org, or no entitlement has synced: turning the projection on must not lock anyone out before
    the data has landed.

    Callers that ALSO ask :func:`has_prepper_access` for the same subject should resolve one
    :func:`subject_scope` and use the ``_in_scope`` forms instead — this convenience wrapper
    re-reads what that one has already got.
    """
    return is_org_blocked_in_scope(subject_scope(session, subject))


def has_prepper_access_for_platform_user(
    session: Session, platform_user_id: str
) -> bool:
    """Whether a platform user may use Prepper in ANY of their orgs — the derived-access emptiness
    test, keyed by ``platform_user_id`` directly.

    Used by the SSO login gate, which knows the member by **email → membership** (the identity link
    that :func:`access.platform_user_id_for` needs may not exist yet for an SSO user). Fail-open
    (``True``) until entitlements have synced, so turning the projection on never locks anyone out
    before the data lands.
    """
    return has_prepper_access_in_scope(
        session, scope_for_platform_user(session, platform_user_id)
    )


def platform_user_id_for_email(session: Session, email: str) -> str | None:
    """An ACTIVE member's ``platform_user_id`` resolved straight from their email.

    The SSO login path: the member is known by the verified email (the identity link may not exist
    yet), and the membership projection carries the ``platform_user_id``. ``None`` if not a member.

    **``email`` must be a VERIFIED email**, not a value a user can write. This maps an email onto a
    Passport identity, so whoever controls the input controls whose identity is returned. Callers
    pass either a token claim (``api/auth.py:90``) or ``users.email``, which is safe only because
    the profile route refuses to set it (``UserUpdate``).

    Fails closed on an ambiguous match rather than returning an arbitrary one — the same rule
    ``deps.resolve_or_provision_passport_user`` applies, and for the same reason: on a path that
    confers identity, "one of these two people" is not an answer.

    Normalised with ``.strip().lower()``, matching :func:`is_active_member` — the two must agree or
    the callback splits in half. A verified claim carrying ``" chef@…"`` used to pass
    ``resolve_or_provision_passport_user``, provision a ``users`` row holding the untrimmed address,
    and then be refused here as ``passport_no_access``. Fails closed, but leaves a junk row behind
    and a login failure with no explanation an operator could act on.

    That resolver now strips too. An earlier version of this docstring claimed it "trims via
    ``ensure_user``'s own lookup path" — it did not: ``UserService.get_user_by_email`` matches
    ``User.email == email`` exactly, with no trim and no lowercase. The claim is recorded here
    because a docstring asserting a normalisation that does not exist is worse than none: it is
    exactly what stops the next reader from checking.
    """
    matches = list(
        session.exec(
            select(PassportMembership.platform_user_id).where(
                func.lower(PassportMembership.email) == email.strip().lower(),
                PassportMembership.status == _ACTIVE,
            )
        ).all()
    )
    distinct = set(matches)
    if len(distinct) > 1:
        logging.getLogger(__name__).warning(
            "platform_user_id_for_email: ambiguous match (count=%d) — failing closed",
            len(distinct),
        )
        return None
    return next(iter(distinct), None)


def has_prepper_access(session: Session, subject: str) -> bool:
    """Whether the user behind ``subject`` (a local ``users.id``) may use Prepper in ANY org.

    Fail-open (``True``) until Passport is genuinely the source of truth — not linked, no org, or no
    entitlement synced — so that turning the projection on does not lock everyone out.

    Callers that ALSO ask :func:`is_org_blocked` for the same subject should resolve one
    :func:`subject_scope` and use the ``_in_scope`` forms instead.
    """
    return has_prepper_access_in_scope(session, subject_scope(session, subject))
