"""A per-user rate limit for the routes that spend money.

The AI agent routes call Anthropic on every request. They are authenticated, so this is not a leak —
but any signed-in user could hold the button down and bill the organisation for it, and nothing
stopped them. `security.md` requires a limit on spend-adjacent routes.

## What this is, and what it is not

In-process, in-memory, per machine. There is no Redis here and adding one for two routes would be a
poor trade, so the honest description is: **the limit is per instance, not per deployment.** With
`fly.toml` set to `auto_stop_machines` and `min_machines_running = 0` there is usually one machine,
but under load Fly will start more and the effective ceiling multiplies by the machine count.

That is a real weakness and it is the reason this is deliberately strict (a handful of calls a
minute, far below anything a person does by hand). It turns "unbounded spend" into "bounded, times
a small number", which is the difference that matters. If the agents ever become hot paths, this
should move to a shared store — do not raise the numbers to compensate.

Counters are also lost on restart, and Fly restarts these machines freely. A determined abuser can
therefore get more than the nominal rate. Again: the point is a ceiling, not an airtight quota.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models import User

# The window is short on purpose: a person categorising ingredients clicks a few times a minute, so
# these bite only on automation, and bite quickly rather than after a large bill.
AI_CALLS_PER_WINDOW = 10
AI_WINDOW_SECONDS = 60

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()  # sync routes run in a threadpool, so this is genuinely concurrent


def _too_many(key: str, limit: int, window: float) -> bool:
    """Sliding window. True when ``key`` has already used its allowance."""
    now = time.monotonic()
    with _lock:
        seen = _hits[key]
        cutoff = now - window
        while seen and seen[0] <= cutoff:
            seen.popleft()
        if len(seen) >= limit:
            return True
        seen.append(now)
        # An idle key holds an empty deque forever otherwise; this is the only cleanup there is.
        if not seen:
            del _hits[key]
        return False


def rate_limit_ai(current_user: User = Depends(get_current_user)) -> None:
    """429 once a user exceeds the AI allowance.

    Keyed by user id, not IP: the routes are authenticated, so the user is the thing that spends,
    and an IP is both spoofable and shared by a whole kitchen behind one NAT.
    """
    if _too_many(current_user.id, AI_CALLS_PER_WINDOW, AI_WINDOW_SECONDS):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many AI requests. Limit is {AI_CALLS_PER_WINDOW} per "
                f"{AI_WINDOW_SECONDS} seconds."
            ),
            headers={"Retry-After": str(AI_WINDOW_SECONDS)},
        )


def _reset_for_tests() -> None:
    """Clear the counters. Tests share a process, so one test's calls would limit the next."""
    with _lock:
        _hits.clear()
