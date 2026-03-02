'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/style.css';
import {
  useTastingSession,
  useUpdateTastingSession,
  useDeleteTastingSession,
  useSessionRecipes,
  useAddRecipeToSession,
  useRemoveRecipeFromSession,
  useSessionIngredients,
  useAddIngredientToSession,
  useRemoveIngredientFromSession,
  useRecipes,
} from '@/lib/hooks';
import { useIngredients } from '@/lib/hooks';
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
import type { Recipe, RecipeTasting, Ingredient, IngredientTasting, User, UpdateTastingSessionRequest } from '@/types';
import { useAppState } from '@/lib/store';
import { ApiError } from '@/lib/api';

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
  onAddRecipe: (recipeId: number) => void;
  onRemoveRecipe: (recipeId: number) => void;
}

function SessionRecipesSection({
  sessionId,
  sessionRecipes,
  availableRecipes,
  isLoading,
  onAddRecipe,
  onRemoveRecipe,
}: SessionRecipesSectionProps) {
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const linkedRecipeIds = sessionRecipes.map((sr) => sr.recipe_id);
  const filteredAvailableRecipes = availableRecipes.filter(
    (r) => !linkedRecipeIds.includes(r.id)
  );

  // Filter recipes based on search query
  const filteredRecipes = searchQuery
    ? filteredAvailableRecipes.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredAvailableRecipes;

  const handleAddRecipe = () => {
    if (!selectedRecipeId) return;
    onAddRecipe(selectedRecipeId);
    setSelectedRecipeId(null);
    setSearchQuery('');
    setShowAddRecipe(false);
  };

  const handleSelectRecipe = (recipeId: number) => {
    setSelectedRecipeId(recipeId);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-purple-500" />
          Session Recipes
        </h2>
        <div className="flex items-center gap-2">
          {!showAddRecipe && (
            <Button
              size="sm"
              onClick={() => setShowAddRecipe(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Recipe
            </Button>
          )}
        </div>
      </div>

      {showAddRecipe && (
        <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Search Recipes
                </label>
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  placeholder="Type to filter recipes..."
                  className="w-full"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
                {filteredRecipes.length === 0 ? (
                  <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                    {searchQuery ? 'No recipes match your search' : 'No recipes available'}
                  </div>
                ) : (
                  filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => handleSelectRecipe(recipe.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                        selectedRecipeId === recipe.id
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {recipe.name}
                    </button>
                  ))
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleAddRecipe} disabled={!selectedRecipeId}>
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddRecipe(false);
                    setSearchQuery('');
                    setSelectedRecipeId(null);
                  }}
                >
                  Cancel
                </Button>
                {selectedRecipeId && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Selected: {filteredAvailableRecipes.find((r) => r.id === selectedRecipeId)?.name}
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
          {sessionRecipes.map((sr) => {
            const recipe = availableRecipes.find((r) => r.id === sr.recipe_id);
            return (
              <div
                key={sr.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <Link
                  href={`/tastings/${sessionId}/r/${sr.recipe_id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400"
                >
                  {recipe?.name || `Recipe #${sr.recipe_id}`}
                </Link>
                <button
                    onClick={() => onRemoveRecipe(sr.recipe_id)}
                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-600"
                    title="Remove from session"
                  >
                    <X className="h-4 w-4" />
                  </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SessionIngredientsSectionProps {
  sessionId: number;
  sessionIngredients: IngredientTasting[];
  allIngredients: Ingredient[];
  isLoading: boolean;
  onAddIngredient: (ingredientId: number) => void;
  onRemoveIngredient: (ingredientId: number) => void;
}

function SessionIngredientsSection({
  sessionId,
  sessionIngredients,
  allIngredients,
  isLoading,
  onAddIngredient,
  onRemoveIngredient,
}: SessionIngredientsSectionProps) {
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const linkedIngredientIds = sessionIngredients.map((si) => si.ingredient_id);
  const availableIngredients = allIngredients.filter(
    (i) => !linkedIngredientIds.includes(i.id)
  );

  const filteredIngredients = searchQuery
    ? availableIngredients.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableIngredients;

  const handleAddIngredient = () => {
    if (!selectedIngredientId) return;
    onAddIngredient(selectedIngredientId);
    setSelectedIngredientId(null);
    setSearchQuery('');
    setShowAddIngredient(false);
  };

  const handleSelectIngredient = (ingredientId: number) => {
    setSelectedIngredientId(ingredientId);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span className="text-amber-500">🥘</span>
          Session Ingredients
        </h2>
        <div className="flex items-center gap-2">
          {!showAddIngredient && (
            <Button
              size="sm"
              onClick={() => setShowAddIngredient(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Ingredient
            </Button>
          )}
        </div>
      </div>

      {showAddIngredient && (
        <Card className="mb-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Search Ingredients
                </label>
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  placeholder="Type to filter ingredients..."
                  className="w-full"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
                {filteredIngredients.length === 0 ? (
                  <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                    {searchQuery ? 'No ingredients match your search' : 'No ingredients available'}
                  </div>
                ) : (
                  filteredIngredients.map((ingredient) => (
                    <button
                      key={ingredient.id}
                      type="button"
                      onClick={() => handleSelectIngredient(ingredient.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 flex items-center justify-between ${
                        selectedIngredientId === ingredient.id
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      <span>{ingredient.name}</span>
                      <div className="flex items-center gap-1 text-xs">
                        {ingredient.base_unit && (
                          <Badge variant="secondary" className="text-xs">{ingredient.base_unit}</Badge>
                        )}
                        {ingredient.is_halal ? (
                          <Badge variant="success" className="text-xs">Halal</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Non-Halal</Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleAddIngredient} disabled={!selectedIngredientId}>
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddIngredient(false);
                    setSearchQuery('');
                    setSelectedIngredientId(null);
                  }}
                >
                  Cancel
                </Button>
                {selectedIngredientId && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Selected: {availableIngredients.find((i) => i.id === selectedIngredientId)?.name}
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

      {!isLoading && sessionIngredients.length === 0 && !showAddIngredient && (
        <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
          <span className="text-2xl mx-auto mb-2 block">🥘</span>
          <p className="text-zinc-500 dark:text-zinc-400">No ingredients added to this session</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Add ingredients to track what will be tasted
          </p>
        </div>
      )}

      {!isLoading && sessionIngredients.length > 0 && (
        <div className="space-y-2">
          {sessionIngredients.map((si) => {
            const ingredient = allIngredients.find((i) => i.id === si.ingredient_id);
            return (
              <div
                key={si.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <Link
                  href={`/tastings/${sessionId}/i/${si.ingredient_id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  {ingredient?.name || `Ingredient #${si.ingredient_id}`}
                </Link>
                <button
                    onClick={() => onRemoveIngredient(si.ingredient_id)}
                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-600"
                    title="Remove from session"
                  >
                    <X className="h-4 w-4" />
                  </button>
              </div>
            );
          })}
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
  const { data: availableRecipes } = useRecipes();
  const { data: sessionIngredients, isLoading: ingredientsLoading } = useSessionIngredients(sessionId);
  const { data: ingredients } = useIngredients();

  const deleteSession = useDeleteTastingSession();
  const updateSession = useUpdateTastingSession();
  const addRecipeToSession = useAddRecipeToSession();
  const removeRecipeFromSession = useRemoveRecipeFromSession();
  const addIngredientToSession = useAddIngredientToSession();
  const removeIngredientFromSession = useRemoveIngredientFromSession();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Access control check
  const isInvited = userType === 'admin' ||
    (userId && session?.creator_id === userId) ||
    (userId && (session?.participants?.some(p => p.user_id === userId) ?? false)) || false;

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

  const handleAddRecipeToSession = async (recipeId: number) => {
    if (!sessionId) return;
    try {
      await addRecipeToSession.mutateAsync({
        sessionId,
        data: { recipe_id: recipeId },
      });
    } catch (error) {
      console.error('Failed to add recipe to session:', error);
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

  const handleAddIngredientToSession = async (ingredientId: number) => {
    if (!sessionId) return;
    try {
      await addIngredientToSession.mutateAsync({
        sessionId,
        data: { ingredient_id: ingredientId },
      });
    } catch (error) {
      console.error('Failed to add ingredient to session:', error);
    }
  };

  const handleRemoveIngredientFromSession = async (ingredientId: number) => {
    if (!sessionId) return;
    if (!confirm('Remove this ingredient from the session?')) return;
    try {
      await removeIngredientFromSession.mutateAsync({ sessionId, ingredientId });
    } catch (error) {
      console.error('Failed to remove ingredient from session:', error);
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
            <EditableCell
              value={session.name}
              onSave={(value) => handleUpdateSession({ name: value })}
              className="text-2xl font-bold"
              placeholder="Session name"
            />
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
            {/* Editable DateTime */}
            <div className="flex items-center gap-1.5 relative">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="hover:bg-zinc-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded cursor-pointer flex items-center gap-2"
              >
                <span>{formatDate(session.date)}</span>
                <Clock className="h-3 w-3 text-zinc-400" />
                <span>{getDisplayTime()}</span>
              </button>
              {showCalendar && (
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

            {/* Editable Location */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-zinc-400" />
              <EditableCell
                value={session.location || ''}
                onSave={(value) => handleUpdateSession({ location: value || null })}
                placeholder="Add location"
              />
            </div>

            <ParticipantPicker
              selectedUsers={(session.participants || []).map((p) => ({
                id: p.user_id || '',
                email: p.email,
                username: p.username,
              })) as User[]}
              onChange={(participants) => handleUpdateSession({ participant_ids: participants.map((p) => p.id) })}
            />
          </div>

          {session.notes && (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 italic">{session.notes}</p>
          )}
        </div>

        {/* Session Recipes Section */}
        {availableRecipes && sessionId && (
          <SessionRecipesSection
            sessionId={sessionId}
            sessionRecipes={sessionRecipes || []}
            availableRecipes={availableRecipes}
            isLoading={recipesLoading}
            onAddRecipe={handleAddRecipeToSession}
            onRemoveRecipe={handleRemoveRecipeFromSession}
          />
        )}

        {/* Session Ingredients Section */}
        {ingredients && sessionId && (
          <SessionIngredientsSection
            sessionId={sessionId}
            sessionIngredients={sessionIngredients || []}
            allIngredients={ingredients}
            isLoading={ingredientsLoading}
            onAddIngredient={handleAddIngredientToSession}
            onRemoveIngredient={handleRemoveIngredientFromSession}
          />
        )}

        {/* Delete Session */}
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
      </div>
    </div>
  );
}
