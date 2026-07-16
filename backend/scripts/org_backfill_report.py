"""Org backfill report — how much of the domain can be assigned to an org from the DATA?

READ-ONLY. Runs no DDL, writes nothing, takes no locks beyond the reads. Safe against production,
which is the point: the backfill rule for undecidable rows must be chosen from real numbers, and a
wrong assignment silently hands one org's data to another — the one outcome worth avoiding, because
it loses a user access to their own recipe.

Run:

    python -m scripts.org_backfill_report

Reports, per table: rows derivable from an authoritative unit link, rows derivable from a
single-org owner, and rows that are genuinely UNDECIDABLE.

Read the "undecidable" column first. For `ingredients`, `categories` and `menus_sketch` it is
expected to be 100%: those tables have no owner column and no unit link, so nothing in the data
says which org a row belongs to. They were a globally-shared pool. No ownership rule can fix that —
the answer has to come from a human who knows the history (almost always: "everything predates the
second org, so it is org X's").

Derivation, by table:

    recipes          recipe_outlets.organization_id (authoritative) -> else owner_id -> membership
    menus            menu_outlets.organization_id  (authoritative) -> else created_by -> membership
    tasting_sessions creator_id -> membership
    suppliers        supplier_ingredients -> outlet_supplier_ingredient.organization_id
    ingredients      (none)
    categories       (none)
    menus_sketch     (none)

An owner-based derivation only counts when that user belongs to exactly ONE active org. A multi-org
owner's rows are undecidable by definition — that is the ambiguity this report exists to size.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field

from sqlalchemy import text
from sqlmodel import Session, create_engine

from app.config import get_settings

# A row whose org is derivable from more than one distinct org via its links is NOT derivable —
# it is a genuine conflict and must be reported, not silently resolved to the first match.
_LINK_DERIVABLE = """
SELECT COUNT(*) FROM {table} t
WHERE t.organization_id IS NULL
  AND (SELECT COUNT(DISTINCT l.organization_id) FROM {link} l WHERE l.{fk} = t.id) = 1
"""

_LINK_CONFLICT = """
SELECT COUNT(*) FROM {table} t
WHERE t.organization_id IS NULL
  AND (SELECT COUNT(DISTINCT l.organization_id) FROM {link} l WHERE l.{fk} = t.id) > 1
"""

# An owner resolves through the projection, and only if they belong to exactly one active org.
#
# Resolution is identity link OR verified email — the same chain `deps.get_org_context` uses, and
# for the same reason: `identity_link` is written on SSO login (`report_identity_link_safe`), so
# anyone who has not logged in since SSO went live has no link at all. Measured on staging, the
# link-only form derived 0 of 11 recipes and 0 of 13 tasting sessions; adding the email path
# derived all of them. A report that models a chain the app does not use tells you nothing about
# what the app can see.
_OWNER_DERIVABLE = """
SELECT COUNT(*) FROM {table} t
JOIN users u ON u.id = t.{owner}
WHERE t.organization_id IS NULL
  AND {not_link_derivable}
  AND (
    SELECT COUNT(DISTINCT m.organization_id)
    FROM passport.membership m
    WHERE m.status = 'active'
      AND (
        m.platform_user_id IN (
          SELECT il.platform_user_id FROM passport.identity_link il WHERE il.subject = t.{owner}
        )
        OR lower(m.email) = lower(u.email)
      )
  ) = 1
