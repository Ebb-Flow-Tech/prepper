'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, MoreVertical, Check, X, Edit as EditIcon, Trash2 } from 'lucide-react';
import {
  useOutlet,
  useUpdateOutlet,
  useOutlets,
  useOutletRecipes,
  useAddRecipeToOutlet,
  useUpdateRecipeOutlet,
  useRemoveRecipeFromOutlet,
  useRecipes,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, EditableCell, Input, Modal, Select, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { UpdateOutletRequest } from '@/types';

const OUTLET_TYPE_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'location', label: 'Location' },
];

interface EditableSelectProps {
  value: string;
  onSave: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  onValidate?: (newValue: string) => boolean;
  disabled?: boolean;
}

function EditableSelect({ value, onSave, options, className = '', onValidate, disabled = false }: EditableSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setIsEditing(false);
    if (newValue !== value) {
      if (onValidate && !onValidate(newValue)) {
        return;
      }
      onSave(newValue);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`px-1 py-0.5 text-sm border border-purple-400 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white dark:bg-zinc-800 ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const displayLabel = options.find((opt) => opt.value === value)?.label ?? value;

  return (
    <span
      onClick={() => !disabled && setIsEditing(true)}
      className={`px-1 py-0.5 rounded font-medium text-zinc-900 dark:text-zinc-100 ${disabled
          ? 'cursor-not-allowed text-zinc-400 dark:text-zinc-500'
          : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700'
        } ${className}`}
    >
      {displayLabel}
    </span>
  );
}

interface OutletPageProps {
  params: Promise<{ id: string }>;
}

export default function OutletPage({ params }: OutletPageProps) {
  const { id } = use(params);
  const outletId = parseInt(id, 10);

  const { data: outlet, isLoading, error } = useOutlet(outletId);
  const { data: allOutlets = [] } = useOutlets(true);
  const { data: outletRecipes = [] } = useOutletRecipes(outletId);
  const { data: recipes = [] } = useRecipes();

  const updateOutletMutation = useUpdateOutlet();
  const addRecipeToOutletMutation = useAddRecipeToOutlet();
  const updateRecipeOutletMutation = useUpdateRecipeOutlet();
  const removeRecipeFromOutletMutation = useRemoveRecipeFromOutlet();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecipe, setEditingRecipe] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<number, { price_override: number | null }>>({});
  const [formData, setFormData] = useState({
    recipe_id: '',
    price_override: '',
  });

  // Get child outlets count for current outlet
  const childOutletsCount = allOutlets.filter((o) => o.parent_outlet_id === outletId).length;
  const hasChildren = childOutletsCount > 0;

  // Disable outlet type if: brand with children OR location with parent outlet
  const outletTypeDisabled = hasChildren || (outlet?.outlet_type === 'location' && outlet?.parent_outlet_id !== null);


  const handleUpdateOutlet = (data: UpdateOutletRequest) => {
    updateOutletMutation.mutate({ id: outletId, data });
  };

  // Filter recipes that are not already added to this outlet
  const existingRecipeIds = new Set(outletRecipes.map((r) => r.recipe_id));
  const recipesToAdd = recipes.filter((r) => !existingRecipeIds.has(r.id));

  // Filter recipes by search term
  const filteredRecipes = recipesToAdd.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get available parent outlets (exclude current outlet, only brands)
  const parentOutletOptions = allOutlets
    .filter((o) => o.id !== outletId && o.is_active && o.outlet_type === 'brand')
    .map((o) => ({ value: o.id.toString(), label: o.name }));

  const handleAddRecipe = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.recipe_id) {
      toast.error('Please select a recipe');
      return;
    }

    const priceOverride = formData.price_override ? parseFloat(formData.price_override) : null;

    addRecipeToOutletMutation.mutate(
      {
        recipeId: parseInt(formData.recipe_id, 10),
        data: {
          outlet_id: outletId,
          price_override: priceOverride,
        },
      },
      {
        onSuccess: () => {
          toast.success('Recipe added to outlet');
          setFormData({ recipe_id: '', price_override: '' });
          setSearchTerm('');
          setShowAddModal(false);
        },
        onError: () => {
          toast.error('Failed to add recipe');
        },
      }
    );
  };

  const handleDeleteRecipe = (recipeId: number) => {
    removeRecipeFromOutletMutation.mutate(
      {
        recipeId,
        outletId,
      },
      {
        onSuccess: () => {
          toast.success('Recipe removed from outlet');
        },
        onError: () => {
          toast.error('Failed to remove recipe');
        },
      }
    );
  };

  const handleUpdateRecipe = (recipeId: number) => {
    const dataToSave = editData[recipeId];
    if (dataToSave !== undefined) {
      updateRecipeOutletMutation.mutate(
        {
          recipeId,
          outletId,
          data: {
            price_override: dataToSave.price_override,
          },
        },
        {
          onSuccess: () => {
            toast.success('Recipe updated');
            setEditingRecipe(null);
            setEditData({});
          },
          onError: () => {
            toast.error('Failed to update recipe');
          },
        }
      );
    }
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
          Outlet not found or failed to load.
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
        ) : outlet ? (
          <>
            {/* Outlet Header Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Outlet Name */}
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      <EditableCell
                        value={outlet.name}
                        onSave={(value) => handleUpdateOutlet({ name: value })}
                        className="text-2xl font-bold"
                      />
                    </h1>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                    {/* Code */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Code
                      </label>
                      <div className="flex items-center gap-2">
                        <EditableCell
                          value={outlet.code}
                          onSave={(value) => handleUpdateOutlet({ code: value })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Outlet Type */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Outlet Type
                        {hasChildren && (
                          <span className="ml-2 text-xs text-zinc-400">(Cannot change with child outlets)</span>
                        )}
                      </label>
                      <EditableSelect
                        value={outlet.outlet_type}
                        onSave={(newType) => handleUpdateOutlet({ outlet_type: newType as 'brand' | 'location' })}
                        options={OUTLET_TYPE_OPTIONS}
                        disabled={outletTypeDisabled}
                      />
                    </div>

                    {/* Parent Outlet */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Parent Outlet
                        {outlet.outlet_type === 'brand' && (
                          <span className="ml-2 text-xs text-zinc-400">(Brands only)</span>
                        )}
                      </label>
                      {outlet.outlet_type === 'brand' ? (
                        <span className="text-sm text-zinc-400 dark:text-zinc-500">
                          Only locations can have parent outlets
                        </span>
                      ) : outlet.parent_outlet_id ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            {allOutlets.find((o) => o.id === outlet.parent_outlet_id)?.name || 'Unknown'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateOutlet({ parent_outlet_id: null })}
                            className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : parentOutletOptions.length > 0 ? (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleUpdateOutlet({ parent_outlet_id: parseInt(e.target.value, 10) });
                              e.target.value = '';
                            }
                          }}
                          className="px-2 py-1 text-sm border border-purple-400 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer"
                        >
                          <option value="">Select parent outlet...</option>
                          {parentOutletOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-zinc-400 dark:text-zinc-500">None</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Status
                      </label>
                      <Badge variant={outlet.is_active ? 'success' : 'warning'}>
                        {outlet.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    Created: {new Date(outlet.created_at).toLocaleDateString()}
                    {outlet.updated_at !== outlet.created_at && (
                      <span className="ml-4">
                        Updated: {new Date(outlet.updated_at).toLocaleDateString()}
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
                    setFormData({ recipe_id: '', price_override: '' });
                  }}
                  title="Add Recipe to Outlet"
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

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        Price Override (Optional)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Leave blank to use default"
                        value={formData.price_override}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, price_override: e.target.value }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddModal(false);
                          setSearchTerm('');
                          setFormData({ recipe_id: '', price_override: '' });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!formData.recipe_id || addRecipeToOutletMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Recipe
                      </Button>
                    </div>
                  </form>
                </Modal>

                {/* Recipes Table */}
                {outletRecipes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Recipe Name
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Price Override
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {outletRecipes.map((recipeOutlet) => {
                          const recipe = recipes.find((r) => r.id === recipeOutlet.recipe_id);
                          return (
                            <tr
                              key={recipeOutlet.recipe_id}
                              className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group"
                            >
                              <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                                <Link
                                  href={`/recipes/${recipeOutlet.recipe_id}`}
                                  className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                                >
                                  {recipe?.name || 'Unknown Recipe'}
                                </Link>
                              </td>
                              <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                                {editingRecipe === recipeOutlet.recipe_id ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editData[recipeOutlet.recipe_id]?.price_override ?? recipeOutlet.price_override ?? ''}
                                    onChange={(e) =>
                                      setEditData({
                                        ...editData,
                                        [recipeOutlet.recipe_id]: {
                                          price_override: e.target.value ? parseFloat(e.target.value) : null,
                                        },
                                      })
                                    }
                                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 text-right"
                                  />
                                ) : (
                                  recipeOutlet.price_override !== null ? formatCurrency(recipeOutlet.price_override) : '-'
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="relative group/menu">
                                  <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>

                                  <div className="absolute right-0 top-full mt-0 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-md shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 min-w-max">
                                    {editingRecipe === recipeOutlet.recipe_id ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingRecipe(null);
                                            setEditData({});
                                          }}
                                          disabled={updateRecipeOutletMutation.isPending}
                                          className="w-full justify-start text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-none first:rounded-t-md h-8 px-3"
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Cancel
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleUpdateRecipe(recipeOutlet.recipe_id)}
                                          disabled={updateRecipeOutletMutation.isPending}
                                          className="w-full justify-start text-green-600 hover:text-green-700 dark:hover:text-green-400 rounded-none last:rounded-b-md h-8 px-3"
                                        >
                                          <Check className="h-4 w-4 mr-2" />
                                          Save
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingRecipe(recipeOutlet.recipe_id);
                                            setEditData({
                                              [recipeOutlet.recipe_id]: {
                                                price_override: recipeOutlet.price_override,
                                              },
                                            });
                                          }}
                                          className="w-full justify-start text-[hsl(var(--primary))] hover:opacity-80 rounded-none first:rounded-t-md h-8 px-3"
                                        >
                                          <EditIcon className="h-4 w-4 mr-2" />
                                          Edit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteRecipe(recipeOutlet.recipe_id)}
                                          disabled={removeRecipeFromOutletMutation.isPending}
                                          className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-none last:rounded-b-md h-8 px-3"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </Button>
                                      </>
                                    )}
                                  </div>
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
                      No recipes added to this outlet yet
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
