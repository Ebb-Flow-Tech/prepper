"""Costing API routes."""

import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import Recipe, CostingResult
from app.domain import CostingService

router = APIRouter()

# Simple TTL cache for costing results (recipe_id -> (result, timestamp))
_costing_cache: dict[int, tuple[CostingResult, float]] = {}
_COSTING_TTL = 5 * 60  # 5 minutes


def _get_cached_costing(recipe_id: int) -> CostingResult | None:
    entry = _costing_cache.get(recipe_id)
    if entry and (time.monotonic() - entry[1]) < _COSTING_TTL:
        return entry[0]
    return None


def _set_cached_costing(recipe_id: int, result: CostingResult) -> None:
    _costing_cache[recipe_id] = (result, time.monotonic())


def _invalidate_costing_cache(recipe_id: int) -> None:
    _costing_cache.pop(recipe_id, None)


@router.get("/{recipe_id}/costing", response_model=CostingResult)
def get_recipe_costing(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Get the cost breakdown for a recipe."""
    cached = _get_cached_costing(recipe_id)
    if cached:
        return cached

    service = CostingService(session)
    result = service.calculate_recipe_cost(recipe_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    _set_cached_costing(recipe_id, result)
    return result


@router.post("/{recipe_id}/costing/recompute", response_model=Recipe)
def recompute_recipe_cost(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Recompute and persist the cost for a recipe."""
    _invalidate_costing_cache(recipe_id)

    service = CostingService(session)
    recipe = service.persist_cost_snapshot(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe
