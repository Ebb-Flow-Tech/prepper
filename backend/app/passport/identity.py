"""The (app, subject) -> platform_user identity link — written LOCALLY, never reported upward.

The link is the bridge from this app's Supabase ``sub`` to a Passport platform user: without one,
a user resolves to no orgs, no brands and no roles, and every brand-scoped check denies them.

**Prepper reports nothing to Passport.** ``report_identity_link_safe`` used to POST the caller's
token so Passport could mint the link itself; it was deleted on 2026-08-13 when the app became a
read-only consumer. It was also, on the evidence, doing nothing: all five links in staging carried
``linked_via='email_match'`` — Passport's own eager matching — and none came from that call. Whether
it was 403-ing on an issuer mismatch or being silently no-op'd, it had never produced a link, so
removing it cost a repair path that had never run.

Links now arrive two ways, both of which still work:

- **Passport creates them eagerly** on membership/entitlement events, and they arrive through the
  sync webhook as ``identity_link.created``. This is where every existing link came from.
- **:func:`bind_identity_link`** writes the row directly at the end of the Model 3 login callback,
  for the session Prepper has just minted.

And if neither has landed yet, ``deps._platform_user_for`` falls back to resolving the platform user
by verified email, so a first login is not a dead end.
"""

from __future__ import annotations

import logging
from uuid import uuid4

from sqlmodel import Session, select

from app.models import PassportIdentityLink
from app.passport.gate import resolve_app_id

logger = logging.getLogger(__name__)


def bind_identity_link(session: Session, *, subject: str, platform_user_id: str) -> None:
    """Write the ``(app, subject) -> platform_user`` link DIRECTLY, for the Model 3 callback.

    :func:`report_identity_link_safe` cannot do this job: it forwards the caller's token so Passport
    can verify it against PREPPER's registered ``issuer_url``, and a Passport-issued token has the
    wrong issuer — a guaranteed no-op on that path. So the row is written locally instead.

    ``platform_user_id`` must come from the MEMBERSHIP projection, never from the token's ``sub``.
    Those are different UUID spaces (Passport's Supabase auth-user id vs. Passport's own internal
    id), and a link written from the wrong one resolves to nobody: every brand-scoped check then
    denies the user **silently**, because the projection still looks populated.

    Idempotent per ``(subject, app_id)``. A row naming a different platform user is REPLACED rather
    than updated, because identity-link rows are immutable per row.

    **The self-healing is one-directional, and that is a known gap.** The replacement row is minted
    with a local ``uuid4``, so Passport has never seen its id: a later ``identity_link.removed`` for
    the id Passport knows will not match it, and ``reconcile`` cannot pair them either. A revocation
    on Passport's side therefore leaves this row in place. It heals a wrong ``platform_user_id``; it
    does not survive a revocation. Closing that means writing the id Passport issues, which needs an
    API this app does not have today.
    """
    app_id = resolve_app_id(session)
    if app_id is None:
        logger.warning(
            "passport callback: identity link not written — no app id in the entitlement projection"
        )
        return

    existing = session.exec(
        select(PassportIdentityLink).where(
            PassportIdentityLink.subject == subject,
            PassportIdentityLink.app_id == app_id,
        )
    ).first()
    if existing is not None:
        if existing.platform_user_id == platform_user_id:
            return
        session.delete(existing)
        session.flush()

    session.add(
        PassportIdentityLink(
            id=str(uuid4()),
            platform_user_id=platform_user_id,
            app_id=app_id,
            subject=subject,
            linked_via="manual",
        )
    )
    session.commit()
