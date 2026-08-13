# Passport Email-First Login Implementation Plan

> **For agentic workers:** REQUIRED: Use proceed to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prepper's Model 2 SSO login-proxy — which sends members' Passport passwords through Prepper's backend — with the standard email-first router plus the Model 3 hosted-login handoff, ported from `geddit-one`.

**Architecture:** One email field routes to either Passport's hosted login (OAuth 2.1 + PKCE, backend-brokered code exchange, session returned in a URL fragment) or Prepper's own password step. Sessions move from localStorage tokens to dual Supabase browser clients selected by a provider cookie. Derived-access authorization moves onto the request path.

**Tech Stack:** FastAPI, SQLModel, Alembic, pytest · Next.js 15, `@supabase/ssr`, vitest, Playwright

**Spec:** `docs/specs/2026-08-12-01-passport-email-first-login-design.md` — authoritative. Do not re-derive design decisions; every deviation from `geddit-one` is a numbered **D**-row there.

**Reference implementation:** `D:\workspace\mission-systems\geddit-one` (`missiongroupsystems/geddit-one`, `main`). Copy from it. **Not** `D:\workspace\mission-systems\geddit`, which is a different repo.

---

## File Structure

**Backend — create**

| File | Responsibility |
|---|---|
| `backend/app/models/passport_login_attempt.py` | PKCE `state → code_verifier` row |
| `backend/alembic/versions/<rev>_passport_login_attempt.py` | Table + RLS deny-all |
| `backend/app/passport/pkce.py` | PKCE pair generation, store, atomic single-use pop |
| `backend/app/passport/login_routing.py` | The two-valued routing decision, and nothing else |

**Backend — modify**

| File | Change |
|---|---|
| `backend/app/passport/access.py` | `+sso_active`, `+is_active_member` (promoted), `+resolve_app_id` |
| `backend/app/api/auth.py` | `+3` routes, `+2` D9 checks, `−register`, `−refresh-token`, `−proxy branch` |
| `backend/app/api/deps.py` | Request-path access gate; `public_routes`; drop `_is_active_member` |
| `backend/app/api/rate_limit.py` | IP + email buckets |
| `backend/app/passport/writeback.py` | `_app_id` becomes a wrapper over `resolve_app_id` |
| `backend/app/domain/supabase_auth_service.py` | `−login_via_passport`, `−refresh_via_passport`, `−register`, `−sso_login_enabled` |
| `backend/app/config.py` | `+3` settings, `−passport_org_id` |

**Frontend — create**

| File | Responsibility |
|---|---|
| `frontend/src/lib/auth/authProviderCookie.ts` | Cookie name/values/parse — single source of truth |
| `frontend/src/lib/supabase/passportClient.ts` | Second browser client (`isSingleton: false`) |
| `frontend/src/lib/supabase/activeClient.ts` | Cookie-driven client selection + set/clear |
| `frontend/src/lib/auth/postLoginDestination.ts` | Shared destination resolution (3rd occurrence) |
| `frontend/src/lib/auth/signOut.ts` | `performSignOut()` shared by button and forced paths |
| `frontend/src/app/auth/passport-callback/page.tsx` + `parseFragment.ts` | Fragment → session |

**Frontend — modify:** `login/page.tsx` (two-step), `store.tsx`, `api.ts`, `auth-interceptor.ts`, `AuthGuard.tsx`, `TopNav.tsx`, `tastings/invite/[id]/page.tsx`, `e2e/global.setup.ts`, `e2e/pages/LoginPage.ts`.

**Frontend — delete:** `app/register/page.tsx`, the `/register` e2e specs.

---

## Chunk 1: Backend foundations

### Task 1: Promote `is_active_member` and add `sso_active`

