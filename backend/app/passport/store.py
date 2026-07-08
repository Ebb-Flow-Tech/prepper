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

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session

from app.models import (
    PassportEntitlement,
    PassportIdentityLink,
    PassportMembership,
    PassportOrganization,
)


def is_newer(incoming_version: int, stored_version: int | None) -> bool:
    """Mirror of the SDK ``is_newer``: apply when nothing is stored OR the incoming
    version is greater-than-OR-EQUAL to the stored one.

    The ``>=`` is load-bearing (trap 3): an equal-version replay must re-apply
    idempotently. Never use ``>``.
    """
    return stored_version is None or incoming_version >= stored_version


def _insert(session: Session):
    """Pick the dialect-specific ``insert`` that supports ``ON CONFLICT``.

    Both Postgres and SQLite expose ``on_conflict_do_update`` / ``on_conflict_do_nothing``
    with an ``excluded`` pseudo-table, with the same call shape.
    """
    dialect = session.get_bind().dialect.name
    return pg_insert if dialect == "postgresql" else sqlite_insert


def _versioned_upsert(session: Session, model, values: dict) -> None:
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


def _insert_if_absent(session: Session, model, values: dict) -> None:
    """Immutable aggregate: ``INSERT ... ON CONFLICT (id) DO NOTHING``. Commits."""
    table = model.__table__
    stmt = _insert(session)(table).values(**values).on_conflict_do_nothing(
        index_elements=[table.c.id]
    )
    session.execute(stmt)
    session.commit()


def _delete_if_present(session: Session, model, pk: str) -> None:
    """Immutable aggregate removal: delete the row if it exists. Commits."""
    row = session.get(model, pk)
    if row is not None:
        session.delete(row)
        session.commit()


# --- mutable aggregates -------------------------------------------------------------------

def apply_org(session: Session, values: dict) -> None:
    """``org.upserted`` / ``org.archived`` — archived is carried in ``status``."""
    _versioned_upsert(session, PassportOrganization, values)


def apply_membership(session: Session, values: dict) -> None:
    """``membership.upserted`` AND ``membership.removed`` (trap 1: removed keeps the row
    with ``status="removed"`` — the payload carries that status and a bumped version)."""
    _versioned_upsert(session, PassportMembership, values)


def apply_entitlement(session: Session, values: dict) -> None:
    """``entitlement.upserted`` — revocations (``status != "active"``) arrive here too
    (trap 2) and are applied like any other state; never filtered out."""
    _versioned_upsert(session, PassportEntitlement, values)


# --- immutable aggregates -----------------------------------------------------------------

def create_identity_link(session: Session, values: dict) -> None:
    """``identity_link.created`` — insert-if-absent."""
    _insert_if_absent(session, PassportIdentityLink, values)


def remove_identity_link(session: Session, link_id: str) -> None:
    """``identity_link.removed`` — delete-if-present."""
    _delete_if_present(session, PassportIdentityLink, link_id)
