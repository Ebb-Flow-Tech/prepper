// Types matching backend SQLModel schemas

export type RecipeStatus = 'draft' | 'active' | 'archived';

export interface Ingredient {
  id: number;
  name: string;
  base_unit: string;
  cost_per_base_unit: number | null;
  is_active: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  suppliers?: IngredientSupplierEntry[];
}

export interface Recipe {
  id: number;
  name: string;
  instructions_raw: string | null;
  instructions_structured: InstructionsStructured | null;
  yield_quantity: number;
  yield_unit: string;
  cost_price: number | null;
  selling_price_est: number | null;
  status: RecipeStatus;
  is_prep_recipe: boolean;
  is_public: boolean;
  owner_id: string | null;
  version: number;
  root_id: number | null;
  image_url: string | null;
  description: string | null;
  summary_feedback?: string | null;
  rnd_started: boolean;
  review_ready: boolean;
  created_at: string;
  updated_at: string;
  ingredients?: RecipeIngredient[];
  created_by: string;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  quantity: number;
  unit: string;
  sort_order: number;
  created_at: string;
  base_unit: string | null;
  unit_price: number | null;
  supplier_id: number | null;
  wastage_percentage: number;
  ingredient?: Ingredient;
}

export interface InstructionStep {
  order: number;
  text: string;
  timer_seconds?: number | null;
  temperature_c?: number | null;
}

export interface InstructionsStructured {
  steps: InstructionStep[];
}

export interface CostingBreakdown {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  quantity_in_base_unit: number;
  base_unit: string;
  cost_per_base_unit: number | null;
  wastage_percentage: number;
  adjusted_cost_per_unit: number | null;
  line_cost: number | null;
}

export interface SubRecipeCostItem {
  link_id: number;
  recipe_id: number;
  recipe_name: string;
  quantity: number;
  unit: string;
  sub_recipe_batch_cost: number | null;
  sub_recipe_portion_cost: number | null;
  line_cost: number | null;
}

export interface CostingResult {
  recipe_id: number;
  recipe_name: string;
  total_batch_cost: number | null;
  cost_per_portion: number | null;
  yield_quantity: number;
  yield_unit: string;
  breakdown: CostingBreakdown[];
  sub_recipe_breakdown: SubRecipeCostItem[];
  ingredient_cost: number | null;
  sub_recipe_cost: number | null;
  missing_costs: string[];
}

// API Request/Response types
export interface CreateRecipeRequest {
  name: string;
  yield_quantity?: number;
  yield_unit?: string;
  cost_price?: number | null;
  status?: RecipeStatus;
  created_by?: string;
  is_public?: boolean;
  owner_id?: string;
  version?: number;
  root_id?: number | null;
  image_url?: string | null;
}

export interface UpdateRecipeRequest {
  name?: string;
  yield_quantity?: number;
  yield_unit?: string;
  cost_price?: number | null;
  selling_price_est?: number | null;
  instructions_raw?: string | null;
  instructions_structured?: InstructionsStructured | null;
  status?: RecipeStatus;
  is_public?: boolean;
  image_url?: string | null;
  description?: string | null;
  summary_feedback?: string | null;
  rnd_started?: boolean;
  review_ready?: boolean;
}

