"""Costing API routes."""

from cachetools import TTLCache

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import Recipe, CostingResult
from app.domain import CostingService

router = APIRouter()

# Bounded TTL cache for costing results (max 256 entries, 5-minute expiry)
_costing_cache: TTLCache = TTLCache(maxsize=256, ttl=300)


@router.get("/{recipe_id}/costing", response_model=CostingResult)
def get_recipe_costing(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get the cost breakdown for a recipe."""
    cached = _costing_cache.get(recipe_id)
    if cached:
        return cached

    service = CostingService(session)
    result = service.calculate_recipe_cost(recipe_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    _costing_cache[recipe_id] = result
    return result


@router.post("/{recipe_id}/costing/recompute", response_model=Recipe)
def recompute_recipe_cost(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Recompute and persist the cost for a recipe."""
    _costing_cache.pop(recipe_id, None)

    service = CostingService(session)
    recipe = service.persist_cost_snapshot(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe
