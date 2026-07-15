"""Auto-provision a Prepper login for a member added in Passport.

The gap this closes: a Passport membership projects a person's roles into Prepper, but it does NOT
give them a way to log in — Prepper authenticates against its OWN Supabase project, which the
membership never touched. So "add someone in Passport" left them unable to sign in ("Invalid email
or password", because no account exists).

When `auto_provision_members` is on, an incoming `membership.upserted` for an email Prepper has never
seen invites that person into Prepper's Supabase (they set their own password from the invite) and
creates the local `users` row. Their identity link — and therefore their derived roles — lands on
their first login (`report_identity_link`), as for any other user.

**Best-effort by contract.** This runs AFTER the membership projection has committed and never raises
back into the sync handler: a failed invite (Supabase down, SMTP unconfigured) must not 500 the
webhook and wedge the sync worker on retries. The membership is projected either way; the login can
be provisioned later (a re-sync re-attempts, idempotently).

**SSO note.** This mints in *Prepper's* project — an interim measure. Once the SSO login cutover
(P3 §5.2) lands, auth moves to Passport's issuer and Passport (P-b) mints the account; Prepper then
only needs the local `users` row, which `UserService.ensure_user` (shared with the SSO login path)
already provides. Disable this flag at that point.
"""

from __future__ import annotations

import logging

from sqlmodel import Session

from app.config import get_settings
from app.domain.supabase_auth_service import get_auth_service
from app.domain.user_service import UserService

logger = logging.getLogger(__name__)


def _username_from_email(email: str) -> str:
    return email.split("@", 1)[0] or email


def provision_member_login(session: Session, *, email: str, display_name: str | None) -> None:
    """Invite `email` into Prepper's Supabase and create the local user, if not already present.

    No-op when auto-provisioning is off, the email is unknown-but-already-registered, or a local
    user already exists. Swallows every error (logged, never the address) — the caller is a sync
    handler that must stay 2xx.
    """
    if not get_settings().auto_provision_members:
        return

    user_service = UserService(session)
    if user_service.get_user_by_email(email) is not None:
        return  # already has a Prepper account — nothing to do

    try:
        auth_service = get_auth_service()
        supabase_id = auth_service.invite_member(email)
    except Exception:  # noqa: BLE001 — best-effort; a failed invite must not break the projection
        logger.warning("auto-provision: invite failed", exc_info=True)
        return

    if supabase_id is None:
        # The Supabase account already exists but there's no local row (e.g. a prior partial
        # provision). We cannot recover the id from here without another admin call; a subsequent
        # login or re-sync reconciles it. Leave it for that path rather than guess an id.
        logger.info("auto-provision: supabase account already exists; local row deferred to login")
        return

    display = display_name or _username_from_email(email)
    user_service.ensure_user(supabase_id, email, display)
    logger.info("auto-provision: created Prepper login for a new member")
