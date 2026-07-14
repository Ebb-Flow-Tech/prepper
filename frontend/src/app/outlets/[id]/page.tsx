'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, MoreVertical, Check, X, Edit as EditIcon, Trash2 } from 'lucide-react';
import {
  useOutlet,
  useUpdateOutlet,
  useOutlets,
  useOutletRecipes,
  useParentOutletRecipes,
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
        className={`px-1 py-0.5 text-sm border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring bg-card ${className}`}
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
      className={`px-1 py-0.5 rounded font-medium text-foreground ${disabled
          ? 'cursor-not-allowed text-muted-foreground'
          : 'cursor-pointer hover:bg-secondary'
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
  const { data: allOutletsData } = useOutlets({ page_size: 30 });
  const allOutlets = allOutletsData?.items ?? [];
  const { data: outletRecipes = [] } = useOutletRecipes(outletId);
  const { data: parentOutletRecipes = [] } = useParentOutletRecipes(outletId);
  const { data: recipesData } = useRecipes({ page_size: 30 });
  const recipes = recipesData?.items ?? [];

  const updateOutletMutation = useUpdateOutlet();
  const addRecipeToOutletMutation = useAddRecipeToOutlet();
  const updateRecipeOutletMutation = useUpdateRecipeOutlet();
  const removeRecipeFromOutletMutation = useRemoveRecipeFromOutlet();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecipe, setEditingRecipe] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<number, { price_override: string }>>({});
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
      const v = parseFloat(dataToSave.price_override);
      updateRecipeOutletMutation.mutate(
        {
          recipeId,
          outletId,
          data: {
            price_override: isNaN(v) ? null : v,
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
    let statusCode: number | undefined;
    if (typeof error === 'object' && error !== null) {
      if ('response' in error && typeof error.response === 'object' && error.response !== null && 'status' in error.response) {
        statusCode = (error.response as { status: number }).status;
      } else if ('status' in error) {
        statusCode = (error as { status: number }).status;
      }
    }
    const is403 = statusCode === 403;

    return (
      <div className="p-6">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
          {is403
            ? "You do not have permission to access this outlet."
            : "Outlet not found or failed to load."}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : outlet ? (
          <>
            {/* Outlet Header Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Outlet Name */}
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      <EditableCell
                        value={outlet.name}
                        onSave={(value) => handleUpdateOutlet({ name: value })}
                        className="text-2xl font-bold"
                      />
                    </h1>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-6">
                    {/* Code */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">
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
                      <label className="block text-xs font-medium text-muted-foreground">
                        Outlet type
                        {hasChildren && (
                          <span className="ml-2 text-xs text-muted-foreground">(Cannot change with child outlets)</span>
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
                      <label className="block text-xs font-medium text-muted-foreground">
                        Parent outlet
                        {outlet.outlet_type === 'brand' && (
                          <span className="ml-2 text-xs text-muted-foreground">(Brands only)</span>
                        )}
                      </label>
                      {outlet.outlet_type === 'brand' ? (
                        <span className="text-sm text-muted-foreground">
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
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
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
                          className="px-2 py-1 text-sm border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring bg-card text-foreground cursor-pointer"
                        >
                          <option value="">Select parent outlet...</option>
                          {parentOutletOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">
                        Status
                      </label>
                      <Badge variant={outlet.is_active ? 'success' : 'secondary'}>
                        {outlet.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-sm text-muted-foreground border-t border-border pt-4">
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
                  <h2 className="text-lg font-semibold text-foreground">
                    Outlet recipe
                  </h2>
                </div>

                {/* Add Recipe Button */}
                <div className="mb-4">
                  <Button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add recipe
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
                  title="Add recipe to outlet"
                  maxWidth="max-w-lg"
                >
                  <form onSubmit={handleAddRecipe} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Search recipe
                      </label>
                      <Input
                        type="text"
                        placeholder="Search recipes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mb-2"
                      />
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Price override (optional)
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Leave blank to use default"
                        value={formData.price_override}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, price_override: e.target.value }))
                        }
                        onBlur={() => {
                          const n = parseFloat(formData.price_override);
                          if (!isNaN(n)) setFormData((prev) => ({ ...prev, price_override: String(n) }));
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
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
                        Add recipe
                      </Button>
                    </div>
                  </form>
                </Modal>

                {/* Recipes Table */}
                {outletRecipes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                            Recipe name
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                            Price override
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
                              className="border-b border-border hover:bg-secondary group"
                            >
                              <td className="py-3 px-2 text-foreground font-medium">
                                <Link
                                  href={`/recipes/${recipeOutlet.recipe_id}`}
                                  className="hover:text-primary hover:underline"
                                >
                                  {recipe?.name || 'Unknown recipe'}
                                </Link>
                              </td>
                              <td className="py-3 px-2 text-right text-foreground tabular-nums">
                                {editingRecipe === recipeOutlet.recipe_id ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editData[recipeOutlet.recipe_id]?.price_override ?? recipeOutlet.price_override?.toString() ?? ''}
                                    onChange={(e) =>
                                      setEditData({
                                        ...editData,
                                        [recipeOutlet.recipe_id]: {
                                          price_override: e.target.value,
                                        },
                                      })
                                    }
                                    onBlur={() => {
                                      const raw = editData[recipeOutlet.recipe_id]?.price_override ?? '';
                                      const n = parseFloat(raw);
                                      if (!isNaN(n)) setEditData({ ...editData, [recipeOutlet.recipe_id]: { price_override: String(n) } });
                                    }}
                                    className="w-full px-2 py-1 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right tabular-nums"
                                  />
                                ) : (
                                  recipeOutlet.price_override !== null ? formatCurrency(recipeOutlet.price_override) : '-'
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="relative group/menu">
                                  <button className="text-muted-foreground hover:text-foreground p-1">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>

                                  <div className="absolute right-0 top-full mt-0 bg-popover border border-border rounded-xl shadow-elevation-2 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 min-w-max">
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
                                          className="w-full justify-start text-[var(--color-feedback-error)] rounded-none first:rounded-t-lg h-8 px-3"
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Cancel
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleUpdateRecipe(recipeOutlet.recipe_id)}
                                          disabled={updateRecipeOutletMutation.isPending}
                                          className="w-full justify-start text-[var(--color-feedback-success)] rounded-none last:rounded-b-lg h-8 px-3"
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
                                                price_override: recipeOutlet.price_override?.toString() ?? '',
                                              },
                                            });
                                          }}
                                          className="w-full justify-start text-primary hover:opacity-80 rounded-none first:rounded-t-lg h-8 px-3"
                                        >
                                          <EditIcon className="h-4 w-4 mr-2" />
                                          Edit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteRecipe(recipeOutlet.recipe_id)}
                                          disabled={removeRecipeFromOutletMutation.isPending}
                                          className="w-full justify-start text-[var(--color-feedback-error)] hover:bg-[var(--color-feedback-error-tint)] rounded-none last:rounded-b-lg h-8 px-3"
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
                  <div className="text-center py-6 border border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground">
                      No recipes added to this outlet yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parent Outlet Recipes Card (Read-Only) */}
            {outlet?.parent_outlet_id && parentOutletRecipes.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                      Recipes from parent outlet
                    </h2>
                    <span className="text-xs text-muted-foreground italic">
                      (Inherited, read-only)
                    </span>
                  </div>

                  {/* Parent Recipes Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                            Recipe name
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                            Price override
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parentOutletRecipes.map((recipeOutlet) => {
                          const recipe = recipes.find((r) => r.id === recipeOutlet.recipe_id);
                          return (
                            <tr
                              key={recipeOutlet.recipe_id}
                              className="border-b border-border bg-secondary"
                            >
                              <td className="py-3 px-2 text-muted-foreground font-medium">
                                <Link
                                  href={`/recipes/${recipeOutlet.recipe_id}`}
                                  className="hover:text-primary hover:underline"
                                >
                                  {recipe?.name || 'Unknown recipe'}
                                </Link>
                              </td>
                              <td className="py-3 px-2 text-right text-muted-foreground tabular-nums">
                                {recipeOutlet.price_override !== null ? formatCurrency(recipeOutlet.price_override) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
