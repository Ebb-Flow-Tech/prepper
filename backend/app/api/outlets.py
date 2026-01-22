"""Outlet API routes for multi-brand operations."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    Outlet,
    OutletCreate,
    OutletUpdate,
    RecipeOutlet,
    RecipeOutletCreate,
    RecipeOutletUpdate,
)
from app.domain import OutletService

router = APIRouter()


# --- Outlet CRUD ---


@router.post("", response_model=Outlet, status_code=status.HTTP_201_CREATED)
def create_outlet(
    data: OutletCreate,
    session: Session = Depends(get_session),
):
    """Create a new outlet (brand or location)."""
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


@router.get("", response_model=list[Outlet])
def list_outlets(
    is_active: bool | None = Query(default=None),
    session: Session = Depends(get_session),
):
    """List all outlets, optionally filtered by active status."""
    service = OutletService(session)
    return service.list_outlets(is_active=is_active)


@router.get("/{outlet_id}", response_model=Outlet)
def get_outlet(
    outlet_id: int,
    session: Session = Depends(get_session),
):
    """Get an outlet by ID."""
    service = OutletService(session)
    outlet = service.get_outlet(outlet_id)
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outlet not found",
        )
    return outlet


@router.patch("/{outlet_id}", response_model=Outlet)
def update_outlet(
    outlet_id: int,
    data: OutletUpdate,
    session: Session = Depends(get_session),
):
    """Update outlet details."""
    service = OutletService(session)

    # Check for cycle before updating
    if data.parent_outlet_id is not None and service._would_create_cycle(outlet_id, data.parent_outlet_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create circular parent-child relationship. This would form a cycle in the outlet hierarchy.",
        )

    outlet = service.update_outlet(outlet_id, data)
    if not outlet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outlet not found",
        )
    return outlet


@router.delete("/{outlet_id}", response_model=Outlet)
def deactivate_outlet(
    outlet_id: int,
    session: Session = Depends(get_session),
):
    """Soft-delete an outlet (sets is_active to False)."""
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
):
    """Get all recipes assigned to an outlet."""
    service = OutletService(session)
    return service.get_recipes_for_outlet(outlet_id, is_active=is_active)


@router.get("/{outlet_id}/hierarchy")
def get_outlet_hierarchy(
    outlet_id: int,
    session: Session = Depends(get_session),
):
    """Get the full hierarchy tree for an outlet and its children."""
    service = OutletService(session)
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
