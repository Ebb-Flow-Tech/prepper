"""Base class for AI agents using Claude with tool use."""

import json
import time
from abc import ABC, abstractmethod
from typing import Any

import anthropic

from app.config import get_settings
from app.agents.agent_utils import (
    print_agent_header,
    print_tool_call,
    print_tool_timing,
    print_timing_summary,
)


class BaseAgent(ABC):
    """Base class for Claude-based agents with tool use.

    Provides common functionality for:
    - Client initialization and configuration
    - Agentic loop with tool use handling
    - Timing and logging
    - Async/sync wrapper support (via utilities)
    """

    # Default model and configuration
    MODEL = "claude-haiku-4-5-20251001"
    MAX_TOKENS = 1024

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

    @property
    @abstractmethod
    def agent_name(self) -> str:
        """Name of the agent for logging purposes."""
        pass

    @property
    @abstractmethod
    def tools(self) -> list[dict[str, Any]]:
        """Tool definitions for the agent."""
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """System prompt for the agent."""
        pass

    @abstractmethod
    def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        """Process a tool call from Claude.

        Subclasses must implement this to handle agent-specific tools.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Input parameters for the tool

        Returns:
            JSON string with the tool result
        """
        pass

    @abstractmethod
    def _on_finalization(self) -> dict[str, Any]:
        """Return the final result when agent finalization is complete.

        Subclasses should return the structured result appropriate for their use case.

        Returns:
            Dictionary with the agent's result
        """
        pass

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
        overall_start = time.perf_counter()
        api_call_count = 0
        total_api_time_ms = 0.0

        print_agent_header(self.agent_name, f"Starting execution")

        messages = [{"role": "user", "content": initial_message}]

        while True:
            api_call_count += 1
            api_start = time.perf_counter()
            print(f"\n[API Call #{api_call_count}] Calling Claude...")

            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=self.MAX_TOKENS,
                system=self.system_prompt,
                tools=self.tools,
                messages=messages,
            )

            api_elapsed_ms = (time.perf_counter() - api_start) * 1000
            total_api_time_ms += api_elapsed_ms
            print(
                f"[API Call #{api_call_count}] Completed in {api_elapsed_ms:.2f}ms (stop_reason: {response.stop_reason})"
            )

            # Check if Claude wants to use a tool
            if response.stop_reason == "tool_use":
                # Find tool use blocks
                tool_uses = [
                    block for block in response.content if block.type == "tool_use"
                ]

                # Add assistant message with tool use
                messages.append({"role": "assistant", "content": response.content})

                # Process each tool call and add results
                tool_results = []
                finalized = False
                for tool_use in tool_uses:
                    result = self._process_tool_call(tool_use.name, tool_use.input)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.id,
                            "content": result,
                        }
                    )
                    # Check if finalization tool was called
                    if tool_use.name == self._get_finalization_tool_name():
                        finalized = True

                messages.append({"role": "user", "content": tool_results})

                # If finalized, break the loop and return the result
                if finalized:
                    overall_elapsed_ms = (time.perf_counter() - overall_start) * 1000
                    print_timing_summary(
                        self.agent_name,
                        api_call_count,
                        total_api_time_ms,
                        overall_elapsed_ms,
                    )
                    return self._on_finalization()

            else:
                # Claude has finished without explicit finalization
                overall_elapsed_ms = (time.perf_counter() - overall_start) * 1000
                print_timing_summary(
                    self.agent_name,
                    api_call_count,
                    total_api_time_ms,
                    overall_elapsed_ms,
                )
                return self._on_finalization()

    def _get_finalization_tool_name(self) -> str:
        """Get the name of the finalization tool.

        Override if your agent uses a different finalization tool name.

        Returns:
            Name of the finalization tool
        """
        # Extract from tools list - look for finalize tool
        for tool in self.tools:
            if "finalize" in tool["name"]:
                return tool["name"]
        return "finalize"
