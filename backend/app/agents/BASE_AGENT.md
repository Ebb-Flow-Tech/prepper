# BaseAgent - Agent Framework Documentation

This document explains the `BaseAgent` abstract base class that provides the foundation for all AI agents using Claude with tool use.

**Related agents:**
- [CATEGORY_AGENT.md](CATEGORY_AGENT.md) - Categorizes ingredients using semantic search
- [FEEDBACK_SUMMARY_AGENT.md](FEEDBACK_SUMMARY_AGENT.md) - Summarizes tasting feedback

## Overview

`BaseAgent` is an abstract base class that provides a reusable framework for building AI agents that use Claude's API with tool calling. It handles:

1. **Client initialization** with API key validation
2. **Agentic loop** with tool use and result handling
3. **Timing and logging** for debugging and monitoring
4. **Async/sync execution** patterns

## Architecture

```
┌──────────────────────────┐
│     BaseAgent (ABC)      │
├──────────────────────────┤
│ Abstract Properties:     │
│ - agent_name             │
│ - tools                  │
│ - system_prompt          │
│                          │
│ Abstract Methods:        │
│ - _process_tool_call()   │
│ - _on_finalization()     │
│                          │
│ Concrete Methods:        │
│ - _run_agentic_loop()    │
│ - _get_finalization_tool │
└──────────────────────────┘
         △
         │ extends
         │
    ┌────┴─────┐
    │           │
┌───────────┐ ┌──────────────────┐
│ Category  │ │ FeedbackSummary  │
│ Agent     │ │ Agent            │
└───────────┘ └──────────────────┘
```

## Core Components

### 1. Initialization

```python
def __init__(self, session: Any = None):
    """Initialize the base agent.

    Args:
        session: Optional database session for tool implementations
    """
    self.session = session
    self.settings = get_settings()

    if not self.settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
```

**Key behaviors:**
- Stores database session for subclass tools
- Loads settings from environment (via `get_settings()`)
- Validates API key on initialization (fail-fast approach)
- Creates Anthropic client instance
- Raises `ValueError` if API key is missing

### 2. Abstract Properties (must be implemented by subclasses)

#### `agent_name` (property)
```python
@property
@abstractmethod
def agent_name(self) -> str:
    """Name of the agent for logging purposes."""
    pass
```

**Example:**
```python
@property
def agent_name(self) -> str:
    return "Category Agent"
```

#### `tools` (property)
```python
@property
@abstractmethod
def tools(self) -> list[dict[str, Any]]:
    """Tool definitions for the agent."""
    pass
```

**Tool definition format:**
```python
@property
def tools(self) -> list[dict[str, Any]]:
    return [
        {
            "name": "tool_name",
            "description": "What this tool does",
            "input_schema": {
                "type": "object",
                "properties": {
                    "param1": {
                        "type": "string",
                        "description": "Parameter description"
                    }
                },
                "required": ["param1"]
            }
        }
    ]
```

#### `system_prompt` (property)
```python
@property
@abstractmethod
def system_prompt(self) -> str:
    """System prompt for the agent."""
    pass
```

**Example:**
```python
@property
def system_prompt(self) -> str:
    return """You are a helpful assistant that categorizes ingredients.
Your task is to:
1. Determine appropriate food categories for ingredients
2. Use the provided tools to search and create categories
3. Provide clear explanations for your choices"""
```

### 3. Abstract Methods (must be implemented by subclasses)

#### `_process_tool_call(tool_name, tool_input) -> str`

Process a tool call from Claude and return results as JSON string.

```python
@abstractmethod
def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
    """Process a tool call from Claude.

    Args:
        tool_name: Name of the tool to execute
        tool_input: Input parameters for the tool

    Returns:
        JSON string with the tool result
    """
    pass
```

**Implementation pattern:**
```python
def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
    if tool_name == "tool_1":
        result = self._do_something(tool_input["param"])
        return json.dumps(result)
    elif tool_name == "tool_2":
        result = self._do_something_else(tool_input["param"])
        return json.dumps(result)
    else:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
```

#### `_on_finalization() -> dict[str, Any]`

Return the final result when the agent is finished.

```python
@abstractmethod
def _on_finalization(self) -> dict[str, Any]:
    """Return the final result when agent finalization is complete.

    Returns:
        Dictionary with the agent's result
    """
    pass
```

**Implementation pattern:**
```python
def _on_finalization(self) -> dict[str, Any]:
    result = MyAgentResult(
        result_field=self._last_result,
        success=self._last_result is not None
    )
    return result.model_dump()
```

### 4. Concrete Methods

#### `_run_agentic_loop(initial_message) -> dict[str, Any]`

The core agentic loop that orchestrates the interaction with Claude.

```python
async def _run_agentic_loop(self, initial_message: str) -> dict[str, Any]:
    """Run the agentic loop with tool use.

    This is the core loop that:
    1. Sends messages to Claude
    2. Processes tool calls
    3. Continues until finalization or end_turn

    Args:
        initial_message: The initial user message to send to Claude

    Returns:
        Dictionary with the final result from _on_finalization()
    """
```

**Loop flow:**
```
1. Initialize timing and message history
2. Send messages to Claude with tools
3. Check response.stop_reason:
   a. If "tool_use":
      - Extract tool use blocks
      - Process each tool call via _process_tool_call()
      - Add tool results to messages
      - If finalization tool was called, return _on_finalization()
      - Otherwise, loop back to step 2
   b. If anything else (e.g., "end_turn"):
      - Return _on_finalization()
4. Log timing information
```

**Key features:**
- Async-friendly design
- Automatic timing measurement
- Tool result handling and message building
- Finalization detection via `_get_finalization_tool_name()`
- Comprehensive logging

