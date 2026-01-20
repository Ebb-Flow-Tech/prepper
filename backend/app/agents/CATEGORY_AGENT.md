# Category Agent Implementation

This document explains the implementation of the Category Agent, an AI-powered agent that categorizes ingredients using Claude with tool use.

**See also:** [BASE_AGENT.md](BASE_AGENT.md) for the foundation this agent builds upon.

## Overview

The Category Agent uses the Anthropic Claude API with tool calling to intelligently categorize ingredients. When given an ingredient name, it:

1. Semantically analyzes the ingredient name
2. Searches for existing categories in the database
3. Either returns a matching category or creates a new one

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  API Endpoint   │────▶│  CategoryAgent   │────▶│   Claude    │
│  /agents/       │     │  (extends        │◀────│   API       │
│  categorize-    │     │   BaseAgent)     │     └─────────────┘
│  ingredient     │     │  ┌────────────┐  │
└─────────────────┘     │  │   Tools    │  │     ┌─────────────┐
                        │  │            │  │     │  Supabase   │
                        │  │ - query    │──┼────▶│  Database   │
                        │  │ - add      │  │     │  (Category) │
                        │  │ - finalize │  │     └─────────────┘
                        │  └────────────┘  │
                        └──────────────────┘
```

## Components

### 1. Tool Definitions

Three tools are exposed to Claude:

#### `query_category_by_name`
- **Purpose**: Search for existing categories using similarity matching
- **Input**: `name` (string) - the category name to search for
- **Output**: Category object with similarity score, or `null` if no match ≥ 0.8
- **Example**:
  ```json
  {
    "id": 3,
    "name": "Dairy",
    "description": "Milk products",
    "similarity": 1.0
  }
  ```

#### `add_category`
- **Purpose**: Create a new category in the database
- **Input**: `name` (string, required), `description` (string, optional)
- **Output**: Created category object with `already_existed` flag
- **Example**:
  ```json
  {
    "id": 15,
    "name": "Herbs",
    "description": "Fresh and dried herbs",
    "already_existed": false
  }
  ```

#### `finalize_categorization`
- **Purpose**: Signal that categorization is complete and store the result
- **Input**: `category_id` (int), `category_name` (string), `explanation` (string)
- **Output**: Status confirmation

### 2. Similarity Matching

The agent uses Python's built-in `SequenceMatcher` for lexical similarity:

```python
from difflib import SequenceMatcher

def _calculate_similarity(self, str1: str, str2: str) -> float:
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()
```

**Why SequenceMatcher?**
- Built into Python's standard library (no external dependencies)
- Uses the Ratcliff/Obershelp algorithm for pattern matching
- Returns a ratio between 0.0 (no match) and 1.0 (exact match)
- Case-insensitive comparison via `.lower()`

**Threshold: 0.8 (80%)**
- "Dairy" vs "Dairy Products" → ~0.67 ✗ (too dissimilar)
- "Vegetables" vs "Vegetable" → ~0.95 ✓ (plural match)
- "Spices" vs "Spice" → ~0.91 ✓ (plural match)
- "Herbs" vs "Seasonings" → ~0.43 ✗ (different meaning)

### 3. System Prompt

The system prompt instructs Claude to:
- Determine appropriate food categories for ingredients
- Use common ingredient category names (Dairy, Meat, Poultry, Seafood, Vegetables, Fruits, Grains, Spices, Herbs, Oils, Condiments, Baking, Nuts, Legumes, etc.)
- Convert names to Title Case
- Be specific but not overly granular
- Provide clear explanation of the categorization choice
- Use the `finalize_categorization` tool to complete the task

### 4. Tool Processing

The agent processes tool calls through the `_process_tool_call` method:

```python
def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
    if tool_name == "query_category_by_name":
        result = self._query_category_by_name(tool_input["name"])
        if result:
            self._last_category_id = result["id"]
            self._last_category_name = result["name"]
        return json.dumps(result) if result else json.dumps(None)

    elif tool_name == "add_category":
        result = self._add_category(
            name=tool_input["name"],
            description=tool_input.get("description")
        )
        self._last_category_id = result["id"]
        self._last_category_name = result["name"]
        return json.dumps(result)

    elif tool_name == "finalize_categorization":
        self._last_category_id = tool_input["category_id"]
        self._last_category_name = tool_input["category_name"]
        self._last_explanation = tool_input["explanation"]
        return json.dumps({"status": "finalized"})
