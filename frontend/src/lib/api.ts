import type { FMHImportResult } from '@/types';
import type {
  AssignBrandRoleRequest,
  BrandRole,
  PassportBrand,
  PassportOrganization,
  PassportBrandRole,
  PassportMember,
} from '@/types';
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
  ReorderSessionDishesRequest,
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
  RecipeUnit,
  CreateRecipeUnitRequest,
  UpdateRecipeUnitRequest,
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
  UpdateUserRequest,
  Menu,
  MenuDetail,
  MenuItem,
  MenuItemRead,
  MenuSection,
  MenuSectionRead,
  CreateMenuRequest,
  UpdateMenuRequest,
  MenuSketch,
  CreateMenuSketchRequest,
  UpdateMenuSketchRequest,
  MenuSketchSection,
  CreateMenuSketchSectionRequest,
  UpdateMenuSketchSectionRequest,
  MenuSketchSectionItem,
  CreateMenuSketchSectionItemRequest,
  UpdateMenuSketchSectionItemRequest,
  MenuSketchSectionItemComment,
  CreateMenuSketchSectionItemCommentRequest,
  UpdateMenuSketchSectionItemCommentRequest,
  MenuSketchCommentsResponse,
  PaginatedResponse,
  SupplierIngredientItem,
  SupplierIngredientTag,
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
  sort_by?: string;
}

export interface SupplierListParams extends ListParams {
  active_only?: boolean;
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
    return { jwt: null, refreshToken: null, activeOrgId: null };
  }
  try {
    const stored = localStorage.getItem('prepper_auth');
    if (stored) {
      const auth = JSON.parse(stored);
      return { jwt: auth.jwt, refreshToken: auth.refreshToken, activeOrgId: auth.activeOrgId ?? null };
    }
  } catch {
    // Ignore parse errors
  }
  return { jwt: null, refreshToken: null, activeOrgId: null };
}

/**
 * The acting org, sent on every request beside the JWT.
 *
 * A proposal, not an authority: the backend re-derives membership from the Passport projection
 * and 403s an org the caller does not belong to. Omitted when unset — a single-org user never
 * needs to send it, and the server resolves their one org itself.
 */
function orgHeader(activeOrgId: string | null): Record<string, string> {
  return activeOrgId ? { 'X-Organization-Id': activeOrgId } : {};
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
  const { jwt, refreshToken, activeOrgId } = readAuthFromStorage();

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}),
      ...orgHeader(activeOrgId),
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

/**
 * Like fetchApi but without a Content-Type header, so FormData can set its own
 * multipart/form-data boundary automatically.
 */
async function fetchApiFormData<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const { jwt, activeOrgId } = readAuthFromStorage();

  const config: RequestInit = {
    ...options,
    headers: {
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...orgHeader(activeOrgId),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) errorMessage = errorJson.detail;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

async function fetchApiBlob(endpoint: string): Promise<Blob> {
  const url = `${API_BASE}${endpoint}`;
  const { jwt, activeOrgId } = readAuthFromStorage();
  const response = await fetch(url, {
    headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...orgHeader(activeOrgId) },
  });
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) errorMessage = errorJson.detail;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    throw new ApiError(response.status, errorMessage);
  }
  return response.blob();
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
  if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
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

