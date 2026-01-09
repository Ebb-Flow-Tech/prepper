'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  Star,
  ChefHat,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  useTastingSession,
  useSessionNotes,
  useAddNoteToSession,
  useUpdateTastingNote,
  useDeleteTastingNote,
} from '@/lib/hooks/useTastings';
import { useRecipe } from '@/lib/hooks';
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
import type { TastingNote, TastingDecision } from '@/types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isSessionExpired(dateString: string): boolean {
  const sessionDate = new Date(dateString);
  const today = new Date();
  sessionDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
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

interface FeedbackNoteCardProps {
  note: TastingNote;
  sessionId: number;
  isExpired: boolean;
  onUpdate: (noteId: number, data: Partial<TastingNote>) => Promise<void>;
  onDelete: (noteId: number) => Promise<void>;
}

function FeedbackNoteCard({ note, sessionId, isExpired, onUpdate, onDelete }: FeedbackNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(note.feedback || '');
  const [actionItems, setActionItems] = useState(note.action_items || '');
  const [decision, setDecision] = useState<TastingDecision | ''>(note.decision || '');
  const [tasterName, setTasterName] = useState(note.taster_name || '');

  const decisionConfig = note.decision ? DECISION_CONFIG[note.decision] : null;
  const DecisionIcon = decisionConfig?.icon;

  const handleStartEditing = () => {
    setFeedback(note.feedback || '');
    setActionItems(note.action_items || '');
    setDecision(note.decision || '');
    setTasterName(note.taster_name || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onUpdate(note.id, {
      feedback: feedback.trim() || null,
      action_items: actionItems.trim() || null,
      decision: decision || null,
      taster_name: tasterName.trim() || null,
    });
    setIsEditing(false);
  };

  const handleUpdateRating = async (field: string, value: number) => {
    await onUpdate(note.id, { [field]: value });
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.taster_name && (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {note.taster_name}
              </span>
            )}
            {decisionConfig && (
              <Badge variant={decisionConfig.badgeVariant}>
                {DecisionIcon && <DecisionIcon className="h-3 w-3 mr-1" />}
                {decisionConfig.label}
              </Badge>
            )}
          </div>
        </div>
        {!isExpired && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => isEditing ? setIsEditing(false) : handleStartEditing()}
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
        )}
      </CardHeader>

      <CardContent>
        {/* Ratings */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Taste</p>
            <StarRating
              rating={note.taste_rating}
              onChange={isEditing ? (v) => handleUpdateRating('taste_rating', v) : undefined}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Presentation</p>
            <StarRating
              rating={note.presentation_rating}
              onChange={isEditing ? (v) => handleUpdateRating('presentation_rating', v) : undefined}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Texture</p>
            <StarRating
              rating={note.texture_rating}
              onChange={isEditing ? (v) => handleUpdateRating('texture_rating', v) : undefined}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Overall</p>
            <StarRating
              rating={note.overall_rating}
              onChange={isEditing ? (v) => handleUpdateRating('overall_rating', v) : undefined}
            />
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Chef Name
              </label>
              <Input
                value={tasterName}
                onChange={(e) => setTasterName(e.target.value)}
                placeholder="e.g., Chef Marco"
              />
            </div>
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

export default function RecipeTastingPage() {
  const params = useParams();
  const sessionId = params.id ? Number(params.id) : null;
  const recipeId = params.recipeId ? Number(params.recipeId) : null;

  const { data: session, isLoading: sessionLoading } = useTastingSession(sessionId);
  const { data: recipe, isLoading: recipeLoading } = useRecipe(recipeId);
  const { data: allNotes } = useSessionNotes(sessionId);

  const addNote = useAddNoteToSession();
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();

  // Filter notes for this specific recipe
  const recipeNotes = allNotes?.filter((n) => n.recipe_id === recipeId) || [];

  // For new notes
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTasterName, setNewTasterName] = useState('');
  const [newOverallRating, setNewOverallRating] = useState<number | null>(null);
  const [newFeedback, setNewFeedback] = useState('');

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !recipeId) return;
    try {
      await addNote.mutateAsync({
        sessionId,
        data: {
          recipe_id: recipeId,
          overall_rating: newOverallRating || null,
          taster_name: newTasterName.trim() || null,
          feedback: newFeedback.trim() || null,
        },
      });
      setShowAddForm(false);
      setNewTasterName('');
      setNewOverallRating(null);
      setNewFeedback('');
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
    if (!confirm('Remove this feedback from the tasting session?')) return;
    try {
      await deleteNote.mutateAsync({ sessionId, noteId });
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  if (sessionLoading || recipeLoading) {
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

  if (!recipe) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Recipe not found.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/tastings/${sessionId}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Session
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat className="h-6 w-6 text-purple-500" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{recipe.name}</h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">{session.name}</p>
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
        </div>

        {/* Feedback Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Feedback ({recipeNotes.length})
          </h2>
          {!showAddForm && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              disabled={isSessionExpired(session.date)}
              title={isSessionExpired(session.date) ? 'Cannot add feedback to past sessions' : undefined}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Feedback
            </Button>
          )}
        </div>

        {/* Add Feedback Form */}
        {showAddForm && (
          <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
            <CardContent className="pt-4">
              <form onSubmit={handleAddNote} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Initial Overall Rating
                  </label>
                  <StarRating rating={newOverallRating} onChange={setNewOverallRating} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Your Name
                  </label>
                  <Input
                    value={newTasterName}
                    onChange={(e) => setNewTasterName(e.target.value)}
                    placeholder="e.g., Chef Marco"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Feedback
                  </label>
                  <Textarea
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    placeholder="Tasting notes and observations..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit">
                    Add Feedback
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Feedback Notes List */}
        {recipeNotes.length === 0 && !showAddForm ? (
          <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
            <p className="text-zinc-500 dark:text-zinc-400">No feedback recorded yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              Add feedback to record tasting notes
            </p>
          </div>
        ) : (
          <div>
            {recipeNotes.map((note) => (
              <FeedbackNoteCard
                key={note.id}
                note={note}
                sessionId={sessionId!}
                isExpired={isSessionExpired(session.date)}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
