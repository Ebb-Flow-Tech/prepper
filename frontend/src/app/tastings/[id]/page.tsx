'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Calendar,
  MapPin,
  ChefHat,
  X,
  Clock,
  Copy,
  Check,
  CheckCircle,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useTastingSession,
  useUpdateTastingSession,
  useDeleteTastingSession,
  useSessionRecipes,
  useAddRecipesToSession,
  useRemoveRecipeFromSession,
  useReorderSessionDishes,
  useInfiniteRecipes,
  useSessionNotes,
  useCreateRecipe,
} from '@/lib/hooks';
import {
  Button,
  Skeleton,
  Card,
  CardContent,
  EditableCell,
  SearchInput,
  Badge,
} from '@/components/ui';
import { ParticipantPicker } from '@/components/tasting/ParticipantPicker';
import { DishFeedbackPanel } from '@/components/tasting/DishFeedbackPanel';
import type { Recipe, RecipeTasting, User, UpdateTastingSessionRequest, ReorderSessionDishItem } from '@/types';
import { useAppState } from '@/lib/store';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

// Ensure bare datetime strings (no timezone suffix) are treated as UTC
function toUtcDate(dateString: string): Date {
  const hasOffset = dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString);
  return new Date(hasOffset ? dateString : dateString + 'Z');
}

