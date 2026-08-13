"""Rate limits for the routes that spend money, and for the unauthenticated login front door.

The AI agent routes call Anthropic on every request. They are authenticated, so this is not a leak —
but any signed-in user could hold the button down and bill the organisation for it, and nothing
stopped them. `security.md` requires a limit on spend-adjacent routes.

The login buckets bound something else: `POST /auth/resolve-login` answers, without a token,
whether an address is a Passport member; `POST /auth/password-reset` takes an address and SENDS
MAIL to it; and `GET /auth/passport/start` writes a row per hit. Those are enumeration, mail
bombing and growth — not spend.

## What this is, and what it is not

In-process, in-memory, per machine. There is no Redis here and adding one would be a poor trade, so
the honest description is: **every bucket in this file is per instance, not per deployment.** With
`fly.toml` set to `auto_stop_machines` and `min_machines_running = 0` there is usually one machine,
but under load Fly will start more and the effective ceiling multiplies by the machine count.

That is a real weakness and it is the reason these are deliberately strict (a handful of calls a
minute, far below anything a person does by hand). It turns "unbounded" into "bounded, times a small
number", which is the difference that matters. If any of these become hot paths, they should move to
a shared store — do not raise the numbers to compensate.

Counters are also lost on restart, and Fly restarts these machines freely. A determined abuser can
therefore get more than the nominal rate. Again: the point is a ceiling, not an airtight quota.

For the login buckets this sits in acknowledged tension with the reason PKCE state went to Postgres
(`app/models/passport_login_attempt.py`): *that* is a correctness problem — a start and a callback
landing on different machines simply breaks — whereas a multiplied rate ceiling still bounds
throughput. Accepted with the difference stated rather than hidden.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.models import User

# The window is short on purpose: a person categorising ingredients clicks a few times a minute, so
# these bite only on automation, and bite quickly rather than after a large bill.
AI_CALLS_PER_WINDOW = 10
AI_WINDOW_SECONDS = 60

# The login front door. A person signs in once; these are generous for a human and hostile to a
# script walking an address list.
LOGIN_ROUTE_IP_PER_MINUTE = 10
LOGIN_ROUTE_EMAIL_PER_MINUTE = 5
PASSPORT_START_IP_PER_MINUTE = 10
LOGIN_WINDOW_SECONDS = 60

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()  # sync routes run in a threadpool, so this is genuinely concurrent

# The longest window any bucket uses. A key with nothing newer than this is dead for every caller.
_LONGEST_WINDOW_SECONDS = max(AI_WINDOW_SECONDS, LOGIN_WINDOW_SECONDS)
_last_sweep = 0.0


def _sweep(now: float) -> None:
    """Drop keys with nothing left inside the window. Caller must hold ``_lock``.

    Without this ``_hits`` only ever GROWS: a key hit once keeps its entry forever, because pruning
    happens only for the key being checked and that key is immediately re-populated. It was close to
    harmless while every key was an authenticated user id — a bounded set of real people. The login
    buckets make the key space unauthenticated and caller-supplied (``login-email:`` carries up to
    320 octets of whatever was posted), which turns a slow leak into memory an anonymous caller can
    grow at will.

    Amortised to once per window: an O(n) walk on every request would put the whole dict on the
    critical path of the AI routes, and there is nothing to gain from sweeping more often than
    entries can expire.
    """
    global _last_sweep
    if now - _last_sweep < _LONGEST_WINDOW_SECONDS:
        return
    _last_sweep = now

    cutoff = now - _LONGEST_WINDOW_SECONDS
    # `.items()` rather than the defaultdict accessor: reading a key through `_hits[k]` would create
    # the very entries this is removing. Materialised first — the dict cannot be mutated mid-walk.
    dead = [key for key, seen in _hits.items() if not seen or seen[-1] <= cutoff]
    for key in dead:
        del _hits[key]


def _too_many(key: str, limit: int, window: float) -> bool:
    """Sliding window. True when ``key`` has already used its allowance."""
    now = time.monotonic()
    with _lock:
        _sweep(now)
        seen = _hits[key]
        cutoff = now - window
        while seen and seen[0] <= cutoff:
            seen.popleft()
        if len(seen) >= limit:
            return True
        seen.append(now)
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


def client_ip(request: Request) -> str:
    """The caller's address, as best this deployment can know it.

    ``request.client.host`` is fly-proxy's internal mesh address for EVERY request in production, so
    keying on it alone would put the whole internet in one bucket. ``Fly-Client-IP`` is therefore
    preferred, and the fallback covers local and non-Fly environments where the header is absent.

    **``Fly-Client-IP`` is trustworthy only because fly-proxy OVERWRITES it** on every inbound
    request, so a client-supplied value never survives. That property belongs to the deployment, not
    to this function. Move Prepper behind anything that forwards the header instead of replacing it
    — another CDN in front of Fly, an nginx that copies client headers, a direct port exposure — and
    every limit in this module becomes bypassable with one header per request, silently and with no
    test able to see it. If the hosting changes, this function changes with it.
    """
    fly_client_ip = request.headers.get("Fly-Client-IP")
    if fly_client_ip:
        return fly_client_ip
    # `request.client` is None for ASGI transports that report no peer (some test and unix-socket
    # setups). One shared bucket is the safe answer: it over-limits rather than under-limits.
    return request.client.host if request.client else "unknown"


def login_ip_limited(ip: str) -> bool:
    """The IP half of the login front door, on its own — for ``POST /auth/login``.

    Deliberately the **same key** as :func:`login_route_limited`'s IP bucket, so the allowance is
    genuinely shared across the whole front door and an enumerator cannot refresh it by moving
    between routes.

    ``/auth/login`` gets the IP bucket and NOT the email one, which is the one asymmetry in this
    module and is a deliberate trade:

    - The email bucket is 5/minute and shared with ``/auth/resolve-login``. Applying it here would
      lock a real user out of their own account after six fumbled passwords.
    - Far worse, it would be a targeted lockout an attacker can trigger for anyone: posting a
      victim's address to ``/auth/resolve-login`` needs no password and no session, and would
      spend the allowance that victim needs to sign in. That converts a rate limit into a denial
      of service aimed at one named person — the same trap the IP short-circuit below avoids.

    **That denial of service already exists in a narrower form, and is accepted knowingly.** The
    ``login-email:`` key is shared by ``/auth/resolve-login`` and ``/auth/password-reset``, so an
    attacker can already deny a NAMED victim password recovery for a minute at a time by posting
    their address to the router. Extending the key to sign-in would extend that from "cannot reset
    their password" to "cannot log in at all", which is the line worth not crossing.

    **A separate ``login-pw-email:`` key was available and deliberately not taken.** It would give
    sign-in its own per-address ceiling with no cross-route lockout — but a per-address bucket on
    a password endpoint is a credential-stuffing control, not an enumeration one, and Prepper's
    own project already rate-limits password grants at GoTrue. Adding a second, weaker, in-process
    copy would imply a protection this module cannot actually provide. Recorded as a decision, so
    the asymmetry above reads as a choice rather than an oversight.

    The IP bucket bounds the address sweep, which is the thing being defended against.
    """
    return _too_many(f"login-ip:{ip}", LOGIN_ROUTE_IP_PER_MINUTE, LOGIN_WINDOW_SECONDS)


def login_route_limited(*, ip: str, email: str) -> bool:
    """Whether this login-front-door attempt is over either allowance.

    **Shared by ``POST /auth/resolve-login`` and ``POST /auth/password-reset``, on purpose.** They
    are the same surface — unauthenticated, keyed on an email, answering non-committally — so
    giving them one pair of buckets stops the ceilings drifting apart, and the shared key means an
    enumerator cannot buy a fresh allowance by switching routes half way through a sweep. Do not
    split them into per-route keys without deciding what should happen to that property.

    Two buckets, because either alone is trivially defeated: an enumerator spraying one address
    from a botnet walks past the IP bucket, and one IP walking an address list walks past the email
    bucket.

    The IP check SHORT-CIRCUITS, so a flooding IP does not also spend every address's allowance —
    that would let one attacker lock real users out from their own machines, turning a rate limit
    into a denial of service.

    Applied inside the handler rather than as a dependency: the email key can only be derived from
    the parsed body, and the route must own its own 429.
    """
    if login_ip_limited(ip):
        return True
    return _too_many(f"login-email:{email}", LOGIN_ROUTE_EMAIL_PER_MINUTE, LOGIN_WINDOW_SECONDS)


def passport_start_limited(ip: str) -> bool:
    """Whether this ``GET /auth/passport/start`` attempt is over the IP allowance.

    That route writes an unauthenticated row to ``passport_login_attempt`` on every hit, and the
    table has no sweeper: stale rows are harmless only because this keeps the write volume bounded.

    Returns a bool rather than raising, because the caller must answer with a redirect — a 429 JSON
    body would render as the entire page on a route reached only by top-level navigation.
    """
    return _too_many(f"passport-start-ip:{ip}", PASSPORT_START_IP_PER_MINUTE, LOGIN_WINDOW_SECONDS)


def _reset_for_tests() -> None:
    """Clear the counters. Tests share a process, so one test's calls would limit the next."""
    global _last_sweep
    with _lock:
        _hits.clear()
        # Also the sweep clock: leaving it set would make the next test's first sweep a no-op,
        # which is exactly the sweep a test of eviction is trying to observe.
        _last_sweep = 0.0
