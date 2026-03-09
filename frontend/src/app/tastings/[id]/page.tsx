'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import {
  useTastingSession,
  useUpdateTastingSession,
  useDeleteTastingSession,
  useSessionRecipes,
  useAddRecipesToSession,
  useRemoveRecipeFromSession,
  useInfiniteRecipes,
  useSessionNotes,
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
import { RecipeFeedbackModal } from '@/components/tasting/RecipeFeedbackModal';
import type { Recipe, RecipeTasting, RecipeTastingIngredient, User, UpdateTastingSessionRequest } from '@/types';
import { useAppState } from '@/lib/store';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}


interface SessionRecipesSectionProps {
  sessionId: number;
  sessionRecipes: RecipeTasting[];
  availableRecipes: Recipe[];
  isLoading: boolean;
  isCreator: boolean;
  onAddRecipes: (recipeIds: number[]) => void;
  onRemoveRecipe: (recipeId: number) => void;
  hasMoreRecipes: boolean;
  onLoadMoreRecipes: () => void;
  isLoadingMoreRecipes: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  reviewedRecipeIds: Set<number>;
  onRecipeClick: (recipeId: number) => void;
}

function SessionRecipesSection({
  sessionId,
  sessionRecipes,
  availableRecipes,
  isLoading,
  isCreator,
  onAddRecipes,
  onRemoveRecipe,
  hasMoreRecipes,
  onLoadMoreRecipes,
  isLoadingMoreRecipes,
  searchQuery,
  onSearchChange,
  reviewedRecipeIds,
  onRecipeClick,
}: SessionRecipesSectionProps) {
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<number>>(new Set());

  const linkedRecipeIds = new Set(sessionRecipes.map((sr) => sr.recipe_id));

  const handleAddRecipes = () => {
    if (selectedRecipeIds.size === 0) return;
    onAddRecipes(Array.from(selectedRecipeIds));
    setSelectedRecipeIds(new Set());
    onSearchChange('');
    setShowAddRecipe(false);
  };

  const handleToggleRecipe = (recipeId: number) => {
    if (linkedRecipeIds.has(recipeId)) return;
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

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 min-w-0">
          <ChefHat className="h-5 w-5 text-purple-500 shrink-0" />
          <span className="truncate">Session Recipes</span>
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
            onClick={() => setShowAddRecipe(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Add Recipes</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {isCreator && showAddRecipe && (
        <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Search Recipes
                </label>
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onClear={() => onSearchChange('')}
                  placeholder="Type to search recipes..."
                  className="w-full"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
                {availableRecipes.length === 0 ? (
                  <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                    {searchQuery ? 'No recipes match your search' : 'No recipes available'}
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
                        disabled={isAlreadyAdded}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 flex items-center justify-between ${
                          isAlreadyAdded
                            ? 'opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500'
                            : isSelected
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                              : 'text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isAlreadyAdded
                              ? 'border-zinc-300 dark:border-zinc-600'
                              : isSelected
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-600'
                          }`}>
                            {isSelected && <span className="text-xs">&#10003;</span>}
                          </span>
                          {recipe.name}
                        </span>
                        {isAlreadyAdded && (
                          <Badge variant="secondary" className="text-xs ml-2 shrink-0">Added</Badge>
                        )}
                      </button>
                    );
                  })
                )}
                {hasMoreRecipes && (
                  <button
                    type="button"
                    onClick={onLoadMoreRecipes}
                    disabled={isLoadingMoreRecipes}
                    className="w-full px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-medium disabled:opacity-50"
                  >
                    {isLoadingMoreRecipes ? 'Loading...' : 'Load more recipes'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleAddRecipes} disabled={selectedRecipeIds.size === 0}>
                  Add{selectedRecipeIds.size > 0 ? ` (${selectedRecipeIds.size})` : ''}
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
                {selectedRecipeIds.size > 0 && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedRecipeIds.size} recipe{selectedRecipeIds.size !== 1 ? 's' : ''} selected
                  </span>
                )}
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

      {!isLoading && sessionRecipes.length === 0 && !showAddRecipe && (
        <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
          <ChefHat className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
          <p className="text-zinc-500 dark:text-zinc-400">No recipes added to this session</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Add recipes to track what will be tasted
          </p>
        </div>
      )}

      {!isLoading && sessionRecipes.length > 0 && (
        <div className="space-y-2">
          {[...sessionRecipes].sort((a, b) => (a.recipe_name || '').localeCompare(b.recipe_name || '')).map((sr) => {
            return (
              <div
                key={sr.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => onRecipeClick(sr.recipe_id)}
                  className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 text-left"
                >
                  {reviewedRecipeIds.has(sr.recipe_id) ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600 shrink-0" />
                  )}
                  {sr.recipe_name || `Recipe #${sr.recipe_id}`}
                </button>
                {isCreator && (
                  <button
                    onClick={() => onRemoveRecipe(sr.recipe_id)}
                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-600"
                    title="Remove from session"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 min-w-0">
          <span className="text-amber-500 shrink-0">🥘</span>
          <span className="truncate">Session Ingredients</span>
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
        <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
          <span className="text-2xl mx-auto mb-2 block">🥘</span>
          <p className="text-zinc-500 dark:text-zinc-400">No ingredients yet</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Add recipes to see their ingredients here
          </p>
        </div>
      )}

      {!isLoading && ingredients.length > 0 && (
        <div className="space-y-2">
          {ingredients.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tastings/${sessionId}/i/${item.id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400"
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
  const date = new Date(dateString);
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

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedRecipeIdForModal, setSelectedRecipeIdForModal] = useState<number | null>(null);

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
    return `${dateStr}T${get24HourTime()}`;
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
    if (!confirm('Remove this recipe from the session?')) return;
    try {
      await removeRecipeFromSession.mutateAsync({ sessionId, recipeId });
    } catch (error) {
      console.error('Failed to remove recipe from session:', error);
    }
  };


  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      await deleteSession.mutateAsync(sessionId);
      router.push('/tastings');
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
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          <p className="font-medium">Access Denied</p>
          <p className="text-sm mt-1">You are not invited to this tasting session.</p>
          <Link href="/tastings" className="text-red-600 dark:text-red-400 hover:underline text-sm mt-2 inline-block">
            Back to sessions
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Tasting session not found.
        </div>
      </div>
    );
  }

  if (!isInvited) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          <p className="font-medium">Access Denied</p>
          <p className="text-sm mt-1">You are not invited to this tasting session.</p>
          <Link href="/tastings" className="text-red-600 dark:text-red-400 hover:underline text-sm mt-2 inline-block">
            Back to sessions
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
            href="/tastings"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasting Sessions
          </Link>
        </div>

        {/* Session Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
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
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
            {/* DateTime */}
            <div className="flex items-center gap-1.5 relative">
              <Calendar className="h-4 w-4 text-zinc-400" />
              {isCreator ? (
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="hover:bg-zinc-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded cursor-pointer flex items-center gap-2"
                >
                  <span>{formatDate(session.date)}</span>
                  <Clock className="h-3 w-3 text-zinc-400" />
                  <span>{getDisplayTime()}</span>
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{formatDate(session.date)}</span>
                  <Clock className="h-3 w-3 text-zinc-400" />
                  <span>{getDisplayTime()}</span>
                </span>
              )}
              {isCreator && showCalendar && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3">
                  <style>{`
                    .rdp-root {
                      --rdp-accent-color: hsl(270 65% 50%);
                      --rdp-accent-background-color: hsl(270 65% 95%);
                    }
                    .dark .rdp-root {
                      --rdp-accent-color: hsl(270 65% 60%);
                      --rdp-accent-background-color: hsl(270 65% 15%);
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
                  <div className="border-t border-zinc-200 dark:border-zinc-700 mt-3 pt-3">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Select Time
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(e.target.value)}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className="text-zinc-500 font-medium">:</span>
                      <select
                        value={selectedMinute}
                        onChange={(e) => setSelectedMinute(e.target.value)}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
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
                      className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-zinc-400" />
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
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(session.participants || []).map((p) => (
                  <Badge key={p.user_id} variant="secondary">{p.username || p.email}</Badge>
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
                <Check className="h-4 w-4 mr-1.5 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-1.5" />
              )}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </Button>
          </div>

          {session.notes && (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 italic">{session.notes}</p>
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
            hasMoreRecipes={!!hasMoreRecipes}
            onLoadMoreRecipes={() => fetchNextRecipesPage()}
            isLoadingMoreRecipes={isLoadingMoreRecipes}
            searchQuery={recipeSearch}
            onSearchChange={setRecipeSearch}
            reviewedRecipeIds={reviewedRecipeIds}
            onRecipeClick={setSelectedRecipeIdForModal}
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
          <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-700">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Are you sure? This will delete the session and all its notes.
                </p>
                <Button variant="destructive" size="sm" onClick={handleDeleteSession}>
                  Yes, Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
              >
                Delete this session
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recipe Feedback Modal */}
      {sessionId && session && selectedRecipeIdForModal && (
        <RecipeFeedbackModal
          isOpen={!!selectedRecipeIdForModal}
          onClose={() => setSelectedRecipeIdForModal(null)}
          sessionId={sessionId}
          recipeId={selectedRecipeIdForModal}
          session={session}
          ingredients={sessionRecipes?.find((sr) => sr.recipe_id === selectedRecipeIdForModal)?.ingredients || []}
        />
      )}
    </div>
  );
}
