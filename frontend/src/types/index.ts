// Types matching backend SQLModel schemas

// ============ FMH Import Types ============

export interface FMHImportResult {
  suppliers_created: number;
  suppliers_updated: number;
  categories_created: number;
  ingredients_created: number;
  ingredients_updated: number;
  supplier_ingredients_created: number;
  supplier_ingredients_updated: number;
  outlet_supplier_ingredients_created: number;
  warnings: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page_number: number;
  current_page_size: number;
  total_count: number;
  total_pages: number;
}

export interface SupplierIngredientItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string | null;
  category_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name: string | null;
  unit: string;
  price_per_pack: number;
}

export interface AuthApiError {
  message?: string;
}

export type RecipeStatus = 'draft' | 'active' | 'archived';

export interface Allergen {
  id: number;
  name: string;
}

export interface Ingredient {
  id: number;
  name: string;
  base_unit: string;
  cost_per_base_unit: number | null;
  is_active: boolean;
  is_halal: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  supplier_ingredients?: SupplierIngredient[];
  allergens?: Allergen[];
  supplier_names?: string[];
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
  selling_price_est?: number | null;
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

export interface CreateIngredientRequest {
  name: string;
  base_unit: string;
  cost_per_base_unit?: number | null;
  is_halal?: boolean;
  category_id?: number | null;
}

export interface UpdateIngredientRequest {
  name?: string;
  base_unit?: string;
  cost_per_base_unit?: number | null;
  is_halal?: boolean;
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

export interface ParseInstructionsRequest {
  instructions_raw: string;
}

// ============ Tasting Types ============

export type TastingDecision = 'approved' | 'needs_work' | 'rejected';

export interface TastingParticipant {
  id: number;
  user_id: string | null;
  email: string;
  username: string;
  phone_number?: string | null;
}

export interface TastingSession {
  id: number;
  name: string;
  date: string;
  location: string | null;
  creator_id: string | null;
  participants: TastingParticipant[];
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
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TastingNoteImage {
  id: number;
  tasting_note_id: number;
  image_url: string;
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
  participant_ids?: string[] | null;
  notes?: string | null;
}

export interface UpdateTastingSessionRequest {
  name?: string;
  date?: string;
  location?: string | null;
  participant_ids?: string[] | null;
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

export interface RecipeTastingIngredient {
  id: number;
  name: string;
  base_unit: string;
  is_halal: boolean;
}

export interface RecipeTasting {
  id: number;
  recipe_id: number;
  tasting_session_id: number;
  recipe_name?: string | null;
  ingredients: RecipeTastingIngredient[];
  sequence?: number | null;
  created_at: string;
}

export interface AddRecipeToSessionRequest {
  recipe_id: number;
}

export interface AddRecipesToSessionRequest {
  recipe_ids: number[];
}

export interface BatchAddResult {
  added: number[];
  skipped: number[];
}

export interface ReorderSessionDishItem {
  id: number;
  sequence: number;
}

export interface ReorderSessionDishesRequest {
  items: ReorderSessionDishItem[];
}

// ============ Ingredient-Tasting Session Types ============

export interface IngredientTasting {
  id: number;
  ingredient_id: number;
  tasting_session_id: number;
  ingredient_name?: string | null;
  created_at: string;
}

export interface IngredientTastingNote {
  id: number;
  session_id: number;
  ingredient_id: number;
  taste_rating: number | null;
  aroma_rating: number | null;
  texture_rating: number | null;
  overall_rating: number | null;
  feedback: string | null;
  action_items: string | null;
  action_items_done: boolean;
  decision: TastingDecision | null;
  taster_name: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientTastingNoteWithDetails extends IngredientTastingNote {
  ingredient_name?: string | null;
  session_name?: string | null;
  session_date?: string | null;
}

export interface IngredientTastingSummary {
  ingredient_id: number;
  total_tastings: number;
  average_overall_rating: number | null;
  latest_decision: TastingDecision | null;
  latest_feedback: string | null;
  latest_tasting_date: string | null;
}

export interface CreateIngredientTastingNoteRequest {
  ingredient_id: number;
  taste_rating?: number | null;
  aroma_rating?: number | null;
  texture_rating?: number | null;
  overall_rating?: number | null;
  feedback?: string | null;
  action_items?: string | null;
  decision?: TastingDecision | null;
  taster_name?: string | null;
}

export interface UpdateIngredientTastingNoteRequest {
  taste_rating?: number | null;
  aroma_rating?: number | null;
  texture_rating?: number | null;
  overall_rating?: number | null;
  feedback?: string | null;
  action_items?: string | null;
  action_items_done?: boolean;
  decision?: TastingDecision | null;
  taster_name?: string | null;
}

export interface AddIngredientToSessionRequest {
  ingredient_id: number;
}

export interface AddIngredientsToSessionRequest {
  ingredient_ids: number[];
}

// ============ Supplier Types ============

export interface Supplier {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone_number: string | null;
  email: string | null;
  shipping_company_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierRequest {
  name: string;
  code?: string | null;
  address?: string;
  phone_number?: string;
  email?: string;
  shipping_company_name?: string | null;
}

export interface UpdateSupplierRequest {
  name?: string;
  code?: string | null;
  address?: string | null;
  phone_number?: string | null;
  email?: string | null;
  shipping_company_name?: string | null;
  is_active?: boolean;
}

// ============ Supplier-Ingredient Types (normalized join table) ============

export interface SupplierIngredient {
  id: number;
  ingredient_id: number;
  supplier_id: number;
  /** Passport unit UUID the price belongs to. */
  unit_id: string | null;
  sku: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  currency: string;
  source: string;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
  supplier_name: string | null;
  ingredient_name: string | null;
  unit_name: string | null;
}

export interface AddSupplierIngredientRequest {
  ingredient_id: number;
  supplier_id: number;
  unit_id: string;
  sku?: string | null;
  pack_size: number;
  pack_unit: string;
  price_per_pack: number;
  currency?: string;
  source?: string;
  is_preferred?: boolean;
}

export interface UpdateSupplierIngredientRequest {
  sku?: string | null;
  pack_size?: number;
  pack_unit?: string;
  price_per_pack?: number;
  currency?: string;
  source?: string;
  is_preferred?: boolean;
  unit_id?: string;
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

// ============ Recipe-Unit Types ============
//
// A unit is a Passport brand or outlet, projected read-only. Prepper links recipes to units; it
// never creates or edits the units themselves — that happens in Passport.

export interface RecipeUnit {
  recipe_id: number;
  unit_id: string;
  organization_id: string;
  is_active: boolean;
  price_override: number | null;
  created_at: string;
}

export interface CreateRecipeUnitRequest {
  unit_id: string;
  is_active?: boolean;
  price_override?: number | null;
}

export interface UpdateRecipeUnitRequest {
  is_active?: boolean;
  price_override?: number | null;
}

// ============ Recipe Category Types ============

export interface RecipeCategory {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecipeCategoryRequest {
  name: string;
  description?: string | null;
}

export interface UpdateRecipeCategoryRequest {
  name?: string;
  description?: string | null;
  is_active?: boolean | null;
}

// ============ Recipe-Recipe Category Link Types ============

export interface RecipeRecipeCategory {
  id: number;
  recipe_id: number;
  category_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecipeRecipeCategoryRequest {
  recipe_id: number;
  category_id: number;
  is_active?: boolean;
}

export interface UpdateRecipeRecipeCategoryRequest {
  is_active?: boolean;
}

// ============ Allergen Types ============

export interface Allergen {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredientAllergen {
  id: number;
  ingredient_id: number;
  allergen_id: number;
  created_at: string;
}

export interface AllergenCreate {
  name: string;
  description?: string | null;
}

export interface AllergenUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface IngredientAllergenCreate {
  ingredient_id: number;
  allergen_id: number;
}

// ============ Auth Types ============

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * The email-first router's answer: which kind of account holds this address.
 *
 * Exactly two values, and no client-side toggle may add a third — the point of the router is that
 * a user never has to know whether they hold a Passport identity or a Prepper password.
 */
export type LoginRoute = 'passport' | 'app-native';

/**
 * A Prepper account. It carries NO role: `user_type`, `is_manager` and `outlet_id` are gone.
 * Roles are Passport's and are read per-brand (`PassportBrand.my_role`) — never as a global flag.
 */
export interface User {
  id: string;
  email: string;
  username: string;
  phone_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  phone_number?: string | null;
}

export interface LoginResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ============================================================================
// Menu Types
// ============================================================================

export interface Menu {
  id: number;
  name: string;
  is_published: boolean;
  is_active: boolean;
  version_no: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MenuSection {
  id: number;
  name: string;
  menu_id: number;
  order_no: number;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  id: number;
  recipe_id: number;
  section_id: number;
  order_no: number;
  display_price: number | null;
  additional_info: string | null;
  key_highlights: string | null;
  substitution: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MenuUnit {
  id: number;
  menu_id: number;
  unit_id: string;
  organization_id: string;
  created_at?: string;
}

export interface MenuItemRead extends MenuItem {
  recipe_name: string;
}

export interface MenuSectionRead extends MenuSection {
  items: MenuItemRead[];
}

export interface MenuDetail extends Menu {
  sections: MenuSectionRead[];
  /** The Passport units this menu is served at (API field name is still `outlets`). */
  outlets?: MenuUnit[];
}

export interface CreateMenuItemRequest {
  recipe_id: number;
  order_no: number;
  display_price?: number | null;
  additional_info?: string | null;
  key_highlights?: string | null;
  substitution?: string | null;
}

export interface CreateMenuSectionRequest {
  name: string;
  order_no: number;
  items?: CreateMenuItemRequest[];
}

export interface CreateMenuRequest {
  name: string;
  is_published?: boolean;
  unit_ids: string[];
  sections?: CreateMenuSectionRequest[];
}

export interface UpdateMenuRequest {
  name?: string;
  is_published?: boolean;
  unit_ids?: string[];
  sections?: Array<{
    id?: number;
    name: string;
    order_no: number;
    items: Array<{
      id?: number;
      recipe_id: number;
      order_no: number;
      display_price?: number | null;
      additional_info?: string | null;
      key_highlights?: string | null;
    }>;
  }>;
}

// ============================================================================
// Menu Sketch Types (relational menu builder)
// ============================================================================

export interface MenuSketch {
  id: number;
  version: number;
  name: string;
  status: 'draft' | 'archived';
  root: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuSketchRequest {
  name?: string;
}

export interface UpdateMenuSketchRequest {
  name?: string;
  notes?: string | null;
}

export interface MenuSketchSection {
  id: number;
  name: string;
  menu_sketch_id: number;
  order_no: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuSketchSectionRequest {
  menu_sketch_id: number;
  name: string;
  order_no?: number;
}

export interface UpdateMenuSketchSectionRequest {
  name?: string;
  order_no?: number;
}

export interface MenuSketchTastingNote {
  id: number;
  feedback: string | null;
  taster_name: string | null;
  decision: string | null;
  overall_rating: number | null;
  session_name: string | null;
  session_date: string | null;
  created_at: string;
}

export interface MenuSketchSectionItem {
  id: number;
  menu_sketch_section_id: number;
  recipe_id: number | null;
  /** Display name resolved from the linked recipe. */
  recipe_name: string | null;
  sales_price: number | null;
  cost_price: number | null;
  margin: number | null;
  description: string | null;
  is_highlight: boolean;
  icons: string[];
  order_no: number;
  tasting_notes: MenuSketchTastingNote[];
  created_at: string;
  updated_at: string;
}

export interface CreateMenuSketchSectionItemRequest {
  menu_sketch_section_id: number;
  name: string;
  recipe_id?: number | null;
  sales_price?: number | null;
  cost_price?: number | null;
  description?: string | null;
  is_highlight?: boolean;
  icons?: string[];
  order_no?: number;
}

export interface UpdateMenuSketchSectionItemRequest {
  name?: string;
  recipe_id?: number | null;
  sales_price?: number | null;
  cost_price?: number | null;
  description?: string | null;
  is_highlight?: boolean;
  icons?: string[];
  order_no?: number;
}

export interface MenuSketchSectionItemComment {
  id: number;
  menu_sketch_section_item_id: number;
  text: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuSketchSectionItemCommentRequest {
  menu_sketch_section_item_id: number;
  text: string;
}

export interface UpdateMenuSketchSectionItemCommentRequest {
  text: string;
}

export interface DishCommentsRead {
  menu_sketch_section_item_id: number;
  name: string | null; // resolved from the linked recipe
  comments: MenuSketchSectionItemComment[];
}

export interface MenuSketchCommentsResponse {
  data: DishCommentsRead[];
}

// ============ Supplier Ingredient Tag Types ============

export interface SupplierIngredientTag {
  id: number;
  name: string;
  is_active: boolean;
}

export interface CreateSupplierIngredientTagRequest {
  name: string;
}

// ---------------------------------------------------------------------------
// Passport — brand-app roles
//
// Passport's vocabulary is used VERBATIM: `Manager` | `Staff` at a BRAND (people are never held at
// an outlet or entity). These are NOT Prepper's `user_type`/`is_manager` — the two vocabularies are
// distinct and must never be conflated. A user may hold different roles at different brands, so a
// role is always read per-brand; there is no single "effective role".
// ---------------------------------------------------------------------------

export type BrandRole = 'Manager' | 'Staff';

/**
 * Where a brand role came from.
 *
 * `assigned` — an active `unit_app_membership` row exists: editable, removable.
 * `derived`  — no row. The holder is an org Owner/Admin and Passport's ladder gives them `Manager`
 *              at every brand carrying the app, so there is nothing to edit or remove.
 *
 * Keys on the ROW, never on the org role. The ladder is a floor for GAPS, not an override: an Owner
 * carrying an explicit `Staff` row **is** `Staff` there, and that row is real and must stay
 * editable. Deriving this from `org_role` on the client would strip the controls off a live
 * assignment — and would re-implement Passport's ladder in a second language, so the roster could
 * disagree with the permission check.
 */
export type BrandRoleSource = 'assigned' | 'derived';

/**
 * An organisation the user belongs to, from Prepper's projection of Passport.
 *
 * The only place org NAMES reach the client. `organization_id` has been carried on several
 * payloads since the sync consumer landed with no way to render it.
 */
export interface PassportOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  /** The user's role IN THIS ORG: `Owner` | `Admin` | `Member`. Read per-org, never "strongest anywhere". */
  my_org_role: string;
}

export interface PassportBrand {
  id: string;
  name: string;
  organization_id: string;
  /** The current user's role AT THIS BRAND — null means no access here (they may hold one elsewhere). */
  my_role: BrandRole | null;
}

export interface PassportBrandRole {
  /** `null` for a derived holder — the ladder grants the role, so there is no row to point at. */
  assignment_id: string | null;
  source: BrandRoleSource;
  platform_user_id: string;
  email: string;
  display_name: string | null;
  unit_id: string;
  unit_name: string;
  /** Always Passport's derived answer, never the stored row's value — the two differ on a demotion. */
  role: BrandRole;
  /** The person's ORG role (`Owner`|`Admin`|`Member`) — a different vocabulary; shown for context. */
  org_role: string;
  organization_id: string;
}

/** A person in the org, from Passport's membership, with their local account if they have one. */
export interface MemberAccount {
  platform_user_id: string;
  email: string;
  display_name: string | null;
  /** `Owner` | `Admin` | `Member` — the ORG vocabulary. */
  org_role: string;
  /** `null` => never signed in via Passport, so there is no local row, no username and no phone. */
  user_id: string | null;
  username: string | null;
  phone_number: string | null;
}

export interface InviteMemberRequest {
  email: string;
  display_name?: string | null;
  /** The ORG vocabulary — NOT `Manager`/`Staff`. */
  role: 'Owner' | 'Admin' | 'Member';
}

export interface PassportMember {
  platform_user_id: string;
  email: string;
  display_name: string | null;
  org_role: string;
  organization_id: string;
}

/**
 * What Passport returns from a brand-role write — its `unit_app_membership` AGGREGATE.
 *
 * NOT a `PassportBrandRole`: that is a roster row and carries `email`, `unit_name` and `org_role`,
 * which this does not. The write routes were typed as returning the roster shape, which compiled
 * only because nothing read the body — there is no runtime validation to catch it.
 *
 * `status: 'removed'` is a TOMBSTONE, not a delete: the row survives and confers nothing.
 */
export interface PassportBrandRoleAggregate {
  id: string;
  organization_id: string;
  platform_user_id: string;
  unit_id: string;
  app_id: string;
  role: BrandRole;
  status: 'active' | 'removed';
  version: number;
}

export interface AssignBrandRoleRequest {
  platform_user_id: string;
  unit_id: string;
  role: BrandRole;
}
