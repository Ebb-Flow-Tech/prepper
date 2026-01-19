import type {
  Recipe,
  Ingredient,
  RecipeIngredient,
  CostingResult,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  UpdateRecipeImageRequest,
  CreateIngredientRequest,
  UpdateIngredientRequest,
  AddRecipeIngredientRequest,
  UpdateRecipeIngredientRequest,
  ReorderIngredientsRequest,
  ParseInstructionsRequest,
  InstructionsStructured,
  TastingSession,
  TastingNote,
  TastingNoteWithRecipe,
  RecipeTastingSummary,
  TastingSessionStats,
  CreateTastingSessionRequest,
  UpdateTastingSessionRequest,
  CreateTastingNoteRequest,
  UpdateTastingNoteRequest,
  RecipeTasting,
  AddRecipeToSessionRequest,
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  IngredientSupplierEntry,
  AddIngredientSupplierRequest,
  UpdateIngredientSupplierRequest,
  SupplierIngredientEntry,
  AddSupplierIngredientRequest,
  UpdateSupplierIngredientRequest,
  SubRecipe,
  SubRecipeCreate,
  SubRecipeUpdate,
  SubRecipeReorder,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============ Recipes ============

export async function getRecipes(): Promise<Recipe[]> {
  return fetchApi<Recipe[]>('/recipes');
}

export async function getRecipe(id: number): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${id}`);
}

export async function createRecipe(data: CreateRecipeRequest): Promise<Recipe> {
  return fetchApi<Recipe>('/recipes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipe(
  id: number,
  data: UpdateRecipeRequest
): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateRecipeStatus(
  id: number,
  status: string
): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  return fetchApi<void>(`/recipes/${id}`, {
    method: 'DELETE',
  });
}

export async function forkRecipe(
  id: number,
  newOwnerId?: string
): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${id}/fork`, {
    method: 'POST',
    body: JSON.stringify({ new_owner_id: newOwnerId }),
  });
}

export async function getRecipeVersions(recipeId: number, userId?: string | null): Promise<Recipe[]> {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return fetchApi<Recipe[]>(`/recipes/${recipeId}/versions${params}`);
}

export async function updateRecipeImage(
  id: number,
  data: UpdateRecipeImageRequest
): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${id}/image`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ============ Recipe Ingredients ============

export async function getRecipeIngredients(
  recipeId: number
): Promise<RecipeIngredient[]> {
  return fetchApi<RecipeIngredient[]>(`/recipes/${recipeId}/ingredients`);
}

export async function addRecipeIngredient(
  recipeId: number,
  data: AddRecipeIngredientRequest
): Promise<RecipeIngredient> {
  return fetchApi<RecipeIngredient>(`/recipes/${recipeId}/ingredients`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipeIngredient(
  recipeId: number,
  ingredientId: number,
  data: UpdateRecipeIngredientRequest
): Promise<RecipeIngredient> {
  return fetchApi<RecipeIngredient>(
    `/recipes/${recipeId}/ingredients/${ingredientId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}

export async function removeRecipeIngredient(
  recipeId: number,
  ingredientId: number
): Promise<void> {
  return fetchApi<void>(`/recipes/${recipeId}/ingredients/${ingredientId}`, {
    method: 'DELETE',
  });
}

export async function reorderRecipeIngredients(
  recipeId: number,
  data: ReorderIngredientsRequest
): Promise<void> {
  return fetchApi<void>(`/recipes/${recipeId}/ingredients/reorder`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ Instructions ============

export async function updateRawInstructions(
  recipeId: number,
  instructionsRaw: string
): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${recipeId}/instructions/raw`, {
    method: 'POST',
    body: JSON.stringify({ instructions_raw: instructionsRaw }),
  });
}

export async function parseInstructions(
  recipeId: number,
  data: ParseInstructionsRequest
): Promise<InstructionsStructured> {
  return fetchApi<InstructionsStructured>(
    `/recipes/${recipeId}/instructions/parse`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export async function updateStructuredInstructions(
  recipeId: number,
  structured: InstructionsStructured
): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${recipeId}/instructions/structured`, {
    method: 'PATCH',
    body: JSON.stringify(structured),
  });
}

// ============ Ingredients ============

export async function getIngredients(activeOnly: boolean = true): Promise<Ingredient[]> {
  return fetchApi<Ingredient[]>(`/ingredients?active_only=${activeOnly}`);
}

export async function getIngredient(id: number): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${id}`);
}

export async function createIngredient(
  data: CreateIngredientRequest
): Promise<Ingredient> {
  return fetchApi<Ingredient>('/ingredients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIngredient(
  id: number,
  data: Partial<UpdateIngredientRequest>
): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deactivateIngredient(id: number): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${id}/deactivate`, {
    method: 'PATCH',
  });
}

// ============ Costing ============

export async function getRecipeCosting(recipeId: number): Promise<CostingResult> {
  return fetchApi<CostingResult>(`/recipes/${recipeId}/costing`);
}

