"""Recipe core API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import OrgContext, get_current_user, get_org_context, get_session
from app.api.guards import (
    require_recipe_access,
    require_recipe_access_or_tasting_participant,
)
from app.domain import RecipeService
from app.models import (
    Recipe,
    RecipeCreate,
    RecipeStatus,
    RecipeStatusUpdate,
    RecipeUpdate,
    User,
)


class ForkRecipeRequest(BaseModel):
    """Request body for forking a recipe."""

    new_owner_id: str | None = None


router = APIRouter()


@router.post("", response_model=Recipe, status_code=status.HTTP_201_CREATED)
def create_recipe(
    data: RecipeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Create a recipe, owned by the caller unless an owner is named.

    The route took no user at all, and the frontend sends no `owner_id` — so every recipe was
    created with `owner_id = None`. A recipe with no owner, not public and not yet linked to a
    unit is visible to NOBODY, including the person who just created it: all three visibility
    rules fail. The documented rule "the owner can always access their own recipe" was dead code.

    An explicit `owner_id` is honoured rather than overridden: it is part of `RecipeCreate`, and
    assigning ownership is a real feature (`fork` takes `new_owner_id`). Naming someone else only
    ever GRANTS them access — it cannot take any, so it is not an escalation path.
    """
    if data.owner_id is None:
        data.owner_id = current_user.id
    service = RecipeService(session)
    return service.create_recipe(data, organization_id=org.organization_id)


@router.get("")
def list_recipes(
    status: RecipeStatus | None = Query(default=None),
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    category_ids: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """List all recipes, optionally filtered by status and category."""
    from app.models.pagination import PaginatedResponse

    parsed_category_ids = [int(x) for x in category_ids.split(",")] if category_ids else None

    service = RecipeService(session)
    offset = (page_number - 1) * page_size
    items, total = service.list_paginated_with_count(org.organization_id, offset=offset, limit=page_size, status=status, current_user=current_user, search=search, category_ids=parsed_category_ids)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


@router.get("/tasting/{recipe_id}", response_model=Recipe)
def get_recipe_for_tasting(
    recipe: Recipe = Depends(require_recipe_access_or_tasting_participant),
):
    """A recipe you are tasting, even if it sits outside your brands.

    Said "No access control - users can view recipe details while in a tasting session regardless
    of their normal recipe access level" — and meant it literally, returning any recipe's
    `instructions_raw` and `cost_price` to anyone who could guess an id.

    The intent was sound: a taster invited to a session may hold no role at the brand whose dish it
    is. The guard keeps that exception and scopes it to the case it was written for — the recipe
    must actually be on a session you take part in.
    """
    return recipe


@router.get("/{recipe_id}", response_model=Recipe)
def get_recipe(recipe: Recipe = Depends(require_recipe_access)):
    """Get a recipe by ID.

    - the owner always sees their own recipe
    - public recipes are visible to any authenticated user
    - otherwise it must be served at a unit the caller can see

    The rule used to be written out here and nowhere else, which is exactly why every OTHER route
    on this recipe leaked: each had to remember to repeat it, and none did. It now lives in
    `guards._may_see_recipe`, alongside the list query it must agree with — a recipe you cannot
    find in the list must not be reachable by id.

    Org Owners/Admins need no special case: Passport's ladder gives them a role at every brand of
    their org, so `accessible_unit_ids` already covers them.
    """
    return recipe


@router.patch("/{recipe_id}", response_model=Recipe)
def update_recipe(
    recipe_id: int,
    data: RecipeUpdate,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Update recipe metadata."""
    service = RecipeService(session)
    recipe = service.update_recipe_metadata(recipe_id, data)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.patch("/{recipe_id}/status", response_model=Recipe)
def update_recipe_status(
    recipe_id: int,
    data: RecipeStatusUpdate,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Update a recipe's status."""
    service = RecipeService(session)
    recipe = service.set_recipe_status(recipe_id, data.status)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.delete("/{recipe_id}", response_model=Recipe)
def delete_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Soft-delete a recipe (sets status to archived)."""
    service = RecipeService(session)
    recipe = service.soft_delete_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.post("/{recipe_id}/fork", response_model=Recipe, status_code=status.HTTP_201_CREATED)
def fork_recipe(
    recipe_id: int,
    data: ForkRecipeRequest | None = None,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Fork a recipe - create an editable copy with all ingredients."""
    service = RecipeService(session)
    new_owner_id = data.new_owner_id if data else None
    forked = service.fork_recipe(recipe_id, new_owner_id)
    if not forked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return forked


@router.get("/{recipe_id}/versions", response_model=list[Recipe])
def get_recipe_versions(
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all recipes in the version tree for a recipe.

    NOT guarded by `require_recipe_access`: masking IS the access control here. A caller who
    cannot see a version gets a stub (id, root_id, version) so the tree's shape survives, which is
    the documented behaviour and is pinned by
    `test_version_tree_user_with_no_passport_role_sees_masked_recipes`.

    The identity comes from the TOKEN. It used to come from a `?user_id=` query parameter, so
    `?user_id=<victim>` unmasked the victim's versions — the same impersonation shape as the
    `/with-feedback/{user_id}` path param. An identity a caller can assert is not an identity.

    - owner or public: full recipe data
    - otherwise: masked to id, root_id, version
    - a masked parent links to the last visible ancestor
    """
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return service.get_version_tree(recipe_id, user_id=current_user.id)


