# Changelog

All notable changes to Prepper are documented here.

---

## Index

- **[0.0.54](#0054---2026-07-15)** — Passport: Disarm the Silent Admin Promotion (Delete the Role Projection), Brand-Roles UI, Projection-Backed Reads, Synchronous Identity Linking & the Rule-7 Re-Key Migration
- **[0.0.53](#0053---2026-07-14)** — Passport Sync Consumer: Complete the Eight-Aggregate Projection (Units, Relations, Brand-App Switches & Roles), Derived Brand-Scoped Access, Role Write-Back, Multi-Org Projection & a Scheduled Nightly Reconciliation
- **[0.0.52](#0052---2026-07-09)** — Build Fix: Python 3.12 Floor Across Image, CI & Package Metadata — Unblocks the Staging Deploy `ResolutionTooDeep` Caused by `passport-client`'s `requires-python >=3.12`
- **[0.0.51](#0051---2026-07-09)** — Passport Sync Consumer: Adopt the `org.resync` Manual Re-Sync Handler (SDK 0.2.0, Upsert-Only Fan-Out) with Forward-Compatible Type-Only SDK Imports
- **[0.0.50](#0050---2026-07-08)** — Passport Sync Consumer: Read-Model Projection of Org/Membership/Entitlement/Identity-Link Events, Signed Sync Receive Endpoint, Role Projection, Entitlement Kill Switch & Nightly Reconciliation
- **[0.0.49](#0049---2026-06-16)** — Recipe Canvas Polish: Design-Token Migration (266 Hardcoded `zinc-*` Pairs Removed), Terracotta Active/Drop States, Reduced-Motion Support & Cost-Pill Contrast Fix
- **[0.0.48](#0048---2026-05-22)** — Tasting Session Inline Feedback: Collapsible Per-Dish Feedback Panel Replaces Modal
- **[0.0.47](#0047---2026-05-20)** — Tasting Session Dish Reordering: Drag-and-Drop Sequence Control for Session Creators
- **[0.0.46](#0046---2026-05-20)** — Tasting Session UX: Creator Auto-Enrolled as Participant, Insertion-Order Dishes & Organiser Badge
- **[0.0.45](#0045---2026-04-27)** — Canvas UX Polish: Simplified Ingredient Cost Display & Narrowed Table Item Column
- **[0.0.44](#0044---2026-04-24)** — Ingredient Line Cost in Canvas: Real-Time `qty × unit_price = cost` Display Across All Three Canvas View Modes
- **[0.0.43](#0043---2026-04-22)** — Decimal Input Fix: Codebase-Wide `type="number"` → `type="text" inputMode="decimal"` with Trailing-Zero Normalisation on Blur
- **[0.0.42](#0042---2026-04-22)** — Costing Engine Bug Fixes: Sub-Dish Unit Cost Display, Supplier/Ingredient Base-Unit Mismatch, Null Guard in Unit Conversion & Recipe List Per-Portion Cost Display
- **[0.0.41](#0041---2026-04-22)** — Sub-Dish Search & Race Condition Fixes: Parent Recipes Surface in Search When Sub-Dish Name Matches, Canvas & Overview Race Condition Guards
- **[0.0.40](#0040---2026-04-21)** — Costing Cache Invalidation, Canvas Sub-Recipe Autosave, Cost Display Fixes & Theme Token Cleanup
- **[0.0.39](#0039---2026-04-20)** — Sub-Recipe Portion Costing: Per-Portion Cost Hints, Expandable Ingredient Breakdown, Canvas Batch Cost Fix & Scaled Ingredient Display
- **[0.0.38](#0038---2026-04-17)** — Buy Catalogue Import: Single-Sheet FMH XLSX Import, Template Download & Efficiency Improvements
- **[0.0.37](#0037---2026-04-17)** — Ingredient Library UX: Supplier Names on Draggable Cards, Token-Based AND Search, Paginated Category Filter & Menu Archives Toggle
- **[0.0.36](#0036---2026-04-16)** — Menu Sketch Relational Refactor: Replace JSON sections/comments with relational tables, per-dish comments, recipe fork-on-edit, soft-delete & tasting session creation from menu
- **[0.0.35](#0035---2026-04-15)** — PostgreSQL Row-Level Security: Database-Layer Access Policies, RLS Helper Functions & Integration Tests
- **[0.0.34](#0034---2026-04-14)** — Ingredient Search, Filter & Sort Enhancements: Cross-Table Search, SKU-First FMH Upsert, Category Filter Pills & Server-Side Sorting
- **[0.0.33](#0033---2026-04-13)** — Menu Nav Restructure, Sketch Editor Overhaul & Dish Highlights / Icon Tags
- **[0.0.32](#0032---2026-04-07)** — Ingredient-Free Recipes & Inline Recipe Creation in Tasting Sessions
- **[0.0.31](#0031---2026-03-27)** — Menu Sketch Round 1 Feedback: UI Refinements, Delete Support & UX Polish
- **[0.0.30](#0030---2026-03-26)** — Menu Sketch UX Refinements: Design Tokens, Preview Fixes, Dish Comments Panel & Tiptap Notes Editor
- **[0.0.29](#0029---2026-03-26)** — Nav Restructure, Products Tab, Menu Sketch Enhancements & Supplier Ingredient Tags
- **[0.0.28](#0028---2026-03-25)** — Menu Sketch Canvas: Freeform JSON-section menu builder at `/menu-sketch` — `menus_sketch` table, CRUD + fork API, list & editor pages, TanStack Query hooks, TopNav updated from `/menu` → `/menu-sketch`
- **[0.0.27](#0027---2026-03-17)** — Playwright E2E Testing, FMH Import Optimization & Sample File Downloads: Full E2E test suite (213 tests), N+1→bulk DB round-trips (~2500→~6), FMH import modals, sample XLSX download endpoints & DropdownButton component
- **[0.0.26](#0026---2026-03-13)** — Cross-Category Unit Conversion in Canvas: Weight↔Volume unit switching (g/kg↔ml/l) with automatic quantity and price conversion in CanvasLayout ingredient table and cards
- **[0.0.25](#0025---2026-03-12)** — FMH Import Pipeline, Recipe-Category Search, Menu UX Enhancements, Recipe Category Soft Delete, Ingredient Filter Pagination & UI Polish
- **[0.0.24](#0024---2026-03-09)** — Lark Integration & Tasting UX: Lark DM Invitations, Add-to-Calendar Applink, Branded Email Template, Inline Recipe Feedback Modal, Derived Session Ingredients & Sequential Lark Fix
- **[0.0.23](#0023---2026-03-06)** — Performance Audit Fixes: Singleton Supabase Client, Local JWT Verification, N+1 Elimination, Centralized Outlet Hierarchy, Shared httpx Client & Bounded Costing Cache
- **[0.0.22](#0022---2026-03-06)** — Bug Fixes: Canvas Navigation, Recipe Creation Race Condition, Untitled Recipe Flash, Submit Button Logic, Tasting Session UX & Ingredient/Recipe Tasting DTOs
- **[0.0.21](#0021---2026-03-05)** — Participant-Only Feedback, Canvas Unit Price Auto-Conversion & Recipe Loading Fix
- **[0.0.20](#0020---2026-03-04)** — Server-Side Pagination & Performance: Paginated List Endpoints, Server-Side Search/Filtering, Database Indexes, Connection Pooling & Next.js Optimization
- **[0.0.19](#0019---2026-03-03)** — Outlet-Scoped Supplier Ingredients: Per-Outlet Pricing, Hierarchical Access Control & Outlet Selector UI
- **[0.0.18](#0018---2026-03-02)** — Supplier-Ingredient Normalization & UX Improvements: JSONB-to-Join-Table Refactor, Canvas Supplier Selection, Costing Integration, Session Creator Tracking, ID-Based Participants & Quick-Add Ingredients
- **[0.0.17](#0017---2026-02-27)** — UI Redesign & Performance Optimization: Canvas Layout Overhaul, Supplier UI Polish, Menu Publish/Unpublish & Backend Query Optimization
- **[0.0.16](#0016---2026-02-26)** — SMS Invitations, Tasting Participant Association & Menu Management: Twilio SMS Integration, User-Based Session Relationships & Drag-and-Drop Menu Reordering
- **[0.0.15](#0015---2026-02-23)** — Access Control & Allergen Management: Admin User Management, Hierarchical Access Control, Allergen Tracking & Supplier Soft Delete
- **[0.0.14](#0014---2026-02-12)** — Parent Outlet Recipes Display: Read-Only Table for Multi-Brand Recipe Management
- **[0.0.13](#0013---2026-01-28)** — Ingredient Tasting & Text-Based Features: Standalone Tasting Notes, Direct Ingredient Input, Collapsible UI & Image Support
- **[0.0.12](#0012---2026-01-21)** — Wastage, Outlets & Recipe Enhancements: Multi-Image Gallery, Outlet Hierarchy, Profit Margins, AI Feedback Summary & R&D Workflow
- **[0.0.11](#0011---2026-01-23)** — User Authentication & Recipe Categories: Supabase Auth Integration, Full CRUD Category Management, Tasting Note Images & Branding
- **[0.0.10](#0010---2025-12-18)** — Tasting Notes: R&D Feedback Tracking with Sessions, Ratings, Decisions & Recipe History Integration
- **[0.0.9](#009---2025-12-17)** — Bugfix: Enum-to-VARCHAR Mismatch Fix for Ingredients API + CORS Update for Vercel
- **[0.0.8](#008---2025-12-17)** — Frontend Multi-Page Expansion: Ingredients Library, Recipes Gallery, Recipe Detail, R&D Workspace, Finance Placeholder
- **[0.0.7](#007---2025-12-17)** — Recipe Extensions: Sub-Recipe BOM Hierarchy, Authorship Tracking, Outlet/Brand Attribution
- **[0.0.6](#006---2025-12-17)** — Ingredient Data Model Enhancements: Multi-Supplier Pricing, Master Ingredient Linking, Food Categories & Source Tracking
- **[0.0.5](#005---2025-12-03)** — AI-Powered Instructions Parsing: Vercel AI SDK + GPT-5.1 for Freeform→Structured Conversion, UX Improvements & CORS Fixes
- **[0.0.4](#004---2025-12-02)** — Backend Deployment: Fly.io Production Setup with Supabase PostgreSQL
- **[0.0.3](#003---2024-11-27)** — Database Migration: Alembic Initial Tables to Supabase + PostgreSQL JSON Compatibility Fix
- **[0.0.2](#002---2024-11-27)** — Frontend Implementation: Next.js 15 Recipe Canvas with Drag-and-Drop, Autosave & TanStack Query
- **[0.0.1](#001---2024-11-27)** — Backend Foundation: FastAPI + SQLModel with 17 API Endpoints, Domain Services & Unit Conversion
---

## [0.0.54] - 2026-07-15

### Fixed

#### Passport — an Armed, Silent Promotion to Global Admin

`role_projection.project_user()` derived Prepper's local flags from Passport and was **armed**: with brands now projected, the next login of any Passport org `Admin` (17 of 19 members are) would have silently made them a **global Prepper admin** — ingredient CRUD, every outlet, tasting bypass. Nothing would have errored.

It did two things rule 8 forbids by name:

- **Conflated the vocabularies.** `_ROLE_MAP` mapped the Passport **org** role onto `user_type`. Passport's model says an org `Owner`/`Admin` holds `Manager` **in** an app (the ladder) — not "admin **of**" it. The mapping invented a privilege Passport never granted.
- **Collapsed a per-brand MAP into one global flag.** `is_manager = "Manager" in roles.values()` — so a `Member` given `Manager` at *one* brand became a manager at *every* brand.

`project_user` and `_ROLE_MAP` are **deleted**. `revoke_local_grants` stays (rule 6): a removed member still loses their grants — revocation can only ever *reduce* access, which is the direction that is always safe. Nobody's current access changed.

#### Passport — Identity Links Applied Synchronously, Not via the Webhook

`report_identity_link` **returns** the link; Prepper discarded it and waited for the webhook. The link is the only bridge from Prepper's Supabase `sub` to a Passport platform user — without it a user resolves to no orgs, no brands and no roles. Waiting on asynchronous delivery left a window immediately after login where a user was authenticated with **zero access**. The returned link is now applied to the projection at once (insert-if-absent, so the webhook re-applying it is a harmless no-op).

### Added

#### Passport — Brand Roles UI + Projection-Backed Reads

`app/passport/directory.py` and three read endpoints (`/passport/brand-roles/{,brands,members}`) plus a **Brand Roles** tab in Settings: assign / change / remove `Manager`|`Staff` at a brand.

Reads come from the **projection**, not Passport's API. Proxying to Passport on the request path would defeat the point of projecting — the page would die during a Passport outage, add a network hop per render, and `403` for any user without an identity link. Writes still go **up** via write-back and come back **down** through sync; the UI never applies a mutation locally, because that would make Prepper the source of truth for a row it does not own.

Access helpers for the coming rule-8 switch: `org_role`, `is_org_admin`, `role_at_unit` (resolves an outlet through `belongs_to_brand` — people are held at brands; outlets *inherit*), `accessible_unit_ids`.

### Migration (written, NOT yet applied)

`p2rtunit3k4l` — **rule 7**: re-keys `recipe_outlets` / `menu_outlets` / `outlet_supplier_ingredient` (**8,637 rows**) from the serial `outlets.id` onto Passport unit UUIDs via the `external_ref` bridge, adds `organization_id` (rule 9, while the backfill is still a constant), drops `users.outlet_id` and the `outlets` shadow table. It **aborts rather than strand a single row**. The dependent code refactor (24 backend + ~10 frontend files) is not yet done, so this is not applied.

**Files changed:** `backend/app/passport/{access,directory,handlers,identity,role_projection,writeback}.py`, `backend/app/api/passport_roles.py`, `backend/alembic/versions/p2rtunit3k4l_*.py`, `backend/tests/test_passport_{directory,access,sync}.py`, `frontend/src/components/admin/BrandRolesTab.tsx`, `frontend/src/lib/hooks/usePassportRoles.ts`, `frontend/src/lib/api.ts`, `frontend/src/types/index.ts`, `frontend/src/app/settings/page.tsx`

---

## [0.0.53] - 2026-07-14

### Fixed

#### Passport — the Projection Was Silently Dropping Half the Contract

The consumer shipped in 0.0.50 projected only **four** of Passport's **eight** aggregates. `upsert_unit`, `archive_unit`, `create_relation` and `remove_relation` were explicit no-ops (`return  # conforming no-op`), and there were **no** `unit_app_access` / `unit_app_membership` handlers at all — so the SDK's `getattr` dispatch skipped them silently. Nothing errored; the receiver returned `200` to every event and discarded it.

The consequence was total, and invisible: Passport's access model is **derived** from the entitlement, the org role, the brand-app switch (`unit_app_access`) and the (user, brand, app) role row (`unit_app_membership`). Projecting none of the last three means `has_app_access` could only ever return `False`, and no Passport role could ever be derived for anyone.

- **`p1rtaccess1x2y`** — adds `passport_unit`, `passport_unit_relation`, `passport_unit_app_access`, `passport_unit_app_membership` (RLS enabled + forced, no client policies, Passport UUIDs adopted verbatim as PKs), plus a nullable `outlets.passport_unit_id` link column.
- **All 17 handlers** now exist and are asserted by `test_every_dispatched_handler_exists` / `test_no_dead_handlers`, which diff the class against the SDK's `_DISPATCH` table. A misnamed handler is a silent no-op, so this test is the only thing that catches one.
- **Access is derived via `passport_client.access`**, never hand-rolled — `has_app_access` / `roles_at_brands` are called with both `org_id` **and** `org_role`. Omitting `org_role` silently denies every org `Owner`/`Admin` (they hold `Manager` everywhere via the ladder, with zero role rows); `test_owner_with_no_role_rows_has_access` is the only check that catches it.

#### Passport — Nightly Reconciliation Was Never Actually Scheduled

`reconcile_nightly()` existed and was never invoked by anything. Webhook delivery is at-least-once, so a delivery lost during a deploy or outage left the projection permanently stale with no error. Added `.github/workflows/passport-reconcile.yml`: runs `python -m app.passport.reconcile` **inside** the deployed machine via `flyctl ssh console` (reusing its secrets — no new credentials, no scheduler thread in the web process), nightly at 02:00 SGT, failing red.

### Changed

#### Passport — Multi-Org Projection (No Single-Org Pin)

The receive path dropped every event whose `organization_id` differed from a configured `PASSPORT_ORG_ID` (11 `_wrong_org` guards). That is data loss the moment a second org is entitled — and it is silent. Passport's delivery filter has already decided what the app may see; re-deciding it locally only puts holes in the read model.

- Removed every org filter from the receive path and from reconciliation (the snapshot's scope **is** the delivery filter — filtering it to one org guarantees permanent phantom drift on every other).
- `org_id` is now a **request-path argument**, resolved from the acting user's membership in the projection, never a setting. The kill switch (`is_org_blocked`) is evaluated against the user's own orgs; `brand_roles` unions across them (safe — a brand UUID belongs to exactly one org, so no "active org" concept is needed); write-back derives the org from its **target** (a brand names its org; an assignment names its org), which makes acting across an org boundary unrepresentable rather than merely checked.
- `test_owner_of_one_org_gets_nothing_at_another_orgs_brands` covers the cross-org grant this prevents. Nothing else catches it.

### Added

#### Passport — Brand-App Role Write-Back

`app/passport/writeback.py` + `app/api/passport_roles.py`: list / assign / change / remove `Manager`|`Staff` at a brand, via the SDK's four `unit_app_membership` methods. Prepper enforces its own local role check first, then forwards the **end user's own** Supabase JWT (`end_user_token` → `X-End-User-Token`) so the acting user is *proved*, not asserted. A `403` (authority matrix) and a `409` (target is not a brand) are normal outcomes, surfaced verbatim. Requires Prepper's `issuer_url` to be registered in Passport — unregistered means every write-back, **and every identity-link report**, fails closed with a silently-swallowed `403`.

**Files changed:** `backend/alembic/versions/p1rtaccess1x2y_*.py`, `backend/app/models/passport.py`, `backend/app/passport/{handlers,store,access,identity,reconcile,role_projection,sync_router,writeback}.py`, `backend/app/api/{deps,auth,passport_roles}.py`, `backend/app/main.py`, `backend/tests/test_passport_{sync,access,writeback}.py`, `.github/workflows/passport-reconcile.yml`

---

## [0.0.52] - 2026-07-09

### Fixed

#### Build — Python 3.12 Floor Unblocks the Staging Deploy

The staging Fly deploy failed after ~74 minutes with `pip._vendor.resolvelib.resolvers.ResolutionTooDeep: 200000`. The message is a symptom, not the cause: `passport-client` (added in 0.0.50) declares `requires-python = ">=3.12"` on every published tag, while `backend/Dockerfile` built on `python:3.11-slim`. Because the SDK is a direct git reference, pip cannot fall back to an older version of it — the requirement has zero valid candidates, so the resolver backtracked through every other package's version space (visibly walking `python-multipart` 0.0.12 → 0.0.9, then starting on `pyjwt`) until it hit the 200000-round cap. The image's bundled **pip 24.0** reports the cap rather than naming the offending constraint; newer pip surfaces the real error, `Package 'passport-client' requires a different Python`.

- `backend/Dockerfile` — `python:3.11-slim` → `python:3.12-slim`. Also upgrades pip before installing: the bundled 24.0 turns an unsatisfiable constraint into a 45-minute backtracking storm instead of a one-line error, so the upgrade is load-bearing for future diagnosability, not cosmetic.
- `backend/pyproject.toml` — `requires-python` `>=3.11` → `>=3.12`. The old floor was simply untrue given the `passport-client` dependency, and understating it is what let pip thrash rather than fail fast.
- `.github/workflows/ci.yml` — CI runner Python `3.11` → `3.12`, keeping the gate matched to the image it guards.

Verified by a `flyctl deploy --build-only --remote-only` against `fly.stage.toml`: the `pip install` layer now completes in **26.5s** (previously 4450s before dying), `passport-client-0.1.0` builds and installs cleanly, and all compiled wheels resolve as `cp312`. No backtracking occurred. No release command ran and no machines were replaced, so the passport read-model migration remains unapplied.

**Dev-facing:** local virtualenvs now require Python 3.12+. `ruff`'s `target-version` and `mypy`'s `python_version` still read `py311`/`3.11`; these lag the real floor but are left alone deliberately — bumping ruff's target can activate new `UP` autofixes and turn CI red on existing code, which belongs in its own change.

**Files changed:**
- `backend/Dockerfile`, `backend/pyproject.toml`, `.github/workflows/ci.yml`

---

## [0.0.51] - 2026-07-09

### Added

#### Passport Sync Consumer — `org.resync` Manual Re-Sync Handler

Catch-up to the additive SDK 0.2.0 contract. Passport gained a super-admin **manual per-org re-sync**: from the dashboard it re-emits one org's full current state to a single app as one `org.resync` event, letting a drifted read model converge without waiting for the nightly `snapshot()` pass. Prepper now implements the 13th `SyncHandlers` method to consume it. Additive and dormant on the current pin — no runtime behaviour changes by default.

- `resync_org` (`backend/app/passport/handlers.py`) fans the bundle's six collections out through the **same per-aggregate handlers**, in FK-safe order (org → units → relations → memberships → links → entitlements). **Trap 3 — upsert-only:** it never deletes local rows absent from the bundle, and its `identity_links` (a per-org subset, not authoritative) never drive a pruning path. A bundle-level org guard drops a mis-routed bundle wholesale (still acked 2xx).
- SDK payload types are now imported under `TYPE_CHECKING` only. With `from __future__ import annotations` every annotation is a string touched purely by duck-typed attribute access, so `handlers.py` imports cleanly without the private SDK **and** can reference `ResyncPayload` (new in 0.2.0) while the branch is still pinned to an earlier tag — the method simply never fires until the pin carries `org.resync`. The receiver (`sync_router`) and client (`reconcile`) still require the SDK and remain guarded.
- `backend/tests/test_passport_sync.py` — two SDK-free tests assert the fan-out order + upsert-only invariant (no remove/delete handler is ever called) and that a wrong-org bundle is dropped.

**Activation note:** the handler is present but stays dormant until the `staging` pyproject pin advances from `passport-client-v0.1.0rc1` to `v0.2.0rc1` (Renovate's prerelease channel bump; `main` tracks the `v0.2.0` stable). The dispatch guard makes the interim safe: unknown on an older SDK, no-op if unimplemented.

**Files changed:**
- `backend/app/passport/handlers.py`, `backend/tests/test_passport_sync.py`

---

## [0.0.50] - 2026-07-08

### Added

#### Passport Sync Consumer — Read-Model Projection

Prepper is now a conforming Passport sync consumer. Passport is the source of truth for organisations, memberships/roles, and entitlements; Prepper projects those facts into local read-model tables from a signed webhook feed and reads them on its request path — it never mints these aggregates. The integration is dormant until configured (`PASSPORT_*` env + the private SDK installed), so this release changes no runtime behaviour by default.

- New read-model tables (`backend/app/models/passport.py`), Passport UUIDs adopted verbatim as string PKs: `passport_organization`, `passport_membership`, `passport_entitlement`, `passport_identity_link`. Alembic migration `p0rtsync9m0d1` creates them with RLS **enabled + forced** and no client policies (default-deny) — a read-only projection only the `BYPASSRLS` backend writes; member emails are unreachable by `anon` / `authenticated`.
- `backend/app/passport/store.py`: dialect-aware, version-guarded upsert (`INSERT … ON CONFLICT (id) DO UPDATE … WHERE excluded.version >= version`) — race-safe against concurrent deliveries and idempotent on replay / out-of-order events (guard is `>=`, not `>`).
- Signed sync receive endpoint mounted at `/api/v1/passport/sync` via the SDK's `build_sync_router` (HMAC verify → stale `schema_version` → version-guarded apply → 2xx only after commit). Handlers for all 12 event types; `membership.removed` keeps the row as a `status=removed` tombstone (not a delete); entitlement revocation is applied via `entitlement.upserted` with a non-active status. Prepper does not project Passport units — its serial-PK `outlets` table is untouched and those handlers are conforming no-ops.

#### Role Projection & Entitlement Kill Switch
- Passport org role → local `users.user_type` (Owner/Admin → admin, Member → normal). `membership.removed` demotes and revokes local unit-scoped grants (`is_manager`, `outlet_id`).
- Identity link reported to Passport on every login / register / OAuth completion (best-effort; a no-op when Passport is unconfigured and never blocks login).
- Org-level entitlement kill switch (`backend/app/passport/access.py`) wired into `get_current_user` — blocks the whole org when its entitlement is synced and non-active, and **fails open** until entitlements are synced so existing behaviour is preserved.

#### Reconciliation, Tests & Dependency Wiring
- Nightly server-side reconciliation via a single `snapshot()` call (`python -m app.passport.reconcile`) — a scheduled job, not client polling.
- `backend/tests/test_passport_sync.py` — 11 tests covering the version guard, both traps, immutable insert-if-absent / delete-if-present, role projection with grant revocation, and the entitlement kill switch (including fail-open).
- Private `passport-client` SDK added to `pyproject.toml` (two-channel Renovate: `staging` tracks prerelease `rc` tags, `main` tracks stable); root `renovate.json` opens CI-gated bump PRs on new tags. PR workflow `.github/workflows/ci.yml` installs the private SDK (reusing the `EBB_PACKAGES_TOKEN` secret), import-smoke-tests `passport_client`, and runs ruff + pytest — the gate Renovate auto-merge waits on.

**Files changed:**
- `backend/app/models/passport.py`, `backend/app/models/__init__.py`
- `backend/app/passport/` — `store.py`, `role_projection.py`, `access.py`, `handlers.py`, `sync_router.py`, `identity.py`, `reconcile.py`
- `backend/app/api/auth.py`, `backend/app/api/deps.py`, `backend/app/config.py`, `backend/app/main.py`
- `backend/alembic/versions/p0rtsync9m0d1_add_passport_read_model.py`
- `backend/tests/test_passport_sync.py`, `backend/.env.example`, `backend/pyproject.toml`, `renovate.json`, `.github/workflows/ci.yml`

---

## [0.0.49] - 2026-06-16

### Changed

#### Recipe Canvas — Design-Token Migration

The recipe canvas (`CanvasTab.tsx`) was built with hardcoded `zinc-*` light/dark Tailwind pairs instead of the project's HSL design-system tokens. The cold neutral greys fought the warm terracotta/parchment brand and made the canvas read as a generic dashboard. Migrated the full surface to semantic tokens — no behaviour change.

- **`CanvasTab.tsx`**: replaced 266 hardcoded `zinc-*` usages across all three view modes (grid/list/table), the header, metadata panel, and bottom bar. Surfaces → `bg-background` / `bg-card` / `bg-secondary`; borders → `border-border` / `border-input`; text → `text-foreground` / `text-muted-foreground`; inputs → `bg-secondary border-input`. Zero hardcoded neutral classes remain. The add-ingredients textarea's stray `focus:ring-blue-500` now uses `ring` (terracotta).
- **`CanvasLayout.tsx`**: tokenised the back-link chrome bar (`border-border/60`, `bg-background`, `text-muted-foreground`).

#### Recipe Canvas — Warm Active & Drop States

- View-mode toggle active state changed from cold `bg-blue-100 … text-blue-600` to `bg-primary/15 text-primary` (terracotta), matching the active-state convention introduced in 0.0.40.
- Drop-zone hover highlight changed from `border-blue-400 bg-blue-50/50` to `border-primary bg-primary/5`, so the primary tactile drag interaction now gives on-brand feedback. Added `duration-200` for a smoother transition.

The intentional `game-card` aesthetic (blue ingredient / green recipe "rarity") and colour type-coding (pips, category tags, profit/loss, unsaved-amber) were deliberately left unchanged.

### Fixed

#### Accessibility — Reduced Motion & Cost-Pill Contrast

- **`globals.css`**: added a `@media (prefers-reduced-motion: reduce)` reset (none existed app-wide) that neutralises transitions, animations, and smooth scroll. Covers the canvas `game-card` hover-lift, drop transitions, and `flow-ui` utilities.
- **`CanvasTab.tsx`**: the header cost-summary pills (Batch / per-portion / Sell / profit) were `text-muted-foreground` on `bg-secondary` (~2.9–3.5:1, below WCAG AA at 12 px). Strengthened to `text-foreground/80` so the cost figures finance relies on are legible.

**Files changed:**
- `frontend/src/components/layout/tabs/CanvasTab.tsx`
- `frontend/src/components/layout/CanvasLayout.tsx`
- `frontend/src/app/globals.css`

---

## [0.0.48] - 2026-05-22

### Changed

#### Inline Collapsible Feedback Panel Replaces Recipe Feedback Modal

Dish feedback in tasting sessions is now surfaced inline, directly under each dish row, instead of opening a separate full-screen modal.

- **`DishFeedbackPanel.tsx`** (new): self-contained collapsible body rendered below each dish row. Calls `useSessionNotes(sessionId)` — shares the same TanStack Query cache key already fetched at the page level, so no extra request is made. Filters notes by `recipe_id` and renders a `FeedbackNoteCard` per note with full edit/delete support. Participants see a collapsible "Add Feedback" section at the bottom (chevron toggle) that expands a full `FeedbackForm` with image support inline. Non-participants see notes read-only with no add section.
- **`tastings/[id]/page.tsx`**: each `SortableDishItem` now has a chevron "Feedback" toggle button on the right of the dish row. `SessionRecipesSection` holds `expandedDishId` accordion state (one dish open at a time) and passes `isExpanded` / `onToggle` / `sessionId` / `currentUserId` / `isParticipant` down to each item. Removed `selectedRecipeIdForModal` state and the `RecipeFeedbackModal` render block. Removed `onRecipeClick` prop from `SessionRecipesSectionProps`.
- **`RecipeFeedbackModal.tsx`** (deleted): fully removed; all feedback surfaces now use the inline panel.

---

## [0.0.47] - 2026-05-20

### Added

#### Drag-and-Drop Dish Reordering in Tasting Sessions

- **Backend** (`recipe_tasting.py`): added `sequence: Optional[int]` column to `RecipeTasting`. Added `RecipeTastingReorderItem` (id + sequence) and `RecipeTastingReorderRequest` (list of items) schemas. `RecipeTastingRead` now exposes the `sequence` field.
- **Backend** (`recipe_tasting_service.py`): added `reorder_session_dishes(session_id, items)` method that validates all provided IDs belong to the session then bulk-updates their `sequence` values in a single transaction. Returns `False` if any ID is foreign to the session. Default dish listing now orders by `sequence ASC NULLS LAST, id` so newly-ordered dishes render predictably.
- **Backend** (`recipe_tastings.py`): new `PATCH /{session_id}/recipes/reorder` endpoint (204 No Content). Creator-only; returns 400 if any dish ID does not belong to the session.
- **Frontend** (`types/index.ts`): added `ReorderSessionDishItem` and `ReorderSessionDishesRequest` interfaces; added `sequence?: number | null` to `RecipeTasting`.
- **Frontend** (`api.ts`): added `reorderSessionDishes(sessionId, data)` typed fetch call.
- **Frontend** (`useTastings.ts`): added `useReorderSessionDishes` mutation hook; on success invalidates `['tasting-session', sessionId, 'recipes']`.
- **Frontend** (`tastings/[id]/page.tsx`): extracted `SortableDishItem` component with a `GripVertical` drag handle (creator-only, `touch-none`). `SessionRecipesSection` now wraps the dish list in `DndContext` + `SortableContext` from `@dnd-kit/sortable`. Drag end debounces the `onReorderDishes` call by 2 s so the server write is deferred while the UI stays responsive. Local optimistic state (`localDishes`) syncs back from the server whenever `sessionRecipes` changes (add/remove).

---

## [0.0.46] - 2026-05-20

### Changed

#### Creator Auto-Enrolled as Participant on Session Creation

- **Backend** (`tasting_session_service.py` → `create()`): when a new tasting session is created the `creator_id` is now automatically prepended to the participants list before `_add_participants` is called. If the creator was already included in `participant_ids` from the request body, deduplication in `_add_participants` prevents a duplicate row. Creators will therefore always appear in their own participant list with full access rights.

#### Dishes Ordered by Insertion, Not Alphabetically

- **Frontend** (`tastings/[id]/page.tsx`): removed the client-side `.sort((a, b) => localeCompare)` that was reordering dishes alphabetically. Dishes now render in the order returned by the backend, which orders by `RecipeTasting.id` (insertion order). No model or API changes required.

#### Creator Cannot Be Removed from Participants; Organiser Badge

- **`ParticipantPicker.tsx`**: added `creatorId?: string` prop. The creator's participant chip no longer renders an X button, preventing accidental self-removal. The creator's chip also displays an `(Organiser)` suffix at reduced opacity.
- **`tastings/[id]/page.tsx`**: passes `creatorId={session.creator_id}` to `ParticipantPicker`. The read-only participant badge view (shown to non-creator participants and admins) also appends `(Organiser)` to the creator's name.

---

## [0.0.45] - 2026-04-27

### Changed

#### Simplified Ingredient Cost Display in Canvas
- **What**: Removed the full equation preamble (`qty × $price/unit =`) from every cost display in the canvas. Each location now shows the formatted line cost (`$X.XX`) only.
- **Why**: The breakdown notation was redundant — chefs already know the quantity and unit from the row itself. Showing just the resulting cost is faster to scan.
- **Grid view** (`StagedIngredientCard`): cost pill shows `$X.XX` instead of `2 kg × $3.50/kg = $7.00`.
- **List view** (`StagedIngredientListItem`): meta row shows `$X.XX` instead of the full formula.
- **Table view** (`CanvasTable` cost column): shows `$X.XX` instead of `qty × $price/unit = $total`.
- **Expanded recipe card — ingredient list**: shows line cost instead of `$unit_price = $line_cost`.
- **Expanded recipe card — scaled/green breakdown**: shows `{scaledQty} {unit} $X.XX` instead of `{qty} @ $price/unit = $cost`.
- **Ingredient edit row** (`RecipeIngredientRow`): dropped `= ` prefix from the inline line cost beside the unit price field; added `tabular-nums` for alignment.

#### Table View Item Column Width
- **What**: Added `w-48` to the Item column header in `CanvasTable`.
- **Why**: Without a fixed width the Item column expanded to fill all remaining horizontal space, pushing Qty / Unit / Wastage controls to the far left.

---

## [0.0.44] - 2026-04-24

### Added

#### Ingredient Line Cost Display in Canvas (All 3 View Modes)
- **What**: Each ingredient row in the canvas now shows the full cost calculation inline: `{qty} {unit} × ${unit_price}/{unit} = {cost}`.
- **Why**: Chefs need to fact-check total dish cost per ingredient as they build — seeing the raw unit price alone doesn't make the actual spend visible when quantities are small (e.g. 0.016 pcs × $7.50/pcs = $0.12).
- **Grid view** (`StagedIngredientCard`): calculation displayed in the cost row at the bottom of each ingredient card; cost is bolded for scannability.
- **List view** (`StagedIngredientListItem`): calculation displayed inline in the ingredient metadata row, bolded cost.
- **Table view** (`CanvasTable`): new "Cost" column added; each ingredient row shows the full formula right-aligned.
- **Canvas editing panel** (`RecipeIngredientRow`): line cost shown beside the unit price field (`= $0.12`) in real-time, computed from local state so it updates instantly as quantity or price is typed — no wait for debounce/save.

---

## [0.0.43] - 2026-04-22

### Fixed

#### Decimal Typing in All Numeric Inputs (Codebase-Wide)
- **Root cause**: HTML `type="number"` inputs return `""` for intermediate float states (e.g. typing `"0."` mid-entry), causing React controlled inputs to either clear the field or snap to a fallback value. This made it impossible to type decimals like `0.005` or `1.25` without the field resetting.
- **Fix**: replaced `type="number"` with `type="text" inputMode="decimal"` across every numeric input in the frontend. Removed `min`, `step`, and `max` HTML attributes from the underlying `<input>` elements (validation happens on save, not on the DOM).
- **Trailing-zero normalisation**: all inputs now strip trailing zeros on blur (e.g. `"1.50"` → `"1.5"`, `"2.00"` → `"2"`), matching the existing behaviour of the `NumericInput` component used in the CanvasTab metadata panel.

**Files changed:**
- `components/ui/EditableCell.tsx` — maps `type="number"` prop to `type="text" inputMode="decimal"` on the underlying input; normalises value before calling `onSave` in `handleBlur`
- `components/ui/NumericInput.tsx` — already correct; used as the reference implementation
- `components/layout/tabs/CanvasTab.tsx` — replaced `yield_quantity` and `selling_price` `<Input type="number">` with `<NumericInput>` (Group C)
- `components/layout/tabs/OutletsTab.tsx` — attr swap + blur normalisation on `editingPrice`
- `components/layout/tabs/AddOutletModal.tsx` — attr swap + blur normalisation on `priceOverride`
- `components/layout/RightPanel.tsx` — attr swap + blur normalisation on `cost`
- `components/recipe/InstructionStepCard.tsx` — attr swap + blur normalisation on `localTemp`
- `components/ingredients/AddIngredientModal.tsx` — attr swap + blur normalisation on `cost`, `pack_size`, `price_per_pack`
- `components/menu/MenuBuilder.tsx` — switched both `display_price` inputs from controlled `value/onChange` to uncontrolled `defaultValue/onBlur`; normalises display value in the blur handler (Group D)
- `app/suppliers/[id]/page.tsx` — modal inputs attr swap + blur normalisation; inline table `editData` changed from numeric to string fields (local `IngredientRowEdit` interface), parses `parseFloat` only on save
- `app/outlets/[id]/page.tsx` — modal input attr swap + blur normalisation; inline table `editData` changed from `number | null` to `string`, parses on save
- `app/ingredients/[id]/page.tsx` — modal inputs attr swap + blur normalisation; inline table `editData` string fields (local `SupplierRowEdit` interface), parses on save
- `app/menu-sketch/[id]/page.tsx` — 4 uncontrolled price inputs (DishCard + DishRow sale/cost) attr swap + blur normalisation via `e.target.value = String(val)`

**Verification:** `npx tsc --noEmit` passes with zero errors.

---

## [0.0.42] - 2026-04-22

### Fixed

#### Costs Tab — Sub-Dish Unit Cost Column Shows Wrong Value
- The "Cost per Unit" column in the Sub-Dishes table previously always showed `sub_recipe_portion_cost` regardless of which unit the sub-dish was linked with. For a sub-dish measured in `batch`, the displayed cost was the child recipe's cost-per-portion (wrong); for `g`/`ml` it was similarly wrong, even though the `line_cost` calculation in the backend was already correct
- Fixed: unit cost now resolves per unit type — `portion` → `sub_recipe_portion_cost`, `batch` → `sub_recipe_batch_cost`, `g`/`ml` → derived from `line_cost / quantity` (consistent with the backend's actual calculation). The unit label updates accordingly (`/portion`, `/batch`, `/g`, `/ml`)
- This supersedes the 0.0.40 entry that incorrectly described "always uses `sub_recipe_portion_cost`" as correct behaviour

#### Costing Engine — Supplier Price Paired with Wrong Base Unit (up to 1000× error)
- When a supplier ingredient was linked and `RecipeIngredient.base_unit` was already set to a unit that differed from `SupplierIngredient.pack_unit` (e.g. `ri.base_unit = "g"` but `si.pack_unit = "kg"`), the supplier's price-per-pack-unit was used but the quantity was converted to `ri.base_unit` — off by a factor of 1 000 for g/kg and ml/l mismatches
- Fixed in `costing_service.py`: `base_unit` is now always set to `si.pack_unit` when supplier pricing is applied, not only when `base_unit` is `None`
- Applies to both mass units (g/kg, oz/lb) and volume units (ml/l, tsp/tbsp/cup)

#### Costing Engine — Ingredient Fallback Price Paired with Wrong Base Unit
- When falling back to `ingredient.cost_per_base_unit` (no supplier, no manual price), `base_unit` was only set to `ingredient.base_unit` if it was `None`. If `ri.base_unit` was set to a different unit (e.g. `"l"` while `ingredient.base_unit = "ml"`), the price per `ingredient.base_unit` was combined with a quantity converted to `ri.base_unit`, producing a 1 000× error
- Fixed: `base_unit` is now unconditionally set to `ingredient.base_unit` for this fallback path, since `ingredient.cost_per_base_unit` is definitionally per `ingredient.base_unit`

#### Costing Engine — `convert_to_base_unit` Crashes on `None` Base Unit
- `convert_to_base_unit` called `.lower()` on `to_base_unit` with no `None` guard, causing an `AttributeError` if `base_unit` was unresolvable (e.g. `ri.unit_price` set without `ri.base_unit`)
- Fixed: function now returns `None` immediately when `to_base_unit is None`, allowing the caller's existing `None`-check to route the ingredient into `missing_costs`

#### Costing Engine — Dead Code in `_calculate_sub_recipe_line_cost`
- An intermediate `batch_fraction` computation (`quantity / (yield_quantity²)`) was immediately overwritten on the next line. Removed

#### Recipe List — Cost Per Portion Shows Batch Cost Instead of Per-Portion Cost
- On the `/recipes` list page (both grid and list views) and the `/rnd` page, `recipe.cost_price` (the total batch cost stored by the canvas) was displayed with a `/portion` label without being divided by `yield_quantity`. The `/recipes/[id]` detail page was correct because it fetches `CostingResult.cost_per_portion` directly from the costing endpoint
- Fixed in `RecipeCard.tsx`, `RecipeListRow.tsx`, and `rnd/page.tsx`: cost is now displayed as `cost_price / yield_quantity` when `yield_quantity > 0`, matching the per-portion value shown on the detail page

---

## [0.0.41] - 2026-04-22

### Added

#### Recipe Search — Sub-Dish Name Matching
- Searching the recipe list now also returns parent recipes whose sub-recipes match the search term. For example, searching "Hollandaise" surfaces both the "Hollandaise Sauce" recipe and any parent dish (e.g. "Eggs Benedict") that uses it as a sub-recipe
- Backend: `recipe_service.list_recipes()` extended with a sub-query that matches `RecipeRecipe.parent_recipe_id` where the child recipe name matches, ORed with the existing name + category matches
- Backend: new `GET POST /recipes/sub-recipes/batch` endpoint (`SubRecipeService.get_has_sub_recipes_batch()`) returns a `dict[recipe_id, bool]` in a single query — no N+1
- Frontend: `getSubRecipesBatch` API call + `useSubRecipesBatch` TanStack Query hook; `RecipeManagementTab` uses the batch result to set a `matchedViaSubDish` flag per recipe
- `RecipeCard` and `RecipeListRow` show a "Via Sub-dish" badge when the recipe was surfaced via a sub-dish match rather than a direct name match
- Regression test: `test_list_recipes_search_by_sub_dish_name` verifies the parent recipe is returned and unrelated recipes are excluded

### Fixed

#### Canvas — Stale Recipe Load Race Condition
- `CanvasTab` now guards on `selectedRecipeData` being defined before loading the canvas. Previously, if `selectedRecipeData` was still `undefined` when the load effect fired, the canvas could initialise with stale data from the previously selected recipe
- Removed `recipes` from the canvas load effect dependency array; including the full recipe list caused spurious re-runs whenever any recipe in the list was refreshed, potentially clobbering in-progress canvas edits

#### Overview Tab — AI Summary Saved to Wrong Recipe
- Added `summaryForRecipeIdRef` to track which recipe an AI feedback summary was requested for. The `useEffect` that persists the summary now only runs if `summaryForRecipeIdRef.current === selectedRecipeId`, preventing the summary from being written to a different recipe if the user navigated away while the (potentially slow) AI call was in-flight

#### Overview Tab — Stale UI State on Recipe Change
- Recipe change now resets all transient interaction state: `isEditingName`, `isEditingDescription`, `isTagDropdownOpen`, `isFeedbacksOpen`, and `tagSearchFilter`. Previously, open dropdowns or active name-edit mode would persist after switching recipes, causing confusing UI behaviour

---

## [0.0.40] - 2026-04-21

### Fixed

#### Canvas Builder — Sub-Recipe Cost Calculation
- `calculateCanvasCost()` in `CanvasTab` no longer double-divides by `yield_quantity`. `recipe.cost_price` is already stored as cost-per-portion by the backend's `persist_cost_snapshot`; the previous `/yieldQty` division caused sub-recipe costs to be understated by a factor of the yield

#### Canvas Builder — Sub-Recipe Quantity Autosave
- Changing the quantity of an existing staged sub-recipe card now persists to the backend via a debounced (500 ms) `updateSubRecipe` mutation. Previously, quantity edits were canvas-local only and lost on navigation. Implemented with a per-item timer ref (`subRecipeUpdateTimers`) to avoid flooding the API on rapid slider/input changes

#### Costs Tab — Sub-Recipe Unit Cost Display
- Unit cost column now always uses `sub_recipe_portion_cost` regardless of the link's `unit` field, matching the per-portion semantics used everywhere else in costing
- Unit label next to the cost now shows the child recipe's yield unit (e.g. `portion`, `kg`) instead of the raw `item.unit` string from the costing payload
- "Sub-Recipe Costs" section heading renamed to "Sub-Dishes Costs" for consistency with the rest of the UI

#### Backend — Costing Cache Invalidation on Sub-Recipe Mutations
- `add_sub_recipe`, `update_sub_recipe`, and `remove_sub_recipe` endpoints now call `evict_costing_cache(recipe_id)` after a successful mutation, ensuring the next `GET /{recipe_id}/costing` recomputes fresh instead of returning a stale cached value
- Added `evict_costing_cache()` helper on the costing router (used by the sub-recipes router) to keep cache management co-located with the cache definition

### Changed

#### Theme Token Cleanup
- Active canvas tab indicator changed from hardcoded `bg-zinc-900 text-white / dark:bg-zinc-100 dark:text-zinc-900` to `bg-primary text-primary-foreground`, picking up the design-system colour token in both light and dark modes
- "Owned" badge on `RecipeCard` migrated from `bg-black text-white / dark:bg-white dark:text-black` to `bg-primary text-primary-foreground` for the same reason

### Fixed (Tests)

#### Auth Test Suite — `_ebb_verify_token` Mock
- `mock_supabase_client` fixture in `test_auth.py` now also patches `app.domain.supabase_auth_service._ebb_verify_token` so `verify_token()` works without a live Supabase/JWT service. A small `MockIdentity` class and a token→user-id lookup table cover the four tokens used across the auth test suite

---

## [0.0.39] - 2026-04-20

### Added

#### Sub-Recipe Portion Scaling (SubRecipesList)
- Sub-recipe rows now display `· yields N unit` metadata beneath the recipe name when `yield_quantity > 1`
- Per-portion cost hint (`$X.XX/portion` in amber) shown inline on each sub-recipe row using `sub_recipe_portion_cost` from the costing API — no extra fetch, reuses the existing `useCosting` call
- `AddSubRecipeForm` shows a yield hint after recipe selection: "Yields N unit per batch" when `yield_quantity > 1`, or a softer tip to set yield when it defaults to 1

#### CostsTab — Sub-Recipe Cost Context & Ingredient Drill-Down
- **Scale context**: `SubRecipeCostTable` rows show an amber secondary line (`"1 of 300 portions"`) when `unit === 'portion'` and child `yield_quantity > 1`, making the batch fraction immediately visible
- **Expandable ingredient breakdown**: clicking the `▶` chevron on any sub-recipe row expands it to show that sub-recipe's constituent ingredients with costs prorated to the quantity being used (`ingredient.line_cost × parentQuantity / childYield`); collapses on second click
- `SubRecipeIngredientBreakdown` component fetches child recipe costing via `useCosting(childRecipeId)` (TanStack Query cached); renders indented ingredient rows with unit cost and prorated line cost columns

### Fixed

#### Canvas Builder — Batch Cost Calculation
- Fixed `calculateCanvasCost()` in `CanvasTab`: `recipe.cost_price` stores the full *batch* cost; the function was multiplying it directly by `staged.quantity` (portions), resulting in per-batch pricing for sub-recipes with `yield_quantity > 1`. Now divides by `yield_quantity` first: `costPerPortion = cost_price / yieldQty`, then `totalCost += staged.quantity × costPerPortion`

#### Canvas Builder — Zero Quantity Prevention
- All six staged item quantity inputs (ingredients and recipes across card / list / table views) now floor at `0.01` — `|| 0` replaced with `|| 0.1` in onChange handlers and `min="0.01"` set on inputs. Wastage, yield, and selling price fields are unchanged

#### Canvas Builder — Scaled Ingredient Display in Sub-Recipe Cards
- Ingredients listed inside an expanded staged recipe card now show quantities scaled to the portion fraction being used: if a recipe uses 1 kg for 2 portions and the canvas quantity is set to 1, the card displays `0.5 kg`. Formula: `ri.quantity × (staged.quantity / yield_quantity)`, formatted to 3 decimal places with trailing zeros stripped

---

## [0.0.38] - 2026-04-17

### Added

#### Buy Catalogue Import (Plan 28)
- New single-sheet XLSX import for the `EXPORT_BUY_CATALOGUE` FMH format — all data (outlet, supplier, SKU, category, pricing) in one file with no pre-import step required
- `import_buy_catalogue(session, wb)` in `fmh_import_service.py`: two-phase approach — Phase 1 pure in-memory mapping, Phase 2 bulk upserts with a single `session.commit()`
- Column mapping: `Branch Name` → `Outlet`, `Supplier Name` → `Supplier`, `Sku` → `SupplierIngredient.sku`, `Category Name` → `Category`, `Packaging Note` → `base_unit` + cost divisor via new `_parse_pack_from_note()` helper
- SKU prefix (e.g. `HENT` from `HENT-FD-POULTRY-000003`) set as `Supplier.code` for new suppliers only
- Duplicate handling: Ingredient and SupplierIngredient overwrite on SKU match; Supplier, Category, Outlet, OutletSupplierIngredient skip on duplicate
- Extended `_UNIT_MAP` with full FMH abbreviation set (`gm`, `gms`, `gr`, `kgs`, `kilo`, `mls`, `lt`, `ltr`, `litre`, `liter`, `pce`, `piece`, `pieces`, `unit`, `units`)
- `POST /ingredients/buy-catalogue-import` — admin-only endpoint, `.xlsx` guard, returns `FMHImportResult`
- `GET /ingredients/buy-catalogue-template` — returns blank XLSX with correct headers + one example row (no storage dependency)

#### Frontend
- `importIngredientsBuyCatalogue(file)` and `downloadBuyCatalogueTemplate()` API functions in `api.ts`
- `BuyCatalogueImportModal` component — single file input, success toast with ingredient/supplier/outlet/category counts, invalidates `ingredients`, `categories`, `outlets`, `suppliers` query keys
- **"Buy Catalogue (FMH)"** `DropdownButton` on the Ingredients page (Download Template + Import items) alongside the existing FMH button

### Changed

#### Import Service Efficiency
- `import_buy_catalogue`: replaced three full-table scans (`select(Outlet/Category/Supplier).all()` + Python filter) with targeted `func.lower(col).in_(keys)` queries — pushes filtering to DB, only fetches matching rows

---

## [0.0.37] - 2026-04-17

### Added

#### Ingredient Library: Supplier Name on Draggable Cards
- `IngredientListRead` DTO gains a `supplier_names: list[str]` field, populated via a single bulk JOIN (preferred supplier first, then alphabetical)
- `DraggableIngredientCard` in `RightPanel.tsx` now shows supplier name, category, and unit/price on separate rows beneath the ingredient name

#### Ingredient Search: Token-Based AND Matching
- Multi-word search strings (e.g. `phoon huat baking sheet`) are split on whitespace; each token becomes an OR condition across `ingredient.name` / `supplier.name`, and all tokens are AND-ed together
- Single-token behaviour is unchanged; results now correctly intersect across supplier and ingredient name fields

#### Right Panel Category Filter: Pagination & Vertical Scroll
- Category pill container switches from `useCategories` (all) to `useIngredientsWithCategoriesPaginated` (10 per page)
- Pages accumulate in local state; a **"See more"** button loads the next page on demand
- Pill container gains a constrained height with vertical scroll so the filter list never overflows the panel

#### Menu Sketch Archives Toggle
- `GET /menu-sketches` accepts new `include_archived` query param (default `false`); service filters out `status = archived` sketches unless flag is set
- `/menu-sketch` and `/menu` list pages gain a **"View Archives"** checkbox; archived sketches display a styled **Archived** badge when the toggle is enabled

---

## [0.0.36] - 2026-04-16

### Added

#### Menu Sketch Relational Refactor (Plan 27)

**Database Migration**
- Alembic migration drops JSON `sections` and `comments` columns from `menus_sketch`
- Added `status` (`draft` / `archived`, default `draft`) and `root` (nullable FK → `menus_sketch.id`) columns to `menus_sketch`
- New table `menu_sketch_section` — relational sections with `name`, `menu_sketch_id`, `order_no`
- New table `menu_sketch_section_item` — per-dish rows with `name`, `sales_price`, `cost_price`, `margin`, `description`, `is_highlight`, `icons`, `recipe_id` (optional FK), `order_no`
- New table `menu_sketch_section_item_comments` — per-dish comment threads with `text`, `resolved`; all cascade-delete from parent

**Backend Models**
- `MenuSketch` model updated: removed `sections`/`comments`, added `status` and `root`
- New model files: `menu_sketch_section.py`, `menu_sketch_section_item.py`, `menu_sketch_section_item_comment.py`
- Aggregated DTOs: `CommentRead`, `DishCommentsRead`, `MenuSketchCommentsResponse`

**Backend Services**
- `menu_sketch_service.py`: soft-delete (sets `status = archived`), list filters archived, fork sets `root`
- New `menu_sketch_section_service.py`: create, delete (cascade), list sections
- New `menu_sketch_section_item_service.py`: create, update with fork-on-feedback logic (forks recipe if tasting notes exist), delete (recipe untouched)
- New `menu_sketch_section_item_comment_service.py`: aggregated comments view, create, update, resolve, delete

**Backend API**
- `DELETE /menu-sketches/{id}` now soft-deletes (sets `status = archived`)
- New router `menu_sketch_sections.py`: `POST /menu-sketch-sections`, `DELETE /menu-sketch-sections/{id}`
- New router `menu_sketch_section_items.py`: `POST`, `PATCH /{id}`, `DELETE /{id}`
- New router `menu_sketch_section_item_comments.py`: `GET /menu-sketch/{id}`, `POST`, `PATCH /{id}`, `PATCH /resolve/{id}`, `DELETE /{id}`
- All three routers registered in `main.py` under `/api/v1/`

**Backend Tests** (`tests/test_menu_sketch_relational.py`)
- 11 tests covering: section validation, cascade deletes, item CRUD, recipe fork-on-feedback, comment aggregation, resolve, soft-delete, fork root tracking

**Frontend Types & API**
- `MenuSketch`, `MenuSketchSection`, `MenuSketchSectionItem`, `MenuSketchSectionItemComment`, `DishCommentsRead`, `MenuSketchCommentsResponse` interfaces updated/added in `types/index.ts`
- 10 new API functions added to `api.ts` for all new endpoints

**Frontend Hooks** (`useMenuSketches.ts`)
- New hooks: `useMenuSketchSections`, `useCreateMenuSketchSection`, `useDeleteMenuSketchSection`, `useMenuSketchSectionItems`, `useCreateMenuSketchSectionItem`, `useUpdateMenuSketchSectionItem`, `useDeleteMenuSketchSectionItem`, `useMenuSketchComments`, `useCreateMenuSketchComment`, `useUpdateMenuSketchComment`, `useResolveMenuSketchComment`, `useDeleteMenuSketchComment`

**Frontend Pages & Components**
- Menu sketch editor (`/menu-sketch/[id]/page.tsx`) rewritten to use relational data: section + item hooks replace JSON state
- `MenuBuilder` component refactored: removes JSON section/dish state, data flows from relational hooks, drag-and-drop calls `useUpdateMenuSketchSectionItem({ order_no })`
- `CommentsPanel.tsx` / `DishCommentsModal.tsx` refactored to use new comment hooks
- Per-dish unresolved comment count badge retained in edit mode
- Dish selection checkboxes + "Create Tasting Session" button navigate to `/tastings/new` with pre-selected dish IDs via URL query params
- `/tastings/new/page.tsx` accepts `dish_ids` query param and pre-populates session recipe list

---

## [0.0.35] - 2026-04-15

### Added

#### PostgreSQL Row-Level Security (RLS)
- Alembic migration `h1i2j3k4l5m6` enables RLS on all 29 tables and creates policies that mirror the existing permission model (admin / manager / normal user)
- RLS applies to direct Supabase client connections (`authenticated` role); the FastAPI service role retains `BYPASSRLS` so backend behaviour is unchanged
- Policies enforce silent filtering on SELECT and error-on-write for unauthorised rows

#### RLS Helper Functions
- Eight reusable PostgreSQL functions in the `public` schema:
  - `current_user_id()` — reads `auth.uid()` from the Supabase JWT
  - `is_admin()` — true when `user_type = 'admin'`
  - `is_manager_or_admin()` — true for admins and users with `is_manager = true`
  - `can_access_recipe(int)` — owner OR public OR admin (SELECT gate)
  - `owns_recipe(int)` — owner OR admin (write gate)
  - `can_access_tasting_session(int)` — creator OR participant OR admin (SELECT gate)
  - `owns_tasting_session(int)` — creator OR admin (write gate)
  - `can_access_menu(int)` — creator OR manager/admin (SELECT + write gate)
- Helper scripts in `backend/scripts/helpers/` allow re-applying individual functions without re-running the full migration (`python -m scripts.helpers.apply_all`)

#### RLS Integration Tests
- `backend/tests/test_rls_integration.py` — 21 tests that bypass FastAPI and query PostgreSQL directly, simulating the `authenticated` role via `SET LOCAL ROLE` and `set_config('request.jwt.claim.sub', …)`
- Tests cover: recipe SELECT/UPDATE visibility per owner / non-owner / admin, silent list filtering, ingredient INSERT permission by role, ingredient DELETE silent blocking, tasting session SELECT / UPDATE access per creator / participant / outsider / admin
- Tests auto-skip when `DATABASE_URL` points to SQLite; run automatically against Supabase in CI

#### Application-Level Auth Tests
- `backend/tests/test_rls_auth.py` — 19 tests for FastAPI route guards (app-level, SQLite-compatible)
- Covers: recipe ownership GET/list, outlet admin-only CRUD, menu role-based write guards, tasting session creator-only updates/deletes

### Changed

#### Config — Reliable `.env` Resolution
- `backend/app/config.py`: `env_file` changed from relative `".env"` to `Path(__file__).parent.parent / ".env"` so settings load correctly regardless of the current working directory

---

## [0.0.34] - 2026-04-14

### Added

#### Ingredients — Cross-Table Search
- Ingredient search now matches against **category name** and **supplier name** in addition to ingredient name
- Implemented via scalar subqueries + `or_()` in the backend to avoid row multiplication from JOINs
- Results sorted alphabetically by name (was previously sorted by ID descending)

#### Ingredients — Category Filter Pills Respond to Search
- Category filter pills (the "Category:" row) now live-filter as you type in the search box
- When a search is active, the label switches from **"Category:"** to **"Matching tags:"**
- "See more" pagination continues to work scoped to the current search term
- Removed the separate "Matching tags" section below the filter bar (consolidated into the filter pills)

#### Ingredients — Server-Side Sorting
- Sort dropdown now offers four options: **A to Z**, **Z to A**, **Price: Low to High**, **Price: High to Low**
- Sorting is handled by the backend (`ORDER BY` in the DB query) rather than client-side, so results are correct across pages
- Default sort changed from price ascending to **A to Z**
- `sort_by` query param added to `GET /ingredients` endpoint and `IngredientListParams` type

### Changed

#### FMH Import — SKU-First Upsert Resolution
- Re-importing an FMH product list now resolves existing ingredients by **SKU first**, then falls back to name, then creates new
- Prevents duplicate ingredients when a product is renamed between imports
- Existing `SupplierIngredient` pricing fields (`pack_size`, `pack_unit`, `price_per_pack`) are updated on re-import instead of being skipped
- Import result now reports `ingredients_updated` and `supplier_ingredients_updated` counts alongside `_created` counts; shown in the post-import toast

---

## [0.0.33] - 2026-04-13

### Added

#### Menu — Dish Highlight Flag
- `is_highlight` boolean on `SketchDish` marks a dish as highlighted
- Highlighted rows show an amber background in preview; brighter in dark mode (`dark:bg-amber-500/25`)

#### Menu — Dish Icon Tags
- 7 predefined tags: Signature ⭐, Spicy 🌶️, Vegetarian 🌿, Seafood 🐟, Beef 🥩, Pork 🐷, Nuts 🥜
- Collapsible tag picker in both card and list edit views; active count shown on toggle button
- Selected icons displayed as emoji beside the dish name in preview

#### Menu Sketch — Preview Display Toggles
- "Display" dropdown in preview mode toggles visibility of: Description, Key ingredients, Cost margins, Comments
- Fields are hidden, not deleted — data persists when toggled off

#### Menu Sketch — Recipe Search on Dish Entry
- Typing in the dish name input shows a live recipe suggestion dropdown (up to 5 matches)
- Selecting a recipe pre-fills description, cost price, and sales price
- Section quick-add input also supports recipe search, with an "Add new dish" option for free-form entries

#### Menu Sketch — Unsaved Changes Indicator
- Amber "Unsaved changes" badge appears in the top bar whenever local edits have not yet been saved

### Changed

#### Navigation — Menu Restructure
- "Menu" in TopNav now links to `/menu` (was `/menu-sketch`)
- `/menu` page hosts "Draft Menus" and "Recipe Menus" sub-tabs; active tab persisted in `localStorage`
- Back navigation from `/menu-sketch/[id]` and `/menu` sub-pages now returns to `/menu`
- `/recipes` simplified to recipe management only (Menus tab removed)

#### Menu Sketch — Edit Mode as Default
- Editor opens in Edit mode by default instead of Preview mode

#### Menu Sketch — Description Always Visible
- Description textarea is permanently visible in edit mode (was toggle-revealed)

#### Menu Sketch — Preview Layout
- Dish name, price, and cost are now on a single row in preview
- Column headers mirror dish row structure for pixel-accurate alignment
- Cost margins toggle only shows/hides the `%` column — price and cost remain always visible
- Description moved directly below dish name

#### Menu Sketch — "Ingredients" renamed to "Key ingredients"
- Label updated in edit card, list column header, and preview

#### Menu Sketch — Stable Drag IDs
- Sections carry stable UUIDs instead of index-based `section-N` strings; drag-and-drop reorder now ID-based

### Fixed

#### Tasting Sessions — Access Scoping
- Non-admin `GET /tasting-sessions` now returns only sessions the user created or participates in (admin users see all)
- Fixed `useEffect` race condition when pre-selecting recipes in the add-recipe panel
- Batch recipe removal now runs in parallel via `Promise.all + mutateAsync`

#### Menu Sketch — Auto-Adaptive Textareas
- Description and ingredients textareas now auto-resize based on content height

---

## [0.0.32] - 2026-04-07

### Added

#### Recipe Builder — Ingredient-Free Recipes
- Removed hard validation block that prevented saving a recipe with no ingredients or sub-recipes
- Recipes can now be created with a name only — useful for ad-hoc tasting session dishes
- Supplier validation for active-status recipes is unchanged

#### Tasting Sessions — Inline Recipe Creation
- "Create `"..."` as new recipe" button appears in the recipe search panel when a search query is typed but no match is selected
- Creates the recipe immediately and adds it to the selection (same flow as picking an existing recipe)
- Newly created recipe shows as pre-selected (blue checkmark) in the list; can be deselected before confirming

### Changed

#### Tasting Sessions — Add Recipes Panel Overhaul
- Recipes already linked to the session now open pre-selected (checked) instead of disabled
- Unchecking a linked recipe and clicking the action button removes it from the session (no per-item confirm)
- Action button label: **Add** when only adding new recipes, **Save** when any linked recipe is being removed; disabled when nothing has changed
- Batch removal handled without individual confirm dialogs for consistency with the panel's edit-then-apply model

---

## [0.0.31] - 2026-03-27

### Added

#### Menu Sketch — Delete Support
- `DELETE /menu-sketches/{id}` hard-delete endpoint (204 No Content)
- `delete_sketch()` method in `MenuSketchService`
- `useDeleteMenuSketch` TanStack Query mutation hook with success/error toasts
- `deleteMenuSketch` API call in `lib/api.ts`
- Confirm modal on the list page before deletion; sketch removed from list on success

### Changed

#### Menu Sketch — Preview Mode Refinements
- Row spacing increased for better readability
- Comment badge always visible (orange when unresolved, muted when all resolved)
- Comment icon added alongside badge for clearer visual affordance
- Ingredient chips render as styled pill badges instead of plain text
- Font hierarchy tightened: dish name, description, and price use consistent weights

#### Menu Sketch — Edit Mode Refinements
- Cost `%` column added to both list-view rows and card-view items
- Orange comment badge displayed in edit mode to mirror preview behaviour
- Description textarea auto-expands to full content height on initial load

#### Menu Sketch — List Page Polish
- Max width capped at `max-w-7xl` for better wide-screen readability
- Defensive `updated_at` timezone parse prevents crash on missing timezone info
- Version badge rendered without decorative icon for cleaner appearance

### Fixed

- Toast notification shown on deletion of sections/dishes within a menu sketch
- Toast notification shown on resolution of per-dish comments

**Files modified:**
- `backend/app/api/menu_sketches.py`
- `backend/app/domain/menu_sketch_service.py`
- `frontend/src/app/menu-sketch/[id]/page.tsx`
- `frontend/src/app/menu-sketch/[id]/CommentsPanel.tsx`
- `frontend/src/app/menu-sketch/[id]/DishCommentsModal.tsx`
- `frontend/src/app/menu-sketch/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/hooks/useMenuSketches.ts`

---

## [0.0.30] - 2026-03-26

### Changed

#### Menu Sketch — Design System Alignment (Part 1)

- Replaced all raw `zinc-*` Tailwind classes with design-system CSS variable tokens (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, etc.) across both `/menu-sketch` and `/menu-sketch/[id]`
- List page now uses `PageHeader` and `Button` from `@/components/ui`

#### Menu Sketch — Preview & Edit Fixes (Part 2)

- Default mode on editor load changed to **preview** (was edit)
- Preview: empty/null/whitespace dish descriptions no longer rendered — row hidden entirely
- Preview: `%` column header promoted to `font-semibold`; per-dish `%` value promoted to `font-medium`, matching the `Price` and `Cost` column weights
- Edit: ingredient field in both card and row views switched from `<input>` to `<textarea>`
- Quick-add inputs (new section, new dish) gain a visible `SendHorizonal` send button alongside the existing Enter-key handler

### Added

#### Menu Sketch — Backend Columns (Part 3)

- `comments` JSON column on `menus_sketch` (default `{}`) — stores per-dish comments keyed by stable dish UUID
- `notes` VARCHAR column on `menus_sketch` (nullable) — stores menu-wide rich-text HTML
- Alembic migration adds both columns
- Frontend types updated: `SketchComment`, `SketchComments`, `SketchDish.id?`, `MenuSketch.comments`, `MenuSketch.notes`, `UpdateMenuSketchRequest.comments/notes`

#### Menu Sketch — Dish Comments Panel (Part 4)

- Right-hand `CommentsPanel` sidebar always visible in the editor; collapses to icon toggle on narrow (`< lg`) viewports
- Per-dish comment threads with add / inline-edit / resolve / delete (confirm modal) actions
- "Show resolved" toggle reveals greyed-out resolved comments
- Stable UUIDs lazily assigned to dishes on first load; immediately persisted
- Save isolation: comment changes `PATCH { comments }` only — never touches `sections` or `notes`
- `DishCommentsModal` — per-dish modal variant accessible from the dish row/card
- Preview mode: unresolved comment count badge shown bottom-right of each dish cell

#### Menu Sketch — Tiptap Notes Editor (Part 5)

- Collapsible **Menu Notes** block below the editor, expanded by default
- `NotesEditor` component powered by Tiptap v3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline`)
- Toolbar: Bold, Italic, Underline, Strikethrough, Link
- Links rendered as external (`target="_blank" rel="noopener noreferrer"`) with primary-colour underline styling to distinguish from plain text
- Custom link-insert modal replaces browser `window.prompt`
- Save triggers on editor blur (not keystroke); isolation: `PATCH { notes }` only
- SSR hydration resolved via `immediatelyRender: false` + `next/dynamic` with `ssr: false`

**Files created:**
- `frontend/src/app/menu-sketch/[id]/CommentsPanel.tsx`
- `frontend/src/app/menu-sketch/[id]/DishCommentsModal.tsx`
- `frontend/src/app/menu-sketch/[id]/NotesEditor.tsx`

**Files modified:**
- `frontend/src/app/menu-sketch/page.tsx`
- `frontend/src/app/menu-sketch/[id]/page.tsx`
- `frontend/src/types/index.ts`
- `frontend/package.json`

---

## [0.0.29] - 2026-03-26

### Added

#### Nav Restructure & Page Consolidation

Replaced the flat top nav with grouped dropdown nav groups, and consolidated standalone pages into tabbed shells.

- `NAV_GROUPS` replaces `NAV_ITEMS` — groups: Drafts, Recipes, Ingredients, R&D, Reports, Settings; each with dropdown sub-items
- `recipes/page.tsx` — Menus tab added, rendering `MenuPage` inline
- `ingredients/page.tsx` — Products (default) and Suppliers tabs added; Categories renamed to Tags
- `rnd/page.tsx` — split into Pipelines and Tastings tabs
- `settings/page.tsx` — new shell with Users, Outlets, Admin, and Design tabs
- Removed standalone `/outlets/page.tsx` and `/admin/users/page.tsx` routes
- `next.config.ts` redirects added for old routes pointing to new parent pages
- All back buttons and redirects updated to new parent routes
- Layout consistency fix: `w-full` + `max-w-7xl` applied to all tab content roots

#### Products Tab (Ingredients Page)

New paginated supplier-ingredients view as the default tab on `/ingredients`.

**Backend:**
- `GET /api/v1/supplier-ingredients` — paginated endpoint with `search` (name/SKU), `page_number`, `page_size`; returns `SupplierIngredientPaginatedResponse`

**Frontend:**
- `ProductsTab` component — table with Product Name, Category, SKU, Supplier, Tags, Unit, Price/Pack columns; clickable product and supplier links; SGD currency formatting
- `useSupplierIngredientsPaginated` TanStack Query hook
- `getSupplierIngredientsPaginated` API helper
- `UserProfileTab` added to Settings → Users tab (current user account + outlet view)

#### Menu Sketch Dish Description

Optional `description` field on `SketchDish` entries.

- Edit mode: resizable `description` textarea in both card and list views
- Preview: restructured dish cell — prices top row, name full-width, then bold `Ingredients` / `Description` labels at `text-sm`; description shows `n/a` when empty
- Collapsible description field in the edit modal to reduce visual noise

#### Supplier Ingredient Tags

Full product-level tagging system for supplier ingredients.

**Backend:**
- `supplier_ingredient_tags` table — `id`, `name` (unique), `is_active` (soft-delete)
- `supplier_ingredient_supplier_ingredient_tags` join table — cascade FKs, unique constraint on `(supplier_ingredient_id, supplier_ingredient_tag_id)`
- Alembic migration `a2b3c4d5e6f7`
- Service: `list_tags`, `create_tag`, `delete_tag` (soft), `get_tags_for_supplier_ingredient`, `add_tag_to_supplier_ingredient` (idempotent), `remove_tag_from_supplier_ingredient`
- API router at `/api/v1/supplier-ingredient-tags` — 6 endpoints (GET list, POST create, DELETE soft-delete, GET per-product, POST link, DELETE unlink)
- 9 unit tests (all passing)

**Frontend:**
- `TagsCell` component — displays linked tag badges + edit icon that opens `TagManagementModal`
- `TagManagementModal` — checkbox toggle per tag to link/unlink, inline soft-delete with confirm, create new global tag (creates then links immediately)
- Tags column added to `ProductsTab` between Supplier and Unit
- `useSupplierIngredientTags`, `useCreateSupplierIngredientTag`, `useDeleteSupplierIngredientTag`, `useTagsForSupplierIngredient`, `useAddTagToSupplierIngredient`, `useRemoveTagFromSupplierIngredient` hooks

**Files Created:**
- `backend/app/models/supplier_ingredient_tag.py`
- `backend/app/domain/supplier_ingredient_tag_service.py`
- `backend/app/api/supplier_ingredient_tags.py`
- `backend/alembic/versions/a2b3c4d5e6f7_add_supplier_ingredient_tags.py`
- `backend/tests/test_supplier_ingredient_tags.py`
- `frontend/src/components/ingredients/TagsCell.tsx`
- `frontend/src/components/ingredients/TagManagementModal.tsx`
- `frontend/src/lib/hooks/useSupplierIngredientTags.ts`

**Files Modified:**
- `frontend/src/types/index.ts` — `SupplierIngredientTag`, `CreateSupplierIngredientTagRequest`
- `frontend/src/lib/api.ts` — 6 tag API functions
- `frontend/src/lib/hooks/index.ts` — export barrel updated
- `frontend/src/components/ingredients/ProductsTab.tsx` — Tags column wired in
- `backend/app/models/__init__.py`, `backend/app/main.py` — register new model and router

---

## [0.0.28] - 2026-03-25

### Added

#### Menu Sketch Canvas — Freeform Menu Builder

New `/menu-sketch` feature: a freeform, canvas-based sketch system for rapid menu brainstorming, replacing the structured `/menu` builder in the top nav.

**Backend:**
- `MenuSketch` model (`menus_sketch` table) — `id`, `version`, `name`, and freeform `sections` stored as JSON (list of sketch section objects, each containing a list of dishes)
- `MenuSketchService` — `list_sketches()` (ordered by `updated_at`), `get_sketch()`, `create_sketch()`, `update_sketch()`, `fork_sketch()` (copies all fields, increments `version`)
- API router at `/api/v1/menu-sketches`: `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `POST /{id}/fork`
- Alembic migration `c5d6e7f8a9b0` — creates `menus_sketch` table with `version`, `name`, `sections` (JSON), `created_at`, `updated_at`

**Files Created:**
- `backend/app/models/menu_sketch.py` — `MenuSketch`, `MenuSketchCreate`, `MenuSketchUpdate`, `MenuSketchRead`
- `backend/app/domain/menu_sketch_service.py`
- `backend/app/api/menu_sketches.py`
- `backend/alembic/versions/c5d6e7f8a9b0_add_menus_sketch_table.py`
- `backend/tests/test_menu_sketches.py`

**Files Modified:**
- `backend/app/models/__init__.py`, `backend/app/domain/__init__.py`, `backend/app/main.py` — register new model, service, and router

**Frontend:**
- `/menu-sketch` list page — card grid showing sketch name, version badge (`v{n}`), and last-updated relative timestamp; "New Menu" button auto-navigates to the new sketch editor
- `/menu-sketch/[id]` canvas editor page — freeform layout editing with autosave
- `useMenuSketches`, `useMenuSketch`, `useCreateMenuSketch`, `useUpdateMenuSketch`, `useForkMenuSketch` TanStack Query hooks
- `AuthGuard` route patterns extended for `/menu-sketch` and `/menu-sketch/[id]`
- TopNav "Menu" entry updated from `/menu` → `/menu-sketch`

**Files Created:**
- `frontend/src/app/menu-sketch/page.tsx`
- `frontend/src/app/menu-sketch/[id]/page.tsx`
- `frontend/src/lib/hooks/useMenuSketches.ts`

**Files Modified:**
- `frontend/src/lib/api.ts` — `getMenuSketches`, `getMenuSketch`, `createMenuSketch`, `updateMenuSketch`, `forkMenuSketch`
- `frontend/src/types/index.ts` — `MenuSketch`, `CreateMenuSketchRequest`, `UpdateMenuSketchRequest`
- `frontend/src/components/layout/TopNav.tsx` — `/menu` → `/menu-sketch`
- `frontend/src/components/AuthGuard.tsx` — added `/menu-sketch` route patterns
- `frontend/src/lib/hooks/index.ts` — export barrel updated

---

## [0.0.27] - 2026-03-17

### Added

#### Playwright E2E Test Suite

Full end-to-end testing infrastructure covering all 14 sections of the frontend UI testing checklist.

**Infrastructure:**
- `frontend/playwright.config.ts` — Chromium + admin projects, auto-detected workers for local runs
- `frontend/e2e/global.setup.ts` — API-level login, seed data creation (recipe, supplier, tasting session), localStorage auth injection
- `frontend/e2e/helpers/{auth,data,pagination,navigation,seed}.ts` — shared utilities for auth, API data, pagination, page navigation, and seed lookup
- `frontend/e2e/fixtures/index.ts` — Sonner toast helpers
- `frontend/e2e/pages/{LoginPage,RecipesPage}.ts` — page object models
- `docs/frontend-ui-testing-checklist.md` — 850+ line checklist documenting all test cases

**Spec files (14 sections, 213 tests — 164 passing, 49 skipped pending test data):**
- `auth.spec.ts` — login, register, auth guard
- `navigation.spec.ts` — TopNav links, active state, home redirect
- `recipes.spec.ts` — list, search, pagination, category management
- `recipe-canvas.spec.ts` — canvas tabs, ingredient rows, costing
- `ingredients.spec.ts` — list, filters, detail
- `suppliers.spec.ts` — list, detail
- `tastings.spec.ts` — sessions list/create/detail, tasting notes
- `outlets.admin.spec.ts` — admin-only outlet CRUD
- `rnd.spec.ts` — R&D workspace
- `menu.spec.ts`, `menu.manager.spec.ts`, `menu.preview.manager.spec.ts` — menu management flows
- `ui-components.spec.ts` — search debounce, modals, pagination, view toggle, toasts, error handling, responsiveness, autosave

**Files Created:**
- `frontend/e2e/` directory with all spec and helper files
- `frontend/playwright.config.ts`
- `docs/frontend-ui-testing-checklist.md`

**Files Modified:**
- `frontend/package.json` — added `@playwright/test`, `playwright` dev dependencies
- `frontend/src/app/login/page.tsx` — test-id attributes for auth spec
- `frontend/src/app/register/page.tsx` — test-id attributes
- `frontend/src/components/AuthGuard.tsx` — test compatibility adjustments

#### FMH Import Performance Optimization

Centralised all FMH import logic into a dedicated service and replaced N+1 SELECT loops with bulk pre-loads, dropping DB round-trips from ~2500 to ~6 per import.

**`backend/app/domain/fmh_import_service.py`** (new):
- Single-pass over product rows using bulk IN pre-loads for outlets, categories, ingredients, supplier-ingredients, and outlet-supplier-ingredients
- `add_all()` + single flush per entity type (5 total flushes per import)
- `_parse_pack_from_name()` results cached per ingredient to avoid duplicate regex execution
- `openpyxl` opened with `read_only=True` + `data_only=True` on both import endpoints

**`source` field on models** (migration `i5_add_source_to_categories_outlets_suppliers.py`):
- `Category.source`, `Outlet.source`, `Supplier.source` — tracks data origin (e.g. `"fmh"`) for selective resets

**FMH Import Modals (Frontend):**
- `FMHIngredientImportModal` — file upload with progress, toast notifications, auto-close on success
- `FMHSupplierImportModal` — same pattern for supplier + supplier pricings XLSX pair
- `disableClose` prop added to `Modal` component — blocks backdrop click, Escape key, and X button during in-flight requests
- Query invalidation: `['ingredients']`, `['categories']`, `['outlets']` after ingredient import; `['suppliers']` after supplier import

**FMH Response Types (Frontend):**
- `FMHImportResult` and `FMHSupplierImportResult` interfaces added to `frontend/src/types/index.ts`
- API functions `importIngredientsFMH()` and `importSuppliersFMH()` added to `frontend/src/lib/api.ts`

**Files Created:**
- `backend/app/domain/fmh_import_service.py`
- `backend/alembic/versions/i5_add_source_to_categories_outlets_suppliers.py`
- `frontend/src/components/ingredients/FMHIngredientImportModal.tsx`
- `frontend/src/components/suppliers/FMHSupplierImportModal.tsx`

**Files Modified:**
- `backend/app/api/ingredients.py`, `backend/app/api/suppliers.py` — delegated to new service
- `backend/app/models/category.py`, `outlet.py`, `supplier.py` — `source` field
- `backend/scripts/reset_fmh.py` — updated to filter by `source = "fmh"` on new columns
- `frontend/src/components/ui/Modal.tsx` — `disableClose` prop
- `frontend/src/components/ingredients/index.ts`, `suppliers/index.ts` — export new modals

#### FMH Sample File Download Endpoints

Three new GET endpoints serve sample XLSX templates from Supabase Storage (`fmh-samples/` folder) so operators can download pre-formatted import files.

- `GET /ingredients/fmh-sample-items` → `ProductList_sample.xlsx`
- `GET /suppliers/fmh-sample-supplier` → `Suppliers_sample.xlsx`
- `GET /suppliers/fmh-sample-supplier-pricings` → `SponsoredSupplierPricings_sample.xlsx`

All three return 503 when Supabase Storage is not configured and 404 if the file is missing.

**`StorageService.download_fmh_sample(filename)`** — fetches raw bytes from the public storage URL using the shared `httpx` client; raises `StorageError` on HTTP or network failure.

**Frontend (`frontend/src/lib/api.ts`):**
- `fetchApiBlob()` helper — authenticated fetch returning a `Blob`, with structured error parsing
- `downloadFMHSampleSupplier()`, `downloadFMHSampleSupplierPricings()`, `downloadFMHSampleItems()` — thin wrappers

**`triggerBlobDownload(blob, filename)`** utility added to `frontend/src/lib/utils.ts` — creates an object URL, simulates a click, then revokes to free memory.

#### `DropdownButton` UI Component

New `DropdownButton` component (`frontend/src/components/ui/DropdownButton.tsx`) replaces standalone import buttons on the Suppliers and Ingredients pages with a unified FMH import/export menu.

- `items` prop accepts `DropdownItem[]` (label, optional icon, onClick, optional disabled)
- Click-outside via `mousedown` listener; Escape key closes via `keydown` listener
- Animated dropdown panel via Tailwind `animate-in fade-in-0 zoom-in-95`
- Exported from `frontend/src/components/ui/index.ts`

**Suppliers page** (`frontend/src/app/suppliers/page.tsx`):
- FMH `DropdownButton` with three items: Export Sample Suppliers, Export Sample Supplier Pricings, Import
- Per-item loading state (`downloadingSupplier`, `downloadingPricings`) with label swap during download

**Ingredients page** (`frontend/src/app/ingredients/page.tsx`):
- FMH `DropdownButton` with two items: Export Product List, Import
- `downloadingItems` state with label swap during download

### Fixed

#### Modal Accessibility & E2E Reliability

- Moved `role="dialog"` from the fixed full-viewport wrapper to the inner modal content `<div>` so Playwright (and assistive technology) correctly targets the panel rather than the backdrop overlay
- Removed `force: true` from all E2E click calls — no longer needed once the dialog wrapper's `inset-0` element no longer carries the `dialog` role
- Replaced optional `if`-guards in E2E specs with `expect(...).toBeVisible()` assertions for definitive failure on regression

**Files Modified:**
- `frontend/src/components/ui/Modal.tsx`
- `frontend/e2e/ingredients.spec.ts`, `outlets.admin.spec.ts`, `recipes.spec.ts`, `suppliers.spec.ts`, `tastings.spec.ts`, `ui-components.spec.ts`
- All modal components (`AddIngredientModal`, `AddOutletModal`, `AddSupplierModal`, `AddRecipeCategoryModal`, `AddCategoryModal`, `AddAllergenModal`, `AddUserModal`) — removed redundant `role="dialog"` from wrapper

---

## [0.0.25] - 2026-03-12

### Added

#### FMH Import Pipeline — `seed_fmh.py` & `reset_fmh.py`

Scripts to bulk-import Food Market Hub (FMH) Excel exports into the database and cleanly remove them.

**`seed_fmh.py`**:
- Reads three Excel exports from `backend/exports/`: `Suppliers.xlsx`, `SponsoredSupplierPricings.xlsx`, `ProductList_modified.xlsx`
- Seeds suppliers, outlets, categories, ingredients, and supplier-ingredient links in a single run
- Idempotent: skips rows that already exist by name/SKU
- Uses `openpyxl` to parse worksheets into dicts via header row

**`reset_fmh.py`**:
- Removes all FMH-seeded data: `supplier_ingredients` (source = `fmh`), ingredients (source = `fmh`), all categories, suppliers, and outlets
- Confirmation prompt by default; `--yes` flag skips it
- Uses `sqlalchemy inspect` to check table existence before deleting

**Database Change — `OutletSupplierIngredient` join table**:
- New `outlet_supplier_ingredient` table links a `supplier_ingredient` record to one or more outlets for display scoping
- Unique constraint on `(supplier_ingredient_id, outlet_id)`
- Alembic migration `h9_refactor_supplier_ingredient_outlet_scope.py`
- `SupplierIngredient` model updated: removed `outlet_id` direct column, added `outlet_links` relationship to `OutletSupplierIngredient`
- `ingredient_service.py` and `supplier_service.py` refactored for new join table structure

**Files Created**:
- `backend/scripts/seed_fmh.py`
- `backend/scripts/reset_fmh.py`
- `backend/app/models/outlet_supplier_ingredient.py`
- `backend/alembic/versions/h9_refactor_supplier_ingredient_outlet_scope.py`

**Files Modified**:
- `backend/app/models/supplier_ingredient.py` — Removed `outlet_id`, added `outlet_links` relationship
- `backend/app/models/__init__.py` — Export `OutletSupplierIngredient`
- `backend/app/domain/ingredient_service.py` — Refactored for join table
- `backend/app/domain/supplier_service.py` — Refactored for join table

#### Supplier `code` & `shipping_company_name` Fields

Added two new display fields to the `Supplier` type and surfaces them in supplier list and detail views.

**Files Modified**:
- `frontend/src/types/index.ts` — `code` and `shipping_company_name` on `Supplier`, `CreateSupplierRequest`, `UpdateSupplierRequest`
- `frontend/src/app/suppliers/page.tsx` — Display in list
- `frontend/src/app/suppliers/[id]/page.tsx` — Display in detail
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Show code/shipping company
- `backend/tests/test_suppliers.py` — New tests for supplier fields

### Changed

#### Recipe Search Matches Category Names

Recipe list search (`GET /recipes?search=...`) now also returns recipes whose assigned category names match the search term, in addition to recipe name matches.

**Implementation**: Subquery joins `recipe_recipe_categories → recipe_categories` and filters by `RCat.name.ilike(...)` with `is_active = True`. Result is OR-combined with the existing name match.

**Files Modified**:
- `backend/app/domain/recipe_service.py` — Extended `_build_list_query()` with category name OR clause

#### Recipe-Category Links Soft-Delete

`delete_recipe_category_link()`, `delete_recipe_categories_by_recipe()`, and `delete_recipe_categories_by_category()` now soft-delete by setting `is_active = False` instead of issuing a hard `session.delete()`.

**Files Modified**:
- `backend/app/domain/recipe_recipe_category_service.py` — Soft-delete with `is_active = False` + `updated_at`
- `backend/tests/test_recipe_recipe_categories.py` — Updated tests for soft-delete behaviour

#### Recipe Category Badges on Recipe List Rows

Category names are now displayed as secondary badges alongside allergen badges on each recipe row in the recipe management list.

**Files Modified**:
- `frontend/src/components/recipes/RecipeListRow.tsx` — Added `categoryNames` prop and badge render
- `frontend/src/components/recipes/RecipeManagementTab.tsx` — Pass `getCategoryNamesForRecipe()` to each row

#### Inline "Create Category" in Overview Tag Dropdown

When searching for a category tag in the recipe Overview tab and no match exists, a **"+ Create \"{term}\""** button appears instead of a dead-end "No matching categories" message. Clicking it creates the category and immediately assigns it to the recipe.

**Files Modified**:
- `frontend/src/components/layout/tabs/OverviewTab.tsx` — `useCreateRecipeCategory` hook; inline create on empty state

#### Menu Builder — Multi-Add Recipe Picker (replaces single-add)

The `+` button on each menu section's items header now opens an inline multi-select panel instead of immediately adding a blank item.

**Features**:
- Debounced search input with clear button
- Scrollable recipe list with checkboxes; already-added recipes shown as disabled with "Added" label
- "View more" pagination via `useInfiniteRecipes`
- Footer shows selection count; "Add N item(s)" button confirms; Cancel closes the panel
- Only one section's panel can be open at a time

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — `MultiAddContent` component, `useInfiniteRecipes` + `useDebouncedValue` integration, removed single-add `addItem` function

#### Canvas Tab Order — Overview Before Canvas

`CANVAS_TABS` array reordered so **Overview** appears as the first tab, before **Canvas**.

**Files Modified**:
- `frontend/src/components/layout/TopAppBar.tsx`

#### Menu Preview Edit Button — Admins & Managers

"Edit Menu" link on `/menu/preview/[id]` is now visible to both `admin` users and users with `isManager = true` (previously admin-only).

**Files Modified**:
- `frontend/src/app/menu/preview/[id]/page.tsx`

#### Image Upload — Drag-and-Drop Support

`ImageUploadPreview` component refactored to extract `handleFiles(FileList)` as a shared handler, enabling programmatic file processing from both file input and drag-drop events. Added `isDragging` state for visual feedback.

**Files Modified**:
- `frontend/src/components/tasting/ImageUploadPreview.tsx`

#### Remove `cl`/`dl` Unit Support

`cl` (centilitre) and `dl` (decilitre) removed from `MASS_CONVERSIONS` in `unit_conversion.py` and from `COMMON_UNITS` in `utils.ts`. These units are not used in practice and were causing ambiguous conversions.

**Files Modified**:
- `backend/app/utils/unit_conversion.py`
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/unitConversion.ts`

#### Volume ↔ Mass Cross-Category Unit Conversion

`convert_to_base_unit()` now supports volume-to-mass and mass-to-volume conversions using density = 1 g/ml (i.e. 1 ml = 1 g, 1 l = 1 kg). Previously these combinations returned `None` as incompatible.

**Files Modified**:
- `backend/app/utils/unit_conversion.py` — Added cross-category conversion branch

#### Recipe Category Soft Delete & Pagination Parity

Recipe categories now match ingredient category behaviour end-to-end: soft delete (archive/unarchive) instead of hard delete, `active_only` filtering, and "Show archived" checkbox in the UI.

**Backend**:
- Added `is_active: bool = Field(default=True)` to `RecipeCategory` model
- `RecipeCategoryService._build_list_query()`, `list_paginated()`, and `count()` now accept `active_only` param
- Added `soft_delete_recipe_category()` service method
- `DELETE /recipe-categories/{id}` changed from hard delete (204) to soft delete (200, returns archived category)
- `GET /recipe-categories` accepts `active_only` query param (default `true`)
- Alembic migration `d5e6f7g8h9i0` — adds `is_active` column to `recipe_categories` with `server_default=true`

**Frontend**:
- Added `is_active` field to `RecipeCategory` type and `UpdateRecipeCategoryRequest`
- Added `RecipeCategoryListParams` interface with `active_only` in `api.ts`
- Updated `useRecipeCategories` hook to use `RecipeCategoryListParams`
- `RecipeCategoriesTab`: added `showArchived` state, `active_only` in query, page reset on filter change, archive confirmation modal, and unarchive via PATCH
- `RecipeCategoryCard` / `RecipeCategoryListRow`: replaced `onDelete` with `onArchive`/`onUnarchive`; added `Archive`/`ArchiveRestore` icons and "Archived" badge

**Tests**:
- `test_recipe_categories.py`: updated `test_delete_recipe_category` for soft-delete (200 + `is_active=false`); added `test_list_recipe_categories_active_only` and `test_unarchive_recipe_category`; added `is_active` assertions to create tests

**Files Modified**:
- `backend/app/models/recipe_category.py`
- `backend/app/domain/recipe_category_service.py`
- `backend/app/api/recipe_categories.py`
- `backend/alembic/versions/d5e6f7g8h9i0_add_is_active_to_recipe_categories.py` *(new)*
- `backend/tests/test_recipe_categories.py`
- `frontend/src/types/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/hooks/useRecipeCategories.ts`
- `frontend/src/components/recipes/RecipeCategoriesTab.tsx`
- `frontend/src/components/recipes/RecipeCategoryCard.tsx`
- `frontend/src/components/recipes/RecipeCategoryListRow.tsx`

#### Ingredient Category Filter — Server-Side Pagination with Load More

The category filter buttons on `/ingredients` now load categories from the server page-by-page (10 per page) with a "See more" button to append further pages, instead of loading all categories upfront.

**Files Modified**:
- `frontend/src/app/ingredients/page.tsx` — `useCategoriesPaginated` for filter buttons, append-on-load-more logic
- `frontend/src/components/ingredients/FilterButtons.tsx` — `hasMoreCategories`, `onLoadMoreCategories`, `isLoadingMoreCategories` props; "See more" button
- `frontend/src/lib/hooks/useCategories.ts` — Added `useCategoriesPaginated` hook

#### Recipe Category Filter Buttons — Show All Toggle

When more than 8 recipe category filter buttons exist, only the first 8 are shown with a `+N more` / `See less` toggle button.

**Files Modified**:
- `frontend/src/components/recipes/RecipeCategoryFilterButtons.tsx` — `showAll` state, `CATEGORY_VISIBLE_LIMIT`, toggle button

#### Recipe Overview Tab — Inline Recipe Name Editing

Recipe name in the Overview tab is now inline-editable via a hover-reveal pencil icon. Saves on Enter or confirm button; Escape reverts.

**Files Modified**:
- `frontend/src/components/layout/tabs/OverviewTab.tsx` — `isEditingName` / `nameValue` state, `handleSaveName()`, inline edit input with confirm/cancel

#### Menu Builder — Collapsible Item Fields

Key Highlights, Additional Info, and Substitution fields in `DraggableItem` are now collapsible via chevron toggle buttons (expanded by default). The Outlets section in the menu header is also collapsible.

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — `highlightsOpen`, `additionalOpen`, `substitutionOpen`, `outletsOpen` state; chevron toggle buttons

#### UI Polish — Remove Placeholder Image Elements

Removed non-functional image placeholder buttons from ingredient cards and the ingredient detail page header. The ingredient detail page now shows a subtle "Click any field below to edit" hint instead.

**Files Modified**:
- `frontend/src/components/ingredients/IngredientCard.tsx` — Removed `ImagePlus` placeholder button
- `frontend/src/app/ingredients/[id]/page.tsx` — Replaced image placeholder with edit hint; removed `ImagePlus` import
- `frontend/src/components/categories/CategoryCard.tsx` — Removed `FolderOpen` icon placeholder

#### Supplier List Row — Shipping Company Display

Supplier list rows now display `shipping_company_name` as "Ships via …" when present.

**Files Modified**:
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Inline shipping company name display

---

## [0.0.24] - 2026-03-09

### Added

#### Lark DM Invitations for Tasting Sessions (Plan 14)

Integrated Lark as a third notification channel alongside Email (SendGrid) and SMS (Twilio). Tasting session invitations are now sent as Lark direct messages to all participants.

**Features**:
- `@larksuiteoapi/node-sdk` integration for sending Lark DMs via bot
- SDK handles tenant token generation, caching, and refresh automatically
- Each recipient receives a Lark DM with session name, date, location, and invite link
- Graceful degradation: if `LARK_APP_ID`/`LARK_APP_SECRET` not configured, Email/SMS send normally with `lark_count: 0`
- Per-recipient error isolation: one failed Lark DM does not block others or Email/SMS
- API response includes `lark_count` alongside `email_count` and `sms_count`
- Toast message shows combined delivery summary across all channels

**Environment Variables**:
- `LARK_APP_ID` — Lark app ID from open.larksuite.com
- `LARK_APP_SECRET` — Lark app secret from open.larksuite.com

**Files Modified**:
- `frontend/package.json` — Added `@larksuiteoapi/node-sdk` dependency
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Lark client init, DM sending, `lark_count` response
- `frontend/src/lib/hooks/useSendTastingInvitation.ts` — Added `lark_count` to response type
- `frontend/.env.example` — Added `LARK_APP_ID`, `LARK_APP_SECRET`

#### Add-to-Calendar Applink in Lark Messages (Plan 14, Part 3)

Lark DMs now include a clickable deep link that opens the Lark Calendar event creation page with session details pre-filled.

**Features**:
- Applink URL: `https://applink.larksuite.com/client/calendar/event/create?startTime=...&endTime=...&summary=...`
- `startTime`: session date as Unix timestamp (seconds)
- `endTime`: startTime + 1 hour
- `summary`: URL-encoded "Tasting: {session_name}"
- Clicking the link opens Lark Calendar with pre-filled event — user confirms to add to their own calendar
- No server-side Calendar API calls or additional permissions needed

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Calendar applink URL generation

#### Branded Invitation Email Template (Plan 13, P1-4)

Redesigned the tasting invitation email with a professional, branded layout.

**Features**:
- Branded header with RecipePrep logo and distinct color scheme
- Personalized greeting using recipient name (if available)
- Session details card with icons for session name, date/time, and location
- Custom message support with styled blockquote
- Prominent CTA button ("View Tasting Session")
- Responsive HTML email design

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Full email template redesign

#### Inline Recipe Feedback Modal (Plan 13, P2-2)

Added expandable feedback cards on the tasting session detail page, allowing participants to submit tasting notes without navigating away.

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Inline feedback modal for recipes

#### Session Status Indicators & Loading States (Plan 13, P0-2/P0-3)

Added visual feedback for review progress and image upload states on tasting pages.

**Features**:
- Per-recipe feedback status indicators (checked/unchecked) on session detail page
- Loading spinners during image upload in feedback submission
- Form state improvements after submission

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Review status indicators
- `frontend/src/app/tastings/[id]/r/[recipeId]/page.tsx` — Loading states and form reset

### Changed

#### Lark DMs Sent Sequentially to Avoid Token Race Condition

Lark messages were previously dispatched in parallel via `forEach` + `Promise.all`. The SDK's automatic tenant token acquisition caused race conditions when multiple requests fired before the first token was cached.

**Fix**: Wrapped Lark sends in a sequential `for...of` loop so the first message acquires and caches the token, and subsequent messages reuse it.

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Sequential Lark DM sending

#### Derive Session Ingredients from Recipe Ingredients (Backend + Frontend)

Session ingredients were previously managed as a separate list (add/remove individually). Now they are derived automatically from the recipes linked to the session, eliminating duplicate data management.

**Backend**:
- `RecipeTastingRead` now includes `ingredients: list[RecipeTastingIngredient]` with ingredient id, name, base_unit, is_halal
- `RecipeTastingIngredient` DTO added for minimal nested ingredient info
- `get_recipes_for_session()` batch-loads recipe ingredients via JOIN query and groups by recipe_id
- Tests added for ingredient inclusion in recipe-tasting responses

**Frontend**:
- Session ingredients section now derives from recipe ingredients (no separate add/remove UI)
- `DerivedIngredient` type aggregates ingredients across recipes with `recipe_names[]`
- Removed `useSessionIngredients`, `useAddIngredientsToSession`, `useRemoveIngredientFromSession` usage from session detail page
- `RecipeFeedbackModal` updated with ingredient display improvements

**Files Modified**:
- `backend/app/models/recipe_tasting.py` — Added `RecipeTastingIngredient`, `ingredients` on `RecipeTastingRead`
- `backend/app/models/__init__.py` — Export new types
- `backend/app/domain/recipe_tasting_service.py` — Batch-load ingredients in `get_recipes_for_session()`
- `backend/tests/test_recipe_tastings.py` — Tests for ingredient inclusion
- `frontend/src/app/tastings/[id]/page.tsx` — Derived ingredients, removed manual ingredient management
- `frontend/src/components/tasting/RecipeFeedbackModal.tsx` — Updated ingredient display
- `frontend/src/types/index.ts` — Added `RecipeTastingIngredient` type

#### Moved flow-ui-starter to docs/

Relocated `flow-ui-starter/` directory under `docs/` for better project organization.

---

## [0.0.23] - 2026-03-06

### Performance

#### P0: Singleton Supabase Client + Local JWT Verification

Every authenticated request previously created a new Supabase client (TCP + TLS handshake) and made a synchronous network round-trip to Supabase to verify the JWT. This added 50–300ms of unpredictable latency per request. The `register` endpoint created 3 separate clients.

**Fix**:
- Supabase client created once via `@lru_cache` singleton (`_get_supabase_client()`) and reused across all requests
- `SupabaseAuthService` itself cached as module-level singleton via `get_auth_service()`
- JWT tokens verified locally using `PyJWT` when `SUPABASE_JWT_SECRET` is configured, eliminating the network round-trip entirely
- Falls back to remote Supabase verification if JWT secret is not set
- `auth.py` `/me` endpoint simplified to use `get_current_user` dependency (was duplicating auth logic manually)

**Files Modified**:
- `backend/app/domain/supabase_auth_service.py` — Singleton client, local JWT verification, `get_auth_service()` factory
- `backend/app/api/auth.py` — Use `get_auth_service()`, simplify `/me` endpoint
- `backend/app/api/deps.py` — Use `get_auth_service()` in `get_current_user`
- `backend/app/config.py` — Added `supabase_jwt_secret` setting
- `backend/pyproject.toml` — Added `PyJWT>=2.8.0` dependency
- `backend/tests/test_auth.py` — Clear singleton caches in fixtures, `auth_client` fixture for real auth flow

#### P1: Fix Async/Sync Mismatch

Several `async def` endpoints performed synchronous database calls, blocking the asyncio event loop. While one endpoint waited for a DB response, all other concurrent async operations stalled.

**Fix**: Wrapped synchronous DB calls with `asyncio.to_thread()` in async image upload/delete/sync endpoints.

**Files Modified**:
- `backend/app/api/recipe_images.py` — `to_thread` for `get_recipe` and `add_image`
- `backend/app/api/tasting_note_images.py` — `to_thread` for all sync DB calls in delete and sync endpoints

#### P1: Batch-Fetch N+1 Elimination

N+1 query patterns in cycle detection and batch add operations caused linear query growth. A recipe with 20 sub-recipes triggered 20+ individual SELECT queries.

**Fix**:
- `can_add_subrecipe()`: Fetch all `RecipeRecipe` links in one query, build adjacency map, BFS in memory
- `add_recipes_to_session()`: Batch-fetch all valid recipes + existing links in 2 queries upfront
- `add_ingredients_to_session()`: Same batch-fetch pattern
- `reorder_sub_recipes()`: Batch-fetch all links by IDs in one query

**Files Modified**:
- `backend/app/domain/subrecipe_service.py` — Batch-fetch links for cycle detection and reorder
- `backend/app/domain/recipe_tasting_service.py` — Batch-fetch recipes + existing links
- `backend/app/domain/ingredient_tasting_service.py` — Batch-fetch ingredients + existing links

#### P1/P3: Centralize & Deduplicate Outlet Hierarchy

Outlet hierarchy traversal logic was duplicated across 5+ files. Each copy did full table scans with recursive per-query walking.

**Fix**: Consolidated into `OutletService.get_accessible_outlet_ids()`. All callers now use this single method. Removed `get_accessible_outlet_ids()` standalone function from `ingredient_service.py`.

**Files Modified**:
- `backend/app/domain/outlet_service.py` — New `get_accessible_outlet_ids()` + `list_paginated_with_count()`
- `backend/app/domain/ingredient_service.py` — Removed standalone function, uses `OutletService`
- `backend/app/domain/menu_service.py` — Replaced 20-line hierarchy walk with single `OutletService` call
- `backend/app/domain/supplier_service.py` — Uses `OutletService`
- `backend/app/api/outlets.py` — Uses `OutletService.get_accessible_outlet_ids()`, moved cycle check into service

#### P2: Eliminate Redundant DB Fetches in Tasting Endpoints

Tasting session endpoints loaded the full session (with participants) 2-3 times per request — once for access control, once for the operation.

**Fix**:
- `get_raw()`: Lightweight session fetch without participant loading
- `is_participant()`: Single-column EXISTS query for access checks
- `_check_session_access_raw()`: Access check using raw session + lightweight participant check
- `update()` and `delete()` accept optional pre-loaded `existing` session to avoid re-fetching

**Files Modified**:
- `backend/app/domain/tasting_session_service.py` — `get_raw()`, `is_participant()`, `list_paginated_with_count()`, optional `existing` param
- `backend/app/api/tastings.py` — `_check_session_access_raw()`, pass pre-loaded session to update/delete

#### P2: Combined Paginated List + Count Query

Paginated endpoints issued two separate queries with the same filters — one for items, one for count. The base filter was built twice.

**Fix**: Added `list_paginated_with_count()` to each service that builds the base query once, then derives both count and paginated items from it.

**Files Modified**:
- `backend/app/domain/recipe_service.py` — `list_paginated_with_count()`
- `backend/app/domain/ingredient_service.py` — `list_paginated_with_count()`
- `backend/app/domain/tasting_session_service.py` — `list_paginated_with_count()`
- `backend/app/domain/outlet_service.py` — `list_paginated_with_count()`
- `backend/app/api/recipes.py` — Use combined method
- `backend/app/api/ingredients.py` — Use combined method
- `backend/app/api/tastings.py` — Use combined method
- `backend/app/api/outlets.py` — Use combined method

#### P2: Shared httpx Client for Storage

Each storage upload/delete created a new `httpx.AsyncClient`, establishing a fresh TCP connection per operation.

**Fix**: Module-level singleton `httpx.AsyncClient` via `get_http_client()`, reused across all `StorageService` instances. Client closed during app shutdown via `close_http_client()`.

**Files Modified**:
- `backend/app/domain/storage_service.py` — `get_http_client()`, `close_http_client()`, reuse client in upload/delete
- `backend/app/main.py` — Call `close_http_client()` during app shutdown

#### P2: Reduce Commits in Menu Fork/Update

Menu fork issued 10+ individual `session.commit()` calls — one per section, one per item batch, one per outlet link.

**Fix**: Replaced intermediate `session.commit()` with `session.flush()` to get auto-generated IDs. Single `session.commit()` at the end of the operation.

**Files Modified**:
- `backend/app/domain/menu_service.py` — `flush()` for intermediate operations, single final `commit()`

#### P2: Bounded Costing Cache

The costing cache was an unbounded `dict` that grew without limit, risking memory exhaustion in long-running processes.

**Fix**: Replaced with `cachetools.TTLCache(maxsize=256, ttl=300)` — automatic eviction at 256 entries, 5-minute TTL.

**Files Modified**:
- `backend/app/api/costing.py` — `TTLCache` replaces manual dict + timestamp logic
- `backend/pyproject.toml` — Added `cachetools>=5.3.0` dependency

---

## [0.0.22] - 2026-03-06

### Fixed

#### `/recipes/new` — Canvas Not Showing Up

When navigating to `/recipes/new` from a non-canvas tab (e.g., Overview), the `canvasTab` state retained its previous value. The canvas editor never rendered because `TabContent` dispatched to the stale tab.

**Fix**: Added `setCanvasTab('canvas')` in the `useEffect` of `recipes/new/page.tsx` to force the canvas tab active on mount.

**Files Modified**:
- `frontend/src/app/recipes/new/page.tsx` — Force canvas tab on mount

#### Client-Side Exception After Creating a Recipe

After `createRecipe` returned and `router.push` fired, the new page called `useRecipe(newId)` but there was no cache entry yet. Also, metadata was reset to defaults before navigation, causing a flash of stale data while the component was still mounted.

**Fix**:
- Seed the individual recipe cache in `useCreateRecipe.onSuccess` so `useRecipe(newId)` returns data immediately on navigation
- Removed premature state reset (`setStagedIngredients`, `setStagedRecipes`, `setMetadata(DEFAULT_METADATA)`) before `router.push` — the component unmounts during navigation anyway

**Files Modified**:
- `frontend/src/lib/hooks/useRecipes.ts` — Seed `['recipe', newRecipe.id]` cache in `onSuccess`
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Removed premature state reset before navigation

#### Existing Recipe Shows "Untitled Recipe" on Load

Metadata initialized to `DEFAULT_METADATA` (name: "Untitled Recipe"). The loading effect waited for ALL three queries (recipe + ingredients + subrecipes) before setting metadata. Recipe data loaded faster, but name stayed wrong until ingredients/subrecipes finished.

**Fix**: Added a separate eager `useEffect` that sets metadata from recipe data as soon as it's available, without waiting for ingredients/subrecipes.

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Eager metadata load from recipe data

#### Submit Button Enable/Disable Logic

The Submit/Save button had incorrect enable/disable logic: it required ingredients to exist (`hasItems`) even for metadata-only saves, and it didn't track whether there were unsaved changes on existing recipes.

**Fix**: Submit button now disabled when name is empty, when no unsaved changes exist on an existing recipe, or when user is not the owner. No longer requires ingredients/subrecipes to exist.

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Improved submit button disabled conditions

#### Tasting Session — Already-Added Recipes/Ingredients Hidden

`SessionRecipesSection` and `SessionIngredientsSection` filtered out already-added items entirely via `.filter()`. Users wanted them visible but disabled so they can see what's already been added.

**Fix**: Show all recipes/ingredients in the dropdown. Already-added ones get `disabled` attribute, grayed-out styling, and an "Added" badge. Prevent selection via `onClick` guard. Also applied the same pattern to ingredients section.

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Show already-added items as disabled with "Added" badge

#### Ingredient Tasting Endpoint Missing Ingredient Names

The `GET /{session_id}/ingredients` endpoint returned raw `IngredientTasting` models without ingredient names, forcing the frontend to cross-reference a separate ingredients list.

**Fix**: Created `IngredientTastingRead` DTO with `ingredient_name` field. Service layer now JOINs `Ingredient` table to populate names. Frontend uses `si.ingredient_name` directly instead of looking up from a separate list.

**Files Modified**:
- `backend/app/models/ingredient_tasting.py` — Added `IngredientTastingRead` DTO
- `backend/app/models/__init__.py` — Export `IngredientTastingRead`
- `backend/app/domain/ingredient_tasting_service.py` — JOIN query to include ingredient name
- `backend/app/api/ingredient_tastings.py` — Use `IngredientTastingRead` response model
- `frontend/src/types/index.ts` — Added `ingredient_name` to `IngredientTasting` type
- `frontend/src/app/tastings/[id]/page.tsx` — Use `si.ingredient_name` directly

#### Recipe Tasting Endpoint Missing Recipe Names

The `GET /{session_id}/recipes` endpoint returned raw `RecipeTasting` models without recipe names, forcing the frontend to cross-reference a separately-loaded paginated recipe list. Recipe names showed as "Recipe #ID" until the list finished loading.

**Fix**: Created `RecipeTastingRead` DTO with `recipe_name` field. Service layer now JOINs `Recipe` table to populate names. Frontend uses `sr.recipe_name` directly instead of looking up from `availableRecipes`.

**Files Modified**:
- `backend/app/models/recipe_tasting.py` — Added `RecipeTastingRead` DTO
- `backend/app/models/__init__.py` — Export `RecipeTastingRead`
- `backend/app/domain/recipe_tasting_service.py` — JOIN query to include recipe name
- `backend/app/api/recipe_tastings.py` — Use `RecipeTastingRead` response model
- `frontend/src/types/index.ts` — Added `recipe_name` to `RecipeTasting` type
- `frontend/src/app/tastings/[id]/page.tsx` — Use `sr.recipe_name` directly

### Changed

#### Tasting Session — Server-Side Search with Infinite Scrolling

Replaced client-side filtering (loading 30 recipes/ingredients upfront) with server-side search using `useInfiniteRecipes` and `useInfiniteIngredients`. Search is debounced (300ms) and results load incrementally via "Load more" button.

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Lifted search state, debounced API calls, infinite scroll pagination
- `frontend/src/lib/hooks/useRecipes.ts` — Fixed infinite query key to `['recipes', 'infinite', params]` to avoid cache collisions
- `frontend/src/lib/hooks/useIngredients.ts` — Fixed infinite query key to `['ingredients', 'infinite', params]` to avoid cache collisions

---

## [0.0.21] - 2026-03-05

### Changed

#### Participant-Only Feedback Enforcement

Tasting note creation, editing, and deletion are now restricted to session participants only. Admins no longer bypass participant checks for feedback operations.

**Backend**:
- `tasting_notes.py` — Added `get_current_user` dependency to create, update, and delete note endpoints; only participants can add notes (403), only the original creator can edit/delete (403)
- `ingredient_tasting_notes.py` — Added participant check to create ingredient note endpoint
- `conftest.py` — Test fixtures now persist mock users in DB (required for participant lookups via `TastingUser` join)

**Frontend**:
- `tastings/[id]/r/[recipeId]/page.tsx` — Removed admin bypass from `isInvited`; removed `isAdmin` prop from `FeedbackNoteCard`; edit/delete buttons only shown for original poster
- `tastings/[id]/i/[ingredientId]/page.tsx` — Same participant-only and creator-only simplifications

**Tests**:
- `test_tastings.py` — Updated session creation to include `participant_ids`; added participant/non-participant/admin-non-participant feedback tests
- `test_ingredient_tasting_notes.py` — Added participant-only feedback tests; nonexistent session now returns 403
- `test_tasting_note_images.py` — Updated fixtures; added admin non-participant tests

#### Canvas Unit Price Auto-Conversion

Staged ingredients on the recipe canvas now store a `unitPrice` that auto-converts when the user changes units. Previously, unit cost was computed on-the-fly from suppliers each render and never adjusted for the display unit.

**Behavior**:
- When an ingredient is added → `unitPrice` initialized from `ingredient.cost_per_base_unit`
- When the user changes unit (e.g. g → kg) → `unitPrice` auto-converts via `convertUnitPrice()`
- When the user changes supplier → `unitPrice` recalculates from new supplier cost, converted to current display unit
- When suppliers load asynchronously → `unitPrice` updates to median supplier cost
- On save → `unitPrice` sent directly as `unit_price` with `base_unit` set to the display unit

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Added `unitPrice` to `StagedIngredient`; updated all creation sites, unit change handler, supplier change handler, cost display, submission logic, and `calculateCanvasCost`
- `frontend/src/lib/unitConversion.ts` — Added `convertUnitPrice()` utility (inverse of quantity conversion)
- `frontend/src/components/recipe/RecipeIngredientsList.tsx` — Unit change handler now recalculates `unit_price` via `convertUnitPrice()` and persists to backend

#### Selling Price Replaces Profit Margin

Canvas metadata `profit_margin` (percentage) replaced with `selling_price` (absolute dollar amount). Profit/loss per portion now computed as `selling_price - cost_per_portion` and displayed with color-coded badges (green for profit, red for loss).

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — `RecipeMetadata.selling_price` replaces `profit_margin`; selling price input and profit/loss display
- `frontend/src/types/index.ts` — Added `selling_price_est` to `CreateRecipeRequest`

### Fixed

#### Recipe Canvas Not Loading Existing Recipes

The canvas loading effect required the full `useRecipes()` paginated list to resolve before loading a selected recipe's ingredients. If the recipes list query was slow or failed, the canvas would appear empty even though the individual recipe data was available.

**Fix**: Added `useRecipe(selectedRecipeId)` to fetch the selected recipe directly. The loading effect no longer gates on the full recipes list — it proceeds as soon as `recipeIngredients` and `subRecipes` are available, using the single-recipe query for metadata.

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Added `useRecipe` hook; removed `recipes` from loading gate; used `selectedRecipeData` for metadata with `recipes` list as fallback

---

## [0.0.20] - 2026-03-04

### Added

#### Server-Side Pagination

All major list endpoints now support server-side pagination with `page_number`, `page_size`, and `search` query parameters, returning a standardized `PaginatedResponse` envelope with `items`, `page_number`, `current_page_size`, `total_count`, and `total_pages`.

**Backend**:
- New `PaginatedResponse` generic model (`backend/app/models/pagination.py`) with `create()` factory method
- `IngredientListRead` slim DTO for paginated ingredient responses (excludes relationships)
- `RecipeListRead` lean DTO for paginated recipe responses (excludes heavy text fields)
- `list_paginated()` and `count()` methods added to all six services:
  - `IngredientService` — supports `search`, `category_ids`, `units`, `allergen_ids`, `is_halal` filters
  - `RecipeService` — supports `search`, `category_ids` filters with access control
  - `SupplierService` — supports `search`, `active_only` filters
  - `OutletService` — supports `search`, `is_active`, `accessible_ids` filters
  - `TastingSessionService` — supports `search` filter with batch participant loading
  - `RecipeCategoryService` — supports `search` filter
- Each service uses `_build_list_query()` pattern to share filtering logic between `list_paginated()` and `count()`
- Outlet list endpoint now performs access control filtering at the SQL level (via `accessible_ids`) instead of Python-side loop

**Paginated API Endpoints**:
- `GET /ingredients` — `page_number`, `page_size`, `search`, `category_ids`, `units`, `allergen_ids`, `is_halal`
- `GET /recipes` — `page_number`, `page_size`, `search`, `category_ids`
- `GET /suppliers` — `page_number`, `page_size`, `search`
- `GET /outlets` — `page_number`, `page_size`, `search`
- `GET /tasting-sessions` — `page_number`, `page_size`, `search`
- `GET /recipe-categories` — `page_number`, `page_size`, `search`

**Frontend**:
- New `Pagination` component (`frontend/src/components/ui/Pagination.tsx`) with prev/next navigation and "X-Y of Z" display
- New `useDebouncedValue` hook for search input debouncing
- `PaginatedResponse<T>` TypeScript type added to `types/index.ts`
- API client param interfaces: `ListParams`, `RecipeListParams`, `IngredientListParams`, `SupplierListParams`, `OutletListParams`
- All list API functions (`getRecipes`, `getIngredients`, `getSuppliers`, `getOutlets`, `getTastingSessions`, `getRecipeCategories`) updated to accept pagination params and return `PaginatedResponse<T>`
- TanStack Query hooks updated to pass pagination params as query keys
- List pages updated to use pagination controls and server-side search

**Files Created**:
- `backend/app/models/pagination.py` — `PaginatedResponse` generic model
- `frontend/src/components/ui/Pagination.tsx` — Pagination UI component
- `frontend/src/lib/hooks/useDebouncedValue.ts` — Debounced value hook

**Files Modified**:
- `backend/app/api/ingredients.py` — Paginated list endpoint with filters
- `backend/app/api/recipes.py` — Paginated list endpoint with search and category filters
- `backend/app/api/suppliers.py` — Paginated list endpoint
- `backend/app/api/outlets.py` — Paginated list endpoint with SQL-level access control
- `backend/app/api/tastings.py` — Paginated list endpoint
- `backend/app/api/recipe_categories.py` — Paginated list endpoint
- `backend/app/domain/ingredient_service.py` — `list_paginated()`, `count()`, `_build_list_query()`, accessible outlet ID caching
- `backend/app/domain/recipe_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/supplier_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/outlet_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/tasting_session_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/recipe_category_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/models/ingredient.py` — Added `IngredientListRead` DTO
- `backend/app/models/recipe.py` — Added `RecipeListRead` DTO, indexed `owner_id` and `root_id`
- `backend/app/models/__init__.py` — Updated exports
- `backend/tests/test_ingredients.py` — Updated for paginated response shape
- `backend/tests/test_recipes.py` — Updated for paginated response shape
- `frontend/src/lib/api.ts` — Pagination param interfaces and updated list functions
- `frontend/src/lib/hooks/useRecipes.ts` — Pagination query key support
- `frontend/src/lib/hooks/useIngredients.ts` — Pagination query key support
- `frontend/src/lib/hooks/useSuppliers.ts` — Pagination query key support
- `frontend/src/lib/hooks/useOutlets.ts` — Pagination query key support
- `frontend/src/lib/hooks/useTastings.ts` — Pagination query key support
- `frontend/src/lib/hooks/useRecipeCategories.ts` — Pagination query key support
- `frontend/src/types/index.ts` — `PaginatedResponse<T>` type
- Multiple frontend pages updated for pagination UI

### Performance

#### Database Indexes & Connection Pooling

**Database Changes**:
- Added indexes on `Recipe.owner_id` and `Recipe.root_id` for faster access-control and version-tree queries
- Alembic migration `2682e67b2782_add_indexes_recipe_owner_id_root_id.py`

**Connection Pooling** (PostgreSQL):
- `pool_size=20`, `max_overflow=40`, `pool_recycle=3600`, `pool_pre_ping=True`
- SQLite skips pool configuration automatically

**Caching**:
- `IngredientService._accessible_outlet_ids_cache` — Per-request cache for outlet hierarchy lookups, avoiding repeated tree walks

**Files Modified**:
- `backend/app/database.py` — Connection pool configuration
- `backend/app/domain/ingredient_service.py` — Outlet ID caching

#### Next.js & Frontend Optimization

- Image format optimization: `formats: ["image/avif", "image/webp"]` in next.config.ts
- Package import optimization: `optimizePackageImports` for `@/lib/hooks`, `lucide-react`, `@tanstack/react-query`
- Static asset caching: `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/*`
- Compression enabled: `compress: true`
- Production source maps disabled: `productionBrowserSourceMaps: false`
- Removed 84 lines of duplicate dark mode CSS from `globals.css` (auto-dark-mode block already handled by `.dark` class)

**Files Modified**:
- `frontend/next.config.ts` — Image formats, package optimization, caching headers, compression
- `frontend/src/app/globals.css` — Removed redundant dark mode styles

**Files Created**:
- `backend/alembic/versions/2682e67b2782_add_indexes_recipe_owner_id_root_id.py`

---

## [0.0.19] - 2026-03-03

### Changed

#### Outlet-Scoped Supplier Ingredients

Supplier-ingredient links are now scoped per-outlet via a new `outlet_id` column on `supplier_ingredients`. Each supplier pricing entry belongs to a specific outlet, enabling different outlets to maintain independent supplier pricing for the same ingredient.

**Database Changes**:
- New `outlet_id` column on `supplier_ingredients` (FK to `outlets.id`, NOT NULL, indexed)
- Unique constraint updated from `(ingredient_id, supplier_id)` to `(ingredient_id, supplier_id, outlet_id)` — same supplier can serve same ingredient at different outlets with different pricing
- Alembic migration `g2h3i4j5k6l7` with backfill for existing rows

**Backend**:
- `SupplierIngredient` model includes `outlet_id` field with `Outlet` relationship
- `SupplierIngredientCreate` requires `outlet_id`; `SupplierIngredientUpdate` allows optional `outlet_id` change
- `SupplierIngredientRead` returns `outlet_id` and `outlet_name`
- Duplicate check now includes `outlet_id` in the uniqueness tuple

#### Hierarchical Outlet Access Control for Supplier Ingredients

Supplier-ingredient queries now respect the user's outlet hierarchy tree. Non-admin users only see supplier-ingredient links belonging to outlets in their tree (root → descendants).

**Backend**:
- `get_accessible_outlet_ids()` utility walks up to root then BFS down to collect all outlet IDs in the user's tree
- `get_ingredient_suppliers()`, `get_preferred_supplier()`, and `get_supplier_ingredients()` filter by accessible outlet IDs for non-admin users
- Admin users bypass filtering and see all supplier-ingredient links
- Non-admin users without an outlet see no supplier-ingredient data
- Only admins can change `outlet_id` on existing supplier-ingredient links (403 for non-admins)

**Files Created**:
- `backend/alembic/versions/g2h3i4j5k6l7_add_outlet_id_to_supplier_ingredients.py`
- `backend/tests/test_supplier_ingredient_outlet_scope.py` — 7 tests covering child-sees-parent, parent-sees-child, admin-sees-all, no-outlet isolation, cross-tree isolation, supplier endpoint filtering, and non-admin outlet change restriction

**Files Modified**:
- `backend/app/models/supplier_ingredient.py` — `outlet_id` field, updated unique constraint, `Outlet` relationship, DTOs
- `backend/app/domain/ingredient_service.py` — `get_accessible_outlet_ids()`, outlet filtering in queries
- `backend/app/domain/supplier_service.py` — Outlet filtering in `get_supplier_ingredients()`
- `backend/app/api/ingredients.py` — `get_current_user` dependency, outlet filtering params, admin-only outlet change guard
- `backend/app/api/suppliers.py` — `get_current_user` dependency, outlet filtering params
- `backend/tests/test_ingredients.py` — All supplier tests updated with `outlet_id`
- `backend/tests/test_suppliers.py` — Supplier ingredient tests updated with `outlet_id`

### Added

#### Outlet Selector in Supplier-Ingredient Forms

Frontend forms for adding supplier-ingredient links now include an outlet picker. Non-admin users have their outlet auto-selected and locked; admins can choose any outlet.

**Frontend**:
- Ingredient detail page (`/ingredients/[id]`) — outlet dropdown in add-supplier modal, outlet column in suppliers table
- Supplier detail page (`/suppliers/[id]`) — outlet dropdown in add-ingredient modal, outlet column in ingredients table
- `AddIngredientModal` — outlet picker per supplier entry
- Auth state (`store.tsx`) stores `outletId` from login response, persisted in localStorage
- Login page passes `outlet_id` to auth store

**Files Modified**:
- `frontend/src/app/ingredients/[id]/page.tsx` — Outlet selector and table column
- `frontend/src/app/suppliers/[id]/page.tsx` — Outlet selector and table column
- `frontend/src/components/ingredients/AddIngredientModal.tsx` — Outlet picker per supplier entry
- `frontend/src/lib/store.tsx` — `outletId` in auth state, login, logout, persistence
- `frontend/src/app/login/page.tsx` — Passes `outlet_id` from login response
- `frontend/src/types/index.ts` — `outlet_id` and `outlet_name` on `SupplierIngredient` type

---

## [0.0.18] - 2026-03-02

### Changed

#### Tasting Session Creator Tracking

Added `creator_id` column to tasting sessions, establishing explicit ownership of who created each session. Creators now have the same access privileges as participants.

**Database Changes**:
- New `creator_id` column on `tasting_sessions` (FK to `users.id`, nullable, indexed, SET NULL on delete)
- Legacy `attendees` JSON column dropped (replaced by `tasting_users` join table in 0.0.16)

**Backend**:
- `TastingSession` model includes `creator_id` field
- `TastingSessionRead` returns `creator_id` in API responses
- Service layer sets `creator_id` from authenticated user during session creation
- Access control updated: admins, creators, and participants can all access sessions

**Frontend**:
- Session detail page (`/tastings/[id]`) checks `creator_id` for access control
- Recipe tasting page (`/tastings/[id]/r/[recipeId]`) uses creator-based access check
- Ingredient tasting page (`/tastings/[id]/i/[ingredientId]`) uses creator-based access check
- 403 error handling displays "Access Denied" with back-navigation link

**Files Created**:
- `backend/alembic/versions/e1f2g3h4i5j6_add_creator_id_to_tasting_sessions.py`

**Files Modified**:
- `backend/app/models/tasting.py` — Added `creator_id` to model and read DTO
- `backend/app/domain/tasting_session_service.py` — Creator ID set on create
- `backend/app/api/tastings.py` — Access control includes creator check
- `backend/tests/test_tastings.py` — Tests assert `creator_id` in responses
- `frontend/src/app/tastings/[id]/page.tsx` — Creator-based access check
- `frontend/src/app/tastings/[id]/r/[recipeId]/page.tsx` — Creator-based access check
- `frontend/src/app/tastings/[id]/i/[ingredientId]/page.tsx` — Creator-based access check
- `frontend/src/types/index.ts` — Added `creator_id` to `TastingSession` type

#### Simplified Participant Management (ID-Based)

Replaced email-based `attendees` field with direct `participant_ids` (user ID array) on create/update DTOs. Removes email-to-user resolution overhead.

**Changes**:
- `TastingSessionCreate` and `TastingSessionUpdate` accept `participant_ids: List[str]` instead of `attendees: List[str]`
- Service layer creates `TastingUser` rows directly by user ID (no email lookup)
- Frontend sends user IDs from `ParticipantPicker` component directly

**Files Modified**:
- `backend/app/models/tasting.py` — Schema DTOs use `participant_ids`
- `backend/app/domain/tasting_session_service.py` — Direct ID-based participant creation
- `frontend/src/app/tastings/new/page.tsx` — Sends `participant_ids` from selected users
- `frontend/src/app/tastings/[id]/page.tsx` — Updates participants via `participant_ids`

### Added

#### Quick-Add Ingredient from Search

Added a quick-create shortcut in the RightPanel ingredient library — when a search term yields no matches, a "Add [term]" button appears to instantly create the ingredient with auto-categorization.

**Features**:
- Quick-add button appears when search has no matching ingredients
- Auto-categorizes via AI category agent during creation
- Loading overlay with spinner during ingredient creation
- Tabs and search disabled while creation is in progress
- Created ingredient uses default unit `g` and no cost (editable later)

**Files Modified**:
- `frontend/src/components/layout/RightPanel.tsx` — Quick-add flow with loading state

#### Past-Date Invitation Guard

SMS/email invitations are now skipped when the tasting session date is in the past, preventing unnecessary sends for historical sessions.

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Early return with `email_count: 0, sms_count: 0` for past sessions

#### Supplier-Ingredient Normalization (JSONB → Join Table)

Replaced the `suppliers` JSONB column on the `Ingredient` model with a proper `supplier_ingredients` join table, normalizing the supplier-ingredient relationship for better data integrity, querying, and referential constraints.

**Database Changes**:
- New `supplier_ingredients` table with FK constraints to `ingredients` and `suppliers`
- Unique constraint on `(ingredient_id, supplier_id)` prevents duplicates
- Unique constraint on `sku` for SKU-level deduplication
- Indexes on `ingredient_id` and `supplier_id` for efficient lookups
- Dropped `suppliers` JSONB column from `ingredients` table
- Dropped unused `sort_order` column from `recipe_ingredients` table

**Backend**:
- New `SupplierIngredient` model with `SupplierIngredientCreate`, `SupplierIngredientUpdate`, and `SupplierIngredientRead` DTOs
- `IngredientService` rewritten: supplier CRUD now operates on `supplier_ingredients` rows instead of JSONB array manipulation
- `SupplierService.get_supplier_ingredients()` uses JOIN query with `selectinload` instead of scanning all ingredients
- `CostingService` updated: looks up `SupplierIngredient` row by `(ingredient_id, supplier_id)` to derive unit price from `price_per_pack / pack_size`
- Removed `SupplierEntry`, `SupplierEntryCreate`, `SupplierEntryUpdate` schemas from ingredient model
- API endpoints now return `SupplierIngredientRead` DTOs with nested `supplier_name` and `ingredient_name`

**Frontend**:
- `SupplierIngredient` type replaces `IngredientSupplierEntry`, `AddIngredientSupplierRequest`, `UpdateIngredientSupplierRequest`, and `SupplierIngredientEntry`
- API client updated: supplier CRUD functions use numeric `supplierIngredientId` instead of string `supplierId`
- Ingredient detail page (`/ingredients/[id]`) updated for new supplier data shape
- Supplier detail page (`/suppliers/[id]`) updated for `SupplierIngredient` response type
- `AddIngredientModal` simplified (no longer passes suppliers on create)
- Canvas supplier selection: `StagedIngredientCard` shows supplier dropdown with per-unit cost calculation
- `RecipeIngredientRow` and `RecipeIngredientsList` updated for removed `sort_order` field
- Removed `ReorderIngredientsRequest` type and `reorderRecipeIngredients` API function

**Files Created**:
- `backend/app/models/supplier_ingredient.py` — `SupplierIngredient` model and DTOs
- `backend/alembic/versions/f1g2h3i4j5k6_refactor_supplier_ingredients.py` — Migration

**Files Modified**:
- `backend/app/models/ingredient.py` — Removed JSONB `suppliers` field and `SupplierEntry` schemas
- `backend/app/models/supplier.py` — Added `supplier_ingredients` relationship
- `backend/app/models/recipe_ingredient.py` — Removed `sort_order` field
- `backend/app/models/__init__.py` — Updated exports
- `backend/app/domain/ingredient_service.py` — Rewritten supplier CRUD
- `backend/app/domain/supplier_service.py` — JOIN-based ingredient lookup
- `backend/app/domain/costing_service.py` — Supplier-aware unit price resolution
- `backend/app/domain/recipe_service.py` — Removed sort_order references
- `backend/app/api/ingredients.py` — Updated supplier endpoints
- `backend/app/api/recipe_ingredients.py` — Removed reorder endpoint
- `backend/app/api/suppliers.py` — Updated response model
- `backend/scripts/seed_ingredients.py` — Updated for new supplier model
- `backend/tests/test_ingredients.py` — Expanded supplier CRUD tests
- `backend/tests/test_recipes.py` — Updated for removed sort_order
- `backend/tests/test_suppliers.py` — Updated for SupplierIngredient response
- `frontend/src/types/index.ts` — Consolidated supplier types
- `frontend/src/lib/api.ts` — Updated supplier API functions
- `frontend/src/lib/hooks/useIngredients.ts` — Updated hook types
- `frontend/src/lib/hooks/useRecipeIngredients.ts` — Removed reorder hook
- `frontend/src/lib/hooks/useSuppliers.ts` — Updated for SupplierIngredient
- `frontend/src/app/ingredients/[id]/page.tsx` — Updated supplier UI
- `frontend/src/app/suppliers/[id]/page.tsx` — Updated ingredient list UI
- `frontend/src/components/ingredients/AddIngredientModal.tsx` — Simplified
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Supplier dropdown + cost calc
- `frontend/src/components/recipe/RecipeIngredientRow.tsx` — Removed sort_order
- `frontend/src/components/recipe/RecipeIngredientsList.tsx` — Removed sort_order

---

## [0.0.17] - 2026-02-27

### Changed

#### Canvas Layout Redesign

Replaced game-card styled components with clean, compact list-item design across the recipe canvas for a more professional, minimal look.

**Changes**:
- RightPanel (ingredient palette) redesigned with compact list-item rows instead of large cards
- CanvasTab overhauled with streamlined, minimal UI for recipe ingredients and sub-recipes
- TopAppBar tabs switched to pill-style design for cleaner navigation
- Tabs hidden on new recipe page until recipe is saved
- Menu preview always shows substitution field for consistency

**Files Modified**:
- `frontend/src/components/layout/RightPanel.tsx` — List-item redesign
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Compact ingredient/sub-recipe UI
- `frontend/src/components/layout/CanvasLayout.tsx` — Layout adjustments
- `frontend/src/components/layout/TopAppBar.tsx` — Pill-style tabs
- `frontend/src/app/recipes/new/page.tsx` — Hide tabs on new recipe
- `frontend/src/app/menu/preview/[id]/page.tsx` — Always show substitution field

#### Supplier UI Polish

Enhanced supplier management interface with unarchive support, visual indicators, and better text handling.

**Changes**:
- Supplier unarchive/restore functionality with ArchiveRestore icon button
- `OverflowTooltip` component for truncated text with hover titles
- "Archived" badge displayed on inactive suppliers in both card and list views
- `is_active` field added to `UpdateSupplierRequest` type for reactivation
- Navigation labels visible at `xl` breakpoint (down from `2xl`) for better usability

**Files Modified**:
- `frontend/src/app/suppliers/page.tsx` — Unarchive actions and archived badges
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Archived badge in list view
- `frontend/src/components/layout/TopNav.tsx` — Nav label breakpoint change
- `frontend/src/types/index.ts` — Added `is_active` to update type

### Added

#### Menu Publish/Unpublish

Added publish and unpublish workflow for menus, enabling status management from draft to published state.

**Features**:
- `POST /menus/{id}/publish` and `POST /menus/{id}/unpublish` backend endpoints
- Service-layer `publish_menu()` and `unpublish_menu()` methods
- `usePublishMenu` and `useUnpublishMenu` frontend hooks
- Status toggle UI on menu management page with visual publish state indicator

**Files Modified**:
- `backend/app/api/menus.py` — Publish/unpublish endpoints
- `backend/app/domain/menu_service.py` — Publish/unpublish service methods
- `frontend/src/app/menu/page.tsx` — Status toggle UI
- `frontend/src/lib/api.ts` — API client methods
- `frontend/src/lib/hooks/useMenus.ts` — Mutation hooks

#### Supplier Endpoint Tests

Added comprehensive test coverage for supplier API endpoints.

**Tests**:
- 11 new tests covering deactivate, reactivate, `active_only` filtering, and 404 error cases
- Validates soft-delete and restore behavior end-to-end

**Files Created**:
- `backend/tests/test_suppliers.py` — 11 supplier endpoint tests

### Performance

#### Backend Query Optimization

Eliminated N+1 query patterns across multiple services with batch fetching and SQL-level filtering.

**Optimizations**:
- **Outlet hierarchy/cycle detection** — Replaced recursive single-row fetches with batch `SELECT IN` queries in `outlet_service.py`
- **BOM tree** — Batch-loaded sub-recipe links and recipes in `subrecipe_service.py` instead of per-node queries
- **Tasting session participants** — Single JOIN query to load all participants with user details in `tasting_session_service.py`
- **Recipe list access control** — SQL-level subquery filtering replaces Python-side loop filtering in `recipe_service.py`; removed debug print statements from recipe access control
- **Recipe access control cleanup** — Removed debug `print()` statements from `recipes.py` router

**Files Modified**:
- `backend/app/domain/outlet_service.py` — Batch hierarchy queries
- `backend/app/domain/subrecipe_service.py` — Batch BOM tree loading
- `backend/app/domain/tasting_session_service.py` — JOIN-based participant loading
- `backend/app/domain/recipe_service.py` — SQL subquery access filtering
- `backend/app/api/recipes.py` — Removed debug prints

#### Frontend Caching & Memoization

Optimized React rendering and TanStack Query cache behavior to reduce unnecessary re-renders and API calls.

**Optimizations**:
- **`RecipeIngredientRow`** — Wrapped with `React.memo` and memoized supplier options to prevent re-renders on parent state changes
- **Recipe ID stabilization** — Stabilized recipe ID references in `RecipeManagementTab` to avoid cascading re-renders
- **Scoped cache invalidation** — Cache invalidation for outlets and tasting notes scoped to specific IDs instead of broad invalidation
- **Increased stale time** — TanStack Query stale time increased from default to 5 minutes to reduce refetch frequency

**Files Modified**:
- `frontend/src/components/recipe/RecipeIngredientRow.tsx` — `React.memo` wrapper
- `frontend/src/components/recipes/RecipeManagementTab.tsx` — Stable ID refs
- `frontend/src/lib/hooks/useRecipeOutlets.ts` — Scoped invalidation
- `frontend/src/lib/hooks/useTastings.ts` — Scoped invalidation
- `frontend/src/lib/providers.tsx` — 5-minute stale time

---

## [0.0.16] - 2026-02-26

### Added

#### SMS Invitations for Tasting Sessions

Integrated Twilio SMS delivery for tasting session invitations, providing multi-channel communication alongside email.

**Features**:
- Twilio SMS integration for sending SMS invitations to tasting session participants
- Parallel email (SendGrid) and SMS (Twilio) delivery in single API call
- Graceful degradation if Twilio not configured—falls back to email-only without errors
- SMS includes session name, date, location, and invite link in plain text format
- Participant phone numbers managed through `TastingParticipant` type with optional `phone_number` field
- API response includes `email_count` and `sms_count` for delivery transparency

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Added Twilio integration
- `frontend/src/lib/hooks/useSendTastingInvitation.ts` — Updated recipient type and response schema
- `frontend/src/app/tastings/new/page.tsx` — Updated invitation caller to pass phone numbers
- `frontend/package.json` — Added `twilio` dependency

**Environment Variables**:
- `TWILIO_ACCOUNT_SID` — Twilio account identifier
- `TWILIO_AUTH_TOKEN` — Twilio authentication token
- `TWILIO_FROM_NUMBER` — Twilio phone number for sending SMS

#### Tasting Session Participant Association

Replaced email-based attendee lists with proper user-session relationships via `TastingUser` join table.

**Features**:
- `TastingUser` many-to-many join table links users to tasting sessions
- `TastingUserRead` DTO displays participant names and emails from User table (instead of email strings)
- Email-to-user resolution in service layer (`_resolve_attendees_to_users()`) with silent skipping of unregistered emails
- Access control: non-admin users can only access sessions they participate in (403 Forbidden otherwise)
- Admin users bypass participant check for unrestricted access
- Backward compatibility: `attendees` field retained on request DTOs for wire compatibility

**Database Changes**:
- New `TastingUser` model as join table
- Alembic migration creates `tasting_users` table
- Cascade delete on session deletion, SET NULL on user deletion
- Unique constraint on (session_id, user_id) prevents duplicate participation

**API Changes**:
- All tasting endpoints return `TastingSessionRead` with `participants: List[TastingUserRead]`
- Non-admin GET/PATCH/DELETE now require user participation or admin status
- Email lookup happens transparently during create/update operations

**Frontend**:
- New `ParticipantPicker` component for user selection during session creation
- Uses existing `useUsers()` hook for user lookup
- Supports search by username or email
- Displays selected user badges with removal capability

**Test Coverage**:
- 26/26 tests passing with participant resolution and access control validation
- Tests verify unregistered email skipping and admin access override

**Files Modified**:
- `backend/app/models/tasting.py` — Added `TastingUser` and `TastingUserRead`
- `backend/app/domain/tasting_session_service.py` — Service layer improvements
- `backend/app/api/tastings.py` — API router updates with access control
- `backend/tests/test_tastings.py` — Comprehensive test coverage

#### Menu Management Enhancements

Enhanced menu builder with drag-and-drop reordering and new editable metadata fields.

**Features**:
- Drag-and-drop reordering for menu sections and individual menu items
- Real-time order number updates during drag operations
- New `key_highlights` textarea field for signature items, seasonal specials, etc. (appears first)
- New `additional_info` textarea field for dietary notes, preparation tips, etc. (appears second)
- `DraggableSection` component wrapper for section-level drag handling
- `DraggableItem` component wrapper for item-level drag handling
- Visual feedback with opacity changes during drag operations
- Grip icons for clear drag handles
- Support for both create mode (no IDs) and update mode (with existing IDs)

**Components**:
- `MenuBuilder.tsx` — Main component managing drag-drop state and operations
- `DraggableSection` — Section wrapper with drag handle
- `DraggableItem` — Item wrapper with drag handle
- Proper type handling for `MenuItem` model fields

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — Full drag-and-drop implementation

---

## [0.0.15] - 2026-02-23

### Added

#### Admin User Management & Route Access Control

Implemented admin user management system with role-based access control to protect admin-only routes.

**Features**:
- Admin user model and database support
- Admin identification in user authentication
- Protected admin routes with access control checks
- Fix for infinite loop on admin pages for non-admin users

#### Hierarchical Outlet-Based Access Control

Implemented comprehensive outlet hierarchy-based access control system for recipes and tasting sessions.

**Features**:
- Hierarchical outlet-based recipe filtering
- User access restricted to outlets within their hierarchy
- Recipe access control based on user outlet assignment
- Read-only mode for users without edit permissions
- Outlet hierarchy validation for access checks

**API Enhancements**:
- Enhanced recipe endpoints with outlet-based filtering
- Tasting session endpoints with user hierarchy access control
- Outlet hierarchy tree support for permission validation

#### Allergen Management System

Complete allergen tracking and display system for ingredients and recipes.

**New Features**:
- Allergen field on `Ingredient` model for tracking allergen information
- Allergen display across recipe views (ingredients panel, recipe detail, BOM)
- Ingredient allergen data management through ingredient detail UI
- Hierarchical allergen display in recipe sub-recipes and BOM tree

**Files Created/Modified**:
- Ingredient model extended with allergen field
- Recipe/ingredient components updated to display allergens
- Allergen badges in ingredient lists and recipe views

#### Supplier Soft Delete

Implemented soft delete functionality for suppliers to maintain referential integrity.

**Features**:
- Soft delete support for supplier records
- Archived suppliers remain available for historical reference
- Deactivation logic prevents orphaning ingredient-supplier links

### Fixed

- **JWT Token Regeneration**: Fixed token refresh endpoint to properly handle JWT token regeneration
- **Tasting Notes Access**: Allow tasting notes to be accessible regardless of recipe permissions (users can view tasting history even without full recipe edit access)
- **Admin Page Infinite Loop**: Fixed infinite loop occurring on admin pages for non-admin users

---

## [0.0.14] - 2026-02-12

### Added

#### Parent Outlet Recipes Display (Plan 06)

Implemented read-only display of parent outlet recipes linked to child outlets within the outlet hierarchy.

**Features**:
- Parent outlet recipes displayed in dedicated table on outlet detail page
- Read-only view showing all recipes from parent outlet(s)
- Supports multi-level hierarchy visualization
- Non-editable display to prevent accidental modifications

**Files Modified**:
- `frontend/src/components/outlets/OutletDetail.tsx`
- `frontend/src/app/outlets/[id]/page.tsx`

---

## [0.0.13] - 2026-01-28

### Added

#### Ingredient Tasting Features

Complete standalone tasting note system for individual ingredients, separate from recipe tasting sessions.

**New Features**:
- Standalone tasting notes for ingredients with ratings and feedback
- Image support for ingredient tasting notes (upload, view, delete)
- Auto-categorization via ingredient category agent
- Display of tasting history on ingredient detail pages

**UI Enhancements**:
- Ingredient tasting notes panel in ingredient detail view
- Image upload with preview and management
- Integration with existing tasting note images infrastructure

#### Canvas & Input Enhancements

**Text-Based Ingredient Addition**:
- Add ingredients directly by typing text in canvas ingredient panel
- Alternative to drag-and-drop workflow for rapid entry
- Automatic ingredient lookup and linking

**Right Panel Collapsibility**:
- Horizontal collapsible right panel (ingredient palette)
- Improved canvas real estate for larger ingredient displays
- Persistent collapse state

**Display Improvements**:
- Show usernames instead of user IDs in recipe overview
- Display parent outlet names instead of IDs in outlet management
- Image URL denormalization in Recipe model for optimized display
- Add missing `is_halal` property to fallback Ingredient objects

**Fixes**:
- Fixed overlapping items in Canvas card view layout
- Fixed ingredient/recipe dropdown table functionality
- Fixed category cache invalidation on ingredient creation

**Files Created/Modified**:
- `frontend/src/components/ingredients/IngredientTastingPanel.tsx`
- `frontend/src/hooks/useIngredientTasting.ts`
- Updated CanvasTab, RightPanel, and ingredient detail components

---

## [0.0.12] - 2026-01-21

### Added

#### Wastage Tracking & Recipe Costing

Integrated wastage percentage tracking into recipe ingredients with full cost impact calculations.

**Features**:
- Recipe ingredients track `wastage_percentage` (0-100) field
- Wastage percentage displayed in ingredient table with inline editing
- Cost calculations automatically factor in wastage
- `adjusted_cost_per_unit` reflects final cost including wastage impact

#### Multi-Image Recipe Gallery

Complete multi-image support for recipes with main image selection and carousel display.

**New Models/Features**:
- `RecipeImage` model with `is_main` flag and `order` field
- Multiple images per recipe with sequence ordering
- Main image selection UI in recipe overview
- Image carousel display on recipe cards and detail pages
- Automatic main image fallback if not explicitly set

**Migration**: Added RecipeImage table with indexes

#### Recipe Enhancements

**R&D Workflow Flags**:
- `rnd_started` flag — Marks when R&D work begins on a recipe
- `review_ready` flag — Indicates recipe is ready for review/approval
- Toggle controls in recipe overview tab

**Recipe Description Editing**:
- In-line description editing in Overview tab
- Markdown support in descriptions
- Auto-save on blur

**Profit Margin & Selling Price**:
- Calculate and display profit margin in canvas tab
- Recommended selling price based on cost + markup
- Configurable profit margin inputs
- Cost price denormalization on recipe save

#### Outlet Management Enhancements

**Outlet Hierarchy & Cycle Detection**:
- Implement parent-child relationships between outlets
- Cycle detection prevents circular hierarchies
- Outlet hierarchy tree visualization
- Deactivation of outlets with cascade considerations

**Recipe-Outlet Management UI**:
- Assign recipes to multiple outlets
- Per-outlet activation status
- Per-outlet price overrides
- Outlet badges on recipe cards
- Detail page outlet management tab

#### UI/UX Improvements

**Grid/List View Toggle**:
- Implement across inventory pages (ingredients, recipes, suppliers)
- Persistent view preference storage
- Card view (grid) and list view options
- Optimized layouts for each view type

**AI Feedback Summary**:
- AI-powered tasting feedback summarization endpoint
- Integration in recipe overview tab
- Manual trigger button for feedback generation
- Summary display and editing

**Files Created/Modified**:
- `backend/app/models/recipe_image.py`
- `backend/app/domain/recipe_image_service.py`
- `backend/app/api/recipe_outlets.py`
- Frontend components for outlet management and grid/list toggle
- Canvas tab enhancements for profit margin and cost price

#### Fixes

- Fixed routing to new canvas page
- Fixed Supabase storage mock in tests
- Fixed type errors for recipe page in R&D
- Fixed CanvasTab submit button display issues
- Fixed RightPanel disappearance bugs
- Resolve TypeScript and ESLint errors in frontend
- Fixed recipe description display in individual recipe page

---

## [0.0.11] - 2026-01-23

### Added

#### User Authentication System (Complete Integration)

Full Supabase authentication integration with user roles and session management.

**Features**:
- Supabase Auth login/logout functionality
- JWT token management (access + refresh tokens)
- User role support (normal/admin)
- Outlet assignment per user
- AuthGuard component for route protection
- Session expiration handling with auto-refresh

**New Frontend Pages**:
- `/login` — Login page with Supabase integration
- `/register` — Registration page
- Home page redirect based on auth state

**New Backend Endpoints**:
- `POST /auth/login` — Login with email/password
- `POST /auth/register` — Register new user
- `POST /auth/refresh` — Refresh JWT token

**New Models**:
- `User` model with email, username, user_type, outlet_id reference

**Files Created**:
- `backend/app/domain/supabase_auth_service.py`
- `backend/app/domain/user_service.py`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`

#### Recipe Category Management

Complete category system for organizing and filtering recipes.

**New Models**:
- `RecipeCategory` — Recipe category definition with name, description
- `RecipeRecipeCategory` — Junction table for recipe-category many-to-many relationships

**New API Endpoints** (7 total):
- `/recipe-categories` — CRUD for recipe categories
- `/recipe-recipe-categories` — CRUD for recipe-category links
- `/recipe-recipe-categories/recipe/{recipe_id}` — Get categories for recipe
- `/recipe-recipe-categories/category/{category_id}` — Get recipes in category

**New Frontend Pages**:
- `/recipe-categories` — Category list and management
- `/recipe-categories/[id]` — Category detail with recipe management

**UI Components**:
- `RecipeCategoryCard` — Category display card
- `RecipeCategoryFilterButtons` — Filter buttons for category selection
- `AddRecipeCategoryModal` — Modal for creating/editing categories
- Recipe category badges on recipe cards

**Features**:
- Assign multiple categories to recipes
- Filter recipes by category
- Add/edit/delete recipe categories
- View recipes grouped by category

#### Tasting Note Image Management

Integrated image upload and management for tasting note entries.

**Features**:
- Multiple images per tasting note
- Drag-and-drop image upload with preview
- Base64 encoding for storage
- Supabase Storage integration for persistent storage
- Batch sync operations (add/update/delete)
- Collapsible image gallery view on tasting pages

**New Endpoint**:
- `POST /tasting-note-images/sync/{tasting_note_id}` — Atomic sync operation

**UI Component**:
- `ImageUploadPreview` — Reusable image upload component

#### Branding Updates

Updated application branding and logo references throughout the codebase.

**Changes**:
- Updated logo assets and references
- Consistent branding across pages
- Updated documentation references

**Files Modified**:
- Navigation components
- Layout files
- Documentation (README, CLAUDE.md)

#### Fixes

- Removed `any` types from auth pages
- Added `AuthApiError` interface for type safety
- Show recipe description on individual recipe R&D page
- Improved error handling in auth flows

---

## [0.0.10] - 2025-12-18

### Added

#### Tasting Notes Feature (Plan 05)

Complete R&D feedback tracking system for recipe tasting sessions.

**New Models**:
- `TastingSession` — Tasting event with name, date, location, attendees
- `TastingNote` — Per-recipe feedback with 1-5 star ratings, decision, action items
- `TastingDecision` — Enum: `approved`, `needs_work`, `rejected`
- `RecipeTastingSummary` — Aggregated tasting data for a recipe

**New Database Tables**:
- `tasting_sessions` — with indexes on date and name
- `tasting_notes` — with indexes on session_id and recipe_id, cascade delete

**New API Endpoints** (13 total):
- `/tasting-sessions` — CRUD for tasting sessions
- `/tasting-sessions/{id}/stats` — Session statistics
- `/tasting-sessions/{id}/notes` — CRUD for notes within a session
- `/recipes/{id}/tasting-notes` — Recipe's tasting history
- `/recipes/{id}/tasting-summary` — Recipe's aggregated summary

**New Frontend Pages**:
- `/tastings` — List of all tasting sessions with search
- `/tastings/new` — Create new session form
- `/tastings/[id]` — Session detail with notes, ratings, and editing

**Recipe Detail Integration**:
- Added "Tasting History" section showing recent tastings
- Displays average rating, decision badges, feedback excerpts
- Links to full tasting session

**UI Enhancements**:
- Added `destructive` variant to Badge component
- Added "Tastings" to TopNav with Wine icon
- Star rating component with 1-5 interactive stars

**Migration**: `c3d4e5f6g7h8_add_tasting_tables.py`

**Docs**: `docs/completions/plan-05-tasting-notes.md`

---

## [0.0.9] - 2025-12-17

### Fixed

#### Enum-to-VARCHAR Mismatch

The `/api/v1/ingredients` endpoint was returning 500 errors due to a mismatch between Python Enum types and database VARCHAR storage.

**Root Cause**: The Alembic migration created `category` and `source` as VARCHAR columns, but the SQLModel used Python Enums without explicit `sa_column`. SQLModel interpreted these as native PostgreSQL ENUMs using member **names** (FMH, MANUAL) instead of **values** (fmh, manual), causing `LookupError` on read.

**Fix**: Changed `Ingredient` model to use explicit `sa_column=Column(String(...))` for enum-like fields, ensuring VARCHAR storage.

```python
# Before (broken)
source: IngredientSource = Field(default=IngredientSource.MANUAL)

# After (fixed)
source: str = Field(
    default="manual",
    sa_column=Column(String(20), nullable=False, default="manual")
)
```

**Files Modified**: `backend/app/models/ingredient.py`

#### CORS Origins Update

Added Vercel deployment domain to allowed CORS origins:

```
https://prepper-one.vercel.app
```

**Docs**: `docs/completions/enum-varchar-fix.md`

---

## [0.0.8] - 2025-12-17

### Added

#### Frontend Multi-Page Expansion (Plan 03)

Expanded the frontend from a single recipe canvas to a multi-page application with dedicated views for ingredients, recipes, R&D, and finance.

**New Routes**:
- `/ingredients` — Ingredients Library with search, grouping, and filtering
- `/recipes` — Recipes Gallery with status filtering and search
- `/recipes/[id]` — Individual Recipe detail page with costing and instructions
- `/rnd` — R&D Workspace for experimental recipes and ingredient exploration
- `/finance` — Finance Reporting placeholder (awaiting Atlas integration)

**New UI Components**:
- `TopNav` — Global navigation bar with active state highlighting
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` — Composable card components
- `MasonryGrid` — Pinterest-style responsive grid (using react-masonry-css)
- `GroupSection` — Section with title and count badge for grouped content
- `PageHeader` — Page title, description, and action buttons
- `SearchInput` — Search input with clear button

**New Domain Components**:
- `IngredientCard` — Ingredient display card with hover actions
- `RecipeCard` — Recipe display card with status badge and cost

**Layout Changes**:
- Root layout now includes `TopNav` for global navigation
- `TopAppBar` simplified (logo moved to TopNav)
- Responsive design: mobile-friendly layouts for all new pages

**Library**: Added `react-masonry-css` for masonry grid layout

**Docs**: `docs/completions/plan-03-frontend-pages.md`

---

## [0.0.7] - 2025-12-17

### Added

#### Recipe Extensions (Plan 02)

Extended the `Recipe` model to support sub-recipe linking (BOM hierarchy), authorship tracking, and outlet/brand attribution.

**1. Sub-Recipes (Recipe-to-Recipe Linking)**

New `recipe_recipes` junction table enables Bill of Materials hierarchy where recipes can include other recipes as components (e.g., "Eggs Benedict" includes "Hollandaise Sauce").

**New Model**: `RecipeRecipe`
- `parent_recipe_id` / `child_recipe_id` — Recipe linking
- `quantity` + `unit` — Supports `portion`, `batch`, `g`, `ml`
- `position` — Display order
- Check constraint prevents self-references

**New API Endpoints**:
- `GET /recipes/{id}/sub-recipes` — List sub-recipes
- `POST /recipes/{id}/sub-recipes` — Add sub-recipe (with cycle detection)
- `PUT /recipes/{id}/sub-recipes/{link_id}` — Update quantity/unit
- `DELETE /recipes/{id}/sub-recipes/{link_id}` — Remove sub-recipe
- `POST /recipes/{id}/sub-recipes/reorder` — Reorder sub-recipes
- `GET /recipes/{id}/used-in` — Reverse lookup (what recipes use this?)
- `GET /recipes/{id}/bom-tree` — Full BOM hierarchy tree

**Costing**: `CostingService` now recursively calculates sub-recipe costs with cycle detection.

**2. Authorship Tracking**

**New Recipe Columns**:
- `created_by` (VARCHAR 100) — Who created the recipe
- `updated_by` (VARCHAR 100) — Who last modified it

**3. Outlet/Brand Attribution**

New `outlets` and `recipe_outlets` tables for multi-brand operations.

**New Model**: `Outlet`
- `name`, `code` — Brand/location identification
- `outlet_type` — `"brand"` or `"location"`
- `parent_outlet_id` — Hierarchical structure support

**New Model**: `RecipeOutlet` (junction)
- `recipe_id` / `outlet_id` — Many-to-many linking
- `is_active` — Per-outlet activation
- `price_override` — Outlet-specific pricing

**New API Endpoints**:
- `POST /outlets` — Create outlet
- `GET /outlets` — List outlets
- `GET /outlets/{id}` — Get outlet
- `PATCH /outlets/{id}` — Update outlet
- `DELETE /outlets/{id}` — Deactivate outlet
- `GET /outlets/{id}/recipes` — Recipes for outlet
- `GET /outlets/{id}/hierarchy` — Outlet tree
- `GET /recipes/{id}/outlets` — Outlets for recipe
- `POST /recipes/{id}/outlets` — Assign to outlet
- `PATCH /recipes/{id}/outlets/{outlet_id}` — Update (price override)
- `DELETE /recipes/{id}/outlets/{outlet_id}` — Remove from outlet

**Migration**: `b2c3d4e5f6g7_add_recipe_extensions.py`

**Files Created**:
- `backend/app/models/recipe_recipe.py`
- `backend/app/models/outlet.py`
- `backend/app/domain/subrecipe_service.py`
- `backend/app/domain/outlet_service.py`
- `backend/app/api/sub_recipes.py`
- `backend/app/api/outlets.py`

---

## [0.0.6] - 2025-12-17

### Added

#### Ingredient Data Model Enhancements (Plan 01)

Extended the `Ingredient` model to support multi-supplier pricing, canonical ingredient linking, and food categorization.

**New Database Columns**:
- `suppliers` (JSONB) — Array of supplier entries with pricing, currency, SKU
- `master_ingredient_id` (FK) — Self-referential link to canonical/master ingredient
- `category` (VARCHAR) — Food category enum (proteins, vegetables, dairy, etc.)
- `source` (VARCHAR) — Origin tracking: `"fmh"` or `"manual"`

**New API Endpoints**:
- `GET /ingredients/categories` — List all food categories
- `GET /ingredients/{id}/variants` — Get variants linked to a master ingredient
- `POST /ingredients/{id}/suppliers` — Add supplier entry
- `PATCH /ingredients/{id}/suppliers/{supplier_id}` — Update supplier
- `DELETE /ingredients/{id}/suppliers/{supplier_id}` — Remove supplier
- `GET /ingredients/{id}/suppliers/preferred` — Get preferred supplier

**New Query Filters**:
- `GET /ingredients?category=proteins` — Filter by food category
- `GET /ingredients?source=fmh` — Filter by source
- `GET /ingredients?master_only=true` — Only top-level ingredients

**Migration**: `a1b2c3d4e5f6_add_ingredient_enhancements.py`

**Docs**: `docs/completions/plan-01-ingredient-enhancements.md`

---

## [0.0.5] - 2025-12-03

### Added

#### AI-Powered Instructions Parsing

Integrated Vercel AI SDK with OpenAI GPT-5.1 to transform freeform recipe instructions into structured steps.

**Stack**: Vercel AI SDK, `@ai-sdk/openai`, Zod schema validation

**Features**:
- Natural language → structured JSON with `order`, `text`, `timer_seconds`, `temperature_c`
- Automatic duration extraction (e.g., "5 minutes" → 300 seconds)
- Automatic temperature conversion (e.g., "350°F" → 177°C)
- Loading state with animated spinner

**Files**:
- `frontend/src/app/api/parse-instructions/route.ts` — Next.js API route
- `frontend/.env.example` — Added `OPENAI_API_KEY` placeholder

**Docs**: `docs/completions/ai-instructions-parsing.md`

#### UX Improvements

**Recipe Delete** — Hover-reveal trash icon with click-twice-to-confirm pattern
- Appears on hover, first click arms (turns red), second click confirms
- Auto-resets after 2 seconds if not confirmed

**Double-Click to Create Ingredient** — Double-click empty space in ingredients panel to open new ingredient form
- Reduces friction for rapid ingredient entry
- Updated hint: "Drag to add to recipe • Double-click to create new"

**Files**: `LeftPanel.tsx`, `RightPanel.tsx`

### Fixed

- **CORS**: Added `https://www.reciperep.com` and `https://reciperep.com` to Fly.io `CORS_ORIGINS`
- **API Path**: Frontend `NEXT_PUBLIC_API_URL` now correctly includes `/api/v1` suffix
- **422 Error**: Fixed `updateStructuredInstructions` payload — was wrapping in extra `{ instructions_structured: ... }` layer

**Docs**: `docs/completions/frontend-api-fix.md`

---

## [0.0.4] - 2025-12-02

### Added

#### Backend Deployment (Fly.io)

**App**: `reciperepo` deployed to Ebb & Flow Group organization

**URL**: https://reciperepo.fly.dev

**Files**: `Dockerfile`, `fly.toml`

**Config**: Singapore region, shared-cpu-1x, 1GB RAM, auto-stop enabled

**Secrets**: `DATABASE_URL` (Supabase), `CORS_ORIGINS`

**Docs**: `docs/completions/backend-deployment.md`

---

## [0.0.3] - 2024-11-27

### Added

#### Database Migration (Alembic → Supabase)

**Tables Created**: `ingredients`, `recipes`, `recipe_ingredients`

**Indexes**: `ix_ingredients_name`, `ix_recipes_name`, `ix_recipe_ingredients_recipe_id`, `ix_recipe_ingredients_ingredient_id`

**Migration**: `db480a186284_initial_tables.py`

### Fixed

- `Recipe.instructions_structured` JSON type changed from `sqlite.JSON` to `sqlalchemy.JSON` for PostgreSQL compatibility

**Docs**: `docs/completions/database-migration.md`

---

## [0.0.2] - 2024-11-27

### Added

#### Frontend (Next.js 15 + TypeScript + Tailwind)

**Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS 4, TanStack Query, dnd-kit, Sonner

**Three-Column Layout**
- `TopAppBar` — inline-editable recipe name, yield, status dropdown, cost display
- `LeftPanel` — recipe list with search, create button, selection state
- `RecipeCanvas` — ingredient drop zone, instructions workspace
- `RightPanel` — draggable ingredient palette with inline create form

**Recipe Workspace**
- Drag-and-drop ingredients from palette to recipe
- Sortable ingredient rows with quantity/unit editing and line costs
- Cost summary (batch total + per-portion) from costing API
- Instructions with Freeform/Steps tab toggle
- Structured steps with timer, temperature, drag reorder

**Data Layer**
- Typed API client (`lib/api.ts`) covering all 17 backend endpoints
- 15+ TanStack Query hooks with automatic cache invalidation
- App state context for selected recipe and UI preferences

**UX Polish**
- Debounced autosave (no save buttons)
- Loading skeletons and contextual empty states
- Toast notifications via Sonner
- Dark mode support

**Docs**: `docs/completions/frontend-implementation.md`

---

## [0.0.1] - 2024-11-27

### Added

#### Backend Foundation (FastAPI + SQLModel)

**Infrastructure**: FastAPI, PostgreSQL (Supabase), Alembic migrations, pydantic-settings

**Models**: `Ingredient`, `Recipe`, `RecipeIngredient`

**Domain Services**: IngredientService, RecipeService, InstructionsService, CostingService

**API Endpoints (17 total)**
- `/api/v1/ingredients` — CRUD + deactivate
- `/api/v1/recipes` — CRUD + status + soft-delete
- `/api/v1/recipes/{id}/ingredients` — add, update, remove, reorder
- `/api/v1/recipes/{id}/instructions` — raw, parse, structured
- `/api/v1/recipes/{id}/costing` — calculate, recompute

**Utilities**: Unit conversion (mass, volume, count)

**Testing**: Pytest with SQLite fixtures

**Docs**: `docs/completions/backend-implementation.md`

---

*Backend Blueprint: `docs/plans/backend-blueprint.md` | Alignment: ~95%*
*Frontend Blueprint: `docs/plans/frontend-blueprint.md` | Alignment: ~95%*
