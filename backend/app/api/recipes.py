"""Recipe core API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, col, select

from app.api.deps import get_current_user, get_session
from app.domain import RecipeService
from app.models import (
    Recipe,
    RecipeCreate,
    RecipeOutlet,
    RecipeStatus,
    RecipeStatusUpdate,
    RecipeUpdate,
    User,
)
from app.passport import access


class ForkRecipeRequest(BaseModel):
    """Request body for forking a recipe."""

    new_owner_id: str | None = None


router = APIRouter()


@router.post("", response_model=Recipe, status_code=status.HTTP_201_CREATED)
def create_recipe(
    data: RecipeCreate,
    session: Session = Depends(get_session),
):
    """Create a new recipe."""
    service = RecipeService(session)
    return service.create_recipe(data)


@router.get("")
def list_recipes(
    status: RecipeStatus | None = Query(default=None),
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    category_ids: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all recipes, optionally filtered by status and category."""
    from app.models.pagination import PaginatedResponse

    parsed_category_ids = [int(x) for x in category_ids.split(",")] if category_ids else None

    service = RecipeService(session)
    offset = (page_number - 1) * page_size
    items, total = service.list_paginated_with_count(offset=offset, limit=page_size, status=status, current_user=current_user, search=search, category_ids=parsed_category_ids)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


@router.get("/tasting/{recipe_id}", response_model=Recipe)
def get_recipe_for_tasting(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get a recipe for viewing in a tasting session.

    No access control - users can view recipe details while in a tasting session
    regardless of their normal recipe access level.
    """
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.get("/{recipe_id}", response_model=Recipe)
def get_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a recipe by ID.

    Access control:
    - Recipe owner: can always access their own recipe
    - Public recipes: accessible to all authenticated users
    - Otherwise: the recipe must be served at a unit the caller can see

    The old hand-rolled outlet walk (location -> parent brand) is gone: `accessible_unit_ids`
    already returns the brands the user holds a role at PLUS the outlets under them, which is
    Passport's structure rather than a hierarchy Prepper maintains. Org Owners/Admins need no
    special case — they hold a role at every brand, so every unit is visible to them.
    """
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    if recipe.owner_id == current_user.id or recipe.is_public:
        return recipe

    visible_unit_ids = access.accessible_unit_ids(session, current_user.id)
    served_here = None
    if visible_unit_ids:
        served_here = session.exec(
            select(RecipeOutlet).where(
                RecipeOutlet.recipe_id == recipe.id,
                col(RecipeOutlet.unit_id).in_(visible_unit_ids),
                RecipeOutlet.is_active,
            )
        ).first()

    if not served_here:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this recipe",
        )

    return recipe


@router.patch("/{recipe_id}", response_model=Recipe)
def update_recipe(
    recipe_id: int,
    data: RecipeUpdate,
    session: Session = Depends(get_session),
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
    user_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """Get all recipes in the version tree for a recipe.

    Recipes are filtered based on ownership:
    - If user_id matches owner_id OR recipe is public: full recipe data is returned
    - Otherwise: a masked recipe with only id, root_id, and version is returned

    If a recipe's parent is unauthorized, it links to the last authorized ancestor.
    """
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return service.get_version_tree(recipe_id, user_id=user_id)


