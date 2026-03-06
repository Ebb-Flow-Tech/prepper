"""Outlet API routes for multi-brand operations."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import get_session, get_current_user
from app.models import (
    Outlet,
    OutletCreate,
    OutletUpdate,
    RecipeOutlet,
    RecipeOutletCreate,
    RecipeOutletUpdate,
    User,
    UserType,
)
from app.domain import OutletService


class RecipeOutletsBatchRequest(BaseModel):
    """Request body for batch fetching recipe outlets."""

    recipe_ids: list[int]


router = APIRouter()


# --- Helper Functions ---


def _is_user_outlet_accessible(
    service: OutletService, user_outlet_id: int, target_outlet_id: int
) -> bool:
    """Check if a user's outlet can access a target outlet.

    A normal user can access their own outlet and all child outlets.
    Uses centralized outlet hierarchy resolution (single query).
    """
    accessible_ids = service.get_accessible_outlet_ids(user_outlet_id)
    return target_outlet_id in accessible_ids


# --- Outlet CRUD ---


@router.post("", response_model=Outlet, status_code=status.HTTP_201_CREATED)
def create_outlet(
    data: OutletCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new outlet (brand or location).

    Only admin users can create outlets.
    """
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create outlets",
        )

    service = OutletService(session)

    # Validate parent outlet exists if provided
    if data.parent_outlet_id is not None:
        parent = service.get_outlet(data.parent_outlet_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent outlet not found",
            )

    return service.create_outlet(data)


@router.get("")
def list_outlets(
    is_active: bool | None = Query(default=None),
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List outlets based on user permissions."""
    from app.models.pagination import PaginatedResponse
    service = OutletService(session)

    # Build accessible IDs for non-admin users
    accessible_ids = None
    if current_user.user_type != UserType.ADMIN:
        if not current_user.outlet_id:
            return PaginatedResponse.create(items=[], total_count=0, page_number=page_number, page_size=page_size)
        accessible_ids = service.get_accessible_outlet_ids(current_user.outlet_id)

    offset = (page_number - 1) * page_size
    items, total = service.list_paginated_with_count(offset=offset, limit=page_size, is_active=is_active, search=search, accessible_ids=accessible_ids)
    return PaginatedResponse.create(items=items, total_count=total, page_number=page_number, page_size=page_size)


@router.get("/{outlet_id}", response_model=Outlet)
def get_outlet(
    outlet_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get an outlet by ID.

    - Admin users: can access any outlet
    - Normal users: can only access their assigned outlet or child outlets
    """
    service = OutletService(session)
    outlet = service.get_outlet(outlet_id)
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outlet not found",
        )

    # Check permissions for normal users
    if current_user.user_type != UserType.ADMIN:
        if not current_user.outlet_id or not _is_user_outlet_accessible(
            service, current_user.outlet_id, outlet_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this outlet",
            )

    return outlet


@router.patch("/{outlet_id}", response_model=Outlet)
def update_outlet(
    outlet_id: int,
    data: OutletUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update outlet details.

    Only admin users can update outlets.
    """
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update outlets",
        )

    service = OutletService(session)
    outlet = service.update_outlet(outlet_id, data)
    if not outlet:
        # update_outlet returns None for both not-found and cycle detection
        # Check if outlet exists to differentiate
        existing = service.get_outlet(outlet_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outlet not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create circular parent-child relationship. This would form a cycle in the outlet hierarchy.",
        )
    return outlet


@router.delete("/{outlet_id}", response_model=Outlet)
def deactivate_outlet(
    outlet_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete an outlet (sets is_active to False).

    Only admin users can deactivate outlets.
    """
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can deactivate outlets",
        )

    service = OutletService(session)
    outlet = service.deactivate_outlet(outlet_id)
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outlet not found",
        )
    return outlet


