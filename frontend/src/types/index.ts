// Types matching backend SQLModel schemas

export type RecipeStatus = 'draft' | 'active' | 'archived';

export interface Ingredient {
  id: number;
  name: string;
  base_unit: string;
  cost_per_base_unit: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  unit_cost: number;
  line_cost: number;
}

export interface CostingResult {
  recipe_id: number;
  total_batch_cost: number;
  cost_per_portion: number;
  yield_quantity: number;
  yield_unit: string;
  breakdown: CostingBreakdown[];
  calculated_at: string;
}

// API Request/Response types
export interface CreateRecipeRequest {
  name: string;
  yield_quantity?: number;
  yield_unit?: string;
  status?: RecipeStatus;
  created_by?: string;
}

export interface UpdateRecipeRequest {
  name?: string;
  yield_quantity?: number;
  yield_unit?: string;
  selling_price_est?: number | null;
  instructions_raw?: string | null;
  instructions_structured?: InstructionsStructured | null;
  status?: RecipeStatus;
}

export interface CreateIngredientRequest {
  name: string;
  base_unit: string;
  cost_per_base_unit?: number | null;
}

export interface AddRecipeIngredientRequest {
  ingredient_id: number;
  quantity: number;
  unit: string;
}

export interface UpdateRecipeIngredientRequest {
  quantity?: number;
  unit?: string;
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
  decision?: TastingDecision | null;
  taster_name?: string | null;
}
