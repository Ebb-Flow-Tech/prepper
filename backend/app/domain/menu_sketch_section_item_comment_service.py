"""Menu sketch section item comment service — business logic for dish comments."""

from datetime import datetime

from sqlmodel import Session, select

from app.models.menu_sketch_section import MenuSketchSection
from app.models.menu_sketch_section_item import MenuSketchSectionItem
from app.models.menu_sketch_section_item_comment import (
    CommentRead,
    DishCommentsRead,
    MenuSketchCommentsResponse,
    MenuSketchSectionItemComment,
    MenuSketchSectionItemCommentCreate,
    MenuSketchSectionItemCommentUpdate,
)
from app.models.recipe import Recipe


class MenuSketchSectionItemCommentService:
    """Service for per-dish comment management on menu sketches."""

    def __init__(self, session: Session):
        self.session = session

    def get_comments_for_menu(self, menu_sketch_id: int) -> MenuSketchCommentsResponse:
        """Return aggregated comments grouped by dish for a full menu.

        Traversal: menus_sketch → menu_sketch_section → menu_sketch_section_item → comments
        """
        sections = self.session.exec(
            select(MenuSketchSection).where(
                MenuSketchSection.menu_sketch_id == menu_sketch_id
            )
        ).all()

        result: list[DishCommentsRead] = []
        for section in sections:
            items = self.session.exec(
                select(MenuSketchSectionItem).where(
                    MenuSketchSectionItem.menu_sketch_section_id == section.id
                )
            ).all()

            for item in items:
                comments = self.session.exec(
                    select(MenuSketchSectionItemComment)
                    .where(
                        MenuSketchSectionItemComment.menu_sketch_section_item_id == item.id
                    )
                    .order_by(MenuSketchSectionItemComment.created_at)
                ).all()

                recipe = self.session.get(Recipe, item.recipe_id) if item.recipe_id else None
                result.append(
                    DishCommentsRead(
                        menu_sketch_section_item_id=item.id,  # type: ignore[arg-type]
                        name=recipe.name if recipe else None,
                        comments=[
                            CommentRead(
                                id=c.id,  # type: ignore[arg-type]
                                text=c.text,
                                resolved=c.resolved,
                                created_at=c.created_at,
                            )
                            for c in comments
                        ],
                    )
                )

        return MenuSketchCommentsResponse(data=result)

    def create_comment(
        self, data: MenuSketchSectionItemCommentCreate
    ) -> MenuSketchSectionItemComment | None:
        """Create a comment. Returns None if item does not exist."""
        item = self.session.get(MenuSketchSectionItem, data.menu_sketch_section_item_id)
        if item is None:
            return None

        comment = MenuSketchSectionItemComment(
            menu_sketch_section_item_id=data.menu_sketch_section_item_id,
            text=data.text,
        )
        self.session.add(comment)
        self.session.commit()
        self.session.refresh(comment)
        return comment

    def update_comment(
        self, comment_id: int, data: MenuSketchSectionItemCommentUpdate
    ) -> MenuSketchSectionItemComment | None:
        """Update comment text. Returns None if not found."""
        comment = self.session.get(MenuSketchSectionItemComment, comment_id)
        if comment is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(comment, field, value)
        if update_data:
            comment.updated_at = datetime.utcnow()

        self.session.add(comment)
        self.session.commit()
        self.session.refresh(comment)
        return comment

    def resolve_comment(self, comment_id: int) -> MenuSketchSectionItemComment | None:
        """Set resolved = True on a comment. Returns None if not found."""
        comment = self.session.get(MenuSketchSectionItemComment, comment_id)
        if comment is None:
            return None

        comment.resolved = True
        comment.updated_at = datetime.utcnow()
        self.session.add(comment)
        self.session.commit()
        self.session.refresh(comment)
        return comment

    def delete_comment(self, comment_id: int) -> bool:
        """Hard-delete a comment. Returns True if found, False otherwise."""
        comment = self.session.get(MenuSketchSectionItemComment, comment_id)
        if comment is None:
            return False
        self.session.delete(comment)
        self.session.commit()
        return True
