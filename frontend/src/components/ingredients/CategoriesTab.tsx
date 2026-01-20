'use client';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { useCategories, useUpdateCategory, useDeactivateCategory } from '@/lib/hooks';
import { CategoryCard, AddCategoryModal } from '@/components/categories';
import { PageHeader, SearchInput, Button, Skeleton, Input, Textarea } from '@/components/ui';
import { toast } from 'sonner';
import type { Category } from '@/types';

interface CategoryFormData {
  name: string;
  description: string;
}

interface EditCategoryModalProps {
  category: Category;
  onClose: () => void;
}

function EditCategoryModal({ category, onClose }: EditCategoryModalProps) {
  const updateCategory = useUpdateCategory();
  const [formData, setFormData] = useState<CategoryFormData>({
    name: category.name,
    description: category.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    updateCategory.mutate(
      {
        id: category.id,
        data: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        },
      },
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
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Proteins"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description for this category"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={updateCategory.isPending}>
              {updateCategory.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function CategoriesTab() {
  const deactivateCategory = useDeactivateCategory();
  const updateCategory = useUpdateCategory();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { data: categories, isLoading, error } = useCategories(showArchived);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];

    return categories.filter((cat) => {
      if (search && !cat.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categories, search]);

  const handleArchive = (category: Category) => {
    deactivateCategory.mutate(category.id, {
      onSuccess: () => toast.success(`${category.name} archived`),
      onError: () => toast.error(`Failed to archive ${category.name}`),
    });
  };

  const handleUnarchive = (category: Category) => {
    updateCategory.mutate(
      { id: category.id, data: { is_active: true } },
      {
        onSuccess: () => toast.success(`${category.name} unarchived`),
        onError: () => toast.error(`Failed to unarchive ${category.name}`),
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load categories. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Categories"
          description="Manage ingredient categories"
        >
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Category</span>
          </Button>
        </PageHeader>

        <AddCategoryModal isOpen={showForm} onClose={() => setShowForm(false)} />

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
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              Show archived
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={setEditingCategory}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
              />
            ))}
          </div>
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