@router.get("/{outlet_id}/recipes", response_model=list[RecipeOutlet])
def get_outlet_recipes(
    outlet_id: int,
    is_active: bool | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all recipes assigned to an outlet.

    - Admin users: can access recipes from any outlet
    - Normal users: can only access recipes from their assigned outlet or child outlets
    """
    service = OutletService(session)

    # Check permissions for normal users
    if current_user.user_type != UserType.ADMIN:
        if not current_user.outlet_id or not _is_user_outlet_accessible(
            service, current_user.outlet_id, outlet_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this outlet",
            )

    return service.get_recipes_for_outlet(outlet_id, is_active=is_active)


@router.get("/{outlet_id}/parent-recipes", response_model=list[RecipeOutlet])
def get_parent_outlet_recipes(
    outlet_id: int,
    is_active: bool | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all recipes from the parent outlet (if exists).

    - Admin users: can access recipes from any outlet
    - Normal users: can only access recipes from their assigned outlet or child outlets
    """
    service = OutletService(session)

    # Check permissions for normal users
    if current_user.user_type != UserType.ADMIN:
        if not current_user.outlet_id or not _is_user_outlet_accessible(
            service, current_user.outlet_id, outlet_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this outlet",
            )

    return service.get_parent_outlet_recipes(outlet_id, is_active=is_active)


@router.get("/{outlet_id}/hierarchy")
def get_outlet_hierarchy(
    outlet_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the full hierarchy tree for an outlet and its children.

    - Admin users: can view hierarchy for any outlet
    - Normal users: can only view hierarchy for their assigned outlet or child outlets
    """
    service = OutletService(session)

    # Check permissions for normal users
    if current_user.user_type != UserType.ADMIN:
        if not current_user.outlet_id or not _is_user_outlet_accessible(
            service, current_user.outlet_id, outlet_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this outlet",
            )

    result = service.get_outlet_hierarchy(outlet_id)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outlet not found",
        )
    return result


# --- Recipe-Outlet Router (nested under recipes) ---

recipe_outlets_router = APIRouter()


@recipe_outlets_router.get("/{recipe_id}/outlets", response_model=list[RecipeOutlet])
def get_recipe_outlets(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get all outlets a recipe is assigned to."""
    service = OutletService(session)
    return service.get_outlets_for_recipe(recipe_id)


@recipe_outlets_router.post(
    "/{recipe_id}/outlets",
    response_model=RecipeOutlet,
    status_code=status.HTTP_201_CREATED,
)
def add_recipe_to_outlet(
    recipe_id: int,
    data: RecipeOutletCreate,
    session: Session = Depends(get_session),
):
    """Add a recipe to an outlet."""
    service = OutletService(session)
    result = service.add_recipe_to_outlet(recipe_id, data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipe or outlet not found",
        )
    return result


@recipe_outlets_router.patch("/{recipe_id}/outlets/{outlet_id}", response_model=RecipeOutlet)
def update_recipe_outlet(
    recipe_id: int,
    outlet_id: int,
    data: RecipeOutletUpdate,
    session: Session = Depends(get_session),
):
    """Update a recipe-outlet link (e.g., price override)."""
    service = OutletService(session)
    result = service.update_recipe_outlet(recipe_id, outlet_id, data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe-outlet link not found",
        )
    return result


@recipe_outlets_router.delete(
    "/{recipe_id}/outlets/{outlet_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_recipe_from_outlet(
    recipe_id: int,
    outlet_id: int,
    session: Session = Depends(get_session),
):
    """Remove a recipe from an outlet."""
    service = OutletService(session)
    if not service.remove_recipe_from_outlet(recipe_id, outlet_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe-outlet link not found",
        )


@recipe_outlets_router.post(
    "/outlets/batch",
    response_model=dict[int, list[RecipeOutlet]],
)
def get_recipe_outlets_batch(
    request: RecipeOutletsBatchRequest,
    session: Session = Depends(get_session),
):
    """Get outlets for multiple recipes in a single batch request.

    Returns a dictionary mapping recipe_id -> list of RecipeOutlet records.
    """
    service = OutletService(session)
    return service.get_outlets_for_recipes_batch(request.recipe_ids)