**Files:**
- Modify: `backend/app/passport/access.py`
- Modify: `backend/app/api/deps.py:40-55` (delete `_is_active_member`, import instead)
- Test: `backend/tests/test_passport_access.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_sso_active_requires_flag_and_url():
    from types import SimpleNamespace
    from app.passport.access import sso_active
    assert sso_active(SimpleNamespace(sso_enabled=True, passport_supabase_url="https://p.supabase.co"))
    assert not sso_active(SimpleNamespace(sso_enabled=False, passport_supabase_url="https://p.supabase.co"))
    assert not sso_active(SimpleNamespace(sso_enabled=True, passport_supabase_url=None))


def test_sso_active_ignores_backend_anon_key(session):
    """Model 3 never signs into Passport's GoTrue from the backend, so the anon key
    is a frontend concern. Requiring it here would let a correct config trip the switch."""
    from types import SimpleNamespace
    from app.passport.access import sso_active
    assert sso_active(SimpleNamespace(
        sso_enabled=True, passport_supabase_url="https://p.supabase.co",
        passport_supabase_anon_key=None,
    ))
```

- [ ] **Step 2: Run to verify failure** — `cd backend && pytest tests/test_passport_access.py -k sso_active -v` → FAIL, `ImportError`
- [ ] **Step 3: Implement** — add to `access.py`:

```python
def sso_active(settings) -> bool:
    """The single definition of "SSO is on". Flag AND Passport's project URL.

    Deliberately NOT the backend anon key: under Model 3 the backend never calls
    Passport's GoTrue (the code exchange authenticates with X-API-Key), so an operator
    who correctly drops that key must not silently route every member app-native.
    """
    return bool(settings.sso_enabled and settings.passport_supabase_url)


def is_active_member(session: Session, email: str) -> bool:
    """Promoted from deps._is_active_member — the passport layer must not import a
    private symbol from the API layer."""
    ...  # body moved verbatim from deps.py:40-55
```

- [ ] **Step 4: Rewire `deps.py`** — delete `_is_active_member`, `from app.passport.access import is_active_member`, update its two call sites.
- [ ] **Step 5: Run** — `pytest tests/test_passport_access.py tests/test_sso_dual_verify.py -v` → PASS

### Task 2: `resolve_app_id`, extracted from `writeback._app_id`

**Files:** Modify `backend/app/passport/access.py`, `backend/app/passport/writeback.py:98-114`; Test `backend/tests/test_passport_access.py`

- [ ] **Step 1: Write the failing tests** — org-less resolution returns the app id; empty projection returns `None` (never raises); `writeback._app_id` still raises 503 on `None`.
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement**

```python
def resolve_app_id(session: Session, *, org_id: str | None = None) -> str | None:
    """Prepper's own app id, off the entitlement projection.

    Returns None rather than raising: /passport/start is unauthenticated, has no org,
    and must always redirect (spec §4.2). writeback._app_id keeps the 503.

    The org-less form is NOT an unscoped cross-org read: entitlement delivery is
    own-app scoped, so every entitlement Prepper holds names Prepper and the app id is
    identical across orgs. It resolves the APP, never a tenant's rows.
    """
    stmt = select(PassportEntitlement.app_id)
    if org_id is not None:
        stmt = stmt.where(PassportEntitlement.organization_id == org_id)
    return session.exec(stmt).first()
```

`writeback._app_id` becomes: `app_id = resolve_app_id(session, org_id=org_id)` then its existing 503 when `None`.

- [ ] **Step 4: Run** — `pytest tests/test_passport_access.py tests/test_passport_writeback.py -v` → PASS

### Task 3: `PassportLoginAttempt` model + migration

**Files:** Create `backend/app/models/passport_login_attempt.py`, `backend/alembic/versions/<rev>_passport_login_attempt.py`; Modify `backend/app/models/__init__.py`

- [ ] **Step 1: Create the model** — copy `geddit-one/backend/models/passport_login_attempt.py` verbatim (`state` PK ≤128, `code_verifier` ≤256, `created_at`). **Default schema, not `passport`** — this is Prepper-owned, not a projected aggregate.
- [ ] **Step 2: Generate the migration** — `cd backend && alembic revision -m "passport login attempt"` (hand-write the table; do NOT autogenerate).
- [ ] **Step 3: Copy the RLS block verbatim** from `geddit-one/backend/alembic/versions/20260811_0001_passport_login_attempt.py:42-49`:

