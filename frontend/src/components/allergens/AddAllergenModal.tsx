'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateAllergen } from '@/lib/hooks';
import { toast } from 'sonner';

interface AddAllergenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAllergenModal({ isOpen, onClose }: AddAllergenModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createAllergen = useCreateAllergen();
  const isSubmitting = createAllergen.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createAllergen.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });

      setName('');
      setDescription('');
      onClose();
      toast.success('Allergen created successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create allergen');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Allergen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Allergen Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Milk, Peanuts, Fish"
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
            placeholder="Optional description for this allergen"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Creating...' : 'Create Allergen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
