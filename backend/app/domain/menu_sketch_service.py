"""Menu sketch service — business logic for freeform menu sketches."""

from datetime import datetime

from sqlmodel import Session, select

from app.domain.org_scope import org_scope
from app.models.menu_sketch import (
    MenuSketch,
    MenuSketchCreate,
    MenuSketchUpdate,
)
from app.models.menu_sketch_section import MenuSketchSection
from app.models.menu_sketch_section_item import MenuSketchSectionItem


class MenuSketchService:
    """Service for menu sketch management."""

    def __init__(self, session: Session, organization_id: str):
        """``organization_id`` is required and has no default — see `CategoryService.__init__`."""
        self.session = session
        self.organization_id = organization_id

    def list_sketches(self, include_archived: bool = False) -> list[MenuSketch]:
        """Return this org's menu sketches, ordered by most recently updated.

        When *include_archived* is False (default) archived sketches are excluded.
        """
        stmt = select(MenuSketch).where(org_scope(MenuSketch, self.organization_id))
        if not include_archived:
            stmt = stmt.where(MenuSketch.status != "archived")
        stmt = stmt.order_by(MenuSketch.updated_at.desc())  # type: ignore[arg-type]
        return list(self.session.exec(stmt).all())

    def get_sketch(self, sketch_id: int) -> MenuSketch | None:
        """Get a single sketch by ID, within this org.

        Every mutating method on this service (update, fork, delete, and the section/item routes
        that resolve a sketch first) funnels through here — so this predicate is the whole
        family's org boundary, not just the read's.
        """
        return self.session.exec(
            select(MenuSketch).where(
                MenuSketch.id == sketch_id,
                org_scope(MenuSketch, self.organization_id),
            )
        ).first()

    def create_sketch(self, data: MenuSketchCreate) -> MenuSketch:
        """Create a new sketch, stamped with the acting org.

        The org comes from the acting org context, never the request body — the Create schemas
        have no such field. A tenant id a client can assert is not a tenant id.
        """
        sketch = MenuSketch(
            name=data.name,
            version=1,
            status="draft",
            notes=None,
            organization_id=self.organization_id,
        )
        self.session.add(sketch)
        self.session.commit()
        self.session.refresh(sketch)
        return sketch

    def update_sketch(
        self, sketch_id: int, data: MenuSketchUpdate
    ) -> MenuSketch | None:
        """Update mutable fields on a sketch."""
        sketch = self.session.get(MenuSketch, sketch_id)
        if sketch is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(sketch, field, value)
        if update_data:
            sketch.updated_at = datetime.utcnow()

        self.session.add(sketch)
        self.session.commit()
        self.session.refresh(sketch)
        return sketch

    def delete_sketch(self, sketch_id: int) -> bool:
        """Soft-delete a sketch by setting status to 'archived'.

        Returns True if the sketch was found and archived, False otherwise.
        """
        sketch = self.session.get(MenuSketch, sketch_id)
        if sketch is None:
            return False
        sketch.status = "archived"
        sketch.updated_at = datetime.utcnow()
        self.session.add(sketch)
        self.session.commit()
        return True

    def fork_sketch(self, sketch_id: int) -> MenuSketch | None:
        """Fork a sketch — copy metadata + all sections and items, increment version.

        Resolves through `get_sketch`, not `session.get`: forking is a read of someone's sketch
        followed by a write of a copy, and by primary key alone that read crosses orgs.

        The fork inherits the acting org rather than the original's, so it cannot be written into
        an org the caller isn't acting in. In practice these are the same value — `get_sketch` has
        already established the original is in scope.
        """
        original = self.get_sketch(sketch_id)
        if original is None:
            return None

        forked = MenuSketch(
            name=original.name,
            version=original.version + 1,
            status="draft",
            root=original.id,
            notes=None,
            organization_id=self.organization_id,
        )
        self.session.add(forked)
        self.session.commit()
        self.session.refresh(forked)

        # Copy every section, then every item within each section
        sections = list(
            self.session.exec(
                select(MenuSketchSection)
                .where(MenuSketchSection.menu_sketch_id == sketch_id)
                .order_by(MenuSketchSection.order_no)  # type: ignore[arg-type]
            ).all()
        )
        for section in sections:
            new_section = MenuSketchSection(
                name=section.name,
                menu_sketch_id=forked.id,
                order_no=section.order_no,
            )
            self.session.add(new_section)
            self.session.commit()
            self.session.refresh(new_section)

            items = list(
                self.session.exec(
                    select(MenuSketchSectionItem)
                    .where(MenuSketchSectionItem.menu_sketch_section_id == section.id)
                    .order_by(MenuSketchSectionItem.order_no)  # type: ignore[arg-type]
                ).all()
            )
            for item in items:
                new_item = MenuSketchSectionItem(
                    menu_sketch_section_id=new_section.id,
                    recipe_id=item.recipe_id,
                    sales_price=item.sales_price,
                    cost_price=item.cost_price,
                    margin=item.margin,
                    description=item.description,
                    is_highlight=item.is_highlight,
                    icons=item.icons if isinstance(item.icons, list) else [],
                    order_no=item.order_no,
                )
                self.session.add(new_item)
            self.session.commit()

        return forked