```python
op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
op.execute(f"GRANT ALL ON {TABLE} TO service_role")
op.execute(f"REVOKE ALL ON {TABLE} FROM authenticated")
op.execute(f"REVOKE ALL ON {TABLE} FROM anon")
op.execute(
    f"CREATE POLICY {TABLE}_no_client_access ON {TABLE} "
    "FOR ALL TO authenticated, anon USING (false)"
)
```

`downgrade` drops the policy by its **exact name** before dropping the table. Do **not** reach for `security.md`'s `current_user_id()` helpers — meaningless on a pre-authentication table, and a wrongly-named policy is added *beside* the intended one and keeps granting.

- [ ] **Step 4: Verify** — `pytest tests/ -x -q` → PASS (model registers cleanly on SQLite).

### Task 4: `pkce.py`

**Files:** Create `backend/app/passport/pkce.py`; Test `backend/tests/test_passport_pkce.py`

- [ ] **Step 1: Write the failing tests** — challenge is unpadded base64url SHA-256 of the verifier; verifier length in 43..128; `pop_verifier` returns the verifier once and `None` on the second call; a row older than the TTL returns `None` **and is gone**.
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement** — mirror `geddit-one/backend/services/passport_pkce.py`, converted to sync `Session`. `pop_verifier` **must** be a single `DELETE … RETURNING code_verifier, created_at` — the DELETE *is* the single-use check. A SELECT-then-DELETE reopens the replay race.
- [ ] **Step 4: Run** — `pytest tests/test_passport_pkce.py -v` → PASS

### Task 5: `login_routing.py`

**Files:** Create `backend/app/passport/login_routing.py`; Test `backend/tests/test_passport_login_routing.py`

- [ ] **Step 1: Write the failing tests** — active member + `sso_active` → `"passport"`; non-member → `"app-native"`; unknown address → `"app-native"` and **indistinguishable** from the non-member case; `sso_active=False` → `"app-native"` even for a member (D11).
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement** — sync, one function, one boolean input, two values. No third branch, ever.
- [ ] **Step 4: Run** → PASS

---

## Chunk 2: Backend routes

### Task 6: Rate-limit buckets

**Files:** Modify `backend/app/api/rate_limit.py`; Test `backend/tests/test_rate_limit.py`

