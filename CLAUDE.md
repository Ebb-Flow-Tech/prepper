# Prepper

Kitchen-first recipe workspace for chefs and operators. Recipes are living objects on a "recipe canvas" with drag-and-drop ingredients, freeform-to-structured instructions, and automatic costing with wastage tracking. Principles: clarity, immediacy, reversibility — no save buttons, only autosave.

Features: Supabase auth (normal/admin, hierarchical outlet-based access), recipe versioning (forking + version tree via `root_id` / `version`), multi-outlet with hierarchy + cycle detection + per-outlet price overrides, wastage-adjusted costing, AI agents (categorization, tasting feedback summarization), Passport sync consumer (projects org/membership/entitlement/identity-link facts into local read-model tables).

## Stack
- Backend: FastAPI, SQLModel, Alembic, pytest, ruff, mypy
- Frontend: Next.js 15, React, TypeScript, TanStack Query, `dnd-kit`, `@xyflow/react` (ReactFlow), Tiptap v3
- Storage: Supabase (`recipe-images` bucket)
- AI: Anthropic (agents), OpenAI (DALL-E 3)
- Messaging: SendGrid (email), Twilio (SMS invitations)

## Project map
- `backend/app/main.py` — FastAPI factory (lifespan, CORS, routers)
- `backend/app/models/` — SQLModel entities (Recipe, Ingredient, Outlet, TastingSession, MenuSketch, User, etc.)
- `backend/app/domain/` — service layer (one file per resource: recipe, costing, sub-recipes, outlets, tasting, suppliers, categories, menu-sketch, users, Supabase auth)
- `backend/app/api/` — FastAPI routers (one per resource) + `deps.py`
- `backend/app/agents/` — AI features: `base_agent.py`, `category_agent.py`, `feedback_summary_agent.py`
- `backend/app/passport/` — Passport sync consumer: read-model projection (`store`, `handlers`, `sync_router`), role projection, entitlement kill switch (`access`), identity reporting, nightly `reconcile`
- `backend/app/utils/` — unit conversion helpers
- `frontend/src/app/` — Next.js App Router pages
- `frontend/src/lib/api.ts` — typed fetch wrapper (40+ endpoints)
- `frontend/src/lib/hooks/` — TanStack Query hooks, one file per resource with cache invalidation
- `frontend/src/lib/providers.tsx` — `QueryClientProvider` + `AppProvider` + `AuthGuard`
- `frontend/src/lib/store.tsx` — React Context (selected recipe, canvas tab, auth)
- `frontend/src/components/` — layout, recipe, ingredients, suppliers, outlets, categories, tasting, ui primitives

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

API routes under `/api/v1`. Swagger at `http://localhost:8000/docs`.

## Key patterns
- **Backend**: services receive SQLModel `Session` and return domain objects. Routers call services via function calls (no DI framework). Tests use SQLite in-memory via `conftest.py`.
- **Frontend**: all server data flows through TanStack Query hooks — no local state for server data. Drag-and-drop via `dnd-kit` (wrapped in AppShell's `DndContext`). Debounced autosave on every editable field — no save buttons. `useAppState()` for global UI state. Canvas tabs: `canvas | overview | ingredients | costs | instructions | tasting | outlets | versions`. Version tree via `@xyflow/react`. Inline edit via `EditableCell`. Modals for complex forms.

## Domain invariants
- **Versioning**: every recipe has `version` and `root_id` (parent). Forking copies ingredients + instructions, increments version, excludes image.
- **Costing**: `RecipeIngredient.wastage_percentage` (0–100) factors into unit prices and cost breakdowns. Costing carries `adjusted_cost_per_unit`.
- **Outlets**: cycle detection on parent-child hierarchies. Non-admin users restricted to outlets within their hierarchy.
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
- Cycle detection on outlet hierarchies and sub-recipes — don't bypass.
- Access control is hierarchical: enforce outlet scope for non-admin users.

## Testing
- `pytest` for backend (SQLite in-memory). Bug fixes include a regression test.
- Frontend: type checking via `npm run build`.

## Pointers
- `.claude/rules/general.md` / `backend.md` / `frontend.md` / `testing.md` / `security.md` — path-scoped project rules (auto-loaded)
- `.agents/skills/` — `/frontend-design`, `/fastapi-expert`, `/nextjs-best-practices`, `/nextjs-app-router-patterns`, `/vercel-react-best-practices`, `/python-testing-patterns`, `/database-schema-designer`, `/sqlalchemy-alembic-expert-best-practices-code-review`, `/feature-spec`, `/skill-creator`, `/git-commit` (user-driven only)
- `.claude/commands/` — `/get_started`, `/commit` (user-driven), `/fe-build-check`, `/schema-assembly`, `/update-context`
- `docs/intro.md` + `docs/changelog.md` — product context & history