export interface RecipeImage {
  id: number;
  recipe_id: number;
  image_url: string;
  is_main: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateRecipeImageRequest {
  image_base64: string;
}

export interface CreateIngredientSupplier {
  supplier_id: string;
  supplier_name: string;
  sku?: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  cost_per_unit: number;
  currency?: string;
  is_preferred?: boolean;
  source?: string;
}

export interface CreateIngredientRequest {
  name: string;
  base_unit: string;
  cost_per_base_unit?: number | null;
  category_id?: number | null;
  suppliers?: CreateIngredientSupplier[];
}

export interface UpdateIngredientRequest {
  name?: string;
  base_unit?: string;
  cost_per_base_unit?: number | null;
  is_active?: boolean;
  category_id?: number | null;
}

export interface AddRecipeIngredientRequest {
  ingredient_id: number;
  quantity: number;
  unit: string;
  base_unit: string;
  unit_price: number;
  supplier_id: number | null;
  wastage_percentage?: number;
}

export interface UpdateRecipeIngredientRequest {
  quantity?: number;
  unit?: string;
  base_unit?: string;
  unit_price?: number;
  supplier_id?: number | null;
  wastage_percentage?: number;
}

export interface ReorderIngredientsRequest {
  ordered_ids: number[];
}

export interface ParseInstructionsRequest {
  instructions_raw: string;
}

// ============ Tasting Types ============

export type TastingDecision = 'approved' | 'needs_work' | 'rejected';

export interface TastingSession {
  id: number;
  name: string;
  date: string;
  location: string | null;
  attendees: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TastingNote {
  id: number;
  session_id: number;
  recipe_id: number;
  taste_rating: number | null;
  presentation_rating: number | null;
  texture_rating: number | null;
  overall_rating: number | null;
  feedback: string | null;
  action_items: string | null;
  action_items_done: boolean;
  decision: TastingDecision | null;
  taster_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TastingNoteWithRecipe extends TastingNote {
  recipe_name: string | null;
  session_name: string | null;
  session_date: string | null;
}

export interface RecipeTastingSummary {
  recipe_id: number;
  total_tastings: number;
  average_overall_rating: number | null;
  latest_decision: TastingDecision | null;
  latest_feedback: string | null;
  latest_tasting_date: string | null;
}

export interface TastingSessionStats {
  recipe_count: number;
  approved_count: number;
  needs_work_count: number;
  rejected_count: number;
}

export interface CreateTastingSessionRequest {
  name: string;
  date: string;
  location?: string | null;
  attendees?: string[] | null;
  notes?: string | null;
}

export interface UpdateTastingSessionRequest {
  name?: string;
  date?: string;
  location?: string | null;
  attendees?: string[] | null;
  notes?: string | null;
}

export interface CreateTastingNoteRequest {
  recipe_id: number;
  taste_rating?: number | null;
  presentation_rating?: number | null;
  texture_rating?: number | null;
  overall_rating?: number | null;
  feedback?: string | null;
  action_items?: string | null;
  decision?: TastingDecision | null;
  taster_name?: string | null;
}

export interface UpdateTastingNoteRequest {
  taste_rating?: number | null;
  presentation_rating?: number | null;
  texture_rating?: number | null;
  overall_rating?: number | null;
  feedback?: string | null;
  action_items?: string | null;
  action_items_done?: boolean;
  decision?: TastingDecision | null;
  taster_name?: string | null;
}

// ============ Recipe-Tasting Session Types ============

export interface RecipeTasting {
  id: number;
  recipe_id: number;
  tasting_session_id: number;
  created_at: string;
}

export interface AddRecipeToSessionRequest {
  recipe_id: number;
}

// ============ Supplier Types ============

export interface Supplier {
  id: number;
  name: string;
  address: string | null;
  phone_number: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierRequest {
  name: string;
  address?: string;
  phone_number?: string;
  email?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  address?: string | null;
  phone_number?: string | null;
  email?: string | null;
}

// ============ Ingredient Supplier Entry Types ============

export interface IngredientSupplierEntry {
  supplier_id: string;
  supplier_name: string;
  sku: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  cost_per_unit: number;
  currency: string;
  is_preferred: boolean;
  source: string;
  last_updated: string | null;
  last_synced: string | null;
}

export interface AddIngredientSupplierRequest {
  supplier_id: string;
  supplier_name: string;
  sku?: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  cost_per_unit: number;
  currency?: string;
  is_preferred?: boolean;
  source?: string;
}

export interface UpdateIngredientSupplierRequest {
  supplier_name?: string;
  sku?: string | null;
  pack_size?: number;
  pack_unit?: string;
  price_per_pack?: number;
  cost_per_unit?: number;
  currency?: string;
  is_preferred?: boolean;
}

// ============ Supplier Ingredient Entry Types ============

export interface SupplierIngredientEntry {
  ingredient_id: number;
  ingredient_name: string;
  base_unit: string;
  supplier_id: string;
  sku: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  cost_per_unit: number;
  currency: string;
  is_preferred: boolean;
  source: string;
  last_updated: string | null;
}

export interface AddSupplierIngredientRequest {
  ingredient_id: number;
  sku?: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  cost_per_unit: number;
  currency?: string;
  is_preferred?: boolean;
  source?: string;
}

export interface UpdateSupplierIngredientRequest {
  sku?: string | null;
  pack_size?: number;
  pack_unit?: string;
  price_per_pack?: number;
  cost_per_unit?: number;
  currency?: string;
  is_preferred?: boolean;
}

// ============ Sub-Recipe Types ============

export type SubRecipeUnit = 'portion' | 'batch' | 'g' | 'ml';

export interface SubRecipe {
  id: number;
  parent_recipe_id: number;
  child_recipe_id: number;
  quantity: number;
  unit: SubRecipeUnit;
  position: number;
  created_at: string;
}

export interface SubRecipeCreate {
  child_recipe_id: number;
  quantity?: number;
  unit?: SubRecipeUnit;
}

export interface SubRecipeUpdate {
  quantity?: number;
  unit?: SubRecipeUnit;
}

export interface SubRecipeReorder {
  ordered_ids: number[];
}

// ============ Category Types ============

export interface Category {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

// ============ Outlet Types ============

export type OutletType = 'brand' | 'location';

export interface Outlet {
  id: number;
  name: string;
  code: string;
  outlet_type: OutletType;
  parent_outlet_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOutletRequest {
  name: string;
  code: string;
  outlet_type?: OutletType;
  parent_outlet_id?: number | null;
}

export interface UpdateOutletRequest {
  name?: string;
  code?: string;
  outlet_type?: OutletType;
  parent_outlet_id?: number | null;
  is_active?: boolean;
}

// ============ Recipe-Outlet Types ============

export interface RecipeOutlet {
  recipe_id: number;
  outlet_id: number;
  is_active: boolean;
  price_override: number | null;
  created_at: string;
}

export interface CreateRecipeOutletRequest {
  recipe_id: number;
  outlet_id: number;
  is_active?: boolean;
  price_override?: number | null;
}

export interface UpdateRecipeOutletRequest {
  is_active?: boolean;
  price_override?: number | null;
}