#### `_get_finalization_tool_name() -> str`

Detect which tool signals finalization (looks for "finalize" in tool names).

```python
def _get_finalization_tool_name(self) -> str:
    """Get the name of the finalization tool.

    Override if your agent uses a different finalization tool name.

    Returns:
        Name of the finalization tool
    """
    for tool in self.tools:
        if "finalize" in tool["name"]:
            return tool["name"]
    return "finalize"
```

**Override example:**
```python
def _get_finalization_tool_name(self) -> str:
    return "complete_task"  # Custom finalization tool name
```

## Agent Execution Models

### Async Execution

The primary execution model - use in async contexts:

```python
async def categorize_ingredient(self, ingredient_name: str) -> dict[str, Any]:
    initial_message = f"Please categorize this ingredient: '{ingredient_name}'"
    return await self._run_agentic_loop(initial_message)

# Usage
result = await agent.categorize_ingredient("Basil")
```

### Sync Execution

For sync contexts, use the provided utility wrapper:

```python
def categorize_ingredient_sync(self, ingredient_name: str) -> dict[str, Any]:
    return run_async_in_sync(self.categorize_ingredient(ingredient_name))

# Usage
result = agent.categorize_ingredient_sync("Basil")
```

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional (for specific agents)
# See CATEGORY_AGENT.md and FEEDBACK_SUMMARY_AGENT.md for agent-specific configs
```

### Settings Object

Settings are loaded via `app.config.get_settings()`:

```python
class Settings(BaseSettings):
    """Application settings from environment variables."""

    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")
    # ... other settings
```

## Timing and Logging

The base agent includes automatic timing instrumentation:

```
============================================================
[Category Agent] Starting execution
============================================================

[API Call #1] Calling Claude...
[API Call #1] Completed in 45.23ms (stop_reason: tool_use)
[Tool Call] query_category_by_name
[Tool Input] { "name": "Dairy" }
[Tool Time] query_category_by_name: 2.15ms

[API Call #2] Calling Claude...
[API Call #2] Completed in 38.92ms (stop_reason: tool_use)
[Tool Call] finalize_categorization
[Tool Time] finalize_categorization: 0.05ms

============================================================
[Category Agent] TIMING SUMMARY
============================================================
  Total API calls: 2
  Total API time: 84.15ms
  Overall time: 127.34ms
  Overhead (non-API): 43.19ms
============================================================
```

**Timing utilities:**
- `print_agent_header()` - Agent execution header
- `print_tool_call()` - Tool call logging
- `print_tool_timing()` - Tool execution timing
- `print_timing_summary()` - Overall execution summary

## Testing BaseAgent

The base agent is tested indirectly through subclass tests. However, you can test shared functionality:

**Test fixtures:**
```python
@pytest.fixture
def mock_settings():
    """Mock settings with valid API key."""
    with patch("app.agents.base_agent.get_settings") as mock:
        settings = MagicMock()
        settings.anthropic_api_key = "test-api-key"
        mock.return_value = settings
        yield mock

@pytest.fixture
def mock_anthropic():
    """Mock Anthropic client."""
    with patch("app.agents.base_agent.anthropic.Anthropic") as mock:
        yield mock

@pytest.fixture
def agent_no_api_key():
    """Test missing API key."""
    with patch("app.agents.base_agent.get_settings") as mock:
        settings = MagicMock()
        settings.anthropic_api_key = None
        mock.return_value = settings
        yield mock
```

**Testing patterns:**
- Use `mock_settings` and `mock_anthropic` fixtures for normal testing
- Use `agent_no_api_key` fixture for API key validation tests
- Mock Claude responses with `MockClaudeResponse`, `MockToolUseBlock`, `MockContentBlock`

## Best Practices for Subclasses

### 1. State Management

Store results in private attributes:
```python
def __init__(self, session: Session):
    super().__init__(session)
    self._last_result = None
    self._last_explanation = None
```

### 2. Tool Implementation

Keep `_process_tool_call` focused and delegate to specific methods:
```python
def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
    if tool_name == "my_tool":
        result = self._execute_my_tool(tool_input)
        return json.dumps(result)
    return json.dumps({"error": "Unknown tool"})

def _execute_my_tool(self, params: dict) -> dict:
    # Actual implementation
    pass
```

### 3. Error Handling

Return error information in JSON:
```python
def _process_tool_call(self, tool_name: str, tool_input: dict) -> str:
    try:
        # ... tool logic
    except Exception as e:
        return json.dumps({"error": str(e)})
```

### 4. Database Operations

Use the session provided in `__init__`:
```python
def _query_database(self):
    statement = select(MyModel).where(...)
    results = self.session.exec(statement).all()
    return results
```

## Performance Considerations

1. **API Calls**: Minimize number of calls by batching tool results
2. **Token Usage**: System prompts and tool definitions count towards tokens
3. **Latency**: Typical agent takes 2-5 API calls
4. **Concurrency**: Use async execution for better throughput

## Limitations

1. **Single Agent Instance**: Each agent instance has its own client connection
2. **Stateless by Default**: Results aren't persisted unless explicitly saved
3. **Sequential Tool Calls**: Tools are processed one at a time (though Claude can request multiple)
4. **No Streaming**: Full response is collected before processing

## Future Improvements

- Add parallel tool call handling
- Implement caching for repeated agent executions
- Support for agent memory/history across multiple invocations
- Metrics collection and monitoring hooks
- Support for multiple LLM providers beyond Claude
- Tool validation and schema enforcement
- Retry logic with exponential backoff for API failures
