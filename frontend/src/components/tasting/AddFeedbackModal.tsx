'use client';

import {
  FeedbackForm,
  type FeedbackFormData,
} from '@/components/tasting/FeedbackShared';
import { type ImageWithId } from '@/components/tasting/ImageUploadPreview';
import { Modal } from '@/components/ui';

interface AddFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeName: string;
  initialData?: Partial<FeedbackFormData>;
  onSubmit: (data: FeedbackFormData, images?: ImageWithId[]) => Promise<void>;
}

export function AddFeedbackModal({
  isOpen,
  onClose,
  recipeName,
  initialData,
  onSubmit,
}: AddFeedbackModalProps) {
  const handleSubmit = async (data: FeedbackFormData, images?: ImageWithId[]) => {
    await onSubmit(data, images);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Feedback — ${recipeName}`}
      maxWidth="max-w-lg"
      maxHeight="max-h-[80vh]"
    >
      <FeedbackForm
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitLabel="Add Feedback"
        showImages={true}
      />
    </Modal>
  );
}
