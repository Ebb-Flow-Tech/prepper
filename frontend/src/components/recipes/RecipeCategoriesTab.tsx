'use client';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { useRecipeCategories, useUpdateRecipeCategory, useDeleteRecipeCategory } from '@/lib/hooks';
import { RecipeCategoryCard } from './RecipeCategoryCard';
import { RecipeCategoryListRow } from './RecipeCategoryListRow';
import { AddRecipeCategoryModal } from './AddRecipeCategoryModal';
import { PageHeader, SearchInput, Button, Skeleton, Input, Textarea, ViewToggle } from '@/components/ui';
import { toast } from 'sonner';
import type { RecipeCategory, UpdateRecipeCategoryRequest } from '@/types';

type ViewType = 'grid' | 'list';

interface EditCategoryModalProps {
  category: RecipeCategory;
  onClose: () => void;
}

function EditCategoryModal({ category, onClose }: EditCategoryModalProps) {
  const updateRecipeCategory = useUpdateRecipeCategory();
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }

    const updateData: UpdateRecipeCategoryRequest = {
      name: name.trim(),
      description: description.trim() || null,
    };

    updateRecipeCategory.mutate(
      { id: category.id, data: updateData },
      {
        onSuccess: () => {
          toast.success('Category updated');
          onClose();
        },
        onError: () => {
          toast.error('Failed to update category');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-lg w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-lg">Edit Category</h3>
          <Button variant="ghost" size="icon" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Appetizers"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Category description"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={updateRecipeCategory.isPending}>
              {updateRecipeCategory.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function RecipeCategoriesTab() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RecipeCategory | null>(null);
  const [view, setView] = useState<ViewType>('grid');
  const { data: categories = [], isLoading, error } = useRecipeCategories();
  const deleteRecipeCategory = useDeleteRecipeCategory();

  const filteredCategories = useMemo(() => {
    if (!categories) return [];

    return categories.filter((category) => {
      if (search && !category.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categories, search]);

  const handleDeleteCategory = (category: RecipeCategory) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    deleteRecipeCategory.mutate(category.id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: () => toast.error('Failed to delete category'),
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load recipe categories. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Categories"
          description="Organize recipes into categories"
        >
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Category</span>
          </Button>
        </PageHeader>

        <AddRecipeCategoryModal isOpen={showForm} onClose={() => setShowForm(false)} />

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle view={view} onViewChange={setView} />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          )
        )}

        {/* Empty State */}
        {!isLoading && filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No categories match your search' : 'No categories yet'}
            </p>
          </div>
        )}

        {/* Categories Grid */}
        {!isLoading && filteredCategories.length > 0 && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCategories.map((category) => (
                <RecipeCategoryCard
                  key={category.id}
                  category={category}
                  onEdit={setEditingCategory}
                  onDelete={handleDeleteCategory}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {filteredCategories.map((category) => (
                <RecipeCategoryListRow
                  key={category.id}
                  category={category}
                  onEdit={setEditingCategory}
                  onDelete={handleDeleteCategory}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Edit Modal */}
      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  );
}