- [ ] **Step 1:** Add named constants `LOGIN_ROUTE_IP_PER_MINUTE = 10`, `LOGIN_ROUTE_EMAIL_PER_MINUTE = 5`, `PASSPORT_START_IP_PER_MINUTE = 10` (geddit's values) and helpers `login_route_limited(ip, email) -> bool`, `passport_start_limited(ip) -> bool` over the existing `_too_many`.
- [ ] **Step 2:** Extend the module docstring: these buckets are **per instance**, so the ceiling multiplies by machine count and resets on restart — the same honest caveat the AI limiter already carries, and in tension with the multi-machine argument that put PKCE in Postgres. Accepted: they bound enumeration throughput, not spend.
- [ ] **Step 3:** Tests — the 11th IP hit and 6th email hit are refused; `_reset_for_tests` clears both.

### Task 7: `POST /auth/resolve-login`

**Files:** Modify `backend/app/api/auth.py`, `backend/app/api/deps.py::public_routes`; Test `backend/tests/test_login_routing_route.py`

- [ ] **Step 1: Write the failing tests** — member → `{"route":"passport"}`; non-member and unknown → `{"route":"app-native"}` with **byte-identical** bodies; a 400-octet email → 422; a malformed address still routes (no `EmailStr`); 11th call from one IP → 429; 6th for one email → 429.
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement** — request model `email: str = Field(max_length=320)`, **no `EmailStr`** (rejecting malformed input ahead of the decision is an oracle). Response carries `route` and nothing else. Email bucket applied manually inside the body. Add to `public_routes`.
- [ ] **Step 4: Run** → PASS

### Task 8: `GET /auth/passport/start`

**Files:** Modify `backend/app/api/auth.py`, `deps.py::public_routes`, `backend/app/config.py`; Test `backend/tests/test_passport_sso_start.py`

- [ ] **Step 1:** Add config `passport_dashboard_url`, `sso_callback_url`, `frontend_url` (+ `.env.example`).
- [ ] **Step 2: Write the failing tests** — happy path 307s to `{dashboard}/authorize` with `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`, and writes exactly one row; unconfigured (`resolve_app_id` → `None`) **redirects** to `?error=passport_unavailable`; rate-limited **redirects**; an exception inside `store_verifier` **redirects**.
- [ ] **Step 3: Implement** — every exit is a `RedirectResponse`, including a catch-all around `resolve_app_id`/`store_verifier`. (Geddit lacks this catch-all; Prepper closes it.) Rate limit applied manually — a decorator's global JSON 429 would render as the whole page.
- [ ] **Step 4: Run** → PASS

### Task 9: `GET /auth/passport/callback`

**Files:** Modify `backend/app/api/auth.py`, `deps.py::public_routes`; Test `backend/tests/test_passport_sso_callback.py`

- [ ] **Step 1: Write the failing tests** (mock the exchange with `respx`/`unittest.mock`):
  - unknown `state` → redirect `passport_sso_failed`
  - expired `state` → same
  - **replayed `state`** (second callback with the same state) → same — exercises the atomic DELETE
  - `?error=access_denied` from Passport → same
  - exchange non-200 → same
  - non-member → redirect **`passport_no_access`**, never a 403 body
  - member without derived access → `passport_no_access`
  - success → 307 to `{FRONTEND_URL}/auth/passport-callback#access_token=…&refresh_token=…`
  - success writes `identity_link` with the **membership-derived** `platform_user_id`, not `claims["sub"]`
  - a pre-existing link with a different `platform_user_id` is **replaced**, not updated
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement** — mirror `geddit-one/backend/api/routes/auth.py:228-386`, with: `PASSPORT_API_URL.rstrip("/")`; `redirect_uri` re-sent in the exchange body; the D10 access gate; a **distinct log line per branch** and no PII; **no** `report_identity_link_safe` (a guaranteed no-op for a Passport-issued token — `general.md` forbids dead code).
- [ ] **Step 4: Run** → PASS

---

## Chunk 3: Backend enforcement and deletions

### Task 10: Request-path derived-access gate (D6)

**Files:** Modify `backend/app/api/deps.py` (`_resolve_current_user`); Test `backend/tests/test_default_deny_auth.py`, `backend/tests/test_passport_access.py`

- [ ] **Step 1:** Test — a member without derived access gets 403 on any gated route; a member with access passes; an unlinked user with no synced entitlement **passes** (fails open until the projection lands).
- [ ] **Step 2:** Implement, mirroring `geddit-one/backend/api/deps.py:255`.
- [ ] **Step 3:** Confirm the doctrine's `JwksUnavailableError` clause-ordering footgun does not apply — `verify_passport_identity` is a separate call ending in `except Exception: return None`, not an except-chain fallthrough. One comment recording the check.

### Task 11: D9 server-side enforcement

**Files:** Modify `backend/app/api/auth.py`; Test `backend/tests/test_auth.py`

- [ ] **Step 1:** Tests — with `sso_active`, `/auth/login`, `/auth/oauth-complete` and `/auth/password-reset` each refuse an active member (403 for the first two); with `sso_active=False` **none** of them refuse (D11); `/auth/password-reset` returns a byte-identical body for member, non-member and unknown address.
- [ ] **Step 2:** Implement all three checks, each gated on `sso_active`, all calling the same `is_active_member`.
- [ ] **Step 3:** Add `POST /auth/password-reset` to `public_routes`.

### Task 12: Delete the proxy, register, and refresh-token

**Files:** Modify `backend/app/api/auth.py`, `backend/app/domain/supabase_auth_service.py`, `backend/app/config.py`, `backend/app/models/__init__.py`; Delete tests

- [ ] **Step 1:** Delete `POST /auth/register`, `RegisterRequest`, `SupabaseAuthService.register`, `login_via_passport`, `refresh_via_passport`, `sso_login_enabled`, `POST /auth/refresh-token`, `Settings.passport_org_id`.
- [ ] **Step 2:** Replace `verify_passport_identity`'s inline gate (`supabase_auth_service.py:343`) with `access.sso_active(settings)` — one definition, not three.
- [ ] **Step 3:** Delete `backend/tests/test_auth.py:370,384` (refresh-token) and the register cases.
- [ ] **Step 4:** Add a regression test asserting `login_via_passport` no longer exists.
- [ ] **Step 5:** Run the full suite — `cd backend && pytest -q` → PASS. Then `ruff check . && ruff format . && mypy app/`.

---

## Chunk 4: Frontend substrate

### Task 13: Provider cookie + dual clients

**Files:** Create `frontend/src/lib/auth/authProviderCookie.ts`, `frontend/src/lib/supabase/passportClient.ts`, `frontend/src/lib/supabase/activeClient.ts`; Test `authProviderCookie.test.ts`, `activeClient.test.ts`

- [ ] **Step 1:** Copy all three from `geddit-one/frontend/lib/`, renaming the cookie to `prepper_auth_provider`.
- [ ] **Step 2:** **`passportClient.ts` must pass `isSingleton: false`** — `createBrowserClient` otherwise returns the already-cached Prepper-project client from a shared unkeyed module slot, and every Passport session would silently validate against the wrong project.
- [ ] **Step 3:** Port geddit's unit tests for both. Run `npm test` → PASS.

### Task 14: `store.tsx` — stop owning tokens

**Files:** Modify `frontend/src/lib/store.tsx`, `frontend/src/lib/api.ts` (add `getMe()`)

- [ ] **Step 1:** Add `getMe()` to `api.ts` for `GET /auth/me` — the endpoint exists (`auth.py:404`) but has no frontend caller today.
- [ ] **Step 2:** Subscribe `onAuthStateChange` on the client named by the cookie at hydration; re-subscribe when sign-in changes it.
- [ ] **Step 3:** `userId` / `username` / `email` now come from `getMe()` once a session exists. **`userId` must remain the hydration signal** — `AuthGuard.tsx:91` decides on `!!userId`.
- [ ] **Step 4:** **Keep `activeOrgId` in `store.tsx` and localStorage on its own key.** It is not part of the Supabase session, and it feeds `orgHeader()` → `X-Organization-Id` (`api.ts:172-173`) — load-bearing for org isolation. Dropping it removes the acting-org header from every request.

### Task 15: `api.ts` token source and the 401 rule

**Files:** Modify `frontend/src/lib/api.ts:151-162,197,266,297,215-227`, `frontend/src/lib/auth-interceptor.ts`

- [ ] **Step 1:** Replace `readAuthFromStorage()`'s token half with `getActiveSupabaseClient().auth.getSession()`; keep reading `activeOrgId` from the store.
- [ ] **Step 2:** Delete `refreshAccessToken` and `RefreshTokenResult` from `auth-interceptor.ts`. **Keep `registerLogoutCallback` and `triggerLogout`** — used at `store.tsx:4,143` and `api.ts:138,225`.
- [ ] **Step 3: Implement the 401 rule** — this is the outage fix, relocated from refresh to verify:

| `getSession()` outcome | Action |
|---|---|
| session with a **different** access token | retry once |
| **no session** | `performSignOut()`, throw 401 |
| **throws** (network/DNS/5xx) | **do not sign out** — surface the error, leave the session to ride its TTL |

A Passport JWKS outage 401s every request; collapsing that into a logout mass-logs-out everyone into a login that cannot work.

### Task 16: `performSignOut()` and AuthGuard

**Files:** Create `frontend/src/lib/auth/signOut.ts`; Modify `TopNav.tsx:54`, `auth-interceptor.ts:14-24`, `AuthGuard.tsx`

- [ ] **Step 1:** `performSignOut()` — `signOut({ scope: "local" })` on the **active** client (never the default `global`, which would sign the user out of Passport itself and every other consumer), `clearAuthProviderCookie()`, clear local state, and call `logoutUser()` **only** when the provider is `app-native`.
- [ ] **Step 2:** Use it from **both** the button and the forced path. Without one helper, a 401-driven logout leaves a live Supabase session and stale cookie that the next page load re-hydrates from.
- [ ] **Step 3: AuthGuard — four edits:** add `/auth/passport-callback` to `VALID_ROUTE_PATTERNS` (`:10-39`; a non-match renders `null`) **and** `PASSTHROUGH_ROUTE_PATTERNS` (`:42-45`); remove `/register` from `PUBLIC_ROUTES` (`:7`) **and** `/^\/register$/` from `VALID_ROUTE_PATTERNS` (`:13`).

---

## Chunk 5: Frontend login UI, callback, e2e

### Task 17: Shared destination helper

**Files:** Create `frontend/src/lib/auth/postLoginDestination.ts`; Modify `login/page.tsx:47-65`, `auth/callback/page.tsx:57-64`

- [ ] **Step 1:** Extract `resolvePostLoginDestination()` — `?redirect` > `tasting_redirect_url` > `prepper_last_route` > `/recipes`, validating relative paths only. Third occurrence, so `general.md` requires the extraction.
- [ ] **Step 2:** **Resolve** before the `passport` navigation, but **consume `tasting_redirect_url` only in the callback** — deleting it before the round trip loses the deep link on a failed SSO attempt.

### Task 18: Two-step login page

**Files:** Create `frontend/src/app/login/resolveLogin.ts` (+ test); Modify `frontend/src/app/login/page.tsx`

- [ ] **Step 1:** Port `resolveLogin.ts` from geddit and its unit test. `passport` → full-page `window.location` to `{API}/api/v1/auth/passport/start`; `app-native` → return so the password field renders.
- [ ] **Step 2:** Rebuild the page: step 1 is one email field + Continue. Step 2 reveals the password **in place**, email echoed read-only, with "Use a different email" and "Forgot password?".
- [ ] **Step 3: Google moves to step 2 only** (D7 — geddit renders it on both; that offers a front-door choice before routing, which is the toggle the standard deletes).
- [ ] **Step 4:** `?error=` renders one shared message for `passport_unavailable`, `passport_sso_failed`, `passport_no_access`; a 429 gets its own copy.
- [ ] **Step 5:** Delete `app/register/page.tsx` and the "Sign Up" link (`login/page.tsx:181`).

### Task 19: Callback page

**Files:** Create `frontend/src/app/auth/passport-callback/page.tsx`, `parseFragment.ts` (+ test)

- [ ] **Step 1:** Port both from geddit. Parse the hash, `setSession()` on the Passport client, `setAuthProviderCookie("passport")`, consume `tasting_redirect_url`, navigate to the resolved destination.

> **Leave via a FULL PAGE LOAD (`window.location.assign`), never `router.replace`.** Chunk 4's store
> subscribes `onAuthStateChange` on the cookie-named client **at hydration only**. A client-side
> navigation leaves it subscribed to Prepper's own client while the live session sits on the Passport
> one: no `SIGNED_IN` ever arrives, `isAuthResolving` is already false, so `AuthGuard` sees `!userId`
> and redirects to `/login` — on a session that is actually valid. It presents as "SSO is broken",
> and nothing logs. This is the single most important line in Chunk 5.

> **`await login(...)` at every call site.** Chunk 4 made `store.login()` async, and
> `supabase.auth.setSession()` does a `/auth/v1/user` round trip before persisting. Navigating
> without awaiting can fire `router.push` before the session is readable; on a slow network the 401
> probe lands on `none` and signs the user straight back out. The three existing call sites
> (`login/page.tsx`, `auth/callback/page.tsx`, `register/page.tsx`) do not await it today.
- [ ] **Step 2:** `hasHandledRef` guard against StrictMode's double-invoke.
- [ ] **Step 3:** Run `npm test` → PASS.

### Task 20: e2e harness

**Files:** Modify `frontend/e2e/global.setup.ts:36-50`, `frontend/e2e/pages/LoginPage.ts:17,25-29`; Delete `/register` specs in `auth.spec.ts:78-83,223-275`

- [ ] **Step 1:** **Run e2e with SSO off** — no `PASSPORT_SUPABASE_URL` in the Playwright env, so `sso_active` is false, `/auth/login` keeps working for the test users, and the suite exercises the degradation path.
- [ ] **Step 2:** `global.setup.ts` seeds the **Supabase client's own storage key**, not `prepper_auth` — once `store.tsx` stops owning tokens, injecting `prepper_auth` authenticates nothing.

> **Wider than the two files named above.** `prepper_auth` is seeded in **six** places, all of which
> break: `e2e/global.setup.ts` (three sites), `e2e/helpers/auth.ts`, `e2e/auth.spec.ts`,
> `e2e/navigation.spec.ts`, `e2e/ui-components.spec.ts`. Grep for `prepper_auth` before starting and
> fix every hit — a missed one fails as an unauthenticated redirect, not as an obvious error.
- [ ] **Step 3:** `LoginPage.login()` becomes two steps: fill email → Continue → fill password → Sign in.
- [ ] **Step 4:** Delete the register specs and `registerLink`.

**Known gap, accepted:** the `passport` branch is not e2e-covered. Driving a real hosted login from Playwright means automating Passport's own UI. Covered by backend tests and the manual pass below.

### Task 21: Full verification

- [ ] `cd backend && pytest -q` → PASS
- [ ] `cd backend && ruff check . && ruff format --check . && mypy app/` → clean
- [ ] `cd frontend && npm run build && npm run lint && npm test` → PASS
- [ ] `cd backend && python scripts/verify_rls.py` and `pytest tests/test_rls_integration.py` (real Postgres) — mandated after any policy change; the SQLite suite cannot see RLS
- [ ] `pytest tests/test_route_auth_census.py tests/test_default_deny_auth.py` — four routes added, two removed

**Manual acceptance (staging, cannot be automated):**
- [ ] A real hosted login produces an `identity_link` row (eager linking is not guaranteed)
- [ ] A Passport 5xx during refresh does **not** clear the session
- [ ] A Passport JWKS outage on the request path does **not** mass-log-out
- [ ] Signing out of Prepper does **not** sign the user out of Passport

---

## Deployment order

0. **Set `SSO_ENABLED=false` as a secret in each environment FIRST**, before any deploy. It defaults to `true`, and `PASSPORT_SUPABASE_URL` is already set everywhere (it shipped with the dual-issuer verify seam) — so `sso_active` is `true` on the first boot of this release unless you set it. Skip this and step 3 silently becomes step 4: the router sends every member to Passport and `/auth/login` starts 403-ing them.
1. Operator registers `SSO_CALLBACK_URL` on Passport's **per-app** allow-list (Apps → Prepper → Sign-in callbacks), byte for byte — **not** the Supabase project-level list.
2. Operator confirms Prepper's `issuer_url` = Passport's project (the registry withholds this field; it cannot be verified from Prepper's side).
3. **Deploy the BACKEND first, then the frontend.** Only this order is safe. Frontend-first is a hard login outage — the new page's first action is `POST /auth/resolve-login`, which 404s on the old backend and renders "An unexpected error occurred" for everyone. Backend-first degrades instead: the old frontend's refresh hits the deleted `/auth/refresh-token` and users drop out as their tokens expire, rather than all at once.
4. **The forced logout happens HERE, at the frontend deploy — not at the flag flip.** The substrate port is what ends existing sessions: hydration drops the old `prepper_auth` blob and the app now reads the Supabase client's own cookie storage. Every password-authenticated session dies at this step. (Google-authenticated users may survive, having already held an `sb-<ref>-auth-token` cookie.) Brief support for step 4, not step 5.
5. Flip `SSO_ENABLED=true`. Members without a Passport password complete Passport's set-password step — confirm Passport's mail is sending first.
6. Kill switch: set `SSO_ENABLED=false`. Router sends everyone `app-native` and no endpoint refuses a member.

> **The kill switch is not a full rollback, and it decays.** It restores the app-native path for accounts that existed *before* the cutover. A member provisioned by the Passport callback has a local `users` row but **no credential on Prepper's own GoTrue project** — with SSO off they route `app-native`, reach the password step, and have no password. `/auth/password-reset` cannot help them either: with SSO off the membership check is false, so it tries to recover a GoTrue user that does not exist and answers non-committally by design. **The longer SSO stays on, the larger the population the switch does not cover.** Know this before an incident, not during one.
