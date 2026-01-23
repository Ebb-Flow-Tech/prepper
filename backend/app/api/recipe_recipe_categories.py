"""Recipe-RecipeCategory API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models.recipe_recipe_category import (
    RecipeRecipeCategory,
    RecipeRecipeCategoryCreate,
    RecipeRecipeCategoryUpdate,
)
from app.domain.recipe_recipe_category_service import RecipeRecipeCategoryService

router = APIRouter()


@router.post(
    "",
    response_model=RecipeRecipeCategory,
    status_code=status.HTTP_201_CREATED,
)
def create_recipe_category_link(
    data: RecipeRecipeCategoryCreate,
    session: Session = Depends(get_session),
):
    """Create a link between a recipe and a recipe category."""
    service = RecipeRecipeCategoryService(session)
    return service.create_recipe_category_link(data)


@router.get("", response_model=list[RecipeRecipeCategory])
def list_recipe_categories(
    session: Session = Depends(get_session),
):
    """List all recipe-category links."""
    service = RecipeRecipeCategoryService(session)
    return service.list_recipe_categories()


@router.get("/{link_id}", response_model=RecipeRecipeCategory)
def get_recipe_category_link(
    link_id: int,
    session: Session = Depends(get_session),
):
    """Get a recipe-category link by ID."""
    service = RecipeRecipeCategoryService(session)
    link = service.get_recipe_category_link(link_id)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe-category link not found",
        )
    return link


@router.get("/recipe/{recipe_id}", response_model=list[RecipeRecipeCategory])
def list_categories_by_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """List all categories assigned to a recipe."""
    service = RecipeRecipeCategoryService(session)
    return service.list_recipe_categories_by_recipe(recipe_id)


@router.get("/category/{category_id}", response_model=list[RecipeRecipeCategory])
def list_recipes_by_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """List all recipes in a category."""
    service = RecipeRecipeCategoryService(session)
    return service.list_recipes_by_category(category_id)


@router.patch("/{link_id}", response_model=RecipeRecipeCategory)
def update_recipe_category_link(
    link_id: int,
    data: RecipeRecipeCategoryUpdate,
    session: Session = Depends(get_session),
):
    """Update a recipe-category link."""
    service = RecipeRecipeCategoryService(session)
    link = service.update_recipe_category_link(link_id, data)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe-category link not found",
        )
    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe_category_link(
    link_id: int,
    session: Session = Depends(get_session),
):
    """Delete a recipe-category link."""
    service = RecipeRecipeCategoryService(session)
    deleted = service.delete_recipe_category_link(link_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe-category link not found",
        )


@router.delete("/recipe/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_categories_for_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Delete all category links for a recipe."""
    service = RecipeRecipeCategoryService(session)
    service.delete_recipe_categories_by_recipe(recipe_id)


@router.delete("/category/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_recipes_in_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Delete all recipe links for a category."""
    service = RecipeRecipeCategoryService(session)
    service.delete_recipe_categories_by_category(category_id)
