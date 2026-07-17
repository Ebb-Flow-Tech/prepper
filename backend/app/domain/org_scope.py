"""The org predicate for domain queries — in one place.

`q1orgcol9p0q` added `organization_id`, `q2orgfill1r2s` filled it, v0.0.65 made creates stamp it,
`q3orgnn3t4u` made it NOT NULL, and this is what makes queries respect it.

One helper rather than the predicate written out at every call site, for the reason the whole guard
module exists: a rule each query has to remember is a rule some query will forget, and the forgetting
is silent.
"""

from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col


def org_scope(model: type, organization_id: str) -> ColumnElement[bool]:
    """Rows belonging to ``organization_id``.

    This carried an `OR organization_id IS NULL` arm until `q3orgnn3t4u`. That was transitional and
    load-bearing at the time — the column was nullable, and a bare equality would have erased every
    un-backfilled row from the UI on deploy (6,890 ingredients, among others). It was also a
    standing cross-org hole for as long as it existed: a NULL row was visible to EVERY org, so any
    write path that forgot to stamp produced a row everybody could see. Four of them did
    (`fork_recipe`, `fork_sketch`, `fork_menu`, and the sketch-item rename fork), plus the category
    agent.

    NOT NULL retired both problems at once, and the arm with them. Do not add it back: a NULL is now
    unrepresentable, so an `IS NULL` arm can only ever match rows that a future migration
    accidentally allows — which is precisely when you want the query to hide them, not show them.
    """
    return col(model.organization_id) == organization_id