function formatDate(dateString: string): string {
  return toUtcDate(dateString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}


function SortableDishItem({
  sr,
  isCreator,
  reviewedRecipeIds,
  onRemoveRecipe,
  sessionId,
  currentUserId,
  isParticipant,
  isExpanded,
  onToggle,
}: {
  sr: RecipeTasting;
  isCreator: boolean;
  reviewedRecipeIds: Set<number>;
  onRemoveRecipe: (recipeId: number) => void;
  sessionId: number;
  currentUserId: string | null;
  isParticipant: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sr.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-secondary rounded-xl"
    >
      <div className="flex items-center gap-1 p-3">
        {isCreator && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-2 font-medium text-foreground flex-1 min-w-0">
          {reviewedRecipeIds.has(sr.recipe_id) ? (
            <CheckCircle className="h-4 w-4 text-[var(--color-feedback-success)] shrink-0" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />
          )}
          <span className="truncate">{sr.recipe_name || `Dish #${sr.recipe_id}`}</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent shrink-0"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          Feedback
        </button>
        {isCreator && (
          <button
            onClick={() => onRemoveRecipe(sr.recipe_id)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
            title="Remove from session"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isExpanded && (
        <DishFeedbackPanel
          recipeId={sr.recipe_id}
          sessionId={sessionId}
          currentUserId={currentUserId}
          isParticipant={isParticipant}
        />
      )}
    </div>
  );
}

interface SessionRecipesSectionProps {
  sessionId: number;
  sessionRecipes: RecipeTasting[];
  availableRecipes: Recipe[];
  isLoading: boolean;
  isCreator: boolean;
  onAddRecipes: (recipeIds: number[]) => void;
  onRemoveRecipe: (recipeId: number) => void;
  onReorderDishes: (items: ReorderSessionDishItem[]) => void;
  hasMoreRecipes: boolean;
  onLoadMoreRecipes: () => void;
  isLoadingMoreRecipes: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  reviewedRecipeIds: Set<number>;
  onCreateRecipe: (name: string) => Promise<number>;
  onRemoveRecipes: (recipeIds: number[]) => void;
  isParticipant: boolean;
  currentUserId: string | null;
}

function SessionRecipesSection({
  sessionId,
  sessionRecipes,
  availableRecipes,
  isLoading,
  isCreator,
  onAddRecipes,
  onRemoveRecipe,
  onReorderDishes,
  hasMoreRecipes,
  onLoadMoreRecipes,
  isLoadingMoreRecipes,
  searchQuery,
  onSearchChange,
  reviewedRecipeIds,
  onCreateRecipe,
  onRemoveRecipes,
  isParticipant,
  currentUserId,
}: SessionRecipesSectionProps) {
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [expandedDishId, setExpandedDishId] = useState<number | null>(null);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<number>>(new Set());
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
  const [localDishes, setLocalDishes] = useState<RecipeTasting[]>(sessionRecipes);
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server when session recipes change (e.g. after add/remove)
  useEffect(() => {
    setLocalDishes(sessionRecipes);
  }, [sessionRecipes]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localDishes.findIndex((d) => d.id === active.id);
    const newIndex = localDishes.findIndex((d) => d.id === over.id);
    const newDishes = arrayMove(localDishes, oldIndex, newIndex);
    setLocalDishes(newDishes);

    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(() => {
      onReorderDishes(newDishes.map((d, i) => ({ id: d.id, sequence: i + 1 })));
    }, 2000);
  };

  const linkedRecipeIds = new Set(sessionRecipes.map((sr) => sr.recipe_id));

  const handleOpenAddRecipe = () => {
    setSelectedRecipeIds(new Set(linkedRecipeIds));
    setShowAddRecipe(true);
  };

  const toAdd = Array.from(selectedRecipeIds).filter((id) => !linkedRecipeIds.has(id));
  const toRemove = Array.from(linkedRecipeIds).filter((id) => !selectedRecipeIds.has(id));
  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  const handleAddRecipes = () => {
    if (!hasChanges) return;
    if (toAdd.length > 0) onAddRecipes(toAdd);
    if (toRemove.length > 0) onRemoveRecipes(toRemove);
    setSelectedRecipeIds(new Set());
    onSearchChange('');
    setShowAddRecipe(false);
  };

  const handleToggleRecipe = (recipeId: number) => {
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const handleCreateAndSelect = async () => {
    const name = searchQuery.trim();
    if (!name) return;
    setIsCreatingRecipe(true);
    try {
      const newId = await onCreateRecipe(name);
      setSelectedRecipeIds((prev) => new Set([...prev, newId]));
    } catch {
      // error toast handled by parent
    } finally {
      setIsCreatingRecipe(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 min-w-0">
          <ChefHat className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="truncate">Session dishes</span>
          {sessionRecipes.length > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {sessionRecipes.filter((sr) => reviewedRecipeIds.has(sr.recipe_id)).length}/{sessionRecipes.length} reviewed
            </Badge>
          )}
        </h2>
        {isCreator && !showAddRecipe && (
          <Button
            size="sm"
            className="shrink-0"
            onClick={handleOpenAddRecipe}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Add dishes</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {isCreator && showAddRecipe && (
        <Card className="mb-4 border-border bg-muted/50">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Search dishes
                </label>
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onClear={() => onSearchChange('')}
                  placeholder="Type to search dishes..."
                  className="w-full"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                {availableRecipes.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    {searchQuery ? 'No dishes match your search' : 'No dishes available'}
                  </div>
                ) : (
                  availableRecipes.map((recipe) => {
                    const isAlreadyAdded = linkedRecipeIds.has(recipe.id);
                    const isSelected = selectedRecipeIds.has(recipe.id);
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => handleToggleRecipe(recipe.id)}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-border last:border-b-0 flex items-center justify-between ${
                          isSelected
                            ? 'bg-background-contrast text-foreground'
                            : 'text-foreground hover:bg-secondary'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border'
                            }`}>
                            {isSelected && <span className="text-xs">&#10003;</span>}
                          </span>
                          {recipe.name}
                        </span>
                      </button>
                    );
                  })
                )}
                {hasMoreRecipes && (
                  <button
                    type="button"
                    onClick={onLoadMoreRecipes}
                    disabled={isLoadingMoreRecipes}
                    className="w-full px-3 py-2 text-sm text-primary hover:bg-accent font-medium disabled:opacity-50"
                  >
                    {isLoadingMoreRecipes ? 'Loading...' : 'Load more dishes'}
                  </button>
                )}
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={handleCreateAndSelect}
                    disabled={isCreatingRecipe}
                    className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-primary hover:bg-accent border-t border-border font-medium disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    {isCreatingRecipe ? 'Creating...' : <>Create &ldquo;{searchQuery.trim()}&rdquo; as new dish</>}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleAddRecipes} disabled={!hasChanges}>
                  {toRemove.length > 0 ? 'Save' : 'Add'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddRecipe(false);
                    onSearchChange('');
                    setSelectedRecipeIds(new Set());
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}

      {!isLoading && localDishes.length === 0 && !showAddRecipe && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <ChefHat className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No dishes added to this session</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add dishes to track what will be tasted
          </p>
        </div>
      )}

      {!isLoading && localDishes.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localDishes.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {localDishes.map((sr) => (
                <SortableDishItem
                  key={sr.id}
                  sr={sr}
                  isCreator={isCreator}
                  reviewedRecipeIds={reviewedRecipeIds}
                  onRemoveRecipe={onRemoveRecipe}
                  sessionId={sessionId}
                  currentUserId={currentUserId}
                  isParticipant={isParticipant}
                  isExpanded={expandedDishId === sr.recipe_id}
                  onToggle={() => setExpandedDishId(expandedDishId === sr.recipe_id ? null : sr.recipe_id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

interface DerivedIngredient {
  id: number;
  name: string;
  base_unit: string;
  is_halal: boolean;
  recipe_names: string[];
}

interface SessionIngredientsSectionProps {
  sessionId: number;
  ingredients: DerivedIngredient[];
  isLoading: boolean;
}

function SessionIngredientsSection({
  sessionId,
  ingredients,
  isLoading,
}: SessionIngredientsSectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 min-w-0">
          <span className="shrink-0">🥘</span>
          <span className="truncate">Session ingredients</span>
          {ingredients.length > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {ingredients.length}
            </Badge>
          )}
        </h2>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}

      {!isLoading && ingredients.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <span className="text-2xl mx-auto mb-2 block">🥘</span>
          <p className="text-muted-foreground">No ingredients yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add dishes to see their ingredients here
          </p>
        </div>
      )}

      {!isLoading && ingredients.length > 0 && (
        <div className="space-y-2">
          {ingredients.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-secondary rounded-xl"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tastings/${sessionId}/i/${item.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {item.name}
                </Link>
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.recipe_names.map((rn) => (
                    <Badge key={rn} variant="info" className="text-xs">
                      {rn}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {item.base_unit && (
                  <Badge variant="unit" className="text-xs">{item.base_unit}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to parse datetime string into components
function parseDateTimeComponents(dateString: string) {
  const date = toUtcDate(dateString);
  let hour = date.getHours();
  const minute = date.getMinutes();
  const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';

  // Convert to 12-hour format
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;

  // Round minutes to nearest 15
  const roundedMinute = Math.round(minute / 15) * 15;

  return {
    date,
    hour: String(hour),
    minute: (roundedMinute === 60 ? 0 : roundedMinute).toString().padStart(2, '0'),
    period,
  };
}


export default function TastingSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id ? Number(params.id) : null;

  const { userId, userType } = useAppState();
  const { data: session, isLoading: sessionLoading, error: sessionError } = useTastingSession(sessionId);
  const { data: sessionRecipes, isLoading: recipesLoading } = useSessionRecipes(sessionId);
  const { data: sessionNotes } = useSessionNotes(sessionId);

  const reviewedRecipeIds = useMemo(
    () => new Set(
      (sessionNotes || [])
        .filter((n: { user_id: string | null }) => n.user_id === userId)
        .map((n: { recipe_id: number }) => n.recipe_id)
    ),
    [sessionNotes, userId]
  );

  const [copied, setCopied] = useState(false);

  // Search state lifted from child sections so we can pass it to the API hooks
  const [recipeSearch, setRecipeSearch] = useState('');
  // Debounced search values to avoid excessive API calls
  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRecipeSearch(recipeSearch), 300);
    return () => clearTimeout(timer);
  }, [recipeSearch]);

  const {
    data: recipesPages,
    fetchNextPage: fetchNextRecipesPage,
    hasNextPage: hasMoreRecipes,
    isFetchingNextPage: isLoadingMoreRecipes,
  } = useInfiniteRecipes({ page_size: 30, search: debouncedRecipeSearch || undefined });
  const availableRecipes = useMemo(
    () => recipesPages?.pages.flatMap((p) => p.items) ?? [],
    [recipesPages]
  );
  // Derive unique ingredients from session recipes
  const derivedIngredients = useMemo<DerivedIngredient[]>(() => {
    if (!sessionRecipes || sessionRecipes.length === 0) return [];
    const ingredientMap = new Map<number, DerivedIngredient>();
    for (const sr of sessionRecipes) {
      const recipeName = sr.recipe_name || `Recipe #${sr.recipe_id}`;
      for (const ing of sr.ingredients || []) {
        const existing = ingredientMap.get(ing.id);
        if (existing) {
          if (!existing.recipe_names.includes(recipeName)) {
            existing.recipe_names.push(recipeName);
          }
        } else {
          ingredientMap.set(ing.id, {
            id: ing.id,
            name: ing.name,
            base_unit: ing.base_unit,
            is_halal: ing.is_halal,
            recipe_names: [recipeName],
          });
        }
      }
    }
    return Array.from(ingredientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessionRecipes]);

  const deleteSession = useDeleteTastingSession();
  const updateSession = useUpdateTastingSession();
  const addRecipesToSession = useAddRecipesToSession();
  const removeRecipeFromSession = useRemoveRecipeFromSession();
  const reorderSessionDishes = useReorderSessionDishes();
  const createRecipe = useCreateRecipe();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Access control check
  const isInvited = userType === 'admin' ||
    (userId && session?.creator_id === userId) ||
    (userId && (session?.participants?.some(p => p.user_id === userId) ?? false)) || false;

  // Only the session creator can edit/add/delete
  const isCreator = !!(userId && session?.creator_id === userId);

  // DateTime state for editing
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const hours = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  const minutes = ['00', '15', '30', '45'];

  // Initialize datetime state when session loads
  useEffect(() => {
    if (session?.date) {
      const parsed = parseDateTimeComponents(session.date);
      setSelectedDate(parsed.date);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
    }
  }, [session?.date]);

  // Clear the tasting redirect URL when this page is accessed
  useEffect(() => {
    localStorage.removeItem('tasting_redirect_url');
  }, []);

  const get24HourTime = (): string => {
    let hour = parseInt(selectedHour);
    if (selectedPeriod === 'AM') {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
    return `${hour.toString().padStart(2, '0')}:${selectedMinute}`;
  };

  const getDisplayTime = (): string => {
    return `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  };

  const getDateTimeString = (): string => {
    if (!selectedDate) return '';
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const offset = selectedDate.getTimezoneOffset();
    const sign = offset <= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const offsetHours = Math.floor(absOffset / 60).toString().padStart(2, '0');
    const offsetMins = (absOffset % 60).toString().padStart(2, '0');
    return `${dateStr}T${get24HourTime()}:00${sign}${offsetHours}:${offsetMins}`;
  };

  const handleUpdateSession = async (data: UpdateTastingSessionRequest) => {
    if (!sessionId) return;
    try {
      await updateSession.mutateAsync({ id: sessionId, data });
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  const handleDateTimeConfirm = () => {
    const newDateTime = getDateTimeString();
    if (newDateTime && newDateTime !== session?.date) {
      handleUpdateSession({ date: newDateTime });
    }
    setShowCalendar(false);
  };

  const handleAddRecipesToSession = async (recipeIds: number[]) => {
    if (!sessionId) return;
    try {
      await addRecipesToSession.mutateAsync({
        sessionId,
        data: { recipe_ids: recipeIds },
      });
    } catch (error) {
      console.error('Failed to add recipes to session:', error);
    }
  };

  const handleRemoveRecipeFromSession = async (recipeId: number) => {
    if (!sessionId) return;
    if (!confirm('Remove this dish from the session?')) return;
    try {
      await removeRecipeFromSession.mutateAsync({ sessionId, recipeId });
    } catch (error) {
      console.error('Failed to remove recipe from session:', error);
    }
  };

  const handleBatchRemoveRecipes = async (recipeIds: number[]) => {
    if (!sessionId) return;
    try {
      await Promise.all(
        recipeIds.map((recipeId) =>
          removeRecipeFromSession.mutateAsync({ sessionId, recipeId }),
        ),
      );
    } catch (error) {
      console.error('Failed to remove recipes from session:', error);
    }
  };

  const handleReorderDishes = (items: ReorderSessionDishItem[]) => {
    if (!sessionId) return;
    reorderSessionDishes.mutate({ sessionId, data: { items } });
  };


  const handleCreateRecipe = async (name: string): Promise<number> => {
    try {
      const newRecipe = await createRecipe.mutateAsync({ name });
      return newRecipe.id;
    } catch {
      toast.error('Failed to create recipe');
      throw new Error('Failed to create recipe');
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      await deleteSession.mutateAsync(sessionId);
      router.push('/rnd');
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  if (sessionLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Check for 403 Forbidden (access denied)
  const is403Error = sessionError instanceof ApiError && sessionError.status === 403;

  if (is403Error) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
          <p className="font-medium">Access denied</p>
          <p className="text-sm mt-1">You are not invited to this tasting session.</p>
          <Link href="/rnd" className="text-destructive hover:underline text-sm mt-2 inline-block">
            Back to R&D
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
          Tasting session not found.
        </div>
      </div>
    );
  }

  if (!isInvited) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
          <p className="font-medium">Access denied</p>
          <p className="text-sm mt-1">You are not invited to this tasting session.</p>
          <Link href="/rnd" className="text-destructive hover:underline text-sm mt-2 inline-block">
            Back to R&D
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/rnd"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to R&D
          </Link>
        </div>

        {/* Session Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-foreground">
              {isCreator ? (
                <EditableCell
                  value={session.name}
                  onSave={(value) => handleUpdateSession({ name: value })}
                  className="text-2xl font-bold"
                  placeholder="Session name"
                />
              ) : (
                session.name
              )}
            </h1>
            {isCreator && (
              <Badge variant="success" className="text-xs shrink-0">Your session</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {/* DateTime */}
            <div className="flex items-center gap-1.5 relative">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {isCreator ? (
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="hover:bg-secondary px-1 py-0.5 rounded cursor-pointer flex items-center gap-2"
                >
                  <span>{formatDate(session.date)}</span>
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{getDisplayTime()}</span>
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{formatDate(session.date)}</span>
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{getDisplayTime()}</span>
                </span>
              )}
              {isCreator && showCalendar && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-elevation-2 p-3">
                  <style>{`
                    .rdp-root {
                      --rdp-accent-color: var(--color-brand-accent);
                      --rdp-accent-background-color: var(--surface-selected);
                    }
                  `}</style>
                  <DayPicker
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                      }
                    }}
                  />
                  <div className="border-t border-border mt-3 pt-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-2">
                      Select time
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(e.target.value)}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted-foreground font-medium">:</span>
                      <select
                        value={selectedMinute}
                        onChange={(e) => setSelectedMinute(e.target.value)}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        {minutes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value as 'AM' | 'PM')}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleDateTimeConfirm}
                      className="flex-1 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Reset to original values
                        if (session?.date) {
                          const parsed = parseDateTimeComponents(session.date);
                          setSelectedDate(parsed.date);
                          setSelectedHour(parsed.hour);
                          setSelectedMinute(parsed.minute);
                          setSelectedPeriod(parsed.period);
                        }
                        setShowCalendar(false);
                      }}
                      className="flex-1 px-3 py-2 border border-input hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {isCreator ? (
                <EditableCell
                  value={session.location || ''}
                  onSave={(value) => handleUpdateSession({ location: value || null })}
                  placeholder="Add location"
                />
              ) : (
                <span>{session.location || 'No location'}</span>
              )}
            </div>

            {isCreator ? (
              <ParticipantPicker
                selectedUsers={(session.participants || []).map((p) => ({
                  id: p.user_id || '',
                  email: p.email,
                  username: p.username,
                })) as User[]}
                onChange={(participants) => handleUpdateSession({ participant_ids: participants.map((p) => p.id) })}
                creatorId={session.creator_id || ''}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(session.participants || []).map((p) => (
                  <Badge key={p.user_id} variant="secondary">
                    {p.username || p.email}{p.user_id === session.creator_id && <span className="opacity-60"> (Organiser)</span>}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Copy Invite Link */}
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const inviteUrl = `${window.location.origin}/tastings/invite/${sessionId}`;
                  await navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                  toast.success('Invite link copied to clipboard');
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast.error('Failed to copy link');
                }
              }}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-1.5 text-[var(--color-feedback-success)]" />
              ) : (
                <Copy className="h-4 w-4 mr-1.5" />
              )}
              {copied ? 'Copied!' : 'Copy invite link'}
            </Button>
          </div>

          {session.notes && (
            <p className="mt-3 text-sm text-muted-foreground italic">{session.notes}</p>
          )}
        </div>

        {/* Session Recipes Section */}
        {sessionId && (
          <SessionRecipesSection
            sessionId={sessionId}
            sessionRecipes={sessionRecipes || []}
            availableRecipes={availableRecipes}
            isLoading={recipesLoading}
            isCreator={isCreator}
            onAddRecipes={handleAddRecipesToSession}
            onRemoveRecipe={handleRemoveRecipeFromSession}
            onReorderDishes={handleReorderDishes}
            hasMoreRecipes={!!hasMoreRecipes}
            onLoadMoreRecipes={() => fetchNextRecipesPage()}
            isLoadingMoreRecipes={isLoadingMoreRecipes}
            searchQuery={recipeSearch}
            onSearchChange={setRecipeSearch}
            reviewedRecipeIds={reviewedRecipeIds}
            onCreateRecipe={handleCreateRecipe}
            onRemoveRecipes={handleBatchRemoveRecipes}
            isParticipant={isInvited}
            currentUserId={userId}
          />
        )}

        {/* Session Ingredients Section */}
        {sessionId && (
          <SessionIngredientsSection
            sessionId={sessionId}
            ingredients={derivedIngredients}
            isLoading={recipesLoading}
          />
        )}

        {/* Delete Session - creator only */}
        {isCreator && (
          <div className="mt-12 pt-6 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-destructive">
                  Are you sure? This will delete the session and all its notes.
                </p>
                <Button variant="destructive" size="sm" onClick={handleDeleteSession}>
                  Yes, delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-muted-foreground hover:text-destructive"
              >
                Delete this session
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
