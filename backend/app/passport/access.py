"""Request-path access gate driven by the Passport projection.

Access resolution order (conformance acceptance checklist):

1. **Entitlement first** — the org-level kill switch. If the org's entitlement is not
   ``active``, the whole org is blocked regardless of memberships or local role.
2. **Then membership / role** — already enforced through Prepper's existing ``user_type``
   checks, because role projection writes the org role onto ``users.user_type``.

This module implements step 1. It reads only the local ``passport_entitlement`` projection
(never a JWT claim), imports no ``passport_client`` symbols, and **fails open**: it blocks
only once entitlements are actually being synced and have flipped non-active. When Passport
is unconfigured, or no entitlement row exists yet for the org, access is allowed — so
existing behaviour is unchanged until Passport becomes the source of truth.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.config import get_settings
from app.models import PassportEntitlement

_ACTIVE = "active"


def is_org_blocked(session: Session) -> bool:
    """Return ``True`` when the configured org's entitlement is present but not active.

    Fail-open: ``False`` when Passport has no configured org, or when no entitlement row
    exists yet for that org (entitlements not synced). ``True`` only when at least one
    entitlement row exists for the org and none of them is ``active`` — i.e. the org-level
    kill switch has been thrown (trap 2: revocation arrives as a non-active upsert).
    """
    org_id = get_settings().passport_org_id
    if not org_id:
        return False

    statuses = session.exec(
        select(PassportEntitlement.status).where(
            PassportEntitlement.organization_id == str(org_id)
        )
    ).all()
    if not statuses:
        return False  # no entitlement synced yet — do not block

    return _ACTIVE not in statuses
