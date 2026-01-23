'use client';

import { useState, useCallback } from 'react';
import { useCreateRecipeCategory } from '@/lib/hooks';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { toast } from 'sonner';

interface AddRecipeCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRecipeCategoryModal({ isOpen, onClose }: AddRecipeCategoryModalProps) {
  const createRecipeCategory = useCreateRecipeCategory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setIsSubmitting(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      await createRecipeCategory.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });

      toast.success('Recipe category created');
      resetForm();
      onClose();
    } catch {
      toast.error('Failed to create recipe category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Recipe Category">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Category Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Appetizers, Main Courses, Desserts"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Description (optional)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Cold appetizers served before main course"
            rows={3}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Creating...' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