export async function recomputeRecipeCosting(
  recipeId: number
): Promise<CostingResult> {
  return fetchApi<CostingResult>(`/recipes/${recipeId}/costing/recompute`, {
    method: 'POST',
  });
}

// ============ Tasting Sessions ============

export async function getTastingSessions(): Promise<TastingSession[]> {
  return fetchApi<TastingSession[]>('/tasting-sessions');
}

export async function getTastingSession(id: number): Promise<TastingSession> {
  return fetchApi<TastingSession>(`/tasting-sessions/${id}`);
}

export async function getTastingSessionStats(id: number): Promise<TastingSessionStats> {
  return fetchApi<TastingSessionStats>(`/tasting-sessions/${id}/stats`);
}

export async function createTastingSession(
  data: CreateTastingSessionRequest
): Promise<TastingSession> {
  return fetchApi<TastingSession>('/tasting-sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTastingSession(
  id: number,
  data: UpdateTastingSessionRequest
): Promise<TastingSession> {
  return fetchApi<TastingSession>(`/tasting-sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTastingSession(id: number): Promise<void> {
  return fetchApi<void>(`/tasting-sessions/${id}`, {
    method: 'DELETE',
  });
}

// ============ Tasting Notes ============

export async function getSessionNotes(sessionId: number): Promise<TastingNote[]> {
  return fetchApi<TastingNote[]>(`/tasting-sessions/${sessionId}/notes`);
}

export async function addNoteToSession(
  sessionId: number,
  data: CreateTastingNoteRequest
): Promise<TastingNote> {
  return fetchApi<TastingNote>(`/tasting-sessions/${sessionId}/notes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTastingNote(
  sessionId: number,
  noteId: number,
  data: UpdateTastingNoteRequest
): Promise<TastingNote> {
  return fetchApi<TastingNote>(`/tasting-sessions/${sessionId}/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTastingNote(
  sessionId: number,
  noteId: number
): Promise<void> {
  return fetchApi<void>(`/tasting-sessions/${sessionId}/notes/${noteId}`, {
    method: 'DELETE',
  });
}

// ============ Recipe Tasting History ============

export async function getRecipeTastingNotes(
  recipeId: number
): Promise<TastingNoteWithRecipe[]> {
  return fetchApi<TastingNoteWithRecipe[]>(`/recipes/${recipeId}/tasting-notes`);
}

export async function getRecipeTastingSummary(
  recipeId: number
): Promise<RecipeTastingSummary> {
  return fetchApi<RecipeTastingSummary>(`/recipes/${recipeId}/tasting-summary`);
}

// ============ Session Recipes (Recipe-Tasting) ============

export async function getSessionRecipes(
  sessionId: number
): Promise<RecipeTasting[]> {
  return fetchApi<RecipeTasting[]>(`/tasting-sessions/${sessionId}/recipes`);
}

export async function addRecipeToSession(
  sessionId: number,
  data: AddRecipeToSessionRequest
): Promise<RecipeTasting> {
  return fetchApi<RecipeTasting>(`/tasting-sessions/${sessionId}/recipes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeRecipeFromSession(
  sessionId: number,
  recipeId: number
): Promise<void> {
  return fetchApi<void>(`/tasting-sessions/${sessionId}/recipes/${recipeId}`, {
    method: 'DELETE',
  });
}

// ============ Suppliers ============

export async function getSuppliers(): Promise<Supplier[]> {
  return fetchApi<Supplier[]>('/suppliers');
}

export async function getSupplier(id: number): Promise<Supplier> {
  return fetchApi<Supplier>(`/suppliers/${id}`);
}

export async function createSupplier(
  data: CreateSupplierRequest
): Promise<Supplier> {
  return fetchApi<Supplier>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSupplier(
  id: number,
  data: UpdateSupplierRequest
): Promise<Supplier> {
  return fetchApi<Supplier>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSupplier(id: number): Promise<void> {
  return fetchApi<void>(`/suppliers/${id}`, {
    method: 'DELETE',
  });
}

// ============ Ingredient Suppliers ============

export async function getIngredientSuppliers(
  ingredientId: number
): Promise<IngredientSupplierEntry[]> {
  return fetchApi<IngredientSupplierEntry[]>(`/ingredients/${ingredientId}/suppliers`);
}

export async function addIngredientSupplier(
  ingredientId: number,
  data: AddIngredientSupplierRequest
): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${ingredientId}/suppliers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIngredientSupplier(
  ingredientId: number,
  supplierId: string,
  data: UpdateIngredientSupplierRequest
): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${ingredientId}/suppliers/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeIngredientSupplier(
  ingredientId: number,
  supplierId: string
): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${ingredientId}/suppliers/${supplierId}`, {
    method: 'DELETE',
  });
}

// ============ Supplier Ingredients ============

export async function getSupplierIngredients(
  supplierId: number
): Promise<SupplierIngredientEntry[]> {
  return fetchApi<SupplierIngredientEntry[]>(`/suppliers/${supplierId}/ingredients`);
}

export async function addSupplierIngredient(
  supplierId: number,
  data: AddSupplierIngredientRequest
): Promise<Ingredient> {
  // This adds the supplier to an ingredient, so we use the ingredient's endpoint
  return fetchApi<Ingredient>(`/ingredients/${data.ingredient_id}/suppliers`, {
    method: 'POST',
    body: JSON.stringify({
      supplier_id: supplierId.toString(),
      supplier_name: '', // Will be set by the caller
      sku: data.sku,
      pack_size: data.pack_size,
      pack_unit: data.pack_unit,
      price_per_pack: data.price_per_pack,
      cost_per_unit: data.cost_per_unit,
      currency: data.currency || 'SGD',
      is_preferred: data.is_preferred || false,
      source: data.source || 'manual',
    }),
  });
}

export async function updateSupplierIngredient(
  supplierId: number,
  ingredientId: number,
  data: UpdateSupplierIngredientRequest
): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${ingredientId}/suppliers/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeSupplierIngredient(
  supplierId: number,
  ingredientId: number
): Promise<Ingredient> {
  return fetchApi<Ingredient>(`/ingredients/${ingredientId}/suppliers/${supplierId}`, {
    method: 'DELETE',
  });
}

// ============ Sub-Recipes ============

export async function getSubRecipes(recipeId: number): Promise<SubRecipe[]> {
  return fetchApi<SubRecipe[]>(`/recipes/${recipeId}/sub-recipes`);
}

export async function addSubRecipe(
  recipeId: number,
  data: SubRecipeCreate
): Promise<SubRecipe> {
  return fetchApi<SubRecipe>(`/recipes/${recipeId}/sub-recipes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSubRecipe(
  recipeId: number,
  linkId: number,
  data: SubRecipeUpdate
): Promise<SubRecipe> {
  return fetchApi<SubRecipe>(`/recipes/${recipeId}/sub-recipes/${linkId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function removeSubRecipe(
  recipeId: number,
  linkId: number
): Promise<void> {
  return fetchApi<void>(`/recipes/${recipeId}/sub-recipes/${linkId}`, {
    method: 'DELETE',
  });
}

export async function reorderSubRecipes(
  recipeId: number,
  data: SubRecipeReorder
): Promise<SubRecipe[]> {
  return fetchApi<SubRecipe[]>(`/recipes/${recipeId}/sub-recipes/reorder`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ Categories (Fake/Mock API) ============

// Hardcoded categories data (stored in memory for CRUD operations)
const categoriesData: Category[] = [
  { id: 1, name: 'Proteins', slug: 'proteins', description: 'Meat, poultry, seafood, eggs, and plant-based proteins', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Vegetables', slug: 'vegetables', description: 'Fresh, frozen, and canned vegetables', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'Fruits', slug: 'fruits', description: 'Fresh, frozen, dried, and canned fruits', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'Dairy', slug: 'dairy', description: 'Milk, cheese, yogurt, butter, and cream', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 5, name: 'Grains', slug: 'grains', description: 'Rice, pasta, bread, flour, and cereals', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 6, name: 'Spices', slug: 'spices', description: 'Herbs, spices, and seasonings', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 7, name: 'Oils & Fats', slug: 'oils_fats', description: 'Cooking oils, butter, lard, and shortening', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 8, name: 'Sauces & Condiments', slug: 'sauces_condiments', description: 'Sauces, dressings, marinades, and condiments', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 9, name: 'Beverages', slug: 'beverages', description: 'Drinks, juices, and liquid ingredients', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 10, name: 'Other', slug: 'other', description: 'Miscellaneous ingredients', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

let nextCategoryId = 11;

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export async function getCategories(activeOnly: boolean = true): Promise<Category[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (activeOnly) {
    return categoriesData.filter((c) => c.is_active);
  }
  return [...categoriesData];
}

export async function getCategory(id: number): Promise<Category> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  const category = categoriesData.find((c) => c.id === id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  return { ...category };
}

export async function createCategory(data: CreateCategoryRequest): Promise<Category> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const now = new Date().toISOString();
  const newCategory: Category = {
    id: nextCategoryId++,
    name: data.name,
    slug: data.slug || generateSlug(data.name),
    description: data.description || null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  categoriesData.push(newCategory);
  return { ...newCategory };
}

export async function updateCategory(
  id: number,
  data: UpdateCategoryRequest
): Promise<Category> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const index = categoriesData.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new ApiError(404, 'Category not found');
  }

  const updated: Category = {
    ...categoriesData[index],
    ...data,
    updated_at: new Date().toISOString(),
  };

  categoriesData[index] = updated;
  return { ...updated };
}

export async function deactivateCategory(id: number): Promise<Category> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const index = categoriesData.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new ApiError(404, 'Category not found');
  }

  categoriesData[index] = {
    ...categoriesData[index],
    is_active: false,
    updated_at: new Date().toISOString(),
  };

  return { ...categoriesData[index] };
}
