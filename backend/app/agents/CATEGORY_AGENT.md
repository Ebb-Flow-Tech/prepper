# Category Agent Implementation

This document explains the implementation of the Category Agent, an AI-powered agent that categorizes ingredients using Claude with tool use.

## Overview

The Category Agent uses the Anthropic Claude API with tool calling to intelligently categorize ingredients. When given an ingredient name, it:

1. Semantically analyzes the ingredient name
2. Searches for existing categories in the database
3. Either returns a matching category or creates a new one

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  API Endpoint   │────▶│  CategoryAgent   │────▶│   Claude    │
│  /agents/       │     │                  │◀────│   API       │
│  categorize-    │     │  ┌────────────┐  │     └─────────────┘
│  ingredient     │     │  │   Tools    │  │
└─────────────────┘     │  │            │  │     ┌─────────────┐
                        │  │ - query    │──┼────▶│  Supabase   │
                        │  │ - add      │  │     │  Database   │
                        │  └────────────┘  │     └─────────────┘
                        └──────────────────┘
```

## Components

### 1. Tool Definitions (`TOOLS`)

Two tools are exposed to Claude:

#### `query_category_by_name`
- **Purpose**: Search for existing categories using similarity matching
- **Input**: `name` (string) - the category name to search for
- **Output**: Category object with similarity score, or `null` if no match ≥ 0.8

#### `add_category`
- **Purpose**: Create a new category in the database
- **Input**: `name` (string, required), `description` (string, optional)
- **Output**: Created category object with `already_existed` flag

### 2. Similarity Matching

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
- "Dairy" vs "Dairy Products" → ~0.67 ✗
- "Vegetables" vs "Vegetable" → ~0.95 ✓
- "Spices" vs "Spice" → ~0.91 ✓

### 3. System Prompt (`SYSTEM_PROMPT`)

The system prompt instructs Claude to:
- Determine appropriate food categories for ingredients
- Use common ingredient category names (Dairy, Meat, Poultry, Seafood, Vegetables, Fruits, Grains, Spices, Herbs, Oils, Condiments, Baking, Nuts, Legumes, etc.)
- Convert names to Title Case
- Be specific but not overly granular
- Explain the categorization decision

### 4. Agentic Loop

The core of the agent is the agentic loop in `categorize_ingredient()`:

```python
while True:
    response = self.client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=messages
    )

    if response.stop_reason == "tool_use":
        # Process tool calls and continue
        ...
    else:
        # Final response - exit loop
        return result
```

**Flow:**
1. Send user message to Claude
2. If Claude wants to use a tool (`stop_reason == "tool_use"`):
   - Extract tool use blocks from response
   - Execute the requested tool(s)
   - Append tool results to messages
   - Loop back to step 1
3. If Claude is done (any other stop reason):
   - Extract final text response
   - Return result

### 5. Tool Processing

```python
def _process_tool_call(self, tool_name: str, tool_input: dict) -> str:
    if tool_name == "query_category_by_name":
        result = self._query_category_by_name(tool_input["name"])
        return json.dumps(result) if result else json.dumps(None)

    elif tool_name == "add_category":
        result = self._add_category(
            name=tool_input["name"],
            description=tool_input.get("description")
        )
        return json.dumps(result)
```

Tool results are serialized as JSON strings and returned to Claude as `tool_result` messages.

## Database Operations

### Query Category

```python
def _query_category_by_name(self, name: str) -> dict | None:
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
    if best_match and best_similarity >= 0.8:
        return {"id": ..., "name": ..., "similarity": ...}
    return None
```

### Add Category

```python
def _add_category(self, name: str, description: str | None = None) -> dict:
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
        return {..., "already_existed": True}

    # 3. Create new category
    category = Category.model_validate(CategoryCreate(name=title_case_name))
    self.session.add(category)
    self.session.commit()
    return {..., "already_existed": False}
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
  "category_name": "Dairy",
  "explanation": "I categorized 'Parmesan Cheese' into the 'Dairy' category because it is a cheese product made from milk...",
  "success": true
}
```

## Example Agent Conversation

```
User: Please categorize this ingredient: 'Fresh Basil'

Claude: [Uses query_category_by_name with "Herbs"]
Tool Result: null

Claude: [Uses add_category with name="Herbs", description="Fresh and dried herbs used for flavoring"]
Tool Result: {"id": 15, "name": "Herbs", "already_existed": false}

Claude: I've categorized 'Fresh Basil' into the 'Herbs' category.
Since no existing category matched, I created a new 'Herbs' category, which is
appropriate for aromatic plants like basil used for flavoring dishes.
```

## Configuration

Required environment variable:
```
ANTHROPIC_API_KEY=sk-ant-...
```

The agent checks for this key on initialization and raises `ValueError` if not configured.

## Limitations

1. **Similarity matching is lexical, not semantic**: "Herbs" and "Aromatics" won't match despite meaning similar things. For true semantic matching, consider using embeddings.

2. **Single category per ingredient**: The agent returns one category. Some ingredients might logically fit multiple categories (e.g., "coconut" could be Fruits or Nuts).

3. **No learning**: The agent doesn't improve from past categorizations. Each request is independent.

## Future Improvements

- Use embedding-based semantic search (e.g., OpenAI embeddings or Supabase pgvector)
- Support multiple category suggestions with confidence scores
- Add category hierarchy (e.g., Dairy → Cheese → Hard Cheese)
- Cache common categorizations for faster responses
