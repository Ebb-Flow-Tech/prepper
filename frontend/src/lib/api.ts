import type {
  Recipe,
  Ingredient,
  RecipeIngredient,
  CostingResult,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  CreateIngredientRequest,
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
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  IngredientSupplierEntry,
  AddIngredientSupplierRequest,
  UpdateIngredientSupplierRequest,
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
  data: Partial<CreateIngredientRequest>
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
