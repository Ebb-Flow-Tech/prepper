"""Revocation of Prepper's local unit-scoped grants (conformance rule 6).

**What used to live here — and why it is gone.**

This module used to *grant*: it derived ``user_type`` from the Passport **org** role
(``_ROLE_MAP``: ``Owner``/``Admin`` -> ``admin``) and ``is_manager`` from the **brand-app** role map
(``is_manager = "Manager" in roles.values()``). Both are rule-8 violations, and together they were an
armed over-grant:

- **Conflating two vocabularies.** The org role governs *Passport*; the brand-app role governs *this
  app*. Passport's model says an org ``Owner``/``Admin`` holds ``Manager`` **in** the app — not
  "admin **of** the app". Mapping ``Admin`` -> Prepper superuser invents a privilege Passport never
  granted.
- **Collapsing a per-brand MAP into one global flag.** ``roles_at_brands()`` returns
  ``{brand: role}`` precisely because a person may be ``Manager`` at one brand and ``Staff`` at
  another. Reducing it to a single boolean grants at every brand what was granted at one.

Neither failure raises. The projection was correct; the *derivation* silently over-granted, and it
would have fired on the next login of any org ``Admin`` (17 of 19 members are).

**What remains: revocation only.** Rule 6 still applies while ``is_manager`` / ``outlet_id`` exist:
a removed org member must lose their local unit-scoped grants. Revoking is safe in a way granting is
not — it can only ever reduce access.

Granting is now done the correct way, at the point of the check, per brand:
``access.role_at_brand(...)`` / ``access.brand_roles(...)``. There is nothing to project onto the
user row, which is the whole point of rule 8 — a denormalised role goes stale the moment Passport
changes it, and nothing tells you.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import PassportIdentityLink, User


def _local_user(session: Session, platform_user_id: str) -> User | None:
    """The local ``users`` row behind a Passport platform user, via the identity link
    (``link.subject == users.id``). ``None`` until the link — and a matching local user — exist."""
    link = session.exec(
        select(PassportIdentityLink).where(
            PassportIdentityLink.platform_user_id == platform_user_id
        )
    ).first()
    if link is None:
        return None
    return session.get(User, link.subject)


def revoke_local_grants(session: Session, *, platform_user_id: str) -> None:
    """Conformance rule 6: revoke Prepper's unit-scoped grants for the user behind
    ``platform_user_id`` (clear ``is_manager`` and ``outlet_id``). Called from the
    ``membership.removed`` handler. No-op when there is no linked local user.

    The ``users`` row itself is never deleted — a removed member keeps their account, de-granted.
    """
    user = _local_user(session, platform_user_id)
    if user is None:
        return

    if user.is_manager or user.outlet_id is not None:
        user.is_manager = False
        user.outlet_id = None
        session.add(user)
        session.commit()
