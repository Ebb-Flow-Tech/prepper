"""The org predicate for domain queries — in one place.

Step 3 of org isolation. `q1orgcol9p0q` added `organization_id`, `q2orgfill1r2s` filled it, creates
now stamp it, and this is what finally makes queries respect it.

One helper rather than the predicate written out at every call site, for the reason the whole guard
module exists: a rule each query has to remember is a rule some query will forget, and the forgetting
is silent.
"""

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col


def org_scope(model: type, organization_id: str) -> ColumnElement[bool]:
    """Rows belonging to ``organization_id`` — plus, for now, rows belonging to no org at all.

    **The `IS NULL` arm is transitional and self-eliminating.** `organization_id` only exists from
    `q1orgcol9p0q` and is only populated where `q2orgfill1r2s` has run, so a bare
    ``organization_id == active_org`` would make every pre-backfill row vanish from the UI — a
    catalogue of 6,890 ingredients disappearing the moment this deployed. NULL rows are the rows
    that were global before, so admitting them changes nothing that was not already true.

    It costs nothing once the backfill lands: no NULLs remain, so the arm matches nothing, and
    migration 3's `NOT NULL` makes it formally dead. Delete it then.

    Do not read this as "NULL means everyone's". It means "not yet assigned", and the only correct
    response to that is to assign it — which is what `q2orgfill1r2s` does.
    """
    column = col(model.organization_id)
    return or_(column == organization_id, column.is_(None))
