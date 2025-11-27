# Recipe Builder API

FastAPI backend for recipe management and costing.

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -e ".[dev]"

# Copy environment file
cp .env.example .env

# Run the server
uvicorn app.main:app --reload
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Running Tests

```bash
pytest
```

## Project Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app entry point
│   ├── config.py         # Settings management
│   ├── database.py       # Database connection
│   ├── models/           # SQLModel database models
│   ├── schemas/          # Pydantic API schemas
│   ├── services/         # Domain logic layer
│   ├── api/              # FastAPI routes
│   └── utils/            # Shared utilities
├── tests/                # Test suite
├── alembic/              # Database migrations
└── pyproject.toml        # Project dependencies
```
