"""Shared utilities for AI agents."""

import asyncio
import concurrent.futures
import time
from typing import Callable, Any, TypeVar

T = TypeVar("T")


def print_timing_summary(
    agent_name: str,
    api_call_count: int,
    total_api_time_ms: float,
    overall_elapsed_ms: float,
) -> None:
    """Print timing summary for agent execution.

    Args:
        agent_name: Name of the agent for display
        api_call_count: Number of API calls made
        total_api_time_ms: Total time spent in API calls
        overall_elapsed_ms: Total elapsed time
    """
    overhead_ms = overall_elapsed_ms - total_api_time_ms
    print(f"\n{'='*60}")
    print(f"[{agent_name}] TIMING SUMMARY")
    print(f"{'='*60}")
    print(f"  Total API calls: {api_call_count}")
    print(f"  Total API time: {total_api_time_ms:.2f}ms")
    print(f"  Overall time: {overall_elapsed_ms:.2f}ms")
    print(f"  Overhead (non-API): {overhead_ms:.2f}ms")
    print(f"{'='*60}\n")


def print_agent_header(agent_name: str, context: str) -> None:
    """Print agent execution header.

    Args:
        agent_name: Name of the agent
        context: Contextual information about what the agent is doing
    """
    print(f"\n{'='*60}")
    print(f"[{agent_name}] {context}")
    print(f"{'='*60}")


def print_tool_call(tool_name: str, tool_input: dict[str, Any]) -> None:
    """Print tool call information.

    Args:
        tool_name: Name of the tool being called
        tool_input: Input parameters for the tool
    """
    import json

    print(f"[Tool Call] {tool_name}")
    print(f"[Tool Input] {json.dumps(tool_input, indent=2)}")


def print_tool_timing(tool_name: str, elapsed_ms: float) -> None:
    """Print tool execution timing.

    Args:
        tool_name: Name of the tool
        elapsed_ms: Elapsed time in milliseconds
    """
    print(f"[Tool Time] {tool_name}: {elapsed_ms:.2f}ms")


def time_it(func: Callable[..., T]) -> tuple[T, float]:
    """Time a synchronous function execution.

    Args:
        func: Function to time

    Returns:
        Tuple of (result, elapsed_ms)
    """
    start = time.perf_counter()
    result = func()
    elapsed_ms = (time.perf_counter() - start) * 1000
    return result, elapsed_ms


def run_async_in_sync(coro: Any) -> Any:
    """Run an async coroutine from synchronous code.

    Handles the case where an event loop might already be running.

    Args:
        coro: Coroutine to execute

    Returns:
        Result of the coroutine
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're already in an async context, create a new loop in thread pool
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)
