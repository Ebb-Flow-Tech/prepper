# Feedback Summary Agent Implementation

This document explains the implementation of the Feedback Summary Agent, an AI-powered agent that summarizes tasting feedback using Claude with tool use.

**See also:** [BASE_AGENT.md](BASE_AGENT.md) for the foundation this agent builds upon.

## Overview

The Feedback Summary Agent uses the Anthropic Claude API with tool calling to intelligently summarize all tasting feedback for a recipe. When given a recipe ID, it:

1. Retrieves all feedback notes from the tasting_notes table
2. Sends the feedback to Claude for analysis and summarization
3. Returns a comprehensive summary capturing key themes and insights

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  API Endpoint   │     │FeedbackSummaryAgent  │     │   Claude    │
│  /agents/       │     │  (extends            │────▶│   API       │
│  summarize-     │────▶│   BaseAgent)         │◀────│             │
│  feedback       │     │  ┌────────────────┐  │     └─────────────┘
└─────────────────┘     │  │     Tools      │  │
                        │  │                │  │     ┌─────────────┐
                        │  │ - retrieve_    │──┼────▶│  Supabase   │
                        │  │   feedback     │  │     │  Database   │
                        │  │ - finalize_    │  │     │  (tasting   │
                        │  │   summary      │  │     │   notes)    │
                        │  └────────────────┘  │     └─────────────┘
                        └──────────────────────┘
```

## Components

### 1. Tool Definitions

Two tools are exposed to Claude:

#### `retrieve_feedback`
- **Purpose**: Retrieve all feedback notes for a specific recipe from the tasting_notes table
- **Input**: `recipe_id` (integer) - the recipe ID to retrieve feedback for
- **Output**: Object containing feedback count and list of feedback strings
  ```json
  {
    "feedback_count": 3,
    "feedback": [
      "The flavor is too salty",
      "Great texture, needs more herbs",
      "Excellent presentation!"
    ]
  }
  ```
- **Error Handling**: Raises `ValueError` if recipe has no feedback

#### `finalize_summary`
- **Purpose**: Complete the summarization process with the final summary
- **Input**: `summary` (string) - the comprehensive summary of all feedback
- **Output**: Status confirmation
  ```json
  {
    "status": "finalized"
  }
  ```

### 2. System Prompt

The system prompt instructs Claude to:
- Retrieve all tasting feedback for the recipe
- Analyze feedback systematically and identify key themes
- Group similar feedback together
- Distinguish between consensus points and outlier opinions
- Organize the summary with sections for:
  - Flavor/taste feedback
  - Texture and presentation comments
  - Common action items and improvement suggestions
  - Overall sentiment and decisions
- Create concise but comprehensive summaries (2-4 paragraphs)
- Focus on actionable insights
- Handle cases with no feedback gracefully

### 3. Agentic Loop Flow

The agent's agentic loop follows this flow:

```
1. Send initial message to Claude with recipe_id
   ↓
2. Claude calls retrieve_feedback tool
   ↓
3. Agent returns feedback list to Claude
   ↓
4. Claude analyzes feedback and identifies themes
   ↓
5. Claude calls finalize_summary tool with summary text
   ↓
6. Agent marks finalization and returns result
   ↓
7. Agent returns FeedbackSummaryResult with summary and success status
```

### 4. Tool Processing

The agent processes tool calls through the `_process_tool_call` method:

```python
def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
    if tool_name == "retrieve_feedback":
        recipe_id = tool_input.get("recipe_id")
        feedback_list = self._retrieve_feedback(recipe_id)
        return json.dumps({
            "feedback_count": len(feedback_list),
            "feedback": feedback_list
        })

    elif tool_name == "finalize_summary":
        summary = tool_input.get("summary", "")
        self._last_summary = summary
        return json.dumps({"status": "finalized"})
```

Tool results are serialized as JSON strings and returned to Claude as `tool_result` messages.

## Database Operations

### Retrieve Feedback

```python
def _retrieve_feedback(self, recipe_id: int) -> list[str]:
    """Retrieve all feedback from tasting notes for a recipe.

    Args:
        recipe_id: The recipe ID to retrieve feedback for

    Returns:
        List of feedback strings (non-null only)

    Raises:
        ValueError: If no feedback found for the recipe
    """
    statement = select(TastingNote).where(TastingNote.recipe_id == recipe_id)
    notes = list(self.session.exec(statement).all())

    feedback_list = []
    for note in notes:
        if note.feedback:
            feedback_list.append(note.feedback)

    if not feedback_list:
        raise ValueError(f"No feedback found for recipe {recipe_id}")

    return feedback_list
```

**Query Logic:**
1. Execute SQLModel query to fetch all TastingNote records for the recipe
2. Iterate through notes and collect non-null feedback strings
3. Raise `ValueError` if no feedback exists (agent catches this)
4. Return list of feedback strings

## Output Structure

### FeedbackSummaryResult

```python
class FeedbackSummaryResult(BaseModel):
    """Structured output for feedback summary result."""

    summary: str | None = Field(
        description="Summary of all feedback for the recipe, or None if no feedback exists"
    )
    success: bool = Field(
        default=True,
        description="Whether summarization was successful"
    )
