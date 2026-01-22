'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, ClipboardList, Loader2, CheckCircle, GitFork, ImagePlus, ExternalLink, Wine, Plus, ChevronDown, ChevronUp, RotateCcw, RefreshCw } from 'lucide-react';
import { useRecipesWithFeedback, useRecipeTastingNotes, useCreateTastingSession, useAddRecipeToSession, useTastingSessions, useSessionRecipes } from '@/lib/hooks/useTastings';
import { useRecipes, useForkRecipe } from '@/lib/hooks/useRecipes';
import { useSummarizeFeedback } from '@/lib/hooks/useAgents';
import { PageHeader, SearchInput, Skeleton, Card, CardHeader, CardTitle, CardContent, CardFooter, Badge, Button, Modal, Input } from '@/components/ui';
import { useAppState } from '@/lib/store';
import { formatCurrency, cn } from '@/lib/utils';
import { updateRecipe } from '@/lib/api';
import { toast } from 'sonner';
import type { Recipe, RecipeStatus, TastingNoteWithRecipe, TastingSession, RecipeTasting } from '@/types';

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

interface RndRecipeCardProps {
  recipe: Recipe;
  isOwned: boolean;
  onFork?: () => void;
  isFork?: boolean;
  isForking?: boolean;
}

function RndRecipeCard({ recipe, isOwned, onFork, isFork, isForking }: RndRecipeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();
  const summarizeMutation = useSummarizeFeedback();

  const handleOpenDropdown = async () => {
    // If no feedback summary exists, trigger the agent to generate it
    if (!recipe.summary_feedback) {
      try {
        // 1. Use mutation to call the agent to generate the summary
        const result = await summarizeMutation.mutateAsync(recipe.id);

        if (!result.success || !result.summary) {
          toast.error('Failed to generate feedback summary');
          return;
        }

        // 2. Update the recipe with the generated summary
        await updateRecipe(recipe.id, {
          summary_feedback: result.summary,
        });

        // 3. Refetch to get the updated recipe
        await queryClient.refetchQueries({
          queryKey: ['recipes-with-feedback'],
        });

        // Expand after the mutation completes
        setIsExpanded(true);
        toast.success('Feedback summary generated successfully');
      } catch (error) {
        toast.error('Failed to generate feedback summary');
      }
    } else {
      // If summary already exists, just toggle
      setIsExpanded(!isExpanded);
    }
  };

  const handleRegenerate = async () => {
    try {
      // 1. Use mutation to call the agent to generate the summary
      const result = await summarizeMutation.mutateAsync(recipe.id);

      if (!result.success || !result.summary) {
        toast.error('Failed to regenerate feedback summary');
        return;
      }

      // 2. Update the recipe with the generated summary
      await updateRecipe(recipe.id, {
        summary_feedback: result.summary,
      });

      // 3. Refetch to get the updated recipe
      await queryClient.refetchQueries({
        queryKey: ['recipes-with-feedback'],
      });

      toast.success('Feedback summary regenerated successfully');
      setIsExpanded(false);
    } catch (error) {
      toast.error('Failed to regenerate feedback summary');
    }
  };

  const displaySummary = recipe.summary_feedback;

  return (
    <Card className={isFork ? 'border-l-4 border-l-blue-500' : ''}>
      <Link href={`/rnd/r/${recipe.id}`} className="block">
        <CardHeader>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate text-xl">{recipe.name}</CardTitle>
              {onFork && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 px-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onFork();
                  }}
                  disabled={isForking}
                >
                  <GitFork className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-base text-zinc-500 dark:text-zinc-400 mt-0.5">
              {recipe.yield_quantity} {recipe.yield_unit}
            </p>
          </div>

          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-16 h-16 rounded-md object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <ImagePlus className="h-6 w-6" />
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANTS[recipe.status]} className="text-sm">
              {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
            </Badge>
            {isFork && (
              <Badge variant="info" className="text-sm">
                <GitFork className="h-3 w-3 mr-1" />
                Fork
              </Badge>
            )}
            {isOwned && (
              <Badge className="text-sm bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-base">
              <span className="text-zinc-500 dark:text-zinc-400">Cost: </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(recipe.cost_price)}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">/portion</span>
            </div>
            <ExternalLink className="h-4 w-4 text-zinc-400" />
          </div>
        </CardFooter>
      </Link>

      {/* Feedback Summary Dropdown */}
      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenDropdown();
          }}
          disabled={summarizeMutation.isPending}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Feedback Summary
          </span>
          {summarizeMutation.isPending ? (
            <RefreshCw className="h-4 w-4 text-zinc-500 dark:text-zinc-400 animate-spin" />
          ) : isExpanded && displaySummary ? (
            <ChevronUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          )}
        </button>

        {isExpanded && (
          <div className="pb-3 text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 space-y-3 px-4">
            {displaySummary ? (
              <>
                <p>{displaySummary}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRegenerate();
                  }}
                  disabled={summarizeMutation.isPending}
                  className="w-full"
                >
                  <RotateCcw className={`h-3 w-3 mr-1 ${summarizeMutation.isPending ? 'animate-spin' : ''}`} />
                  {summarizeMutation.isPending ? 'Generating...' : 'Regenerate Summary'}
                </Button>
              </>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">
                {summarizeMutation.isPending ? 'Generating summary...' : 'No summary available'}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// WIP card with sessions
interface WipRecipeCardProps {
  recipe: Recipe;
  isOwned: boolean;
}

function WipRecipeCard({ recipe, isOwned }: WipRecipeCardProps) {
  const queryClient = useQueryClient();
  const { data: tastingNotes } = useRecipeTastingNotes(recipe.id);
  const createSession = useCreateTastingSession();
  const addRecipeToSession = useAddRecipeToSession();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Get unique sessions from tasting notes
  const sessions = useMemo(() => {
    if (!tastingNotes) return [];
    const sessionMap = new Map<number, { id: number; name: string; date: string }>();
    tastingNotes.forEach((note: TastingNoteWithRecipe) => {
      if (note.session_id && note.session_name && !sessionMap.has(note.session_id)) {
        sessionMap.set(note.session_id, {
          id: note.session_id,
          name: note.session_name,
          date: note.session_date || '',
        });
      }
    });
    return Array.from(sessionMap.values());
  }, [tastingNotes]);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) return;

    setIsCreating(true);
    try {
      // Create the session with tomorrow at midnight as default
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const session = await createSession.mutateAsync({
        name: sessionName.trim(),
        date: tomorrow.toISOString(),
      });

      // Add the current recipe to the session
      await addRecipeToSession.mutateAsync({
        sessionId: session.id,
        data: { recipe_id: recipe.id },
      });

      // Mark the parent recipe (root_id) as review_ready if this is a fork
      if (recipe.root_id) {
        try {
          await updateRecipe(recipe.root_id, {
            review_ready: true,
          });
          console.log(`Successfully marked parent recipe ${recipe.root_id} as review_ready`);
          toast.success('Parent recipe marked as ready for review');
        } catch (error) {
          console.error('Failed to mark parent recipe as review_ready:', error);
          toast.error('Failed to mark parent recipe as ready for review');
        }
      }

      setShowCreateModal(false);
      setSessionName('');
      toast.success('Tasting session created successfully');

      // Refetch to get updated data - use exact match for more reliable refetch
      await queryClient.invalidateQueries({
        queryKey: ['recipes'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['recipes-with-feedback'],
        exact: false,
      });

      // Wait a moment for the queries to invalidate before they refetch
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to create tasting session:', error);
      toast.error('Failed to create tasting session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Card className="border-l-4 border-l-blue-500">
        <Link href={`/rnd/r/${recipe.id}`} className="block">
          <CardHeader>
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate text-xl">{recipe.name}</CardTitle>
              <p className="text-base text-zinc-500 dark:text-zinc-400 mt-0.5">
                {recipe.yield_quantity} {recipe.yield_unit}
              </p>
            </div>

            {recipe.image_url ? (
              <img
                src={recipe.image_url}
                alt={recipe.name}
                className="w-16 h-16 rounded-md object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                <ImagePlus className="h-6 w-6" />
              </div>
            )}
          </CardHeader>

          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANTS[recipe.status]} className="text-sm">
                {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
              </Badge>
              {isOwned && (
                <Badge className="text-sm bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
              )}
            </div>

            {/* Sessions */}
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Tasting Sessions:</p>
              <div className="flex flex-wrap gap-1">
                {sessions.map((session) => (
                  <Badge key={session.id} variant="secondary" className="text-xs">
                    <Wine className="h-3 w-3 mr-1" />
                    {session.name}
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCreateModal(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Session
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <div className="flex items-center justify-between w-full">
              <div className="text-base">
                <span className="text-zinc-500 dark:text-zinc-400">Cost: </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(recipe.cost_price)}
                </span>
                <span className="text-zinc-400 dark:text-zinc-500">/portion</span>
              </div>
              <ExternalLink className="h-4 w-4 text-zinc-400" />
            </div>
          </CardFooter>
        </Link>
      </Card>

      {/* Create Tasting Session Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSessionName('');
        }}
        title="Create Tasting Session"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create a new tasting session that includes &quot;{recipe.name}&quot;.
          </p>
          <div>
            <label
              htmlFor="session-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Session Name
            </label>
            <Input
              id="session-name"
              placeholder="e.g., December Menu Tasting"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sessionName.trim()) {
                  handleCreateSession();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setSessionName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!sessionName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Review column session card - filters to show only if session contains recipes ready for review
interface ReviewSessionCardProps {
  session: TastingSession;
  readyForReviewRecipeIds: Set<number>;
}

function ReviewSessionCard({ session, readyForReviewRecipeIds }: ReviewSessionCardProps) {
  const { data: sessionRecipes } = useSessionRecipes(session.id);

  // Check if this session has any recipes whose parents are ready for review
  const hasReadyForReviewRecipes = useMemo(() => {
    if (!sessionRecipes) return false;
    return sessionRecipes.some((rt: RecipeTasting) => readyForReviewRecipeIds.has(rt.recipe_id));
  }, [sessionRecipes, readyForReviewRecipeIds]);

  // Don't render if no ready-for-review recipes in this session
  if (!hasReadyForReviewRecipes) return null;

  const formattedDate = new Date(session.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card>
      <Link href={`/tastings/${session.id}`} className="block">
        <CardHeader>
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-xl">{session.name}</CardTitle>
            <p className="text-base text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formattedDate}
            </p>
          </div>
          <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Wine className="h-6 w-6" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-sm">
              <Wine className="h-3 w-3 mr-1" />
              Tasting Session
            </Badge>
            {session.location && (
              <Badge variant="secondary" className="text-sm">
                {session.location}
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {session.attendees?.length ?? 0} attendee{session.attendees?.length !== 1 ? 's' : ''}
            </div>
            <ExternalLink className="h-4 w-4 text-zinc-400" />
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}

// Group structure for WIP column: parent recipe ID -> its forks
interface WipGroup {
  parentId: number;
  parentName: string;
  forks: Recipe[];
}

export default function RndPage() {
  const { userId } = useAppState();
  const { data: recipesWithFeedback, isLoading: isLoadingFeedback, error: feedbackError } = useRecipesWithFeedback(userId);
  const { data: allRecipes, isLoading: isLoadingRecipes } = useRecipes();
  const { data: tastingSessions, isLoading: isLoadingSessions } = useTastingSessions();
  const forkMutation = useForkRecipe();

  const [search, setSearch] = useState('');

  const isLoading = isLoadingFeedback || isLoadingRecipes || isLoadingSessions;

  // Filter tasting sessions by search
  const filteredSessions = useMemo(() => {
    if (!tastingSessions) return [];

    return tastingSessions.filter((session) => {
      if (search && !session.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [tastingSessions, search]);

  // Filter recipes by search and status for To Do column
  const filteredTodoRecipes = useMemo(() => {
    if (!recipesWithFeedback) return [];

    return recipesWithFeedback.filter((recipe) => {
      // Only show recipes that haven't been started and aren't ready for review
      if (recipe.rnd_started || recipe.review_ready) {
        return false;
      }
      if (search && !recipe.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [recipesWithFeedback, search]);

  // Find recipes in WIP column: children of recipes that have rnd_started = true
  const wipGroups = useMemo(() => {
    if (!allRecipes || !recipesWithFeedback) return [];

    // Get all recipes that have rnd_started = true and review_ready = false
    const startedRecipes = allRecipes.filter((recipe) => recipe.rnd_started === true && !recipe.review_ready);

    // Get all children (forks) of started recipes where review_ready is false or null
    const wipRecipes = allRecipes.filter((recipe) =>
      recipe.root_id !== null &&
      startedRecipes.some((started) => started.id === recipe.root_id) &&
      recipe.owner_id === userId &&
      (!recipe.review_ready)
    );

    // Apply search filter
    const filteredRecipes = wipRecipes.filter((recipe) => {
      if (search && !recipe.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });

    // Return as a single group with no parent info (no "Forks of..." header)
    if (filteredRecipes.length > 0) {
      return [{
        parentId: 0,
        parentName: '',
        forks: filteredRecipes,
      }];
    }

    return [];
  }, [allRecipes, recipesWithFeedback, userId, search]);

  // Count total WIP items
  const wipCount = useMemo(() => {
    return wipGroups.reduce((sum, group) => sum + group.forks.length, 0);
  }, [wipGroups]);

  // Get all WIP recipe IDs
  const wipRecipeIds = useMemo(() => {
    const ids = new Set<number>();
    wipGroups.forEach((group) => {
      group.forks.forEach((fork) => ids.add(fork.id));
    });
    return ids;
  }, [wipGroups]);

  // Get all recipe IDs whose parents are ready for review
  const readyForReviewRecipeIds = useMemo(() => {
    if (!allRecipes) return new Set<number>();
    const ids = new Set<number>();
    // Find all recipes whose root_id points to a recipe with review_ready = true
    allRecipes.forEach((recipe) => {
      if (recipe.root_id) {
        const parent = allRecipes.find((r) => r.id === recipe.root_id);
        if (parent && parent.review_ready) {
          ids.add(recipe.id);
        }
      }
    });
    return ids;
  }, [allRecipes]);

  const handleFork = (recipeId: number) => {
    if (!userId) return;
    forkMutation.mutate({ id: recipeId, newOwnerId: userId });
  };

  if (feedbackError) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load recipes. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6">
        <PageHeader
          title="R&D Workspace"
          description="Track and iterate on recipes with tasting feedback"
        />

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-48 rounded-lg" />
                <Skeleton className="h-48 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Kanban Board */}
        {!isLoading && (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {/* To Do Column */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                <span className="text-muted-foreground"><ClipboardList className="h-5 w-5" /></span>
                <h2 className="font-semibold text-lg">To Do</h2>
                <span className="ml-auto text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {filteredTodoRecipes.length}
                </span>
              </div>

              <div className="flex-1 space-y-4 min-h-[200px]">
                {filteredTodoRecipes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <FlaskConical className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p className="text-sm text-muted-foreground">No recipes to work on</p>
                  </div>
                ) : (
                  filteredTodoRecipes.map((recipe) => (
                    <RndRecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      isOwned={userId !== null && recipe.owner_id === userId}
                      onFork={() => handleFork(recipe.id)}
                      isForking={forkMutation.isPending && forkMutation.variables?.id === recipe.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                <span className="text-muted-foreground"><Loader2 className="h-5 w-5" /></span>
                <h2 className="font-semibold text-lg">In Progress</h2>
                <span className="ml-auto text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {wipCount}
                </span>
              </div>

              <div className="flex-1 space-y-4 min-h-[200px]">
                {wipGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <FlaskConical className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p className="text-sm text-muted-foreground">No work in progress</p>
                    <p className="text-xs text-muted-foreground mt-1">Fork a recipe from To Do to start</p>
                  </div>
                ) : (
                  wipGroups.map((group) => (
                    <div key={group.parentId} className="space-y-2">
                      {group.parentName && (
                        <p className="text-xs text-muted-foreground font-medium px-1">
                          Forks of &quot;{group.parentName}&quot;
                        </p>
                      )}
                      {group.forks.map((fork) => (
                        <WipRecipeCard
                          key={fork.id}
                          recipe={fork}
                          isOwned={userId !== null && fork.owner_id === userId}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Review Column */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                <span className="text-muted-foreground"><CheckCircle className="h-5 w-5" /></span>
                <h2 className="font-semibold text-lg">Review</h2>
              </div>

              <div className="flex-1 space-y-4 min-h-[200px]">
                {filteredSessions.length === 0 || readyForReviewRecipeIds.size === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <FlaskConical className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p className="text-sm text-muted-foreground">No tasting sessions</p>
                    <p className="text-xs text-muted-foreground mt-1">Create a session from a &apos;In Progress&apos; recipe</p>
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <ReviewSessionCard key={session.id} session={session} readyForReviewRecipeIds={readyForReviewRecipeIds} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
