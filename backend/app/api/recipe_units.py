"""Recipe <-> Passport unit links.

Replaces the recipe half of the old `/outlets` router. The units themselves are NOT managed here —
brands and outlets are created and edited in Passport, and Prepper only projects them. This router
just says which units a recipe is served at.

Writing to a unit requires `Manager` AT THAT UNIT (rule 8). There is no global "manager": a person
may be `Manager` at one brand and `Staff` at another, so the question is always asked per unit. An
org Owner/Admin holds `Manager` everywhere via Passport's ladder and therefore needs no special case.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import get_current_user, get_session
from app.domain.recipe_unit_service import RecipeUnitService
from app.models import RecipeOutlet, RecipeOutletCreate, RecipeOutletUpdate, User
from app.passport import access

router = APIRouter()

MANAGER = "Manager"


class RecipeUnitsBatchRequest(BaseModel):
    """Fetch unit chips for a list of recipes in one call (a card/list view)."""

    recipe_ids: list[int]


def _require_manager_at(session: Session, user: User, unit_id: str) -> None:
    """403 unless the caller is `Manager` AT THIS UNIT.

    An outlet resolves through `belongs_to_brand` to its brand — people are held at brands, and an
    outlet inherits. `None` means no access *here*; the user may well manage somewhere else, which
    is precisely what a single global flag could not express.
    """
    if access.role_at_unit(session, user.id, unit_id) != MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a manager at this brand",
        )


@router.post("/units/batch", response_model=dict[int, list[dict[str, object]]])
def recipe_units_batch(
    data: RecipeUnitsBatchRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[int, list[dict[str, object]]]:
    """Unit chips (`{recipe_id: [{unit_id, unit_name, is_active}]}`) for a batch of recipes.

    One request for a whole card list — replaces the deleted `/recipes/outlets/batch`. Scoped to the
    caller's accessible units so the list never renders a brand the user has no role at.
    """
    visible = access.accessible_unit_ids(session, current_user.id)
    return RecipeUnitService(session).units_for_recipes(data.recipe_ids, visible)


@router.get("/{recipe_id}/units", response_model=list[RecipeOutlet])
def list_recipe_units(
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[RecipeOutlet]:
    """Every unit this recipe is served at, restricted to the units the caller may see."""
    visible = access.accessible_unit_ids(session, current_user.id)
    links = RecipeUnitService(session).list_for_recipe(recipe_id)
    return [link for link in links if link.unit_id in visible]


@router.post(
    "/{recipe_id}/units", response_model=RecipeOutlet, status_code=status.HTTP_201_CREATED
)
def add_recipe_to_unit(
    recipe_id: int,
    data: RecipeOutletCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RecipeOutlet:
    """Serve a recipe at a unit."""
    _require_manager_at(session, current_user, data.unit_id)

    link = RecipeUnitService(session).link(recipe_id, data)
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe or unit not found"
        )
    return link


@router.patch("/{recipe_id}/units/{unit_id}", response_model=RecipeOutlet)
def update_recipe_unit(
    recipe_id: int,
    unit_id: str,
    data: RecipeOutletUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RecipeOutlet:
    """Update a recipe-unit link (activation, price override)."""
    _require_manager_at(session, current_user, unit_id)

    link = RecipeUnitService(session).update(recipe_id, unit_id, data)
    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe-unit link not found"
        )
    return link


@router.delete("/{recipe_id}/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_recipe_from_unit(
    recipe_id: int,
    unit_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Stop serving a recipe at a unit."""
    _require_manager_at(session, current_user, unit_id)

    if not RecipeUnitService(session).unlink(recipe_id, unit_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe-unit link not found"
        )
