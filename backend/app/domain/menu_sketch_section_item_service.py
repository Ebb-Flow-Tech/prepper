"""Menu sketch section item service — business logic for dish items."""

from datetime import datetime

from sqlmodel import Session, select

from app.models.menu_sketch_section import MenuSketchSection
from app.models.menu_sketch_section_item import (
    MenuSketchSectionItem,
    MenuSketchSectionItemCreate,
    MenuSketchSectionItemRead,
    MenuSketchSectionItemUpdate,
    MenuSketchTastingNoteRead,
)
from app.models.recipe import Recipe, RecipeStatus
from app.models.tasting import TastingNote, TastingSession


class MenuSketchSectionItemService:
    """Service for menu sketch section item (dish) management."""

    def __init__(self, session: Session, organization_id: str):
        """``organization_id`` is required and has no default — see `CategoryService.__init__`.

        Naming a dish on a sketch AUTO-CREATES a draft recipe (`_auto_create_recipe`), so this
        service is a create path even though nothing about it says "create recipe". It stamped no
        org, so every dish named this way produced an orphan — invisible to its own author once
        reads filtered on the org. Found by `q3orgnn3t4u`, not by a test.
        """
        self.session = session
        self.organization_id = organization_id

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _recipe_name(self, recipe_id: int | None) -> str | None:
        if recipe_id is None:
            return None
        recipe = self.session.get(Recipe, recipe_id)
        return recipe.name if recipe else None

    def _fetch_tasting_notes_bulk(
        self, recipe_ids: list[int]
    ) -> dict[int, list[MenuSketchTastingNoteRead]]:
        """Single query: load tasting notes for all given recipe IDs, grouped by recipe_id."""
        if not recipe_ids:
            return {}
        rows = self.session.exec(
            select(TastingNote, TastingSession)
            .join(TastingSession, TastingNote.session_id == TastingSession.id)
            .where(TastingNote.recipe_id.in_(recipe_ids))  # type: ignore[attr-defined]
            .order_by(TastingSession.date.desc())  # type: ignore[arg-type]
        ).all()
        result: dict[int, list[MenuSketchTastingNoteRead]] = {}
        for note, session in rows:
            entry = MenuSketchTastingNoteRead(
                id=note.id,
                feedback=note.feedback,
                taster_name=note.taster_name,
                decision=note.decision,
                overall_rating=note.overall_rating,
                session_name=session.name,
                session_date=session.date,
                created_at=note.created_at,
            )
            result.setdefault(note.recipe_id, []).append(entry)
        return result

    def _to_read(
        self,
        item: MenuSketchSectionItem,
        tasting_notes: list[MenuSketchTastingNoteRead] | None = None,
    ) -> MenuSketchSectionItemRead:
        if tasting_notes is None:
            # Single-item path: fetch lazily (used for create/update responses)
            tasting_notes = self._fetch_tasting_notes_bulk(
                [item.recipe_id] if item.recipe_id else []
            ).get(item.recipe_id or 0, [])
        return MenuSketchSectionItemRead(
            id=item.id,
            menu_sketch_section_id=item.menu_sketch_section_id,
            recipe_id=item.recipe_id,
            recipe_name=self._recipe_name(item.recipe_id),
            sales_price=item.sales_price,
            cost_price=item.cost_price,
            margin=item.margin,
            description=item.description,
            is_highlight=item.is_highlight,
            icons=item.icons if isinstance(item.icons, list) else [],
            order_no=item.order_no,
            tasting_notes=tasting_notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    def _auto_create_recipe(self, name: str, owner_id: str | None = None) -> Recipe:
        recipe = Recipe(
            name=name,
            status=RecipeStatus.DRAFT,
            owner_id=owner_id,
            organization_id=self.organization_id,
        )
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def _recipe_has_feedback(self, recipe_id: int) -> bool:
        """Return True if any tasting note exists for this recipe."""
        result = self.session.exec(
            select(TastingNote).where(TastingNote.recipe_id == recipe_id).limit(1)
        ).first()
        return result is not None

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def list_items(self, section_id: int) -> list[MenuSketchSectionItemRead]:
        """Return all items for a section ordered by order_no."""
        items = list(
            self.session.exec(
                select(MenuSketchSectionItem)
                .where(MenuSketchSectionItem.menu_sketch_section_id == section_id)
                .order_by(MenuSketchSectionItem.order_no)
            ).all()
        )
        recipe_ids = [i.recipe_id for i in items if i.recipe_id is not None]
        notes_map = self._fetch_tasting_notes_bulk(recipe_ids)
        return [self._to_read(i, notes_map.get(i.recipe_id or 0, [])) for i in items]

    def create_item(
        self, data: MenuSketchSectionItemCreate, owner_id: str | None = None
    ) -> MenuSketchSectionItemRead | None:
        """Create a dish item. Returns None if section does not exist.

        If recipe_id is None and name is provided, a new draft Recipe is
        auto-created and linked to the item.
        """
        section = self.session.get(MenuSketchSection, data.menu_sketch_section_id)
        if section is None:
            return None

        recipe_id = data.recipe_id
        if recipe_id is None and data.name:
            recipe_id = self._auto_create_recipe(data.name, owner_id).id

        item = MenuSketchSectionItem(
            menu_sketch_section_id=data.menu_sketch_section_id,
            recipe_id=recipe_id,
            sales_price=data.sales_price,
            cost_price=data.cost_price,
            description=data.description,
            is_highlight=data.is_highlight,
            icons=data.icons,
            order_no=data.order_no,
        )
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return self._to_read(item)

    def update_item(
        self, item_id: int, data: MenuSketchSectionItemUpdate, owner_id: str | None = None
    ) -> MenuSketchSectionItemRead | None:
        """Update a dish item with optional recipe fork logic.

        Name-change rules (when ``name`` is supplied):
        - Linked recipe has tasting feedback → fork it (version+1, root_id=old id),
          point item.recipe_id at the fork.
        - No feedback → rename the recipe in place.
        - No linked recipe (recipe_id is None) → auto-create a new recipe.

        Passing ``recipe_id`` explicitly always switches the link to that recipe
        and skips the fork/rename logic.
        """
        item = self.session.get(MenuSketchSectionItem, item_id)
        if item is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        new_name = update_data.pop("name", None)
        new_recipe_id = update_data.pop("recipe_id", None)

        # ── Recipe linkage ──────────────────────────────────────────────
        if new_recipe_id is not None:
            # Explicit recipe switch — no rename involved
            item.recipe_id = new_recipe_id

        elif new_name is not None:
            if item.recipe_id is not None:
                recipe = self.session.get(Recipe, item.recipe_id)
                if recipe is not None:
                    if self._recipe_has_feedback(item.recipe_id):
                        # Recipe has feedback — fork to preserve history
                        forked = Recipe(
                            name=new_name,
                            version=recipe.version + 1,
                            root_id=recipe.id,
                            yield_quantity=recipe.yield_quantity,
                            yield_unit=recipe.yield_unit,
                            is_prep_recipe=recipe.is_prep_recipe,
                            status=recipe.status,
                            owner_id=recipe.owner_id,
                            # The fourth hand-rolled fork in this codebase, and the fourth to
                            # forget the org (see `fork_recipe`, `fork_sketch`, `fork_menu`).
                            # Copying a row field-by-field means every new column has to be
                            # remembered in four places; `organization_id` was remembered in none.
                            organization_id=recipe.organization_id,
                        )
                        self.session.add(forked)
                        self.session.commit()
                        self.session.refresh(forked)
                        item.recipe_id = forked.id
                    else:
                        # No feedback — safe to rename in place
                        recipe.name = new_name
                        self.session.add(recipe)
            else:
                # No linked recipe — create one with the given name
                item.recipe_id = self._auto_create_recipe(new_name, owner_id).id

        # ── Apply remaining field updates ───────────────────────────────
        for field, value in update_data.items():
            setattr(item, field, value)
        item.updated_at = datetime.utcnow()

        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return self._to_read(item)

    def delete_item(self, item_id: int) -> bool:
        """Hard-delete an item row. The linked recipe is NOT deleted."""
        item = self.session.get(MenuSketchSectionItem, item_id)
        if item is None:
            return False
        self.session.delete(item)
        self.session.commit()
        return True
