# Prepper

Kitchen-first recipe workspace for chefs and operators. Recipes are living objects on a "recipe canvas" with drag-and-drop ingredients, freeform-to-structured instructions, and automatic costing with wastage tracking. Principles: clarity, immediacy, reversibility — no save buttons, only autosave.

Features: Supabase auth with **brand-scoped roles derived from Passport** (no local role vocabulary), recipe versioning (forking + version tree via `root_id` / `version`), recipes/menus served at **Passport brand/outlet units** with per-unit price overrides, wastage-adjusted costing, AI agents (categorization, tasting feedback summarization), Passport sync consumer (multi-org projection of all eight aggregates — org, unit, unit-relation, membership, entitlement, identity-link, unit-app-access, unit-app-membership — with brand-scoped access derived via the SDK, plus role write-back).

## Stack
- Backend: FastAPI, SQLModel, Alembic, pytest, ruff, mypy
- Frontend: Next.js 15, React, TypeScript, TanStack Query, `dnd-kit`, `@xyflow/react` (ReactFlow), Tiptap v3
- Storage: Supabase (`recipe-images` bucket)
- AI: Anthropic (agents), OpenAI (DALL-E 3)
- Messaging: SendGrid (email), Twilio (SMS invitations)

## Project map
- `backend/app/main.py` — FastAPI factory (lifespan, CORS, routers)
- `backend/app/models/` — SQLModel entities (Recipe, Ingredient, TastingSession, MenuSketch, User, etc.). **No local `Outlet` — brands/outlets are `passport_unit` (Passport-owned, projected).**
- `backend/app/domain/` — service layer (one file per resource: recipe, recipe-unit links, costing, sub-recipes, tasting, suppliers, categories, menu-sketch, users, Supabase auth)
- `backend/app/api/` — FastAPI routers (one per resource) + `deps.py` (`require_auth` default-deny gate, `public_routes()` allowlist, `get_current_user`)
- `backend/scripts/route_auth_census.py` — surveys which routes resolve a user of their own; run it rather than counting auth by hand (a file-level grep cannot see `batch_router`-style mounts)
- `backend/scripts/org_backfill_report.py` — read-only: how much of the domain can be assigned to an org from the data. Run before choosing the backfill rule
- `backend/app/agents/` — AI features: `base_agent.py`, `category_agent.py`, `feedback_summary_agent.py`
- `backend/app/passport/` — Passport sync consumer: eight-aggregate read-model projection (`store`, `handlers`, `sync_router`), derived brand-scoped access + entitlement kill switch (`access`), read-model queries for brands/roster (`directory`), role write-back (`writeback`), identity reporting (`identity`), grant revocation only (`role_projection`), nightly `reconcile`. **Multi-org: every org Passport delivers is projected; `org_id` is resolved per-request from the acting user's membership, never from config.** **Roles are read per-brand at the point of the check — never projected onto the `users` row.**
- `backend/app/utils/` — unit conversion helpers
- `frontend/src/app/` — Next.js App Router pages
- `frontend/src/lib/api.ts` — typed fetch wrapper (40+ endpoints)
- `frontend/src/lib/hooks/` — TanStack Query hooks, one file per resource with cache invalidation
- `frontend/src/lib/providers.tsx` — `QueryClientProvider` + `AppProvider` + `AuthGuard`
- `frontend/src/lib/store.tsx` — React Context (selected recipe, canvas tab, auth)
- `frontend/src/components/` — layout, recipe, ingredients, suppliers, units (brand pickers), categories, tasting, admin (incl. `BrandRolesTab` — Passport brand roles), ui primitives

## Commands
```
# Backend (cd backend) — requires Python 3.12+ (passport-client declares requires-python >=3.12)
python -m venv venv && source venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
pytest                              # all | tests/test_recipes.py | -k "test_create"
ruff check . && ruff format .
mypy app/

# Frontend (cd frontend)
npm install
npm run dev                         # requires backend on :8000
npm run build | lint
```

API routes under `/api/v1`. Swagger at `http://localhost:8000/docs` — **dev only**: `/docs`, `/redoc` and `/openapi.json` are mounted only when `DEBUG=true`. They are plain Starlette routes, so the default-deny gate cannot reach them; serving the schema unauthenticated in production is the reason they are off there.

