"""Pure synchronous persistence for the Passport read-model — the version guard lives here.

This module holds the load-bearing conformance logic (the ``>=`` version guard, trap 1's
keep-the-row on removal, trap 2's revocation-as-upsert) and deliberately imports **no**
``passport_client`` symbols: it operates on plain ``dict`` payloads and Prepper's
synchronous SQLModel ``Session``. That keeps it fully unit-testable on SQLite while the
SDK-typed handlers (``handlers.py``) are thin adapters that unpack ``payload.model_dump()``
and delegate here.

The upsert is dialect-aware: ``INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE
excluded.version >= <table>.version`` on both Postgres (prod) and SQLite (tests). The
``WHERE`` on the ``DO UPDATE`` makes an older or replayed event a no-op at the DB level —
this IS the version guard, and it is race-free against concurrent deliveries. ``>=`` (not
``>``) keeps equal-version replays idempotent (trap 3).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session

from app.models import (
    PassportEntitlement,
    PassportIdentityLink,
    PassportMembership,
    PassportOrganization,
    PassportUnit,
    PassportUnitAppAccess,
    PassportUnitAppMembership,
    PassportUnitRelation,
)

_BRAND = "brand"


def is_newer(incoming_version: int, stored_version: int | None) -> bool:
    """Mirror of the SDK ``is_newer``: apply when nothing is stored OR the incoming
    version is greater-than-OR-EQUAL to the stored one.

    The ``>=`` is load-bearing (trap 3): an equal-version replay must re-apply
    idempotently. Never use ``>``.
    """
    return stored_version is None or incoming_version >= stored_version


def _insert(session: Session) -> Any:
    """Pick the dialect-specific ``insert`` that supports ``ON CONFLICT``.

    Both Postgres and SQLite expose ``on_conflict_do_update`` / ``on_conflict_do_nothing``
    with an ``excluded`` pseudo-table, with the same call shape.
    """
    dialect = session.get_bind().dialect.name
    return pg_insert if dialect == "postgresql" else sqlite_insert


def _versioned_upsert(session: Session, model: Any, values: dict[str, Any]) -> None:
    """Atomic ``INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE excluded.version >=
    existing.version`` for a mutable aggregate. Commits."""
    table = model.__table__
    stmt = _insert(session)(table).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[table.c.id],
        set_={c.name: stmt.excluded[c.name] for c in table.columns if c.name != "id"},
        where=stmt.excluded.version >= table.c.version,
    )
    session.execute(stmt)
    session.commit()


def _insert_if_absent(session: Session, model: Any, values: dict[str, Any]) -> None:
    """Immutable aggregate: ``INSERT ... ON CONFLICT (id) DO NOTHING``. Commits."""
    table = model.__table__
    stmt = _insert(session)(table).values(**values).on_conflict_do_nothing(
        index_elements=[table.c.id]
    )
    session.execute(stmt)
    session.commit()


def _delete_if_present(session: Session, model: Any, pk: str) -> None:
    """Immutable aggregate removal: delete the row if it exists. Commits."""
    row = session.get(model, pk)
    if row is not None:
        session.delete(row)
        session.commit()


# --- mutable aggregates -------------------------------------------------------------------

def apply_org(session: Session, values: dict[str, Any]) -> None:
    """``org.upserted`` / ``org.archived`` — archived is carried in ``status``."""
    _versioned_upsert(session, PassportOrganization, values)


def apply_membership(session: Session, values: dict[str, Any]) -> None:
    """``membership.upserted`` AND ``membership.removed`` (trap 1: removed keeps the row
    with ``status="removed"`` — the payload carries that status and a bumped version)."""
    _versioned_upsert(session, PassportMembership, values)


def apply_entitlement(session: Session, values: dict[str, Any]) -> None:
    """``entitlement.upserted`` — revocations (``status != "active"``) arrive here too
    (trap 2) and are applied like any other state; never filtered out."""
    _versioned_upsert(session, PassportEntitlement, values)


def apply_unit(session: Session, values: dict[str, Any]) -> None:
    """``unit.upserted`` / ``unit.archived`` — archived is carried in ``status``."""
    _versioned_upsert(session, PassportUnit, values)


def apply_unit_app_membership(session: Session, values: dict[str, Any]) -> None:
    """``unit_app_membership.upserted`` AND ``.removed``.

    Same shape as trap 1: ``removed`` carries ``status="removed"`` plus a bumped version and
    KEEPS the row. Deleting it would lose the roster permanently — a revoked-then-restored
    entitlement must come back losslessly, and access dies by arithmetic in the meantime.
    """
    _versioned_upsert(session, PassportUnitAppMembership, values)


# --- immutable aggregates -----------------------------------------------------------------

def create_identity_link(session: Session, values: dict[str, Any]) -> None:
    """``identity_link.created`` — insert-if-absent."""
    _insert_if_absent(session, PassportIdentityLink, values)


def remove_identity_link(session: Session, link_id: str) -> None:
    """``identity_link.removed`` — delete-if-present."""
    _delete_if_present(session, PassportIdentityLink, link_id)


def create_relation(session: Session, values: dict[str, Any]) -> None:
    """``unit_relation.created`` — insert-if-absent."""
    _insert_if_absent(session, PassportUnitRelation, values)


def remove_relation(session: Session, relation_id: str) -> None:
    """``unit_relation.removed`` — delete-if-present."""
    _delete_if_present(session, PassportUnitRelation, relation_id)


def create_unit_app_access(session: Session, values: dict[str, Any]) -> None:
    """``unit_app_access.created`` — insert-if-absent (the brand-app switch, no version)."""
    _insert_if_absent(session, PassportUnitAppAccess, values)


def remove_unit_app_access(session: Session, access_id: str) -> None:
    """``unit_app_access.removed`` — delete-if-present.

    Unlike the role rows this IS a real delete: the switch is immutable and its absence is
    exactly what makes the brand confer nothing.
    """
    _delete_if_present(session, PassportUnitAppAccess, access_id)

