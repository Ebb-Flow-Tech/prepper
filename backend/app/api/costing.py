"""Costing API routes."""

from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.api.guards import require_recipe_access
from app.domain import CostingService
from app.models import CostingResult, Recipe

router = APIRouter()

# Bounded TTL cache for costing results (max 256 entries, 5-minute expiry).
#
# Keyed on recipe_id ALONE, and that is safe — but only because `require_recipe_access` is a
# DEPENDENCY. FastAPI resolves it before the handler body, so an unauthorised caller is refused
# before the cache is ever read. A check written inside the body would run after this lookup and
# happily serve another brand's costs from cache while looking correct.
#
# The key needs no user or org: a recipe's cost is the same whoever asks. What varies is who may
# ASK, and that is the guard's job, not the cache's. If this route ever authorises inside the body
# instead, this key becomes a cross-brand leak.
_costing_cache: TTLCache = TTLCache(maxsize=256, ttl=300)


def evict_costing_cache(recipe_id: int) -> None:
    """Remove a recipe's cached costing result so the next GET recomputes fresh."""
    _costing_cache.pop(recipe_id, None)


@router.get("/{recipe_id}/costing", response_model=CostingResult)
def get_recipe_costing(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
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
    _recipe: Recipe = Depends(require_recipe_access),
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
