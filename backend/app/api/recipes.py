"""Recipe core API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.domain import RecipeService
from app.domain.outlet_service import OutletService
from app.models import (
    Recipe,
    RecipeCreate,
    RecipeOutlet,
    RecipeStatus,
    RecipeStatusUpdate,
    RecipeUpdate,
    User,
    UserType,
)


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


@router.get("", response_model=list[Recipe])
def list_recipes(
    status: RecipeStatus | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all recipes, optionally filtered by status.

    Access control:
    - Admin users: see all recipes
    - Normal users: see only recipes they created, public recipes, or recipes from their outlet
    """
    service = RecipeService(session)
    return service.list_recipes(status=status, current_user=current_user)


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
    - Admin users: can access any recipe
    - Recipe owner: can always access their own recipe
    - Public recipes: accessible to all authenticated users
    - Outlet-based access:
      - Location users can access recipes from their own outlet AND their parent brand outlet
      - Brand users can only access recipes from their own brand outlet (not from child locations)
    """
    service = RecipeService(session)
    recipe = service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    # Check access control for normal users
    if current_user.user_type != UserType.ADMIN:
        can_access = False

        # User's own recipe
        if recipe.owner_id == current_user.id:
            can_access = True
        # Public recipe
        elif recipe.is_public:
            can_access = True
        # Recipe from user's outlet
        elif current_user.outlet_id:
            outlet_service = OutletService(session)
            user_outlet = outlet_service.get_outlet(current_user.outlet_id)

            if user_outlet:
                accessible_outlet_ids = {current_user.outlet_id}
                if user_outlet.outlet_type.value == "location" and user_outlet.parent_outlet_id:
                    accessible_outlet_ids.add(user_outlet.parent_outlet_id)

                statement = select(RecipeOutlet).where(
                    RecipeOutlet.recipe_id == recipe.id,
                    RecipeOutlet.outlet_id.in_(accessible_outlet_ids),
                    RecipeOutlet.is_active,
                )
                recipe_outlet = session.exec(statement).first()
                can_access = bool(recipe_outlet)

        if not can_access:
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