export async function reorderSessionDishes(
  sessionId: number,
  data: ReorderSessionDishesRequest
): Promise<void> {
  return fetchApi<void>(`/tasting-sessions/${sessionId}/recipes/reorder`, {
    method: 'PATCH',
    body: JSON.stringify(data),
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

export async function getSubRecipesBatch(recipeIds: number[]): Promise<Record<number, boolean>> {
  if (recipeIds.length === 0) return {};
  return fetchApi<Record<number, boolean>>('/recipes/sub-recipes/batch', {
    method: 'POST',
    body: JSON.stringify({ recipe_ids: recipeIds }),
  });
}

// ============ Categories ============

export async function getCategories(activeOnly: boolean = true): Promise<Category[]> {
  // Fetch with a large page_size so all categories are returned (backward compat)
  const params = new URLSearchParams({ active_only: String(activeOnly), page_size: '500' });
  const response = await fetchApi<PaginatedResponse<Category>>(`/categories?${params}`);
  return response.items;
}

export interface CategoryListParams extends ListParams {
  active_only?: boolean;
}

export async function getCategoriesPaginated(params?: CategoryListParams): Promise<PaginatedResponse<Category>> {
  const searchParams = new URLSearchParams();
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<Category>>(`/categories${query ? `?${query}` : ''}`);
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

// ============ Recipe Units (Passport brands / outlets) ============
//
// Units are created and edited in Passport, never here. These endpoints only say which units a
// recipe is served at. Use `getPassportBrands()` to obtain the units the caller may pick from.

export async function getRecipeUnits(recipeId: number): Promise<RecipeUnit[]> {
  return fetchApi<RecipeUnit[]>(`/recipes/${recipeId}/units`);
}

export async function addRecipeToUnit(
  recipeId: number,
  data: CreateRecipeUnitRequest
): Promise<RecipeUnit> {
  return fetchApi<RecipeUnit>(`/recipes/${recipeId}/units`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipeUnit(
  recipeId: number,
  unitId: string,
  data: UpdateRecipeUnitRequest
): Promise<RecipeUnit> {
  return fetchApi<RecipeUnit>(`/recipes/${recipeId}/units/${unitId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeRecipeFromUnit(
  recipeId: number,
  unitId: string
): Promise<void> {
  return fetchApi<void>(`/recipes/${recipeId}/units/${unitId}`, {
    method: 'DELETE',
  });
}

// ============ Recipe Categories ============

export interface RecipeCategoryListParams extends ListParams {
  active_only?: boolean;
}

export async function getRecipeCategories(params?: RecipeCategoryListParams): Promise<PaginatedResponse<RecipeCategory>> {
  const searchParams = new URLSearchParams();
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
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

export async function deleteRecipeCategory(id: number): Promise<RecipeCategory> {
  return fetchApi<RecipeCategory>(`/recipe-categories/${id}`, {
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

/**
 * Bridge a Supabase OAuth session into the app's auth state.
 * Auto-provisions a local users row on first Google sign-in.
 */
export async function completeOAuth(accessToken: string): Promise<User> {
  const url = `${API_BASE}/auth/oauth-complete`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    let detail = `OAuth completion failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Ignore parse errors
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<User>;
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

/** The largest page the backend allows. See the truncation note on `getUsers`. */
const USERS_PAGE_SIZE = 100;

/**
 * People who share an organisation with the caller.
 *
 * `GET /users` is now org-scoped and paginated — it used to return every user in the instance,
 * unpaginated, to any authenticated caller.
 *
 * KNOWN LIMITATION: this unwraps the first page and drops the rest, so an org with more than
 * `USERS_PAGE_SIZE` members shows only the first 100. Callers render a flat list and none paginate
 * yet. Surfacing it here rather than hiding it: a silent cap reads as "these are all the users",
 * and none of them are wrong today only because no org is that large.
 */
export async function getUsers(): Promise<User[]> {
  const page = await fetchApi<PaginatedResponse<User>>(
    `/users?page_size=${USERS_PAGE_SIZE}`
  );
  return page.items;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const page = await fetchApi<PaginatedResponse<User>>(
    `/users?email=${encodeURIComponent(email)}&page_size=1`
  );
  return page.items.length > 0 ? page.items[0] : null;
}

export async function updateUser(userId: string, data: UpdateUserRequest): Promise<User> {
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

export async function getMenusByUnit(unitId: string): Promise<Menu[]> {
  return fetchApi<Menu[]>(`/menu-outlets/${unitId}`);
}

export async function getMenuItemsBySection(sectionId: number): Promise<MenuItemRead[]> {
  return fetchApi<MenuItemRead[]>(`/menu-items/${sectionId}`);
}

// ============ FMH Import ============

export async function importSuppliersFMH(
  suppliersFile: File,
  pricingsFile: File
): Promise<FMHImportResult> {
  const form = new FormData();
  form.append('suppliers_file', suppliersFile);
  form.append('pricings_file', pricingsFile);
  return fetchApiFormData<FMHImportResult>('/suppliers/fmh-import', {
    method: 'POST',
    body: form,
  });
}

export async function importIngredientsFMH(productsFile: File): Promise<FMHImportResult> {
  const form = new FormData();
  form.append('products_file', productsFile);
  return fetchApiFormData<FMHImportResult>('/ingredients/fmh-import', {
    method: 'POST',
    body: form,
  });
}

export async function downloadFMHSampleSupplier(): Promise<Blob> {
  return fetchApiBlob('/suppliers/fmh-sample-supplier');
}

export async function downloadFMHSampleSupplierPricings(): Promise<Blob> {
  return fetchApiBlob('/suppliers/fmh-sample-supplier-pricings');
}

export async function downloadFMHSampleItems(): Promise<Blob> {
  return fetchApiBlob('/ingredients/fmh-sample-items');
}

export async function importIngredientsBuyCatalogue(file: File): Promise<FMHImportResult> {
  const form = new FormData();
  form.append('products_file', file);
  return fetchApiFormData<FMHImportResult>('/ingredients/buy-catalogue-import', {
    method: 'POST',
    body: form,
  });
}

export async function downloadBuyCatalogueTemplate(): Promise<Blob> {
  return fetchApiBlob('/ingredients/buy-catalogue-template');
}

// ============ Menu Sketches ============

export async function getMenuSketches(params?: { include_archived?: boolean }): Promise<MenuSketch[]> {
  const qs = params?.include_archived ? '?include_archived=true' : '';
  return fetchApi<MenuSketch[]>(`/menu-sketches${qs}`);
}

export async function getMenuSketch(id: number): Promise<MenuSketch> {
  return fetchApi<MenuSketch>(`/menu-sketches/${id}`);
}

export async function createMenuSketch(
  data?: CreateMenuSketchRequest
): Promise<MenuSketch> {
  return fetchApi<MenuSketch>('/menu-sketches', {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });
}

export async function updateMenuSketch(
  id: number,
  data: UpdateMenuSketchRequest
): Promise<MenuSketch> {
  return fetchApi<MenuSketch>(`/menu-sketches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function forkMenuSketch(id: number): Promise<MenuSketch> {
  return fetchApi<MenuSketch>(`/menu-sketches/${id}/fork`, {
    method: 'POST',
  });
}

export async function deleteMenuSketch(id: number): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>(`/menu-sketches/${id}`, { method: 'DELETE' });
}

// ============ Menu Sketch Sections ============

export async function getMenuSketchSections(menuSketchId: number): Promise<MenuSketchSection[]> {
  return fetchApi<MenuSketchSection[]>(`/menu-sketch-sections?menu_sketch_id=${menuSketchId}`);
}

export async function createMenuSketchSection(
  data: CreateMenuSketchSectionRequest
): Promise<MenuSketchSection> {
  return fetchApi<MenuSketchSection>('/menu-sketch-sections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMenuSketchSection(
  id: number,
  data: UpdateMenuSketchSectionRequest
): Promise<MenuSketchSection> {
  return fetchApi<MenuSketchSection>(`/menu-sketch-sections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteMenuSketchSection(id: number): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>(`/menu-sketch-sections/${id}`, { method: 'DELETE' });
}

// ============ Menu Sketch Section Items ============

export async function getMenuSketchSectionItems(
  sectionId: number
): Promise<MenuSketchSectionItem[]> {
  return fetchApi<MenuSketchSectionItem[]>(
    `/menu-sketch-section-items?section_id=${sectionId}`
  );
}

export async function createMenuSketchSectionItem(
  data: CreateMenuSketchSectionItemRequest
): Promise<MenuSketchSectionItem> {
  return fetchApi<MenuSketchSectionItem>('/menu-sketch-section-items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMenuSketchSectionItem(
  id: number,
  data: UpdateMenuSketchSectionItemRequest
): Promise<MenuSketchSectionItem> {
  return fetchApi<MenuSketchSectionItem>(`/menu-sketch-section-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteMenuSketchSectionItem(id: number): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>(`/menu-sketch-section-items/${id}`, { method: 'DELETE' });
}

// ============ Menu Sketch Section Item Comments ============

export async function getMenuSketchComments(
  menuSketchId: number
): Promise<MenuSketchCommentsResponse> {
  return fetchApi<MenuSketchCommentsResponse>(
    `/menu-sketch-section-item-comments/menu-sketch/${menuSketchId}`
  );
}

export async function createMenuSketchComment(
  data: CreateMenuSketchSectionItemCommentRequest
): Promise<MenuSketchSectionItemComment> {
  return fetchApi<MenuSketchSectionItemComment>('/menu-sketch-section-item-comments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMenuSketchComment(
  id: number,
  data: UpdateMenuSketchSectionItemCommentRequest
): Promise<MenuSketchSectionItemComment> {
  return fetchApi<MenuSketchSectionItemComment>(
    `/menu-sketch-section-item-comments/${id}`,
    { method: 'PATCH', body: JSON.stringify(data) }
  );
}

export async function resolveMenuSketchComment(
  id: number
): Promise<MenuSketchSectionItemComment> {
  return fetchApi<MenuSketchSectionItemComment>(
    `/menu-sketch-section-item-comments/resolve/${id}`,
    { method: 'PATCH' }
  );
}

export async function deleteMenuSketchComment(id: number): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>(`/menu-sketch-section-item-comments/${id}`, {
    method: 'DELETE',
  });
}

// ============ Supplier Ingredients (cross-supplier product view) ============

export interface SupplierIngredientsPaginatedParams {
  page_number?: number;
  page_size?: number;
  search?: string;
}

// ============ Supplier Ingredient Tags ============

export async function getSupplierIngredientTags(): Promise<SupplierIngredientTag[]> {
  return fetchApi<SupplierIngredientTag[]>('/supplier-ingredient-tags');
}

export async function createSupplierIngredientTag(name: string): Promise<SupplierIngredientTag> {
  return fetchApi<SupplierIngredientTag>('/supplier-ingredient-tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function deleteSupplierIngredientTag(tagId: number): Promise<SupplierIngredientTag> {
  return fetchApi<SupplierIngredientTag>(`/supplier-ingredient-tags/${tagId}`, {
    method: 'DELETE',
  });
}

export async function getTagsForSupplierIngredient(siId: number): Promise<SupplierIngredientTag[]> {
  return fetchApi<SupplierIngredientTag[]>(`/supplier-ingredient-tags/supplier-ingredient/${siId}`);
}

export async function addTagToSupplierIngredient(siId: number, tagId: number): Promise<void> {
  return fetchApi<void>(`/supplier-ingredient-tags/supplier-ingredient/${siId}/${tagId}`, {
    method: 'POST',
  });
}

export async function removeTagFromSupplierIngredient(siId: number, tagId: number): Promise<void> {
  return fetchApi<void>(`/supplier-ingredient-tags/supplier-ingredient/${siId}/${tagId}`, {
    method: 'DELETE',
  });
}

export async function getSupplierIngredientsPaginated(
  params?: SupplierIngredientsPaginatedParams
): Promise<PaginatedResponse<SupplierIngredientItem>> {
  const searchParams = new URLSearchParams();
  if (params?.page_number) searchParams.set('page_number', String(params.page_number));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return fetchApi<PaginatedResponse<SupplierIngredientItem>>(
    `/supplier-ingredients${query ? `?${query}` : ''}`
  );
}

// ---------------------------------------------------------------------------
// Passport — brand-app roles
//
// READS come from Prepper's projection of Passport (local, and they survive a Passport outage).
// WRITES go UP to Passport and come back DOWN via sync — they are not applied locally, so the list
// refreshes from the projection once the event lands. A 403 (Passport's authority matrix) and a 409
// (the target unit is not a brand) are NORMAL outcomes, surfaced verbatim.
// ---------------------------------------------------------------------------

export async function getPassportOrganizations(): Promise<PassportOrganization[]> {
  return fetchApi<PassportOrganization[]>('/passport/organizations');
}

export async function getPassportBrands(): Promise<PassportBrand[]> {
  return fetchApi<PassportBrand[]>('/passport/brand-roles/brands');
}

export async function getPassportBrandRoles(): Promise<PassportBrandRole[]> {
  return fetchApi<PassportBrandRole[]>('/passport/brand-roles');
}

export async function getPassportMembers(): Promise<PassportMember[]> {
  return fetchApi<PassportMember[]>('/passport/brand-roles/members');
}

export async function assignPassportBrandRole(
  data: AssignBrandRoleRequest
): Promise<PassportBrandRole> {
  return fetchApi<PassportBrandRole>('/passport/brand-roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function setPassportBrandRole(
  assignmentId: string,
  role: BrandRole
): Promise<PassportBrandRole> {
  return fetchApi<PassportBrandRole>(`/passport/brand-roles/${assignmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removePassportBrandRole(assignmentId: string): Promise<PassportBrandRole> {
  return fetchApi<PassportBrandRole>(`/passport/brand-roles/${assignmentId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Recipe -> unit chips, batched
//
// Replaces the deleted `/recipes/outlets/batch`. One call for a whole card/list view (never one
// request per recipe). Server-scoped to the caller's accessible units, so a list never renders a
// brand the user has no role at. Names are resolved server-side (a recipe may be served at a brand
// OR an outlet, and the client's brand list carries only brands).
// ---------------------------------------------------------------------------

export interface RecipeUnitChip {
  unit_id: string;
  unit_name: string;
  is_active: boolean;
}

export async function getRecipeUnitsBatch(
  recipeIds: number[]
): Promise<Map<number, RecipeUnitChip[]>> {
  if (recipeIds.length === 0) return new Map();
  // JSON object keys are strings; the sibling batch hooks all hand back a Map keyed by number.
  const data = await fetchApi<Record<string, RecipeUnitChip[]>>('/recipes/units/batch', {
    method: 'POST',
    body: JSON.stringify({ recipe_ids: recipeIds }),
  });
  return new Map(Object.entries(data).map(([id, chips]) => [Number(id), chips]));
}
