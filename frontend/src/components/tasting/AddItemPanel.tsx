'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  SearchInput,
  Badge,
} from '@/components/ui';
import type { Recipe, Ingredient } from '@/types';

interface AddItemPanelProps {
  type: 'recipe' | 'ingredient';
  label: string;
  placeholder: string;
  items: (Recipe | Ingredient)[];
  linkedItemIds: number[];
  isExpired: boolean;
  isOpen: boolean;
  onOpen: (isOpen: boolean) => void;
  onAdd: (itemId: number) => void;
  renderBadges?: (item: Recipe | Ingredient) => React.ReactNode;
}

export function AddItemPanel({
  type,
  label,
  placeholder,
  items,
  linkedItemIds,
  isExpired,
  isOpen,
  onOpen,
  onAdd,
  renderBadges,
}: AddItemPanelProps) {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const availableItems = items.filter(
    (item) => !linkedItemIds.includes(item.id)
  );

  const filteredItems = searchQuery
    ? availableItems.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableItems;

  const handleAddItem = () => {
    if (!selectedItemId) return;
    onAdd(selectedItemId);
    setSelectedItemId(null);
    setSearchQuery('');
    onOpen(false);
  };

  const handleSelectItem = (itemId: number) => {
    setSelectedItemId(itemId);
  };

  const handleCancel = () => {
    onOpen(false);
    setSearchQuery('');
    setSelectedItemId(null);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          {type === 'recipe' ? (
            <>
              <span className="text-purple-500">🍳</span>
              Session Recipes
            </>
          ) : (
            <>
              <span className="text-amber-500">🥘</span>
              Session Ingredients
            </>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <Button
              size="sm"
              onClick={() => onOpen(true)}
              disabled={isExpired}
              title={isExpired ? `Cannot add ${type}s to past sessions` : undefined}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add {type === 'recipe' ? 'Recipe' : 'Ingredient'}
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <Card className={`mb-4 border-200 dark:border-800 bg-50/50 dark:bg-900/10 ${
          type === 'recipe'
            ? 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'
            : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
        }`}>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Search {type === 'recipe' ? 'Recipes' : 'Ingredients'}
                </label>
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  placeholder={placeholder}
                  className="w-full"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
                {filteredItems.length === 0 ? (
                  <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                    {searchQuery
                      ? `No ${type}s match your search`
                      : `No ${type}s available`}
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                        selectedItemId === item.id
                          ? type === 'recipe'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{item.name}</span>
                        {renderBadges && (
                          <div className="flex items-center gap-1">
                            {renderBadges(item)}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleAddItem} disabled={!selectedItemId}>
                  Add
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                {selectedItemId && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Selected: {availableItems.find((item) => item.id === selectedItemId)?.name}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
