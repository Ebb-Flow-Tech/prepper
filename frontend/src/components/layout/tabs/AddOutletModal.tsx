'use client';

import { useState, useMemo } from 'react';
import { useOutlets, useAddRecipeToOutlet } from '@/lib/hooks';
import { Input, Button } from '@/components/ui';
import { X } from 'lucide-react';

interface AddOutletModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: number;
}

export function AddOutletModal({ isOpen, onClose, recipeId }: AddOutletModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(null);
  const [priceOverride, setPriceOverride] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: outlets = [], isLoading: outletLoading } = useOutlets();
  const addRecipeToOutlet = useAddRecipeToOutlet();

  // Filter outlets based on search query
  const filteredOutlets = useMemo(() => {
    return outlets.filter((outlet) =>
      outlet.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [outlets, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId) return;

    setIsSubmitting(true);
    try {
      await addRecipeToOutlet.mutateAsync({
        recipeId,
        data: {
          outlet_id: selectedOutletId,
          is_active: true,
          price_override: priceOverride ? parseFloat(priceOverride) : null,
        },
      });
      // Reset form
      setSearchQuery('');
      setSelectedOutletId(null);
      setPriceOverride('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Add Outlet
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search filter */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Search Outlets
            </label>
            <Input
              type="text"
              placeholder="Search outlet name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Outlets dropdown */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Select Outlet
            </label>
            {outletLoading ? (
              <div className="text-sm text-zinc-500">Loading outlets...</div>
            ) : filteredOutlets.length === 0 ? (
              <div className="text-sm text-zinc-500">
                {searchQuery ? 'No outlets match your search' : 'No outlets available'}
              </div>
            ) : (
              <select
                value={selectedOutletId || ''}
                onChange={(e) => setSelectedOutletId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Choose an outlet...</option>
                {filteredOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Price override */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Price Override (Optional)
            </label>
            <Input
              type="number"
              placeholder="Enter price override"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              step="0.01"
              min="0"
              className="w-full"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedOutletId || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Adding...' : 'Add Outlet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