```

Tool results are serialized as JSON strings and returned to Claude as `tool_result` messages.

## Database Operations

### Query Category

```python
def _query_category_by_name(self, name: str) -> dict[str, Any] | None:
    # 1. Get all active categories
    statement = select(Category).where(Category.is_active == True)
    categories = list(self.session.exec(statement).all())

    # 2. Find best match using similarity
    best_match = None
    best_similarity = 0.0
    for category in categories:
        similarity = self._calculate_similarity(name, category.name)
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = category

    # 3. Return only if above threshold
    if best_match and best_similarity >= self.SIMILARITY_THRESHOLD:
        return {
            "id": best_match.id,
            "name": best_match.name,
            "description": best_match.description,
            "similarity": round(best_similarity, 3)
        }

    return None
```

### Add Category

```python
def _add_category(self, name: str, description: str | None = None) -> dict[str, Any]:
    # 1. Convert to title case
    title_case_name = name.title()

    # 2. Check for existing (case-insensitive)
    existing = self.session.exec(
        select(Category).where(
            func.lower(Category.name) == title_case_name.lower(),
            Category.is_active == True
        )
    ).first()

    if existing:
        return {
            "id": existing.id,
            "name": existing.name,
            "description": existing.description,
            "already_existed": True
        }

    # 3. Create new category
    category_data = CategoryCreate(name=title_case_name, description=description)
    category = Category.model_validate(category_data)
    self.session.add(category)
    self.session.commit()
    self.session.refresh(category)

    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "already_existed": False
    }
```

## API Endpoint

```
POST /api/v1/agents/categorize-ingredient
```

**Request:**
```json
{
  "ingredient_name": "Parmesan Cheese"
}
```

**Response:**
```json
{
  "category_id": 3,
  "category_name": "Dairy",
  "explanation": "I categorized 'Parmesan Cheese' into the 'Dairy' category because it is a cheese product made from milk.",
  "success": true
}
```

## Example Agent Conversation

```
User: Please categorize this ingredient: 'Fresh Basil'

Claude: I'll help you categorize Fresh Basil. Let me start by searching for similar categories.

[Uses query_category_by_name with "Herbs"]
Tool Result: null

Claude: No existing category matched. Let me create an appropriate new category.

[Uses add_category with name="Herbs", description="Fresh and dried herbs used for flavoring"]
Tool Result: {"id": 15, "name": "Herbs", "already_existed": false}

Claude: Great! Now I'll finalize the categorization.

[Uses finalize_categorization]
Tool Result: {"status": "finalized"}

Claude: I've successfully categorized 'Fresh Basil' into the 'Herbs' category.
Since no existing category matched, I created a new 'Herbs' category, which is appropriate for aromatic plants like basil used for flavoring dishes.
```

## Configuration

Required environment variable:
```
ANTHROPIC_API_KEY=sk-ant-...
```

The agent checks for this key on initialization (via BaseAgent) and raises `ValueError` if not configured.

## Testing

Tests are located in `tests/test_category_agent.py` and cover:

- **Initialization**: Agent creation, API key validation
- **Similarity calculation**: Exact matches, case-insensitive matching, similar strings, different strings
- **Category querying**: Exact match, similar match, no match, inactive categories
- **Category adding**: New categories, title case conversion, existing categories, no description
- **Tool processing**: Query, add, and finalize operations
- **Integration**: Full agent flow with mocked Claude API
- **API endpoints**: HTTP request/response validation

**Test fixtures** (from `conftest.py`):
- `mock_settings`: Mocks settings with valid API key
- `mock_anthropic`: Mocks Anthropic client
- `agent_no_api_key`: Tests missing API key scenarios

Run tests:
```bash
pytest tests/test_category_agent.py -v
```

## Limitations

1. **Similarity matching is lexical, not semantic**: "Herbs" and "Aromatics" won't match despite meaning similar things. For true semantic matching, consider using embeddings.

2. **Single category per ingredient**: The agent returns one category. Some ingredients might logically fit multiple categories (e.g., "coconut" could be Fruits or Nuts).

3. **No learning**: The agent doesn't improve from past categorizations. Each request is independent.

4. **Title case only**: Categories are stored in Title Case. Very specific naming conventions may be lost.

## Future Improvements

- Use embedding-based semantic search (e.g., OpenAI embeddings or Supabase pgvector)
- Support multiple category suggestions with confidence scores
- Add category hierarchy (e.g., Dairy → Cheese → Hard Cheese)
- Cache common categorizations for faster responses
- Support for category aliases/synonyms
- Confidence scoring for suggested categories
