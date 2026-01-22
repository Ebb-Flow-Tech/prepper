'use client';

import { useState, useCallback } from 'react';
import { useCreateOutlet, useOutlets } from '@/lib/hooks';
import { Button, Input, Select, Modal } from '@/components/ui';
import { toast } from 'sonner';
import type { OutletType } from '@/types';

interface AddOutletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OUTLET_TYPE_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'location', label: 'Location' },
];

export function AddOutletModal({ isOpen, onClose }: AddOutletModalProps) {
  const createOutlet = useCreateOutlet();
  const { data: allOutlets = [] } = useOutlets(false); // Get all outlets including archived

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [outletType, setOutletType] = useState<OutletType>('brand');
  const [parentOutletId, setParentOutletId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setCode('');
    setOutletType('brand');
    setParentOutletId('');
    setIsSubmitting(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Outlet name is required');
      return;
    }
    if (!code.trim()) {
      toast.error('Outlet code is required');
      return;
    }

    setIsSubmitting(true);

    try {
      await createOutlet.mutateAsync({
        name: name.trim(),
        code: code.trim(),
        outlet_type: outletType,
        parent_outlet_id: parentOutletId ? parseInt(parentOutletId) : null,
      });

      toast.success('Outlet created');
      resetForm();
      onClose();
    } catch {
      toast.error('Failed to create outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Outlet">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Outlet Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main Branch, Downtown Location"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Code *
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g., CS, TBH, MBR"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Outlet Type
          </label>
          <Select
            value={outletType}
            onChange={(e) => setOutletType(e.target.value as OutletType)}
            options={OUTLET_TYPE_OPTIONS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Parent Outlet (optional)
          </label>
          <select
            value={parentOutletId}
            onChange={(e) => setParentOutletId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- None --</option>
            {allOutlets
              .filter((outlet) => outlet.id) // Filter out any invalid outlets
              .map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </option>
              ))}
          </select>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim() || !code.trim()}>
            {isSubmitting ? 'Creating...' : 'Create Outlet'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
