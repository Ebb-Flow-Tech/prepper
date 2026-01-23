'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, MoreVertical, Check, X, Trash2 } from 'lucide-react';
import {
  useRecipeCategory,
  useUpdateRecipeCategory,
  useCategoryRecipes,
  useRecipes,
  useAddRecipeToCategory,
  useRemoveRecipeFromCategory,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, EditableCell, Input, Modal, Select, Skeleton } from '@/components/ui';
import type { UpdateRecipeCategoryRequest, RecipeRecipeCategory } from '@/types';

interface RecipeCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default function RecipeCategoryPage({ params }: RecipeCategoryPageProps) {
  const { id } = use(params);
  const categoryId = parseInt(id, 10);

  const { data: category, isLoading, error } = useRecipeCategory(categoryId);
  const { data: categoryRecipes = [] } = useCategoryRecipes(categoryId);
  const { data: recipes = [] } = useRecipes();

  const updateCategoryMutation = useUpdateRecipeCategory();
  const addRecipeMutation = useAddRecipeToCategory();
  const removeMutation = useRemoveRecipeFromCategory();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    recipe_id: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<RecipeRecipeCategory | null>(null);

  const handleUpdateCategory = (data: UpdateRecipeCategoryRequest) => {
    updateCategoryMutation.mutate({ id: categoryId, data });
  };

  // Filter recipes that are not already added to this category
  const existingRecipeIds = new Set(categoryRecipes.map((r) => r.recipe_id));
  const recipesToAdd = recipes.filter((r) => !existingRecipeIds.has(r.id));

  // Filter recipes by search term
  const filteredRecipes = recipesToAdd.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddRecipe = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.recipe_id) {
      toast.error('Please select a recipe');
      return;
    }

    addRecipeMutation.mutate(
      {
        recipe_id: parseInt(formData.recipe_id, 10),
        category_id: categoryId,
      },
      {
        onSuccess: () => {
          toast.success('Recipe added to category');
          setFormData({ recipe_id: '' });
          setSearchTerm('');
          setShowAddModal(false);
        },
        onError: () => {
          toast.error('Failed to add recipe');
        },
      }
    );
  };

  const handleDeleteRecipe = (link: RecipeRecipeCategory) => {
    removeMutation.mutate(
      {
        linkId: link.id,
        categoryId: link.category_id,
        recipeId: link.recipe_id,
      },
      {
        onSuccess: () => {
          toast.success('Recipe removed from category');
          setDeleteConfirm(null);
        },
        onError: () => {
          toast.error('Failed to remove recipe');
        },
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Recipes
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Category not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : category ? (
          <>
            {/* Category Header Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Category Name */}
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      <EditableCell
                        value={category.name}
                        onSave={(value) => handleUpdateCategory({ name: value })}
                        className="text-2xl font-bold"
                      />
                    </h1>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                    {/* Description */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Description
                      </label>
                      <div className="flex items-center gap-2">
                        <EditableCell
                          value={category.description || ''}
                          onSave={(value) =>
                            handleUpdateCategory({
                              description: value || null,
                            })
                          }
                          className="text-sm w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    Created: {new Date(category.created_at).toLocaleDateString()}
                    {category.updated_at !== category.created_at && (
                      <span className="ml-4">
                        Updated: {new Date(category.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipes Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Recipes
                  </h2>
                </div>

                {/* Add Recipe Button */}
                <div className="mb-4">
                  <Button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Recipe
                  </Button>
                </div>

                {/* Add Recipe Modal */}
                <Modal
                  isOpen={showAddModal}
                  onClose={() => {
                    setShowAddModal(false);
                    setSearchTerm('');
                    setFormData({ recipe_id: '' });
                  }}
                  title="Add Recipe to Category"
                  maxWidth="max-w-lg"
                >
                  <form onSubmit={handleAddRecipe} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                        Search Recipe
                      </label>
                      <Input
                        type="text"
                        placeholder="Search recipes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mb-2"
                      />
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        Recipe
                      </label>
                      <Select
                        value={formData.recipe_id}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, recipe_id: e.target.value }))
                        }
                        options={[
                          { value: '', label: 'Select recipe...' },
                          ...filteredRecipes.map((r) => ({
                            value: r.id.toString(),
                            label: r.name,
                          })),
                        ]}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddModal(false);
                          setSearchTerm('');
                          setFormData({ recipe_id: '' });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!formData.recipe_id || addRecipeMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Recipe
                      </Button>
                    </div>
                  </form>
                </Modal>

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                  <Modal
                    isOpen={!!deleteConfirm}
                    onClose={() => setDeleteConfirm(null)}
                    title="Remove Recipe from Category"
                    maxWidth="max-w-md"
                  >
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        Are you sure you want to remove{' '}
                        <span className="font-medium">
                          {recipes.find((r) => r.id === deleteConfirm.recipe_id)?.name || 'this recipe'}
                        </span>{' '}
                        from this category? This will not delete the recipe itself.
                      </p>

                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={removeMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteRecipe(deleteConfirm)}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove Recipe
                        </Button>
                      </div>
                    </div>
                  </Modal>
                )}

                {/* Recipes Table */}
                {categoryRecipes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Recipe Name
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryRecipes.map((recipeLink) => {
                          const recipe = recipes.find((r) => r.id === recipeLink.recipe_id);
                          return (
                            <tr
                              key={recipeLink.id}
                              className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group"
                            >
                              <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                                <Link
                                  href={`/recipes/${recipeLink.recipe_id}`}
                                  className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                                >
                                  {recipe?.name || 'Unknown Recipe'}
                                </Link>
                              </td>
                              <td className="py-3 px-2">
                                <div className="relative group/menu flex justify-end">
                                  <button
                                    onClick={() => setDeleteConfirm(recipeLink)}
                                    className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                                    title="Remove from category"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No recipes in this category yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
