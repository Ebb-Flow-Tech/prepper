'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  Star,
  Trash2,
  Edit,
} from 'lucide-react';
import {
  useTastingSession,
  useTastingSessionStats,
  useSessionNotes,
  useAddNoteToSession,
  useUpdateTastingNote,
  useDeleteTastingNote,
  useDeleteTastingSession,
} from '@/lib/hooks/useTastings';
import { useRecipes } from '@/lib/hooks';
import {
  Button,
  Skeleton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Input,
  Textarea,
  Select,
} from '@/components/ui';
import type { TastingNote, TastingDecision, Recipe } from '@/types';
import { useAppState } from '@/lib/store';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const DECISION_CONFIG: Record<
  TastingDecision,
  { label: string; icon: typeof CheckCircle; className: string; badgeVariant: 'success' | 'warning' | 'destructive' }
> = {
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    className: 'text-green-600 dark:text-green-400',
    badgeVariant: 'success',
  },
  needs_work: {
    label: 'Needs Work',
    icon: AlertCircle,
    className: 'text-amber-600 dark:text-amber-400',
    badgeVariant: 'warning',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'text-red-600 dark:text-red-400',
    badgeVariant: 'destructive',
  },
};

function StarRating({ rating, onChange }: { rating: number | null; onChange?: (value: number) => void }) {
  const isInteractive = !!onChange;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!isInteractive}
          onClick={() => onChange?.(star)}
          className={`${isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            className={`h-4 w-4 ${rating && star <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-zinc-300 dark:text-zinc-600'
              }`}
          />
        </button>
      ))}
    </div>
  );
}

interface TastingNoteCardProps {
  note: TastingNote;
  recipes: Recipe[];
  onUpdate: (noteId: number, data: Partial<TastingNote>) => void;
  onDelete: (noteId: number) => void;
}

function TastingNoteCard({ note, recipes, onUpdate, onDelete }: TastingNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(note.feedback || '');
  const [actionItems, setActionItems] = useState(note.action_items || '');
  const [decision, setDecision] = useState<TastingDecision | ''>(note.decision || '');

  const recipe = recipes.find((r) => r.id === note.recipe_id);
  const decisionConfig = note.decision ? DECISION_CONFIG[note.decision] : null;
  const DecisionIcon = decisionConfig?.icon;

  const handleSave = () => {
    onUpdate(note.id, {
      feedback: feedback.trim() || null,
      action_items: actionItems.trim() || null,
      decision: decision || null,
    });
    setIsEditing(false);
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate">
              <Link
                href={`/recipes/${note.recipe_id}`}
                className="hover:text-purple-600 dark:hover:text-purple-400"
              >
                {recipe?.name || `Recipe #${note.recipe_id}`}
              </Link>
            </CardTitle>
            {decisionConfig && (
              <Badge variant={decisionConfig.badgeVariant}>
                {DecisionIcon && <DecisionIcon className="h-3 w-3 mr-1" />}
                {decisionConfig.label}
              </Badge>
            )}
          </div>
          {note.taster_name && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Tasted by {note.taster_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Ratings */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Taste</p>
            <StarRating
              rating={note.taste_rating}
              onChange={isEditing ? (v) => onUpdate(note.id, { taste_rating: v }) : undefined}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Presentation</p>
            <StarRating
              rating={note.presentation_rating}
              onChange={isEditing ? (v) => onUpdate(note.id, { presentation_rating: v }) : undefined}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Texture</p>
            <StarRating
              rating={note.texture_rating}
              onChange={isEditing ? (v) => onUpdate(note.id, { texture_rating: v }) : undefined}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Overall</p>
            <StarRating
              rating={note.overall_rating}
              onChange={isEditing ? (v) => onUpdate(note.id, { overall_rating: v }) : undefined}
            />
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Decision
              </label>
              <Select
                value={decision}
                onChange={(e) => setDecision(e.target.value as TastingDecision | '')}
                options={[
                  { value: '', label: 'Select decision...' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'needs_work', label: 'Needs Work' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Feedback
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tasting notes and observations..."
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action Items
              </label>
              <Textarea
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="What needs to change..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave}>
                Save Changes
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {note.feedback && (
              <div className="mb-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">&ldquo;{note.feedback}&rdquo;</p>
              </div>
            )}
            {note.action_items && (
              <div className="text-sm">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">Action Items:</p>
                <p className="text-zinc-600 dark:text-zinc-300">{note.action_items}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface AddRecipeFormProps {
  recipes: Recipe[];
  existingRecipeIds: number[];
  onAdd: (data: { recipe_id: number; overall_rating?: number; taster_name?: string }) => void;
  onCancel: () => void;
}

function AddRecipeForm({ recipes, existingRecipeIds, onAdd, onCancel }: AddRecipeFormProps) {
  const { userId } = useAppState()
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | ''>('');
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [tasterName, setTasterName] = useState('');

  const availableRecipes = recipes.filter((r) => !existingRecipeIds.includes(r.id) && r.created_by == userId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId) return;

    onAdd({
      recipe_id: selectedRecipeId as number,
      overall_rating: overallRating || undefined,
      taster_name: tasterName.trim() || undefined,
    });
  };

  return (
    <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Recipe to Taste *
            </label>
            <Select
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'Select a recipe...' },
                ...availableRecipes.map((r) => ({ value: String(r.id), label: r.name })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Initial Overall Rating
            </label>
            <StarRating rating={overallRating} onChange={setOverallRating} />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Your Name
            </label>
            <Input
              value={tasterName}
              onChange={(e) => setTasterName(e.target.value)}
              placeholder="e.g., Chef Marco"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!selectedRecipeId}>
              Add Recipe
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function TastingSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id ? Number(params.id) : null;

  const { data: session, isLoading: sessionLoading } = useTastingSession(sessionId);
  const { data: stats } = useTastingSessionStats(sessionId);
  const { data: notes, isLoading: notesLoading } = useSessionNotes(sessionId);
  const { data: recipes } = useRecipes();

  const addNote = useAddNoteToSession();
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();
  const deleteSession = useDeleteTastingSession();

  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleAddNote = async (data: { recipe_id: number; overall_rating?: number; taster_name?: string }) => {
    if (!sessionId) return;
    try {
      await addNote.mutateAsync({
        sessionId,
        data: {
          recipe_id: data.recipe_id,
          overall_rating: data.overall_rating || null,
          taster_name: data.taster_name || null,
        },
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleUpdateNote = async (noteId: number, data: Partial<TastingNote>) => {
    if (!sessionId) return;
    try {
      await updateNote.mutateAsync({ sessionId, noteId, data });
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!sessionId) return;
    if (!confirm('Remove this recipe from the tasting session?')) return;
    try {
      await deleteNote.mutateAsync({ sessionId, noteId });
    } catch (error) {
      console.error('Failed to delete note:', error);
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

  if (!session) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Tasting session not found.
        </div>
      </div>
    );
  }

  const existingRecipeIds = notes?.map((n) => n.recipe_id) || [];

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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{session.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <span>{formatDate(session.date)}</span>
            </div>
            {session.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-zinc-400" />
                <span>{session.location}</span>
              </div>
            )}
            {session.attendees && session.attendees.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-zinc-400" />
                <span>{session.attendees.join(', ')}</span>
              </div>
            )}
          </div>

          {session.notes && (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 italic">{session.notes}</p>
          )}
        </div>

        {/* Stats */}
        {stats && stats.recipe_count > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="text-center p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.recipe_count}</p>
              <p className="text-xs text-zinc-500">Recipes</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.approved_count}</p>
              <p className="text-xs text-green-600 dark:text-green-500">Approved</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.needs_work_count}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Needs Work</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.rejected_count}</p>
              <p className="text-xs text-red-600 dark:text-red-500">Rejected</p>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recipes Tasted</h2>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Recipe
            </Button>
          )}
        </div>

        {showAddForm && recipes && (
          <AddRecipeForm
            recipes={recipes}
            existingRecipeIds={existingRecipeIds}
            onAdd={handleAddNote}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {notesLoading && (
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        )}

        {!notesLoading && notes && notes.length === 0 && !showAddForm && (
          <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
            <p className="text-zinc-500 dark:text-zinc-400">No recipes tasted yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              Add recipes to start recording feedback
            </p>
          </div>
        )}

        {!notesLoading && notes && notes.length > 0 && recipes && (
          <div>
            {notes.map((note) => (
              <TastingNoteCard
                key={note.id}
                note={note}
                recipes={recipes}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
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