## Key patterns
- **Backend**: services receive SQLModel `Session` and return domain objects. Routers call services via function calls (no DI framework). Tests use SQLite in-memory via `conftest.py`.
- **Frontend**: all server data flows through TanStack Query hooks — no local state for server data. Drag-and-drop via `dnd-kit` (wrapped in AppShell's `DndContext`). Debounced autosave on every editable field — no save buttons. `useAppState()` for global UI state. Canvas tabs: `canvas | overview | ingredients | costs | instructions | tasting | units | versions`. Version tree via `@xyflow/react`. Inline edit via `EditableCell`. Modals for complex forms.

## Domain invariants
- **Versioning**: every recipe has `version` and `root_id` (parent). Forking copies ingredients + instructions, increments version, excludes image.
- **Costing**: `RecipeIngredient.wastage_percentage` (0–100) factors into unit prices and cost breakdowns. Costing carries `adjusted_cost_per_unit`.
- **Units (brands/outlets)**: owned by Passport, projected read-only. Structure + cycle detection live in Passport, not Prepper. Access is brand-scoped (see below), not a local hierarchy walk.
- **Sub-recipes**: cycle detection on BOM tree.
- **Tasting access**: non-admin users can only access sessions they participate in (403 otherwise); admins bypass.
- **Categories + suppliers**: soft-delete supported; archived records remain for historical reference.

## Environment
- Backend: see `backend/.env.example` (`DATABASE_URL`, `CORS_ORIGINS`, `SUPABASE_*`, `ANTHROPIC_API_KEY`)
- Frontend: see `frontend/.env.example` (`NEXT_PUBLIC_API_URL`, `OPENAI_API_KEY`, `TWILIO_*`)

## Working style
- Read code before editing. Plan for non-trivial work.
- Prefer minimal diffs.
- Use `/schema-assembly` for new tables (models + routes + unit tests + migration; does not run them).
- Use `/update-context` to refresh this file after significant changes.
- Use `/get_started` for session onboarding.

## Safety
- Never commit or push — user owns all git actions.
- Commit messages: single line, conventional format `type(scope): summary` — no body, no `Co-Authored-By` trailer (see `/commit`).
- Ask before destructive actions (applied migrations, bulk deletes).
- Never print secrets.
- Cycle detection on sub-recipes — don't bypass. (Outlet-hierarchy cycle detection is Passport's now.)
- Access control is **brand-scoped, derived from Passport** (`app.passport.access.role_at_unit` / `accessible_unit_ids`). There is no local role flag; never reintroduce one.
- **Auth is default-deny.** `require_auth` is registered on the app (`main.py`), so every route needs a JWT unless it's in `deps.public_routes()`. Adding to that allowlist opens a route to the world — justify it. `tests/test_default_deny_auth.py` derives its route list from the running app and will fail on any new ungated route.
- **Authenticated ≠ authorised.** The gate proves *who* is calling, never *what they may see*. A route reading org- or brand-scoped data must still check (`accessible_unit_ids`, or a parent check). Four routes took `get_current_user` and never consulted it: `GET /menu-items/{section_id}` leaked every brand's menu prices, and all three supplier-ingredient writes let any user rewrite any brand's pricing. **Write scope must never be looser than read scope** — being able to destroy a row the scoped read hides is the shape to look for. `tests/test_route_auth_census.py` pins the declared-but-unused case; the conditional case (`if data.x: check()`) is not detectable and needs a human.
- **`users.email` is IDENTITY, not profile.** Passport resolves org membership by it (`deps._platform_user_for`), so a self-writable email hands over someone else's org role. `UserUpdate` refuses it. If it ever becomes writable again, that fallback must resolve from the verified token claim or be deleted.
- **Org isolation is enforced in BOTH layers.** The 7 per-org tables (recipe, ingredient, supplier, category, tasting_session, menu, menu_sketch) carry `organization_id`, backfilled (`q2orgfill1r2s`) and **NOT NULL** (`q3orgnn3t4u`). Creates stamp it from `get_org_context`; every read filters on it, including `GET /users` and `directory.*`. RLS scopes too (`q4rlsorg5v6w` reads, `q5rlswrite7x8y` writes) via `my_org_ids()` / `is_admin_in(org)`. `access.org_role`/`is_org_admin` take an optional `organization_id` — **always pass it**; the org-less form is the cross-org bug (an Owner of org B is admin in org A).
- **The two layers scope differently, on purpose.** RLS has no request context — only `auth.uid()` — so it cannot know the ACTING org and does not try: it enforces *membership* (`my_org_ids()`, a set). Narrowing to one active org is the app's job via `get_org_context`. Don't "fix" an RLS policy to use a single org; there is nothing to read it from.
- **RLS is invisible to the test suite AND to the app.** `conftest.py` is SQLite (no RLS) and the backend connects as `service_role` (BYPASSRLS) — so a broken policy breaks nothing you can see. `tests/test_rls_integration.py` (real Postgres, `SET LOCAL ROLE authenticated`) and `scripts/verify_rls.py` are the only things that exercise it. Run the verifier after touching any policy.
- **Never guess a policy name when dropping.** `supplier_ingredient_supplier_ingredient_tags` names its policies `sit_join_*`. A `DROP POLICY IF EXISTS "<table>_select"` silently no-ops, the new policy is added *beside* the old one, and PERMISSIVE policies **OR** — so the old `USING (true)` keeps granting while the table looks locked down. Query `pg_policies` and drop by actual name.
- **Copying a row field-by-field forgets the org.** Four hand-rolled forks did (`fork_recipe`, `fork_sketch`, `fork_menu`, the sketch-item rename fork), as did the category agent and `_auto_create_recipe`. None were caught by a test; all were caught by `NOT NULL`. If you copy a row, copy `organization_id` — or better, don't hand-roll a fifth fork.
- **Not fully multi-tenant in production.** Staging has exactly **one org**, so isolation has never run against a real second tenant — every cross-org test seeds its own ORG_B. The mechanisms are verified; the deployment is not.
- **Org predicates go through `domain/org_scope.py`** — `org_scope(Model, org)` for queries, `guards._in_org(row, org)` for a row already in hand. Both carry a transitional `IS NULL` arm: NULL means *not yet backfilled*, not *belongs to everyone*. Writing the predicate by hand is how one query gets it wrong; the arm disappears with the `NOT NULL` migration.
- **`organization_id` on a service is a constructor arg, not a method arg.** `IngredientService`/`SupplierService`/`CategoryService`/`MenuSketchService` require it and have no default — a service that cannot be built without an org cannot silently read every org's rows. The read surface (`list`, `list_paginated`, `count`, `get_*`, `_name_exists`) is too wide to thread an argument through by hand without missing one.
- **A cross-ORG miss is 404; a cross-BRAND miss is 403.** Another tenant's row is not yours to know exists; a row in your own org that sits outside your brands may be acknowledged. `guards._in_org` answers the first, `_may_see_recipe` the second — in that order, because `is_public` returns True on its own and would otherwise hand over a foreign row.
- **Never ask `is_org_admin` without an org when a ROW is in scope.** The org-less form means "admin of ANY of your orgs", so an Owner of org B administers org A. Use `access.admins_row(session, subject, row.organization_id)` for one row, or `access.admin_org_ids(session, subject)` for a list query. It survives ONLY in the Passport write-back pre-filter and the global-master-data imports — see the docstring on `access.is_org_admin`, which lists them.
- **Routes addressing a recipe, tasting session or menu sketch by id must take a guard** from `app/api/guards.py`. `tests/test_resource_guards.py` enforces it: add a route and it fails until you take a guard or add an exemption *with a written reason*. Twenty-eight cross-brand leaks came from hand-rolled `if`s that each route had to remember.
- **A parent id in the request BODY cannot be guarded by a dependency** — the route must ask, via `guards.sketch_reachable` / `section_reachable` / `sketch_item_reachable` (or the equivalent for the family). This is the shape that hid an IDOR inside `tasting-note-images/sync/*`: the route *had* a guard, and the ids it acted on came from the body anyway.
- **`organization_id` stays nullable until the backfill is confirmed on every environment.** `NOT NULL` in `q2orgfill1r2s` broke every insert on staging within seconds, because creates did not stamp it. Creates stamp it now, so the migration is unblocked — but it must still run *after* `q2orgfill1r2s` has filled the existing rows, or it fails on the legacy NULLs instead. `fly.toml`'s `release_command = "alembic upgrade head"` enforces that ordering and aborts the deploy on failure.
- `fastapi` is **pinned, not floored** (`pyproject.toml`) — `include_router`'s path handling changed across versions and the auth gate depends on it. Read the comment there before bumping.

## Testing
- `pytest` for backend (SQLite in-memory). Bug fixes include a regression test.
- Frontend: type checking via `npm run build`.

## Pointers
- `.claude/rules/general.md` / `backend.md` / `frontend.md` / `testing.md` / `security.md` — path-scoped project rules (auto-loaded)
- `.agents/skills/` — `/frontend-design`, `/fastapi-expert`, `/nextjs-best-practices`, `/nextjs-app-router-patterns`, `/vercel-react-best-practices`, `/python-testing-patterns`, `/database-schema-designer`, `/sqlalchemy-alembic-expert-best-practices-code-review`, `/feature-spec`, `/skill-creator`, `/git-commit` (user-driven only)
- `.claude/commands/` — `/get_started`, `/commit` (user-driven), `/fe-build-check`, `/schema-assembly`, `/update-context`
- `docs/intro.md` + `docs/changelog.md` — product context & history
