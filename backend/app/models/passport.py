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

**Schema namespace (design 2026-07-15).** Every projected table lives in a dedicated ``passport``
Postgres schema (``passport.organization``, ``passport.membership`` …) rather than a ``passport_``
name prefix. Postgres has no schema on SQLite, so the app + test engines carry a
``schema_translate_map`` that collapses ``passport`` → the default schema on SQLite (see
``app/database.py`` and ``tests/conftest.py``); on Postgres the real schema is used. The relocation
migration also re-qualifies the two ``SECURITY DEFINER`` RLS helpers that read this projection.

All eight aggregates are projected: organization, unit, unit relation, membership,
entitlement, identity link, unit-app access, unit-app membership. The last two ARE the
access model — app access is DERIVED from the entitlement, the org role (the Owner/Admin
ladder), the brand-app switch (``unit_app_access``) and the (user, brand, app) role row
(``unit_app_membership``); there is no per-user app grant. Units are needed too, because the
derivation checks ``unit.status`` and the unit's org.

Prepper's own ``outlets`` table (serial int PK, its own hierarchy + cycle detection) is a
TOOL-LOCAL table and stays exactly as it is — never re-keyed to a UUID. It is linked to a
projected brand by ``outlets.passport_unit_id``, resolved from ``PassportUnit.external_ref``
matching ``outlets.code``.
"""

from sqlmodel import Field, SQLModel


class PassportOrganization(SQLModel, table=True):
    """Projected from ``org.upserted`` / ``org.archived``. Mutable (version-guarded)."""

    __tablename__ = "organization"

    __table_args__ = {"schema": "passport"}

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

    __tablename__ = "membership"

    __table_args__ = {"schema": "passport"}

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

    __tablename__ = "entitlement"

    __table_args__ = {"schema": "passport"}

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    app_id: str
    status: str  # active | inactive | suspended  (status != active blocks the org)
    tier: str | None = None
    source: str  # admin | stripe
    version: int


class PassportUnit(SQLModel, table=True):
    """Projected from ``unit.upserted`` / ``unit.archived``. Mutable (version-guarded).

    A unit is a brand, outlet or entity (``type``). Only BRANDS hold people and apps, but
    every unit is projected because the access derivation checks a brand's ``status`` and
    ``organization_id``.

    ``external_ref`` is Passport's free-form pointer back into the consuming tool. Prepper
    populates a brand's ``external_ref`` with the local ``outlets.code`` (e.g. ``"CS"``);
    that is the ONLY link between a Passport brand UUID and a Prepper outlet id.
    """

    __tablename__ = "unit"

    __table_args__ = {"schema": "passport"}

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    type: str = Field(index=True)  # brand | outlet | entity  (payload field is `type`)
    name: str
    external_ref: str | None = Field(default=None, index=True)  # -> outlets.code
    status: str  # active | archived
    version: int


class PassportUnitRelation(SQLModel, table=True):
    """Projected from ``unit_relation.created`` / ``.removed``. IMMUTABLE — no version.

    Structure edges between units (e.g. an outlet ``belongs_to_brand``). The payload field
    is ``relation`` (not ``relation_type``).
    """

    __tablename__ = "unit_relation"

    __table_args__ = {"schema": "passport"}

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    from_unit_id: str = Field(index=True)
    to_unit_id: str = Field(index=True)
    relation: str


class PassportUnitAppAccess(SQLModel, table=True):
    """Projected from ``unit_app_access.created`` / ``.removed``. IMMUTABLE — no version.

    The brand-app switch: a brand that carries NO row for this app confers nothing, not
    even to an org Owner. Delivery is own-app scoped, so every row here names Prepper —
    never filter by ``app_id`` locally.
    """

    __tablename__ = "unit_app_access"

    __table_args__ = {"schema": "passport"}

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    unit_id: str = Field(index=True)  # always a BRAND
    app_id: str


class PassportUnitAppMembership(SQLModel, table=True):
    """Projected from ``unit_app_membership.upserted`` / ``.removed``. Mutable.

    The (user, brand, app) role row. ``status="removed"`` is a KEPT tombstone (same as trap
    1 on org membership) — never a delete; the row going dormant is what lets a restored
    entitlement bring access back losslessly.

    ``role`` is ``Manager`` | ``Staff`` — a DIFFERENT vocabulary from the org membership's
    ``Owner`` | ``Admin`` | ``Member``. Do not conflate them.
    """

    __tablename__ = "unit_app_membership"

    __table_args__ = {"schema": "passport"}

    id: str = Field(primary_key=True)
    organization_id: str = Field(index=True)
    platform_user_id: str = Field(index=True)
    unit_id: str = Field(index=True)  # always a BRAND
    app_id: str
    role: str  # Manager | Staff
    status: str  # active | removed  (removed = kept tombstone)
    version: int


class PassportIdentityLink(SQLModel, table=True):
    """Projected from ``identity_link.created`` / ``.removed``. IMMUTABLE — no version.

    Resolves a membership (``platform_user_id``) to a local app user (``subject`` == the
    app's Supabase ``sub`` == ``users.id``). ``identity_link.*`` events arrive only for
    this app, so there is at most one link per platform user here.
    """

    __tablename__ = "identity_link"

    __table_args__ = {"schema": "passport"}

    id: str = Field(primary_key=True)
    platform_user_id: str = Field(index=True)
    app_id: str
    subject: str = Field(index=True)  # join key to the local users.id
    linked_via: str  # import | email_match | manual
