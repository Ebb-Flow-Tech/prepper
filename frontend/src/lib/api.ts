import type {
  Recipe,
  Ingredient,
  RecipeIngredient,
  RecipeImage,
  CostingResult,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  UpdateRecipeImageRequest,
  CreateIngredientRequest,
  UpdateIngredientRequest,
  AddRecipeIngredientRequest,
  UpdateRecipeIngredientRequest,
  ParseInstructionsRequest,
  InstructionsStructured,
  TastingSession,
  TastingNote,
  TastingNoteImage,
  TastingNoteWithRecipe,
  RecipeTastingSummary,
  TastingSessionStats,
  CreateTastingSessionRequest,
  UpdateTastingSessionRequest,
  CreateTastingNoteRequest,
  UpdateTastingNoteRequest,
  RecipeTasting,
  AddRecipeToSessionRequest,
  AddRecipesToSessionRequest,
  BatchAddResult,
  IngredientTasting,
  IngredientTastingNote,
  IngredientTastingNoteWithDetails,
  IngredientTastingSummary,
  CreateIngredientTastingNoteRequest,
  UpdateIngredientTastingNoteRequest,
  AddIngredientToSessionRequest,
  AddIngredientsToSessionRequest,
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierIngredient,
  AddSupplierIngredientRequest,
  UpdateSupplierIngredientRequest,
  SubRecipe,
  SubRecipeCreate,
  SubRecipeUpdate,
  SubRecipeReorder,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  Outlet,
  CreateOutletRequest,
  UpdateOutletRequest,
  RecipeOutlet,
  CreateRecipeOutletRequest,
  UpdateRecipeOutletRequest,
  RecipeCategory,
  CreateRecipeCategoryRequest,
  UpdateRecipeCategoryRequest,
  RecipeRecipeCategory,
  CreateRecipeRecipeCategoryRequest,
  UpdateRecipeRecipeCategoryRequest,
  Allergen,
  IngredientAllergen,
  AllergenCreate,
  AllergenUpdate,
  IngredientAllergenCreate,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  Menu,
  MenuDetail,
  MenuItem,
  MenuItemRead,
  MenuSection,
  MenuSectionRead,
  CreateMenuRequest,
  UpdateMenuRequest,
  PaginatedResponse,
} from '@/types';

// ============ Pagination Param Interfaces ============

export interface ListParams {
  page_number?: number;
  page_size?: number;
  search?: string;
}

export interface RecipeListParams extends ListParams {
  status?: string;
  category_ids?: string;
}

export interface IngredientListParams extends ListParams {
  active_only?: boolean;
  category?: string;
  source?: string;
  master_only?: boolean;
  category_ids?: string;
  units?: string;
  allergen_ids?: string;
  is_halal?: string;
}

export interface SupplierListParams extends ListParams {
  active_only?: boolean;
}

export interface OutletListParams extends ListParams {
  is_active?: boolean | null;
}
import { refreshAccessToken, triggerLogout, type RefreshTokenResult } from '@/lib/auth-interceptor';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function readAuthFromStorage() {
  if (typeof window === 'undefined') {
    return { jwt: null, refreshToken: null };
  }
  try {
    const stored = localStorage.getItem('prepper_auth');
    if (stored) {
      const auth = JSON.parse(stored);
      return { jwt: auth.jwt, refreshToken: auth.refreshToken };
    }
  } catch {
    // Ignore parse errors
  }
  return { jwt: null, refreshToken: null };
}

function updateTokensInStorage(newJwt: string, newRefreshToken: string) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('prepper_auth');
    if (stored) {
      const auth = JSON.parse(stored);
      auth.jwt = newJwt;
      auth.refreshToken = newRefreshToken;
      localStorage.setItem('prepper_auth', JSON.stringify(auth));
    }
  } catch {
    // Ignore parse errors
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const { jwt, refreshToken } = readAuthFromStorage();

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryCount === 0 && refreshToken) {
      console.log('Received 401 response, attempting token refresh...');
      const result = await refreshAccessToken(refreshToken);

      if (result) {
        // Token refresh successful, update storage and retry request
        console.log('Token refresh successful, retrying request...');
        updateTokensInStorage(result.accessToken, result.refreshToken);
        return fetchApi<T>(endpoint, options, retryCount + 1);
      } else {
        // Token refresh failed, user needs to log in again
        console.log('Token refresh failed, logging out user...');
        triggerLogout();
        throw new ApiError(401, 'Session expired. Please log in again.');
      }
    }

    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;

    // Try to parse JSON error response and extract detail field
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        errorMessage = errorJson.detail;
      }
    } catch {
      // If not JSON, use raw error text
      if (errorText) {
        errorMessage = errorText;
      }
    }

    throw new ApiError(response.status, errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============ Recipes ============

export async function getRecipes(params?: RecipeListParams): Promise<PaginatedResponse<Recipe>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.category_ids) searchParams.set('category_ids', params.category_ids);
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Recipe>>(`/recipes${query ? `?${query}` : ''}`);
}

