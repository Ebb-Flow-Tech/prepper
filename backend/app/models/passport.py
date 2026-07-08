"""Passport read-model tables — projected from the Passport sync webhook feed.

Passport is the source of truth for organisations, memberships/roles, entitlements,
and identity links. This app is a *sync consumer*: it never mints these aggregates —
it projects them into local read-model tables from the webhook feed and reads them on
its request path (see ``app/passport/``).

Design decisions for Prepper (see ``app/passport/README`` intent):

- **Primary keys are the Passport UUIDs, adopted verbatim** (conformance rule 5), stored
  as ``str`` — exactly like ``users.id`` (which is the Supabase ``sub``). Storing the UUID
  as text keeps a single cross-dialect representation (SQLite in tests, Postgres in prod)
  and never re-keys to a serial.
- **No foreign keys to local tables.** The membership payload *embeds* ``email`` /
  ``display_name`` (trap 4), and identity links may arrive before or after the local
  ``users`` row exists, so these projections stay deliberately loose.
- **Mutable aggregates carry ``version``** (the receiver's version guard). Immutable ones
  (identity links) have no version.

These are a **read-only projection**: only the sync backend (service-role / BYPASSRLS)
writes them. The migration enables + forces RLS with no client policies (default-deny) so
``anon`` / ``authenticated`` can never read member emails directly.

Only the aggregates Prepper actually reads are projected here: organization, membership,
entitlement, identity link. Passport *units* / *relations* are intentionally NOT projected
(Prepper keeps its own serial-PK ``outlets`` table, untouched) — the corresponding sync
handlers are conforming no-ops.
"""

from sqlmodel import Field, SQLModel


class PassportOrganization(SQLModel, table=True):
    """Projected from ``org.upserted`` / ``org.archived``. Mutable (version-guarded)."""

    __tablename__ = "passport_organization"

    id: str = Field(primary_key=True)
    name: str
    slug: str = Field(index=True)
    status: str  # active | suspended | archived
    version: int


class PassportMembership(SQLModel, table=True):
    """Projected from ``membership.upserted`` / ``membership.removed``. Mutable.

    ``status=removed`` is a KEPT row (trap 1), never a delete. ``platform_user_id`` is the
    join key to identity links for role projection. ``email`` / ``display_name`` are
    embedded in the payload — no separate user table is required for matching (trap 4).
    """

    __tablename__ = "passport_membership"

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    platform_user_id: str = Field(index=True)
    role: str  # Owner | Admin | Member (exact strings)
    status: str  # active | removed  (removed = kept tombstone)
    version: int
    email: str
    display_name: str | None = None


class PassportEntitlement(SQLModel, table=True):
    """Projected from ``entitlement.upserted``. Mutable (version-guarded).

    Revocation arrives here too (trap 2): ``status != "active"`` is an org-level kill
    switch, not a separate remove event. The incoming non-active state is always applied.
    """

    __tablename__ = "passport_entitlement"

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    app_id: str
    status: str  # active | inactive | suspended  (status != active blocks the org)
    tier: str | None = None
    source: str  # admin | stripe
    version: int


class PassportIdentityLink(SQLModel, table=True):
    """Projected from ``identity_link.created`` / ``.removed``. IMMUTABLE — no version.

    Resolves a membership (``platform_user_id``) to a local app user (``subject`` == the
    app's Supabase ``sub`` == ``users.id``). ``identity_link.*`` events arrive only for
    this app, so there is at most one link per platform user here.
    """

    __tablename__ = "passport_identity_link"

    id: str = Field(primary_key=True)
    platform_user_id: str = Field(index=True)
    app_id: str
    subject: str = Field(index=True)  # join key to the local users.id
    linked_via: str  # import | email_match | manual
