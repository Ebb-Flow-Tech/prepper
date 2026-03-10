'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Star,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useTastingNoteImages, useSyncTastingNoteImages } from '@/lib/hooks/useTastings';
import { ImageUploadPreview, type ImageWithId } from '@/components/tasting/ImageUploadPreview';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Textarea,
  Select,
} from '@/components/ui';
import type { TastingNote, TastingDecision } from '@/types';

// ============ Constants ============

export const DECISION_CONFIG: Record<
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

// ============ StarRating ============

export function StarRating({ rating, onChange }: { rating: number | null; onChange?: (value: number) => void }) {
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

// ============ Types ============

export interface TastingNoteImageDisplay {
  id: number;
  image_url: string;
  tasting_note_id: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackFormData {
  taster_name: string;
  decision: TastingDecision | '';
  feedback: string;
  action_items: string;
  taste_rating: number | null;
  presentation_rating: number | null;
  texture_rating: number | null;
  overall_rating: number | null;
}

// ============ FeedbackForm ============

interface FeedbackFormProps {
  initialData?: Partial<FeedbackFormData>;
  onSubmit: (data: FeedbackFormData, images?: ImageWithId[]) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  showImages?: boolean;
  existingImages?: TastingNoteImageDisplay[];
}

export function FeedbackForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  showImages = false,
  existingImages = [],
}: FeedbackFormProps) {
  const [tasterName, setTasterName] = useState(initialData?.taster_name || '');
  const [decision, setDecision] = useState<TastingDecision | ''>(initialData?.decision || '');
  const [feedback, setFeedback] = useState(initialData?.feedback || '');
  const [actionItems, setActionItems] = useState(initialData?.action_items || '');
  const [tasteRating, setTasteRating] = useState<number | null>(initialData?.taste_rating ?? null);
  const [presentationRating, setPresentationRating] = useState<number | null>(initialData?.presentation_rating ?? null);
  const [textureRating, setTextureRating] = useState<number | null>(initialData?.texture_rating ?? null);
  const [overallRating, setOverallRating] = useState<number | null>(initialData?.overall_rating ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImageWithId[]>([]);

  const resetForm = () => {
    setTasterName(initialData?.taster_name || '');
    setDecision(initialData?.decision || '');
    setFeedback(initialData?.feedback || '');
    setActionItems(initialData?.action_items || '');
    setTasteRating(initialData?.taste_rating ?? null);
    setPresentationRating(initialData?.presentation_rating ?? null);
    setTextureRating(initialData?.texture_rating ?? null);
    setOverallRating(initialData?.overall_rating ?? null);
    setSelectedImages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          taster_name: tasterName.trim(),
          decision,
          feedback: feedback.trim(),
          action_items: actionItems.trim(),
          taste_rating: tasteRating,
          presentation_rating: presentationRating,
          texture_rating: textureRating,
          overall_rating: overallRating,
        },
        selectedImages
      );
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Overall Rating */}
      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Overall</label>
        <StarRating rating={overallRating} onChange={setOverallRating} />
      </div>

      {showImages && (
        <ImageUploadPreview
          onImagesSelected={setSelectedImages}
          uploadedImages={existingImages}
        />
      )}

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
          Suggested Actions
        </label>
        <Textarea
          value={actionItems}
          onChange={(e) => setActionItems(e.target.value)}
          placeholder="What needs to change..."
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Suggested Status
        </label>
        <Select
          value={decision}
          onChange={(e) => setDecision(e.target.value as TastingDecision | '')}
          options={[
            { value: '', label: 'Select status...' },
            { value: 'approved', label: 'Approved' },
            { value: 'needs_work', label: 'Needs Work' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ============ FeedbackNoteCard ============

interface FeedbackNoteCardProps {
  note: TastingNote;
  currentUserId: string | null;
  onUpdate: (noteId: number, data: Partial<TastingNote>) => Promise<void>;
  onDelete: (noteId: number) => Promise<void>;
  showOwnerBadge?: boolean;
}

export function FeedbackNoteCard({ note, currentUserId, onUpdate, onDelete, showOwnerBadge = false }: FeedbackNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);
  const { data: noteImages = [], isLoading: isLoadingImages } = useTastingNoteImages(isImagesExpanded ? note.id : null);
  const { data: editFormImages = [] } = useTastingNoteImages(isEditing ? note.id : null);
  const syncImages = useSyncTastingNoteImages();

  const decisionConfig = note.decision ? DECISION_CONFIG[note.decision] : null;
  const DecisionIcon = decisionConfig?.icon;

  const handleSave = async (data: FeedbackFormData, imagesWithId: ImageWithId[] = []) => {
    await onUpdate(note.id, {
      taster_name: data.taster_name || null,
      decision: data.decision || null,
      feedback: data.feedback || null,
      action_items: data.action_items || null,
      taste_rating: data.taste_rating,
      presentation_rating: data.presentation_rating,
      texture_rating: data.texture_rating,
      overall_rating: data.overall_rating,
    });

    if (imagesWithId.length > 0) {
      try {
        await syncImages.mutateAsync({
          tastingNoteId: note.id,
          images: imagesWithId,
        });
      } catch (imageError) {
        console.error('Failed to sync images:', imageError);
      }
    }

    setIsEditing(false);
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {note.taster_name && (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {note.taster_name}
              </span>
            )}
            {showOwnerBadge && note.user_id !== null && note.user_id === currentUserId && (
              <Badge variant="info" className="text-xs">You</Badge>
            )}
            {decisionConfig && (
              <Badge variant={decisionConfig.badgeVariant}>
                {DecisionIcon && <DecisionIcon className="h-3 w-3 mr-1" />}
                {decisionConfig.label}
              </Badge>
            )}
          </div>
        </div>
        {(note.user_id !== null && note.user_id === currentUserId) && (
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
        )}
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <FeedbackForm
            initialData={{
              taster_name: note.taster_name || '',
              decision: note.decision || '',
              feedback: note.feedback || '',
              action_items: note.action_items || '',
              taste_rating: note.taste_rating,
              presentation_rating: note.presentation_rating,
              texture_rating: note.texture_rating,
              overall_rating: note.overall_rating,
            }}
            onSubmit={handleSave}
            onCancel={() => setIsEditing(false)}
            submitLabel="Save Changes"
            showImages={true}
            existingImages={editFormImages}
          />
        ) : (
          <>
            {/* Overall Rating */}
            <div className="mb-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Overall</p>
              <StarRating rating={note.overall_rating} />
            </div>

            {/* Collapsible Images Section */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 mt-3">
              <button
                type="button"
                onClick={() => setIsImagesExpanded(!isImagesExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <span className={`transform transition-transform ${isImagesExpanded ? 'rotate-90' : ''}`}>
                  &#9654;
                </span>
                Images
              </button>

              {isImagesExpanded && (
                <div className="mt-3">
                  {isLoadingImages ? (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading images...</div>
                  ) : noteImages && noteImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {noteImages.map((image: TastingNoteImageDisplay) => (
                        <a
                          key={image.id}
                          href={image.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-square hover:ring-2 ring-purple-500 transition-all"
                        >
                          <Image
                            src={image.image_url}
                            alt="Tasting note"
                            width={200}
                            height={200}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No images available</p>
                  )}
                </div>
              )}
            </div>

            {note.feedback && (
              <div className="mb-3 mt-3">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mb-1">Feedback:</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{note.feedback}</p>
              </div>
            )}
            {note.action_items && (
              <div className="mb-3 text-sm">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">Suggested Actions:</p>
                <p className="text-zinc-600 dark:text-zinc-300">{note.action_items}</p>
              </div>
            )}
            {decisionConfig && (
              <div className="mb-3 text-sm">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">Suggested Status:</p>
                <Badge variant={decisionConfig.badgeVariant}>
                  {DecisionIcon && <DecisionIcon className="h-3 w-3 mr-1" />}
                  {decisionConfig.label}
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