export async function getRecipe(id: number): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/${id}`);
}

export async function getRecipeForTasting(id: number): Promise<Recipe> {
  return fetchApi<Recipe>(`/recipes/tasting/${id}`);
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

export async function uploadRecipeImage(
  recipeId: number,
  imageBase64: string
): Promise<RecipeImage> {
  return fetchApi<RecipeImage>(`/recipe-images/${recipeId}`, {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
}

export async function getRecipeImages(
  recipeId: number
): Promise<RecipeImage[]> {
  return fetchApi<RecipeImage[]>(`/recipe-images/${recipeId}`);
}

export async function getMainRecipeImage(
  recipeId: number
): Promise<RecipeImage> {
  return fetchApi<RecipeImage>(`/recipe-images/main/${recipeId}`);
}

export async function setMainRecipeImage(
  imageId: number
): Promise<RecipeImage> {
  return fetchApi<RecipeImage>(`/recipe-images/main/${imageId}`, {
    method: 'PATCH',
  });
}

export async function deleteRecipeImage(imageId: number): Promise<void> {
  return fetchApi<void>(`/recipe-images/${imageId}`, {
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

export async function getIngredients(params?: IngredientListParams): Promise<PaginatedResponse<Ingredient>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.source) searchParams.set('source', params.source);
  if (params?.master_only) searchParams.set('master_only', String(params.master_only));
  if (params?.category_ids) searchParams.set('category_ids', params.category_ids);
  if (params?.units) searchParams.set('units', params.units);
  if (params?.allergen_ids) searchParams.set('allergen_ids', params.allergen_ids);
  if (params?.is_halal) searchParams.set('is_halal', params.is_halal);
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Ingredient>>(`/ingredients${query ? `?${query}` : ''}`);
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

export async function getTastingSessions(params?: ListParams): Promise<PaginatedResponse<TastingSession>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<TastingSession>>(`/tasting-sessions${query ? `?${query}` : ''}`);
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

export async function getRecipesWithFeedback(userId: string): Promise<Recipe[]> {
  return fetchApi<Recipe[]>(`/recipes/with-feedback/${userId}`);
}

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

export async function getSessionRecipesFull(
  sessionId: number
): Promise<Recipe[]> {
  return fetchApi<Recipe[]>(`/tasting-sessions/${sessionId}/recipes-full`);
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

export async function addRecipesToSession(
  sessionId: number,
  data: AddRecipesToSessionRequest
): Promise<BatchAddResult> {
  return fetchApi<BatchAddResult>(`/tasting-sessions/${sessionId}/recipes/batch`, {
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

// ============ Session Ingredients (Ingredient-Tasting) ============

export async function getSessionIngredients(
  sessionId: number
): Promise<IngredientTasting[]> {
  return fetchApi<IngredientTasting[]>(`/tasting-sessions/${sessionId}/ingredients`);
}

export async function addIngredientToSession(
  sessionId: number,
  data: AddIngredientToSessionRequest
): Promise<IngredientTasting> {
  return fetchApi<IngredientTasting>(`/tasting-sessions/${sessionId}/ingredients`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addIngredientsToSession(
  sessionId: number,
  data: AddIngredientsToSessionRequest
): Promise<BatchAddResult> {
  return fetchApi<BatchAddResult>(`/tasting-sessions/${sessionId}/ingredients/batch`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeIngredientFromSession(
  sessionId: number,
  ingredientId: number
): Promise<void> {
  return fetchApi<void>(`/tasting-sessions/${sessionId}/ingredients/${ingredientId}`, {
    method: 'DELETE',
  });
}

// ============ Ingredient Tasting Notes ============

export async function getIngredientNotes(
  sessionId: number
): Promise<IngredientTastingNote[]> {
  return fetchApi<IngredientTastingNote[]>(`/tasting-sessions/${sessionId}/ingredient-notes`);
}

export async function addIngredientNote(
  sessionId: number,
  data: CreateIngredientTastingNoteRequest
): Promise<IngredientTastingNote> {
  return fetchApi<IngredientTastingNote>(`/tasting-sessions/${sessionId}/ingredient-notes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIngredientNote(
  sessionId: number,
  noteId: number,
  data: UpdateIngredientTastingNoteRequest
): Promise<IngredientTastingNote> {
  return fetchApi<IngredientTastingNote>(`/tasting-sessions/${sessionId}/ingredient-notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteIngredientNote(
  sessionId: number,
  noteId: number
): Promise<void> {
  return fetchApi<void>(`/tasting-sessions/${sessionId}/ingredient-notes/${noteId}`, {
    method: 'DELETE',
  });
}

// ============ Ingredient Tasting History ============

export async function getIngredientTastingNotes(
  ingredientId: number
): Promise<IngredientTastingNoteWithDetails[]> {
  return fetchApi<IngredientTastingNoteWithDetails[]>(
    `/ingredients/${ingredientId}/tasting-notes`
  );
}

export async function getIngredientTastingSummary(
  ingredientId: number
): Promise<IngredientTastingSummary> {
  return fetchApi<IngredientTastingSummary>(
    `/ingredients/${ingredientId}/tasting-summary`
  );
}

// ============ Suppliers ============

export async function getSuppliers(params?: SupplierListParams): Promise<PaginatedResponse<Supplier>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Supplier>>(`/suppliers${query ? `?${query}` : ''}`);
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

export async function deactivateSupplier(id: number): Promise<Supplier> {
  return fetchApi<Supplier>(`/suppliers/${id}/deactivate`, {
    method: 'PATCH',
  });
}

// ============ Ingredient Suppliers ============

export async function getIngredientSuppliers(
  ingredientId: number
): Promise<SupplierIngredient[]> {
  return fetchApi<SupplierIngredient[]>(`/ingredients/${ingredientId}/suppliers`);
}

export async function addIngredientSupplier(
  ingredientId: number,
  data: AddSupplierIngredientRequest
): Promise<SupplierIngredient> {
  return fetchApi<SupplierIngredient>(`/ingredients/${ingredientId}/suppliers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIngredientSupplier(
  ingredientId: number,
  supplierIngredientId: number,
  data: UpdateSupplierIngredientRequest
): Promise<SupplierIngredient> {
  return fetchApi<SupplierIngredient>(`/ingredients/${ingredientId}/suppliers/${supplierIngredientId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeIngredientSupplier(
  ingredientId: number,
  supplierIngredientId: number
): Promise<void> {
  return fetchApi<void>(`/ingredients/${ingredientId}/suppliers/${supplierIngredientId}`, {
    method: 'DELETE',
  });
}

// ============ Supplier Ingredients ============

export async function getSupplierIngredients(
  supplierId: number
): Promise<SupplierIngredient[]> {
  return fetchApi<SupplierIngredient[]>(`/suppliers/${supplierId}/ingredients`);
}

export async function addSupplierIngredient(
  supplierId: number,
  data: AddSupplierIngredientRequest
): Promise<SupplierIngredient> {
  return fetchApi<SupplierIngredient>(`/ingredients/${data.ingredient_id}/suppliers`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      supplier_id: supplierId,
    }),
  });
}

export async function updateSupplierIngredient(
  supplierIngredientId: number,
  ingredientId: number,
  data: UpdateSupplierIngredientRequest
): Promise<SupplierIngredient> {
  return fetchApi<SupplierIngredient>(`/ingredients/${ingredientId}/suppliers/${supplierIngredientId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeSupplierIngredient(
  supplierIngredientId: number,
  ingredientId: number
): Promise<void> {
  return fetchApi<void>(`/ingredients/${ingredientId}/suppliers/${supplierIngredientId}`, {
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

// ============ Categories ============

export async function getCategories(activeOnly: boolean = true): Promise<Category[]> {
  const params = new URLSearchParams({ active_only: String(activeOnly) });
  return fetchApi<Category[]>(`/categories?${params}`);
}

export async function getCategory(id: number): Promise<Category> {
  return fetchApi<Category>(`/categories/${id}`);
}

export async function createCategory(data: CreateCategoryRequest): Promise<Category> {
  return fetchApi<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: number,
  data: UpdateCategoryRequest
): Promise<Category> {
  return fetchApi<Category>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deactivateCategory(id: number): Promise<Category> {
  return fetchApi<Category>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

// ============ Allergens ============

export async function getAllergens(activeOnly: boolean = true): Promise<Allergen[]> {
  const params = new URLSearchParams({ active_only: String(activeOnly) });
  return fetchApi<Allergen[]>(`/allergens?${params}`);
}

export async function getAllergen(id: number): Promise<Allergen> {
  return fetchApi<Allergen>(`/allergens/${id}`);
}

export async function createAllergen(data: AllergenCreate): Promise<Allergen> {
  return fetchApi<Allergen>('/allergens', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAllergen(
  id: number,
  data: AllergenUpdate
): Promise<Allergen> {
  return fetchApi<Allergen>(`/allergens/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAllergen(id: number): Promise<Allergen> {
  return fetchApi<Allergen>(`/allergens/${id}`, {
    method: 'DELETE',
  });
}

// ============ Ingredient-Allergen Links ============

export async function getIngredientAllergenLinks(): Promise<IngredientAllergen[]> {
  return fetchApi<IngredientAllergen[]>('/ingredient-allergens');
}

export async function getAllergensByIngredient(ingredientId: number): Promise<IngredientAllergen[]> {
  return fetchApi<IngredientAllergen[]>(`/ingredient-allergens/ingredient/${ingredientId}`);
}

export async function getIngredientsByAllergen(allergenId: number): Promise<IngredientAllergen[]> {
  return fetchApi<IngredientAllergen[]>(`/ingredient-allergens/allergen/${allergenId}`);
}

export async function addIngredientAllergen(data: IngredientAllergenCreate): Promise<IngredientAllergen> {
  return fetchApi<IngredientAllergen>('/ingredient-allergens', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteIngredientAllergen(linkId: number): Promise<void> {
  return fetchApi<void>(`/ingredient-allergens/${linkId}`, {
    method: 'DELETE',
  });
}

// ============ Recipe Allergens ============

export async function getRecipeAllergens(recipeId: number): Promise<Allergen[]> {
  return fetchApi<Allergen[]>(`/recipes/${recipeId}/allergens`);
}

export async function getRecipeAllergensBatch(
  recipeIds: number[]
): Promise<Map<number, Allergen[]>> {
  if (recipeIds.length === 0) return new Map();
  const data = await fetchApi<Record<string, Allergen[]>>('/recipes/allergens/batch', {
    method: 'POST',
    body: JSON.stringify({ recipe_ids: recipeIds }),
  });
  const map = new Map<number, Allergen[]>();
  for (const [id, allergens] of Object.entries(data)) {
    map.set(parseInt(id, 10), allergens);
  }
  return map;
}

// ============ Outlets ============

export async function getOutlets(params?: OutletListParams): Promise<PaginatedResponse<Outlet>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.is_active !== undefined && params.is_active !== null) searchParams.set('is_active', String(params.is_active));
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Outlet>>(`/outlets${query ? `?${query}` : ''}`);
}

export async function getOutlet(id: number): Promise<Outlet> {
  return fetchApi<Outlet>(`/outlets/${id}`);
}

export async function createOutlet(data: CreateOutletRequest): Promise<Outlet> {
  return fetchApi<Outlet>('/outlets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOutlet(
  id: number,
  data: UpdateOutletRequest
): Promise<Outlet> {
  return fetchApi<Outlet>(`/outlets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deactivateOutlet(id: number): Promise<Outlet> {
  return fetchApi<Outlet>(`/outlets/${id}`, {
    method: 'DELETE',
  });
}

export async function getOutletRecipes(outletId: number, isActive: boolean | null = null): Promise<RecipeOutlet[]> {
  const params = new URLSearchParams();
  if (isActive !== null) {
    params.append('is_active', String(isActive));
  }
  return fetchApi<RecipeOutlet[]>(`/outlets/${outletId}/recipes?${params}`);
}

export async function getParentOutletRecipes(outletId: number, isActive: boolean | null = null): Promise<RecipeOutlet[]> {
  const params = new URLSearchParams();
  if (isActive !== null) {
    params.append('is_active', String(isActive));
  }
  return fetchApi<RecipeOutlet[]>(`/outlets/${outletId}/parent-recipes?${params}`);
}

export async function getRecipeOutlets(recipeId: number): Promise<RecipeOutlet[]> {
  return fetchApi<RecipeOutlet[]>(`/recipes/${recipeId}/outlets`);
}

export async function addRecipeToOutlet(
  recipeId: number,
  data: { outlet_id: number; is_active?: boolean; price_override?: number | null }
): Promise<RecipeOutlet> {
  return fetchApi<RecipeOutlet>(`/recipes/${recipeId}/outlets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipeOutlet(
  recipeId: number,
  outletId: number,
  data: UpdateRecipeOutletRequest
): Promise<RecipeOutlet> {
  return fetchApi<RecipeOutlet>(`/recipes/${recipeId}/outlets/${outletId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeRecipeFromOutlet(
  recipeId: number,
  outletId: number
): Promise<void> {
  return fetchApi<void>(`/recipes/${recipeId}/outlets/${outletId}`, {
    method: 'DELETE',
  });
}

// Fetch outlets for multiple recipes in a single batch request
export async function getRecipeOutletsBatch(
  recipeIds: number[]
): Promise<Map<number, RecipeOutlet[]>> {
  if (recipeIds.length === 0) {
    return new Map();
  }

  const data = await fetchApi<Record<string, RecipeOutlet[]>>('/recipes/outlets/batch', {
    method: 'POST',
    body: JSON.stringify({ recipe_ids: recipeIds }),
  });

  // Convert the plain object to a Map
  const outletMap = new Map<number, RecipeOutlet[]>();
  for (const [recipeId, outlets] of Object.entries(data)) {
    outletMap.set(parseInt(recipeId, 10), outlets);
  }

  return outletMap;
}

// ============ Recipe Categories ============

export async function getRecipeCategories(params?: ListParams): Promise<PaginatedResponse<RecipeCategory>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<RecipeCategory>>(`/recipe-categories${query ? `?${query}` : ''}`);
}

export async function getRecipeCategory(id: number): Promise<RecipeCategory> {
  return fetchApi<RecipeCategory>(`/recipe-categories/${id}`);
}

export async function createRecipeCategory(
  data: CreateRecipeCategoryRequest
): Promise<RecipeCategory> {
  return fetchApi<RecipeCategory>('/recipe-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipeCategory(
  id: number,
  data: UpdateRecipeCategoryRequest
): Promise<RecipeCategory> {
  return fetchApi<RecipeCategory>(`/recipe-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRecipeCategory(id: number): Promise<void> {
  return fetchApi<void>(`/recipe-categories/${id}`, {
    method: 'DELETE',
  });
}

// ============ Recipe-Recipe Categories (Many-to-Many) ============

export async function getCategoryRecipes(categoryId: number): Promise<RecipeRecipeCategory[]> {
  return fetchApi<RecipeRecipeCategory[]>(`/recipe-recipe-categories/category/${categoryId}`);
}

export async function getRecipeCategoryLinks(recipeId: number): Promise<RecipeRecipeCategory[]> {
  return fetchApi<RecipeRecipeCategory[]>(`/recipe-recipe-categories/recipe/${recipeId}`);
}

export async function addRecipeToCategory(
  data: CreateRecipeRecipeCategoryRequest
): Promise<RecipeRecipeCategory> {
  return fetchApi<RecipeRecipeCategory>('/recipe-recipe-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipeCategoryLink(
  linkId: number,
  data: UpdateRecipeRecipeCategoryRequest
): Promise<RecipeRecipeCategory> {
  return fetchApi<RecipeRecipeCategory>(`/recipe-recipe-categories/${linkId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeRecipeFromCategory(linkId: number): Promise<void> {
  return fetchApi<void>(`/recipe-recipe-categories/${linkId}`, {
    method: 'DELETE',
  });
}

export async function getAllRecipeRecipeCategories(): Promise<RecipeRecipeCategory[]> {
  return fetchApi<RecipeRecipeCategory[]>('/recipe-recipe-categories');
}

// ============ Agents ============

interface CategorizeIngredientRequest {
  ingredient_name: string;
}

interface CategorizeIngredientResponse {
  category_id: number;
}

export async function categorizeIngredient(
  data: CategorizeIngredientRequest
): Promise<CategorizeIngredientResponse> {
  return fetchApi<CategorizeIngredientResponse>('/agents/categorize-ingredient', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface FeedbackSummaryResponse {
  summary: string | null;
  success: boolean;
}

export async function summarizeFeedback(
  recipeId: number
): Promise<FeedbackSummaryResponse> {
  return fetchApi<FeedbackSummaryResponse>(`/agents/summarize-feedback/${recipeId}`, {
    method: 'POST',
  });
}

// Tasting Note Images

export async function uploadTastingNoteImage(
  tastingNoteId: number,
  imageBase64: string
): Promise<TastingNoteImage> {
  return fetchApi<TastingNoteImage>(`/tasting-note-images/${tastingNoteId}`, {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
}

export async function uploadMultipleTastingNoteImages(
  tastingNoteId: number,
  imageBase64Array: string[]
): Promise<TastingNoteImage[]> {
  return fetchApi<TastingNoteImage[]>(`/tasting-note-images/batch/${tastingNoteId}`, {
    method: 'POST',
    body: JSON.stringify({ images: imageBase64Array }),
  });
}

export async function getTastingNoteImages(
  tastingNoteId: number
): Promise<TastingNoteImage[]> {
  return fetchApi<TastingNoteImage[]>(`/tasting-note-images/${tastingNoteId}`);
}

export async function deleteTastingNoteImage(
  imageId: number
): Promise<void> {
  return fetchApi<void>(`/tasting-note-images/${imageId}`, {
    method: 'DELETE',
  });
}

export interface ImageWithIdRequest {
  id: number | null;
  data: string;
  image_url?: string;
  removed?: boolean;
}

export async function syncTastingNoteImages(
  tastingNoteId: number,
  images: ImageWithIdRequest[]
): Promise<TastingNoteImage[]> {
  return fetchApi<TastingNoteImage[]>(`/tasting-note-images/sync/recipe/${tastingNoteId}`, {
    method: 'POST',
    body: JSON.stringify({ images }),
  });
}

export async function getIngredientTastingNoteImages(
  ingredientTastingNoteId: number
): Promise<TastingNoteImage[]> {
  return fetchApi<TastingNoteImage[]>(`/tasting-note-images/ingredient/${ingredientTastingNoteId}`);
}

export async function syncIngredientTastingNoteImages(
  ingredientTastingNoteId: number,
  images: ImageWithIdRequest[]
): Promise<TastingNoteImage[]> {
  return fetchApi<TastingNoteImage[]>(`/tasting-note-images/sync/ingredient/${ingredientTastingNoteId}`, {
    method: 'POST',
    body: JSON.stringify({ images }),
  });
}

// ============ Auth ============

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  return fetchApi<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(data: RegisterRequest): Promise<LoginResponse> {
  return fetchApi<LoginResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logoutUser(): Promise<void> {
  const res = fetchApi<void>('/auth/logout', {
    method: 'POST',
  });
  console.log('Logout response:', JSON.stringify(res));
  return res;
}

// ============ Users ============

export async function getUser(userId: string): Promise<User> {
  return fetchApi<User>(`/users/${userId}`);
}

export async function getUsers(): Promise<User[]> {
  return fetchApi<User[]>('/users');
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await fetchApi<User[]>(`/users?email=${encodeURIComponent(email)}`);
  return users.length > 0 ? users[0] : null;
}

export async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  return fetchApi<User>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ============ Menus ============

export async function getMenus(includeArchived?: boolean): Promise<Menu[]> {
  const params = includeArchived ? '?include_archived=true' : '';
  return fetchApi<Menu[]>(`/menus${params}`);
}

export async function getMenu(menuId: number): Promise<MenuDetail> {
  return fetchApi<MenuDetail>(`/menus/${menuId}`);
}

export async function createMenu(data: CreateMenuRequest): Promise<MenuDetail> {
  return fetchApi<MenuDetail>('/menus', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMenu(menuId: number, data: UpdateMenuRequest): Promise<MenuDetail> {
  return fetchApi<MenuDetail>(`/menus/${menuId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function forkMenu(menuId: number): Promise<MenuDetail> {
  return fetchApi<MenuDetail>(`/menus/${menuId}/fork`, {
    method: 'POST',
  });
}

export async function deleteMenu(menuId: number): Promise<Menu> {
  return fetchApi<Menu>(`/menus/${menuId}/delete`, {
    method: 'PATCH',
  });
}

export async function restoreMenu(menuId: number): Promise<Menu> {
  return fetchApi<Menu>(`/menus/${menuId}/restore`, {
    method: 'PATCH',
  });
}

export async function getMenusByOutlet(outletId: number): Promise<Menu[]> {
  return fetchApi<Menu[]>(`/menu-outlets/${outletId}`);
}

export async function getMenuItemsBySection(sectionId: number): Promise<MenuItemRead[]> {
  return fetchApi<MenuItemRead[]>(`/menu-items/${sectionId}`);
}
