# Prepper

A kitchen-first recipe workspace that treats recipes as living, central objects—not database records. Drag ingredients, write freeform instructions, and let the system handle costing automatically.

## Philosophy

- **Single recipe canvas** — One dish in focus at a time, everything else supports it
- **No save buttons** — Continuous autosave with debounced updates
- **Drag-and-drop first** — Attach ingredients by dragging, reorder by dragging
- **Freeform → structured** — Write naturally, transform to structured steps when needed
- **Automatic costing** — Real-time cost calculations from ingredient baselines

## Features

### Recipe Management
- Create, edit, and archive recipes with inline editing
- Status workflow: Draft → Active → Archived
- Yield and portion management

### Ingredient System
- Global ingredient palette with base units and costs
- Drag ingredients from palette onto recipes
- Quantity and unit editing with automatic conversion
- Per-line and total cost display

### Instructions
- **Freeform tab**: Free-text instructions with autosave
- **Steps tab**: Structured steps with timer and temperature fields
- LLM-powered parsing from freeform to structured format
- Drag-and-drop step reordering

### Costing
- Automatic batch and per-portion cost calculation
- Unit conversion across mass, volume, and count
- Real-time updates as ingredients change

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| **State** | TanStack Query, React Context |
| **DnD** | dnd-kit |
| **Backend** | FastAPI, SQLModel, Pydantic |
| **Database** | PostgreSQL (Supabase) / SQLite (local) |
| **Migrations** | Alembic |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (optional—defaults to SQLite for local dev)

### Backend

```bash
cd backend

# Setup
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env

# Run
uvicorn app.main:app --reload
```

API docs available at http://localhost:8000/docs

#### Using the Postman Collection

A Postman collection is available at `backend/postman_collection.json` for testing API endpoints.

**To import into Postman:**
1. Open Postman
2. Click **Import** (top-left) or use `Ctrl/Cmd + O`
3. Drag and drop `backend/postman_collection.json` or click **Upload Files** and select it
4. The collection will appear in your sidebar under "Prepper API"

**Setup:**
- Ensure the backend is running on `http://localhost:8000`
- The collection uses `{{baseUrl}}` variable—set it to `http://localhost:8000/api/v1` in your Postman environment, or replace it in the collection settings

### Frontend

```bash
cd frontend

npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
prepper/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI route handlers
│   │   ├── domain/        # Business logic services
│   │   ├── models/        # SQLModel database models
│   │   └── utils/         # Unit conversion, helpers
│   ├── tests/
│   └── alembic/           # Database migrations
├── frontend/
│   └── src/
│       ├── app/           # Next.js App Router
│       ├── components/    # React components
│       ├── lib/           # API client, hooks, state
│       └── types/         # TypeScript definitions
└── docs/
    ├── plans/             # Architecture blueprints
    └── completions/       # Implementation docs
```

## API Overview

All endpoints under `/api/v1`:

| Resource | Endpoints |
|----------|-----------|
| Ingredients | CRUD, deactivate |
| Recipes | CRUD, status updates, soft-delete |
| Recipe Ingredients | Add, update, remove, reorder |
| Instructions | Raw save, LLM parse, structured save |
| Costing | Calculate, recompute |

## Development

### Claude Code Commands

These custom commands are available via Claude Code slash commands (e.g., `/get_started`):

- **`/get_started`** — Review project overview by reading CLAUDE.md, docs/intro.md, and docs/changelog.md
- **`/commit`** — Analyze latest changes and generate a commit message
- **`/update-context`** — Update CLAUDE.md based on current codebase contents
- **`/fe-build-check`** — Run frontend linter and build (`npm run lint && npm run build`)
- **`/schema-assembly`** — Create database tables with schema, CRUD endpoints, and unit tests (migration created last)

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm run lint
```

### Code Quality

```bash
# Backend linting
ruff check . && ruff format .
mypy app/

# Frontend linting
npm run lint
```

## License

[MIT](LICENSE)
