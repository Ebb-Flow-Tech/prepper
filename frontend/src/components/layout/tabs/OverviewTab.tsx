'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ImagePlus, Clock, Thermometer, Star, CheckCircle, AlertCircle, XCircle, Wine, Wand2, Edit2, Check, X, ChevronDown, Plus } from 'lucide-react';
import { useRecipe, useRecipeIngredients, useCosting, useSubRecipes, useRecipes, useUpdateRecipe, useRecipeCategoryLinks, useRecipeCategories, useRecipeAllergens, useCreateRecipeCategory } from '@/lib/hooks';
import { useAddRecipeToCategory, useRemoveRecipeFromCategory } from '@/lib/hooks/useRecipeRecipeCategories';
import { useRecipeTastingNotes, useRecipeTastingSummary } from '@/lib/hooks/useTastings';
import { useSummarizeFeedback } from '@/lib/hooks/useAgents';
import { useUser } from '@/lib/hooks/useUsers';
import { useAppState } from '@/lib/store';
import { Badge, Card, CardContent, Skeleton, Button, Modal, EditableCell } from '@/components/ui';
import { formatCurrency, formatTimer } from '@/lib/utils';
import { RecipeImageCarousel } from '@/components/recipe/RecipeImageCarousel';
import { useState, useEffect, useRef } from 'react';
import type { RecipeStatus, TastingDecision } from '@/types';

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

