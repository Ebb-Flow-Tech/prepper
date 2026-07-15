"""Recipe <-> Passport unit links (which brands/outlets a recipe is served at).

This replaces the recipe half of the old `OutletService`. Prepper no longer owns a structure table:
a recipe is linked to a **Passport unit** (a brand or an outlet), keyed by that unit's UUID (rule 5).

There is no hierarchy code here any more. Passport owns structure and enforces its pairing rules
server-side (`REQUIRED_PAIRING`), so the cycle detection Prepper used to carry is not "ported" — it
is deleted, because the invariant it protected is no longer Prepper's to protect.
"""

from sqlmodel import Session, col, select

from app.models import (
    PassportUnit,
    Recipe,
    RecipeOutlet,
    RecipeOutletCreate,
    RecipeOutletUpdate,
)


class RecipeUnitService:
    """Links recipes to the Passport units they are served at."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_recipe(self, recipe_id: int) -> list[RecipeOutlet]:
        return list(
            self.session.exec(
                select(RecipeOutlet).where(RecipeOutlet.recipe_id == recipe_id)
            ).all()
        )

    def units_for_recipes(
        self, recipe_ids: list[int], visible_unit_ids: set[str]
    ) -> dict[int, list[dict[str, object]]]:
        """`{recipe_id: [{unit_id, unit_name, is_active}]}` for a batch of recipes.

        One query for the links + one for the names — never per-recipe (an N+1 across a list view is
        the exact thing this batch endpoint exists to avoid). Restricted to the units the caller may
        see, so a card list can render a recipe's brands without leaking another tenant's.

        The name is resolved server-side (from `passport_unit`) because a recipe may be served at a
        brand OR an outlet, and the client's brand list carries only brands.
        """
        # Every requested recipe appears in the result — with an empty list when it has no visible
        # unit — so the client can tell "no brands" apart from "not in the response".
        result: dict[int, list[dict[str, object]]] = {rid: [] for rid in recipe_ids}
        if not recipe_ids or not visible_unit_ids:
            return result

        links = self.session.exec(
            select(RecipeOutlet).where(
                col(RecipeOutlet.recipe_id).in_(recipe_ids),
                col(RecipeOutlet.unit_id).in_(visible_unit_ids),
            )
        ).all()
        if not links:
            return result

        names = dict(
            self.session.exec(
                select(PassportUnit.id, PassportUnit.name).where(
                    col(PassportUnit.id).in_({link.unit_id for link in links})
                )
            ).all()
        )

        for link in links:
            result[link.recipe_id].append(
                {
                    "unit_id": link.unit_id,
                    "unit_name": names.get(link.unit_id, ""),
                    "is_active": link.is_active,
                }
            )
        return result

    def link(self, recipe_id: int, data: RecipeOutletCreate) -> RecipeOutlet | None:
        """Attach a recipe to a unit. ``None`` when the recipe or the unit does not exist.

        ``organization_id`` is taken from the UNIT, never from config: the unit already names its
        org, so a row cannot be created in the wrong tenant (rule 9).
        """
        if self.session.get(Recipe, recipe_id) is None:
            return None

        unit = self.session.get(PassportUnit, data.unit_id)
        if unit is None:
            return None

        existing = self.session.get(RecipeOutlet, (recipe_id, data.unit_id))
        if existing is not None:
            return existing

        link = RecipeOutlet(
            recipe_id=recipe_id,
            unit_id=data.unit_id,
            organization_id=unit.organization_id,
            is_active=data.is_active,
            price_override=data.price_override,
        )
        self.session.add(link)
        self.session.commit()
        self.session.refresh(link)
        return link

    def update(
        self, recipe_id: int, unit_id: str, data: RecipeOutletUpdate
    ) -> RecipeOutlet | None:
        link = self.session.get(RecipeOutlet, (recipe_id, unit_id))
        if link is None:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(link, field, value)

        self.session.add(link)
        self.session.commit()
        self.session.refresh(link)
        return link

    def unlink(self, recipe_id: int, unit_id: str) -> bool:
        link = self.session.get(RecipeOutlet, (recipe_id, unit_id))
        if link is None:
            return False

        self.session.delete(link)
        self.session.commit()
        return True