"""

# The buckets MUST be disjoint or the coverage sums past the total. Measured on staging before this
# was added: `menus` reported total=3, by_link=1, by_owner=3 -> UNDECIDABLE = -1, because a row with
# both a unit link and a resolvable owner was counted twice. An over-counted "derivable" understates
# how many rows need a human decision, which is the one number this report exists to produce.
#
# The link is authoritative (it carries the org of a unit the row is actually served at), so it
# wins; the owner is the fallback for rows with no link.
_NOT_LINK_DERIVABLE = (
    "(SELECT COUNT(DISTINCT l.organization_id) FROM {link} l WHERE l.{fk} = t.id) = 0"
)
_NO_LINK_TABLE = (
    "TRUE"  # tables with no link table at all: every owner-derivation is the only one
)

_TOTAL = "SELECT COUNT(*) FROM {table}"
_UNSET = "SELECT COUNT(*) FROM {table} WHERE organization_id IS NULL"


@dataclass
class TableSpec:
    table: str
    link: str | None = None
    fk: str | None = None
    owner: str | None = None
    note: str = ""


@dataclass
class TableReport:
    table: str
    total: int = 0
    already_set: int = 0
    by_link: int = 0
    link_conflict: int = 0
    by_owner: int = 0
    note: str = ""
    warnings: list[str] = field(default_factory=list)

    @property
    def undecidable(self) -> int:
        return self.total - self.already_set - self.by_link - self.by_owner


SPECS: tuple[TableSpec, ...] = (
    TableSpec("recipes", link="recipe_outlets", fk="recipe_id", owner="owner_id"),
    TableSpec("menus", link="menu_outlets", fk="menu_id", owner="created_by"),
    TableSpec("tasting_sessions", owner="creator_id"),
    TableSpec(
        "suppliers",
        note="only via supplier_ingredients -> outlet_supplier_ingredient; counted as link",
    ),
    TableSpec(
        "ingredients", note="NO owner column, NO unit link — nothing to derive from"
    ),
    TableSpec(
        "categories", note="NO owner column, NO unit link — nothing to derive from"
    ),
    TableSpec(
        "menus_sketch", note="NO owner column, NO unit link — nothing to derive from"
    ),
)

# Suppliers reach an org only through two hops, so they get their own query rather than the
# generic single-hop one.
_SUPPLIER_DERIVABLE = """
SELECT COUNT(*) FROM suppliers s
WHERE s.organization_id IS NULL
  AND (
    SELECT COUNT(DISTINCT osi.organization_id)
    FROM supplier_ingredients si
    JOIN outlet_supplier_ingredient osi ON osi.supplier_ingredient_id = si.id
    WHERE si.supplier_id = s.id
  ) = 1
"""


def _scalar(session: Session, sql: str) -> int:
    return int(session.exec(text(sql)).one()[0])  # type: ignore[call-overload]


def report_for(session: Session, spec: TableSpec) -> TableReport:
    r = TableReport(table=spec.table, note=spec.note)
    r.total = _scalar(session, _TOTAL.format(table=spec.table))
    unset = _scalar(session, _UNSET.format(table=spec.table))
    r.already_set = r.total - unset

    if spec.table == "suppliers":
        r.by_link = _scalar(session, _SUPPLIER_DERIVABLE)
    elif spec.link and spec.fk:
        r.by_link = _scalar(
            session,
            _LINK_DERIVABLE.format(table=spec.table, link=spec.link, fk=spec.fk),
        )
        r.link_conflict = _scalar(
            session, _LINK_CONFLICT.format(table=spec.table, link=spec.link, fk=spec.fk)
        )
        if r.link_conflict:
            r.warnings.append(
                f"{r.link_conflict} row(s) link to MORE THAN ONE org — a genuine conflict, "
                f"not a gap. Nothing today prevents it; decide whether it should."
            )

    if spec.owner:
        # Exclude anything the link already claimed, so the buckets stay disjoint.
        not_link = (
            _NOT_LINK_DERIVABLE.format(link=spec.link, fk=spec.fk)
            if spec.link and spec.fk
            else _NO_LINK_TABLE
        )
        r.by_owner = _scalar(
            session,
            _OWNER_DERIVABLE.format(
                table=spec.table, owner=spec.owner, not_link_derivable=not_link
            ),
        )

    return r


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Report org-backfill coverage (read-only)."
    )
    parser.add_argument(
        "--database-url", default=None, help="defaults to settings.database_url"
    )
    args = parser.parse_args()

    url = args.database_url or get_settings().database_url
    engine = create_engine(url)

    print("Org backfill coverage — READ-ONLY, nothing is written.\n")
    header = f"{'table':<18}{'total':>8}{'set':>8}{'by link':>9}{'by owner':>10}{'UNDECIDABLE':>13}"
    print(header)
    print("-" * len(header))

    reports = []
    with Session(engine) as session:
        for spec in SPECS:
            r = report_for(session, spec)
            reports.append(r)
            print(
                f"{r.table:<18}{r.total:>8}{r.already_set:>8}{r.by_link:>9}"
                f"{r.by_owner:>10}{r.undecidable:>13}"
            )

    total_undecidable = sum(r.undecidable for r in reports)
    print(f"\nTOTAL UNDECIDABLE: {total_undecidable}")

    notes = [r for r in reports if r.note]
    if notes:
        print("\nNotes:")
        for r in notes:
            print(f"  {r.table:<18} {r.note}")

    warned = [r for r in reports if r.warnings]
    if warned:
        print("\nWarnings:")
        for r in warned:
            for w in r.warnings:
                print(f"  {r.table:<18} {w}")

    print(
        "\nA row is 'by owner' only when that owner belongs to exactly ONE active org.\n"
        "Multi-org owners are undecidable BY DEFINITION — that ambiguity is the point of this report.\n"
        "Run `python -m app.passport.reconcile` first: a stale projection inflates 'undecidable'\n"
        "(the safe direction — it never assigns a row to the wrong org)."
    )


if __name__ == "__main__":
    main()
