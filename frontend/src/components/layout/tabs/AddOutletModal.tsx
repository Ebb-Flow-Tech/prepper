'use client';

import { useState, useMemo } from 'react';
import { useAddRecipeToOutlet } from '@/lib/hooks';
import { Input, Button } from '@/components/ui';
import { X } from 'lucide-react';
import type { Outlet } from '@/types';

interface AddOutletModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: number;
  outlets?: Outlet[];
}

export function AddOutletModal({ isOpen, onClose, recipeId, outlets = [] }: AddOutletModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(null);
  const [priceOverride, setPriceOverride] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-scrim)]">
      <div className="relative w-full max-w-md rounded-2xl bg-popover p-6 shadow-elevation-3">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Add Outlet
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search filter */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Select Outlet
            </label>
            {filteredOutlets.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {searchQuery ? 'No outlets match your search' : 'No outlets available'}
              </div>
            ) : (
              <select
                value={selectedOutletId || ''}
                onChange={(e) => setSelectedOutletId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Price Override (Optional)
            </label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Enter price override"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              onBlur={() => { const n = parseFloat(priceOverride); if (!isNaN(n)) setPriceOverride(String(n)); }}
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