```

**Response object:**
- `summary`: Comprehensive summary of all feedback, or `null` if no feedback exists
- `success`: Boolean indicating success (true on successful summarization, false if error occurred)

## API Endpoint

```
POST /api/v1/agents/summarize-feedback/{recipe_id}
```

**Request:**
```
POST /api/v1/agents/summarize-feedback/42
```

**Response (Success):**
```json
{
  "summary": "The recipe received generally positive feedback with consistent praise for presentation and flavor. Multiple tasters noted the texture was excellent and the overall recipe is approved for the menu. One taster suggested adding more herbs for depth.",
  "success": true
}
```

**Response (No Feedback):**
```json
{
  "summary": null,
  "success": false
}
```

## Example Agent Conversation

```
User: Please summarize all the feedback from tasting notes for recipe ID 42.

Claude: I'll retrieve all the feedback and create a summary. Let me start by getting all the feedback notes.

[Uses retrieve_feedback tool with recipe_id=42]

Tool Result:
{
  "feedback_count": 3,
  "feedback": [
    "The flavor is excellent, but could use more salt",
    "Great presentation! Texture is spot on",
    "Love the taste, needs more herbs for complexity"
  ]
}

Claude: Now I'll create a comprehensive summary based on this feedback.

[Uses finalize_summary tool]

Summary:
"The recipe received strong positive feedback overall. All three tasters praised the flavor profile and texture, with particular compliments on the presentation. For improvement, tasters suggested adding more salt to enhance the flavor and incorporating more herbs for added complexity."

Tool Result: {"status": "finalized"}

Claude: I've successfully summarized the feedback for recipe 42.
```

## Configuration

Required environment variable:
```
ANTHROPIC_API_KEY=sk-ant-...
```

The agent checks for this key on initialization (via BaseAgent) and raises `ValueError` if not configured.

## Testing

Tests are located in `tests/test_feedback_summary_agent.py` and cover:

- **Initialization**: Agent creation, API key validation
- **Feedback retrieval**: Success cases, no feedback, empty recipe, mixed notes
- **Tool processing**: Retrieve feedback, finalize summary, unknown tool handling
- **Integration**: Full agent flow with mocked Claude API and multiple feedback scenarios
- **API endpoints**: HTTP request/response validation for success and error cases

**Test fixtures** (from `conftest.py`):
- `mock_settings`: Mocks settings with valid API key
- `mock_anthropic`: Mocks Anthropic client
- `agent_no_api_key`: Tests missing API key scenarios
- `MockContentBlock`, `MockToolUseBlock`, `MockClaudeResponse`: Mock Claude response structures

Run tests:
```bash
pytest tests/test_feedback_summary_agent.py -v
```

## Error Handling

The agent gracefully handles various scenarios:

### No Feedback
If a recipe has no tasting notes with feedback:
- `_retrieve_feedback` raises `ValueError` with message "No feedback found for recipe {recipe_id}"
- Agent catches the error and returns `{"summary": null, "success": false}`
- API returns HTTP 200 with the response object (not an HTTP error)

### API Failures
If Claude API call fails:
- Exception is caught in the API endpoint
- HTTPException with status 500 returned to client
- Error message includes agent error details

### Configuration Issues
If ANTHROPIC_API_KEY is not set:
- ValueError raised on agent initialization
- API endpoint catches it and returns HTTPException with status 500

## Use Cases

### 1. First-Time Summary (R&D)
When a recipe is first added to tasting sessions:
- Call the endpoint with recipe_id
- Get initial summary of all accumulated feedback
- Use to inform R&D decisions

### 2. Subsequent Summaries
For recipes with existing summaries:
- User can regenerate summary with all feedback (old and new)
- Useful when recipe has been iterated and new feedback added
- Updates summary in UI

### 3. Iterative Development
Track feedback across multiple iterations:
- Each iteration can have its own tasting session
- Summaries capture feedback for each phase
- Helps identify what changes improved the recipe

## Performance Considerations

1. **Agentic Loop**: Typically 2 API calls (retrieve + finalize)
2. **Database Query**: Simple select query, scales with feedback volume
3. **Token Usage**: Depends on total feedback length
   - Small feedback (< 500 words): ~100-200 tokens
   - Large feedback (> 2000 words): ~500+ tokens

## Limitations

1. **Single Pass Summarization**: The agent summarizes based on current feedback. If feedback context changes, regenerate for new insights.

2. **No Feedback Versioning**: If tasting notes are modified after summarization, previous summary becomes stale. User must manually regenerate.

3. **Similarity Detection**: The agent may miss subtle contradictions in feedback or fail to identify strongly conflicting opinions.

4. **Language Dependency**: Works well for feedback in natural language. Structured ratings (1-5 scores) are ignored in favor of text feedback.

## Future Improvements

- Add sentiment analysis to detect positive/negative/neutral feedback distribution
- Track feedback evolution across multiple iterations of the same recipe
- Support for different languages and translation
- Export summaries to PDF/markdown for documentation
- Integration with recipe versioning to attach summaries to specific versions
- Cache summaries and only re-summarize when new feedback is added
- Support for custom summarization templates/formats
- Multi-recipe comparison in feedback summaries