const DECISION_CONFIG: Record<TastingDecision, { label: string; icon: typeof CheckCircle; variant: 'success' | 'warning' | 'destructive' }> = {
  approved: { label: 'Approved', icon: CheckCircle, variant: 'success' },
  needs_work: { label: 'Needs Work', icon: AlertCircle, variant: 'warning' },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' },
};

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= rating
              ? 'fill-primary text-primary'
              : 'text-muted-foreground'
            }`}
        />
      ))}
    </div>
  );
}

function formatTastingDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function OverviewTab() {
  const { selectedRecipeId, userId, userType } = useAppState();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isFeedbacksOpen, setIsFeedbacksOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [tagSearchFilter, setTagSearchFilter] = useState('');
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const summaryForRecipeIdRef = useRef<number | null>(null);

  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(selectedRecipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(selectedRecipeId);
  const { data: costing, isLoading: costingLoading } = useCosting(selectedRecipeId);
  const { data: subRecipes, isLoading: subRecipesLoading } = useSubRecipes(selectedRecipeId);
  const { data: allRecipesData } = useRecipes({ page_size: 30 });
  const allRecipes = allRecipesData?.items;
  const { data: tastingNotes, isLoading: tastingLoading } = useRecipeTastingNotes(selectedRecipeId);
  const { data: tastingSummary } = useRecipeTastingSummary(selectedRecipeId);
  const { data: categoryLinks = [] } = useRecipeCategoryLinks(selectedRecipeId);
  const { data: allCategoriesData } = useRecipeCategories({ page_size: 30 });
  const allCategories = allCategoriesData?.items ?? [];
  const { data: allergens = [] } = useRecipeAllergens(selectedRecipeId);
  const { data: owner } = useUser(recipe?.owner_id);
  const { data: creator } = useUser(recipe?.created_by);
  const { mutate: updateRecipe, isPending: isUpdating } = useUpdateRecipe();
  const { mutate: summarizeFeedback, data: feedbackSummary, isPending: isSummarizingFeedback, error: feedbackSummaryError } = useSummarizeFeedback();
  const { mutate: addRecipeToCategory, isPending: isAddingTag } = useAddRecipeToCategory();
  const { mutate: removeRecipeFromCategory, isPending: isRemovingTag } = useRemoveRecipeFromCategory();
  const { mutate: createRecipeCategory, isPending: isCreatingTag } = useCreateRecipeCategory();

  const isLoading = recipeLoading || ingredientsLoading || costingLoading || subRecipesLoading || tastingLoading;

  // Save feedback summary to recipe when it's generated.
  // Guard against saving to the wrong recipe if the user navigated away while the AI call was in-flight.
  useEffect(() => {
    if (
      feedbackSummary?.summary &&
      feedbackSummary.success &&
      selectedRecipeId &&
      summaryForRecipeIdRef.current === selectedRecipeId
    ) {
      updateRecipe(
        { id: selectedRecipeId, data: { summary_feedback: feedbackSummary.summary } },
        {
          onError: (error) => {
            console.error('Failed to save feedback summary to recipe:', error);
          },
        }
      );
    }
  }, [feedbackSummary?.summary, feedbackSummary?.success, selectedRecipeId, updateRecipe]);

  const canEditRecipe = userId !== null && recipe?.owner_id === userId;

  // Reset field values and UI interaction state on recipe change
  useEffect(() => {
    if (recipe) {
      setDescriptionValue(recipe.description || '');
      setNameValue(recipe.name || '');
      setIsEditingName(false);
      setIsEditingDescription(false);
      setIsTagDropdownOpen(false);
      setIsFeedbacksOpen(false);
      setTagSearchFilter('');
    }
  }, [recipe?.id]);


  // Close tag dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    }

    if (isTagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isTagDropdownOpen]);

  // Reset search filter when dropdown closes
  useEffect(() => {
    if (!isTagDropdownOpen) {
      setTagSearchFilter('');
    }
  }, [isTagDropdownOpen]);

  const handleSaveName = () => {
    if (selectedRecipeId && nameValue.trim() && nameValue.trim() !== recipe?.name) {
      updateRecipe(
        { id: selectedRecipeId, data: { name: nameValue.trim() } },
        { onSuccess: () => setIsEditingName(false) }
      );
    } else {
      setIsEditingName(false);
    }
  };

  const handleSaveDescription = () => {
    if (selectedRecipeId && descriptionValue !== recipe?.description) {
      updateRecipe(
        { id: selectedRecipeId, data: { description: descriptionValue } },
        {
          onSuccess: () => {
            setIsEditingDescription(false);
          },
        }
      );
    } else {
      setIsEditingDescription(false);
    }
  };

  // Create a map of recipe IDs to names for sub-recipe display
  const recipeMap = new Map<number, string>();
  allRecipes?.forEach((r) => recipeMap.set(r.id, r.name));

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a recipe from the left panel to view its overview
          </p>
        </div>
      </div>
    );
  }

  if (recipeError) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-lg bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 max-w-5xl mx-auto">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-lg" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : recipe ? (
          <>
            {/* Recipe Header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Recipe hero image with edit button */}
                  <div className="relative shrink-0 group">
                    {recipe.image_url ? (
                      <Image
                        src={recipe.image_url}
                        alt={recipe.name}
                        width={128}
                        height={128}
                        className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="h-8 w-8" />
                      </div>
                    )}
                    {canEditRecipe && (
                      <button
                        onClick={() => setIsImageModalOpen(true)}
                        className="absolute bottom-1 right-1 rounded-full h-8 w-8 bg-primary hover:opacity-90 text-primary-foreground flex items-center justify-center transition-colors shadow-elevation-2"
                        title="Edit recipe image"
                      >
                        <Wand2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {isEditingName ? (
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              value={nameValue}
                              onChange={(e) => setNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') { setIsEditingName(false); setNameValue(recipe?.name || ''); }
                              }}
                              autoFocus
                              className="text-2xl font-bold text-foreground bg-transparent border-b-2 border-primary focus:outline-none flex-1 min-w-0"
                            />
                            <button onClick={handleSaveName} disabled={isUpdating} className="text-[var(--color-feedback-success)] hover:opacity-80 disabled:opacity-50 shrink-0">
                              <Check className="h-5 w-5" />
                            </button>
                            <button onClick={() => { setIsEditingName(false); setNameValue(recipe?.name || ''); }} className="text-muted-foreground hover:text-foreground shrink-0">
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <h1 className="text-2xl font-bold text-foreground">
                              {recipe.name}
                            </h1>
                            {canEditRecipe && (
                              <button
                                onClick={() => setIsEditingName(true)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                title="Edit name"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-muted-foreground mt-1">
                          Yield: {recipe.yield_quantity} {recipe.yield_unit}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Based on: {recipe.root_id
                            ? (allRecipes?.find((r) => r.id === recipe.root_id)?.name || `Recipe #${recipe.root_id}`)
                            : 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Version: {recipe.version}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">v{recipe.version}</Badge>
                        {userId !== null && recipe.owner_id === userId && (
                          <Badge className="bg-primary text-primary-foreground">Owned</Badge>
                        )}
                        {categoryLinks.map((link) => {
                          const category = allCategories.find((c) => c.id === link.category_id);
                          return category ? (
                            <Badge key={link.id} variant="default">
                              {category.name}
                            </Badge>
                          ) : null;
                        })}
                        <Badge variant={STATUS_VARIANTS[recipe.status]}>
                          {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    {/* Allergens */}
                    {allergens.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-xs font-medium text-muted-foreground">Allergens:</span>
                        {allergens.map((allergen) => (
                          <Badge key={allergen.id} variant="warning">{allergen.name}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                      <div>
                        Created: {new Date(recipe.created_at).toLocaleDateString()}
                        {recipe.updated_at !== recipe.created_at && (
                          <span className="ml-4">
                            Updated: {new Date(recipe.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {recipe.created_by && (
                        <div>
                          Created by: <span className="font-medium text-foreground">{creator?.username || '-'}</span>
                        </div>
                      )}
                      {recipe.owner_id && (
                        <div>
                          Owner: <span className="font-medium text-foreground">{owner?.username || '-'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Section */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-foreground">
                  Category
                </h2>
                <div className="space-y-4">
                  {/* Current Categories */}
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryLinks.length > 0 ? (
                      categoryLinks.map((link) => {
                        const category = allCategories.find((c) => c.id === link.category_id);
                        return category ? (
                          <div
                            key={link.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background-contrast border border-border"
                          >
                            <span className="text-sm font-medium text-primary">
                              {category.name}
                            </span>
                            <button
                              onClick={() => {
                                if (canEditRecipe) {
                                  removeRecipeFromCategory({
                                    linkId: link.id,
                                    categoryId: category.id,
                                    recipeId: selectedRecipeId!,
                                  });
                                }
                              }}
                              disabled={!canEditRecipe || isRemovingTag}
                              className="ml-1 text-primary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Remove category"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null;
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No categories added yet
                      </p>
                    )}
                  </div>

                  {/* Add Category Button */}
                  {canEditRecipe && (
                    <div className="relative" ref={tagDropdownRef}>
                      <button
                        onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                        disabled={isAddingTag}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background-contrast hover:opacity-90 text-primary text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                        Add Category
                      </button>

                      {/* Dropdown Menu */}
                      {isTagDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-elevation-2 z-50 min-w-48">
                          {allCategories.length > 0 ? (
                            <>
                              {/* Search Input */}
                              <div className="p-2 border-b border-border">
                                <input
                                  type="text"
                                  placeholder="Search categories..."
                                  value={tagSearchFilter}
                                  onChange={(e) => setTagSearchFilter(e.target.value)}
                                  autoFocus
                                  className="w-full px-3 py-2 rounded-md border border-border bg-card text-card-foreground placeholder:text-[var(--color-text-tertiary)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>

                              {/* Category List */}
                              <div className="max-h-48 overflow-y-auto">
                                {allCategories
                                  .filter(
                                    (cat) =>
                                      !categoryLinks.some(
                                        (link) => link.category_id === cat.id
                                      ) &&
                                      cat.name.toLowerCase().includes(tagSearchFilter.toLowerCase())
                                  )
                                  .map((category) => (
                                    <button
                                      key={category.id}
                                      onClick={() => {
                                        addRecipeToCategory({
                                          recipe_id: selectedRecipeId!,
                                          category_id: category.id,
                                        });
                                        setIsTagDropdownOpen(false);
                                      }}
                                      disabled={isAddingTag}
                                      className="w-full text-left px-4 py-2 hover:bg-background-contrast text-sm text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {category.name}
                                    </button>
                                  ))}
                                {allCategories.filter((cat) => !categoryLinks.some((link) => link.category_id === cat.id) && cat.name.toLowerCase().includes(tagSearchFilter.toLowerCase())).length === 0 && (
                                  tagSearchFilter ? (
                                    <button
                                      onClick={() => {
                                        createRecipeCategory({ name: tagSearchFilter }, {
                                          onSuccess: (newCat) => {
                                            addRecipeToCategory({ recipe_id: selectedRecipeId!, category_id: newCat.id });
                                            setIsTagDropdownOpen(false);
                                            setTagSearchFilter('');
                                          },
                                        });
                                      }}
                                      disabled={isCreatingTag}
                                      className="w-full text-left px-4 py-2 hover:bg-background-contrast text-sm text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      + Create &ldquo;{tagSearchFilter}&rdquo;
                                    </button>
                                  ) : (
                                    <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                                      All categories added
                                    </div>
                                  )
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                              No categories available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description Section */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-4 text-foreground">
                      Description
                    </h2>
                    {isEditingDescription ? (
                      <div className="space-y-3">
                        <textarea
                          value={descriptionValue}
                          onChange={(e) => setDescriptionValue(e.target.value)}
                          className="w-full p-3 border border-border rounded-lg bg-card text-card-foreground placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Enter recipe description..."
                          rows={4}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveDescription}
                            disabled={isUpdating}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-feedback-success)] hover:opacity-90 disabled:opacity-50 text-primary-foreground text-sm font-medium transition-colors disabled:pointer-events-none"
                          >
                            <Check className="h-4 w-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingDescription(false);
                              setDescriptionValue(recipe?.description || '');
                            }}
                            disabled={isUpdating}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-accent disabled:opacity-50 text-foreground text-sm font-medium transition-colors disabled:pointer-events-none"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {recipe?.description ? (
                          <p className="text-foreground whitespace-pre-wrap">
                            {recipe.description}
                          </p>
                        ) : (
                          <p className="text-muted-foreground italic">
                            No description added yet
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {canEditRecipe && !isEditingDescription && (
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium transition-colors mt-1 shrink-0"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ingredients | Sub Recipes | Costing Grid */}
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              {/* Ingredients Card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-foreground">
                    Ingredients
                  </h2>

                  {ingredients && ingredients.length > 0 ? (
                    <ul className="space-y-2">
                      {ingredients.map((ri) => (
                        <li
                          key={ri.id}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <div>
                            <span className="font-medium text-foreground">
                              {ri.ingredient?.name || `Ingredient #${ri.ingredient_id}`}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            {ri.quantity} {ri.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">
                      No ingredients added yet
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Sub Recipes Card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-foreground">
                    Sub Recipes
                  </h2>

                  {subRecipes && subRecipes.length > 0 ? (
                    <ul className="space-y-2">
                      {[...subRecipes]
                        .sort((a, b) => a.position - b.position)
                        .map((sr) => (
                          <li
                            key={sr.id}
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div>
                              <span className="font-medium text-foreground">
                                {recipeMap.get(sr.child_recipe_id) || `Recipe #${sr.child_recipe_id}`}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {sr.quantity} {sr.unit}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">
                      No sub-recipes added yet
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Costing Card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-foreground">
                    Costing
                  </h2>

                  {costing ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Batch Cost</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(costing.total_batch_cost)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Cost per Portion</span>
                        <span className="font-semibold text-xl text-foreground">
                          {formatCurrency(costing.cost_per_portion)}
                        </span>
                      </div>

                      {recipe.selling_price_est && costing.cost_per_portion && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-muted-foreground">Margin</span>
                          <span className="font-semibold text-[var(--color-feedback-success)]">
                            {((1 - costing.cost_per_portion / recipe.selling_price_est) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No costing data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Instructions Card */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-foreground">
                  Instructions
                </h2>

                {recipe.instructions_structured?.steps && recipe.instructions_structured.steps.length > 0 ? (
                  <ol className="space-y-4">
                    {recipe.instructions_structured.steps.map((step, index) => (
                      <li key={index} className="flex gap-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                          {step.order || index + 1}
                        </span>
                        <div className="flex-1 pt-0.5">
                          <p className="text-foreground">{step.text}</p>
                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            {step.timer_seconds && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTimer(step.timer_seconds)}
                              </span>
                            )}
                            {step.temperature_c && (
                              <span className="flex items-center gap-1">
                                <Thermometer className="h-4 w-4" />
                                {step.temperature_c}°C
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : recipe.instructions_raw ? (
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap text-foreground">
                      {recipe.instructions_raw}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No instructions added yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tasting History - Summary Card */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wine className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Tasting History
                  </h2>
                </div>

                {tastingSummary && tastingSummary.total_tastings > 0 && tastingNotes && tastingNotes.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary Section - AI Generated */}
                    <div className="p-4 rounded-lg bg-secondary border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-foreground">Feedback Summary</p>
                        {(canEditRecipe || userType === 'admin') && (
                          <button
                            onClick={() => { summaryForRecipeIdRef.current = selectedRecipeId; summarizeFeedback(selectedRecipeId!); }}
                            disabled={isSummarizingFeedback}
                            className="flex items-center gap-2 px-2 py-1 rounded bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-xs font-medium transition-colors disabled:cursor-not-allowed"
                          >
                            <Wand2 className="h-3 w-3" />
                            {isSummarizingFeedback ? 'Generating...' : 'Generate'}
                          </button>
                        )}
                      </div>
                      {isSummarizingFeedback ? (
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                          <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
                        </div>
                      ) : feedbackSummaryError ? (
                        <p className="text-sm text-muted-foreground italic">
                          Unable to generate summary. Please try again.
                        </p>
                      ) : recipe?.summary_feedback ? (
                        <p className="text-sm text-foreground leading-relaxed">
                          {recipe.summary_feedback}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No summary generated yet.
                        </p>
                      )}
                    </div>

                    {/* Feedbacks Section - Collapsible */}
                    <div>
                      <button
                        onClick={() => setIsFeedbacksOpen(!isFeedbacksOpen)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-muted transition-colors"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          Feedbacks ({tastingNotes?.length || 0})
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${isFeedbacksOpen ? 'rotate-180' : ''
                            }`}
                        />
                      </button>

                      {isFeedbacksOpen && (
                        <div className="mt-3 space-y-3 pl-3 border-l-2 border-border">
                          {tastingNotes?.map((note) => {
                            const config = note.decision ? DECISION_CONFIG[note.decision] : null;
                            const Icon = config?.icon;
                            return (
                              <div
                                key={note.id}
                                className="flex items-start gap-3 p-3 rounded-lg bg-secondary"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Link
                                      href={`/tastings/${note.session_id}`}
                                      className="text-sm font-medium text-foreground hover:text-primary"
                                    >
                                      {note.session_name}
                                    </Link>
                                    {config && (
                                      <Badge variant={config.variant} className="text-xs">
                                        {Icon && <Icon className="h-3 w-3 mr-1" />}
                                        {config.label}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    {note.session_date && (
                                      <span>{formatTastingDate(note.session_date)}</span>
                                    )}
                                    {note.overall_rating && (
                                      <StarRating rating={note.overall_rating} />
                                    )}
                                  </div>
                                  {note.feedback && (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      &ldquo;{note.feedback}&rdquo;
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Wine className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No tastings recorded yet
                    </p>
                    <Link href="/tastings/new" className="mt-2 inline-block">
                      <Button variant="outline" size="sm">
                        Create Tasting Session
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {/* Image Carousel Modal */}
        <Modal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          title="Recipe Images"
          maxWidth="max-w-lg"
          maxHeight="max-h-[70vh]"
        >
          {recipe && (
            <RecipeImageCarousel
              recipeId={recipe.id}
              recipeName={recipe.name}
              ingredients={ingredients?.map(i => i.ingredient?.name).filter(Boolean) as string[] | undefined}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}
