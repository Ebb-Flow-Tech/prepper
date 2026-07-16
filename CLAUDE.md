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
- **Org isolation is half-built — don't assume it works.** The 7 per-org tables (recipe, ingredient, supplier, category, tasting_session, menu, menu_sketch) carry `organization_id`, **backfilled** (`q2orgfill1r2s`) but **nullable, and no query filters on it**. `get_org_context` exists and is tested; no route uses it. `access.org_role`/`is_org_admin` take an optional `organization_id` — **always pass it**; the org-less form is the live cross-org bug (an Owner of org B is admin in org A) and exists only until its 13 callers are migrated.
- **`organization_id` stays nullable until the write path sets it.** Creates do not stamp it yet, so `NOT NULL` would break every insert — it did exactly that on staging. `NOT NULL` ships with the create-path stamping, in the same migration, never before.
- `fastapi` is **pinned, not floored** (`pyproject.toml`) — `include_router`'s path handling changed across versions and the auth gate depends on it. Read the comment there before bumping.

## Testing
- `pytest` for backend (SQLite in-memory). Bug fixes include a regression test.
- Frontend: type checking via `npm run build`.

## Pointers
- `.claude/rules/general.md` / `backend.md` / `frontend.md` / `testing.md` / `security.md` — path-scoped project rules (auto-loaded)
- `.agents/skills/` — `/frontend-design`, `/fastapi-expert`, `/nextjs-best-practices`, `/nextjs-app-router-patterns`, `/vercel-react-best-practices`, `/python-testing-patterns`, `/database-schema-designer`, `/sqlalchemy-alembic-expert-best-practices-code-review`, `/feature-spec`, `/skill-creator`, `/git-commit` (user-driven only)
- `.claude/commands/` — `/get_started`, `/commit` (user-driven), `/fe-build-check`, `/schema-assembly`, `/update-context`
- `docs/intro.md` + `docs/changelog.md` — product context & history
