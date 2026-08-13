# Email-first login + Passport hosted-login handoff (Model 3)

**Date:** 2026-08-12
**Status:** Approved for implementation (revised after spec review)
**Reference implementation:** `missiongroupsystems/geddit-one` @ `main` (`bf59519`) — adopted as-is except where a **D**-row below declares otherwise
**Doctrine:** `passport-sync-consumer` skill, `reference/sso-login.md`

## 1. Context

Prepper is a conforming Passport sync consumer on the wire (17 handlers, eight aggregates projected
into the `passport` schema, nightly `snapshot()` reconciliation, no shadow tables, no local role
vocabulary). Its **login** predates the standard: it implements Model 2, the SSO login-proxy.

`POST /auth/login` collects an email *and* a password, then replays the password against Passport's
GoTrue via `login_via_passport` (`auth.py:61-63` → `supabase_auth_service.py:123-153`).
Consequences:

- Prepper's backend handles members' **Passport** passwords in plaintext on every login. A Prepper
  compromise harvests credentials valid for every app on the platform.
- `sign_in_with_password` is a non-interactive API call, so it structurally cannot present MFA.
- It shares *credentials*, not a *session*: the user retypes their password in every app.

`sso-login.md` names this seam **#2** and says it must not be built. This spec replaces it with the
email-first router plus the Model 3 hosted-login handoff.

`unit_scope` was read from `GET /api/v1/apps/me/registry` on 2026-08-12 and is **`brand`** (app id
`3ed1a824-1f78-4746-9005-4273faa186d7`). Prepper's brand-scoped assumptions are correct and
unaffected.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | Adopt `geddit-one` as the reference, backend and frontend, including its session substrate (dual Supabase browser clients selected by a provider cookie). |
| D2 | Routing is one function, one boolean input, **two** values. No third route. |
| D3 | Two rate-limit buckets on `/resolve-login` (IP + email); one on `/passport/start` (IP). Applied **inside** handlers — this is Prepper's own approach, not adoption: Prepper has no slowapi, whereas geddit uses a `@limiter.limit` decorator for the resolve-login IP bucket (`auth.py:105`) and manual `hit()` only for the other two. |
| D4 | PKCE `state → code_verifier` in a Postgres table, popped by an **atomic `DELETE … RETURNING`**. |
| D5 | Session crosses to the browser in the **URL fragment**, as in `geddit-one`. |
| D6 | Derived-access authorization moves to the **request path** (`deps`), matching `geddit-one/backend/api/deps.py:255`. |
| D7 | **Deviation.** Google sign-in moves to **step 2 only**. `geddit-one/frontend/app/(auth)/login/page.tsx:261-298` renders it on *both* steps (outside the step ternary, which closes at `:259`). Showing it at step 1 offers a front-door choice before routing has happened, which is the toggle the standard exists to delete. |
| D8 | `/register` self-signup is **deleted**, frontend and backend. |
| D9 | **Deviation.** App-native password sign-in, password reset, **and `oauth-complete`** re-check membership server-side and refuse an active member. Geddit does sign-in and reset client-side, so its backend cannot enforce anything — leaving an MFA/revocation bypass for legacy local accounts. |
| D10 | **Deviation.** The callback carries the Seam B access gate. `geddit-one/backend/api/routes/auth.py:303-307` deliberately omits it, arguing its request-path gate makes a second check the "divergence is an auth bug" trap. That reasoning is sound *for Geddit*; this spec sides with `sso-login.md` because the callback is the only place Prepper mints a member session, and D6 lands in the same push — so the two gates are the same helper, not two slightly different checks. |
| D11 | The break-glass flag is honoured by **both** the router and D9's checks, or it is not a kill switch (see §7). |

### Non-goals

- Any change to the sync projection, handlers, reconciliation, or write-back.
- Upgrading `passport-client`. Prepper is pinned to `passport-client-v1.1.0`, the newest published tag
  on both channels; `roles_at_units` / `unit_scope` arrive in 2.0.0, which is not cut.
- Seam C (Passport-side logout). **Prepper's own sign-out is in scope** — see §4.5.
- A citext unique index on `users.email`. `resolve_or_provision` already fails closed on ambiguity.

## 3. Flow

```
Step 1: [ email ] (Continue)
   └─ POST /auth/resolve-login ──► "passport"    ──► window.location = {API}/api/v1/auth/passport/start
      (unauthenticated)           └ "app-native" ──► password field renders in place (step 2)

passport branch
   GET /auth/passport/start
     ├─ IP rate limit (manual; a JSON 429 would render as the whole page)
     ├─ resolve app_id from the entitlement projection
     ├─ generate PKCE pair, persist state → verifier
     └─ 302 {PASSPORT_DASHBOARD_URL}/authorize?client_id&redirect_uri&state&code_challenge&S256

   GET /auth/passport/callback?code&state
     ├─ pop verifier by state (atomic DELETE…RETURNING; absent/expired ⇒ refuse)
     ├─ POST {PASSPORT_API_URL}/api/v1/apps/me/session-exchange  (X-API-Key, re-sends redirect_uri)
     ├─ verify token; take sub + email from verified claims
     ├─ resolve_or_provision_passport_user(sub, email)
     ├─ access gate (D10): not-a-member ⇒ refuse; no derived access ⇒ refuse
     ├─ write identity_link directly (platform_user_id from membership projection, by email)
     └─ 302 {FRONTEND_URL}/auth/passport-callback#access_token=…&refresh_token=…

app-native branch
   POST /auth/login  ──► 403 if SSO active AND is_active_member(email)   (D9, D11)
                    └──► sign in against Prepper's own project, return session JSON
```

## 4. Backend

### 4.1 New files

**`app/models/passport_login_attempt.py`** — mirrors `geddit-one/backend/models/passport_login_attempt.py`:
`state` (PK, ≤128), `code_verifier` (≤256), `created_at`.

Postgres, not in-memory: Fly does not guarantee `/start` and `/callback` land on the same machine, and
`min_machines_running = 0` with auto-start makes multi-machine routine. TTL (5 minutes) is enforced at
read time; no sweeper job, because the row is deleted on every pop and stale rows are bounded by the
`/start` rate limit.

**Migration** — copy `geddit-one/backend/alembic/versions/20260811_0001_passport_login_attempt.py:42-49`
**verbatim**: `ENABLE ROW LEVEL SECURITY`, `GRANT ALL … service_role`, `REVOKE ALL … authenticated`,
`REVOKE ALL … anon`, and `CREATE POLICY <table>_no_client_access ON <table> FOR ALL TO authenticated,
anon USING (false)`, with the matching `DROP POLICY IF EXISTS` in `downgrade`.

Do **not** invent a policy from `security.md`'s `current_user_id()` helpers — they are meaningless on a
pre-authentication table, and CLAUDE.md warns that a wrongly-named extra PERMISSIVE policy is added
*beside* the intended one and keeps granting. The deny-all is self-documenting intent, not a no-op.

The table is Prepper-owned, not a Passport aggregate, so it lives in the **default schema, not
`passport`**. Rule 7 does not apply: Passport has no notion of an app's PKCE attempt.

**`app/passport/pkce.py`** — mirrors `services/passport_pkce.py`.

- `generate_pkce_pair()` → `(verifier, challenge, state)`. Verifier `secrets.token_urlsafe(64)`;
  challenge unpadded base64url of its SHA-256; state `secrets.token_urlsafe(32)`. Fresh pair per attempt.
- `store_verifier(session, *, state, verifier)`
- `pop_verifier(session, *, state) -> str | None` — **a single `DELETE … RETURNING code_verifier,
  created_at`**, never SELECT-then-DELETE. The DELETE *is* the atomic single-use check: two concurrent
  pops for one state cannot both see the row. A row past TTL is deleted *and* refused.

**`app/passport/login_routing.py`** — mirrors `services/passport_login_routing.py`, but **sync**
(Prepper uses SQLModel `Session`, not Geddit's `AsyncSession`):

```python
def resolve_login_route(session, email, *, sso_active: bool) -> Literal["passport", "app-native"]:
    if sso_active and is_active_member(session, email):
        return "passport"
    return "app-native"
```

`sso_active` is D11: with the kill switch off, everyone routes `app-native`. One function, one
membership lookup, two values — nowhere for a third branch to hide.

**Prerequisite refactor:** the membership check today is `deps._is_active_member` (`deps.py:40`) —
private, and in the API layer. Promote it to `app/passport/access.py` beside `platform_user_id_for_email`
as public `is_active_member`, and have `deps` import it. Otherwise the passport layer imports a private
symbol from the API layer, inverting the dependency direction.

### 4.2 Routes (`app/api/auth.py`)

**`POST /auth/resolve-login`** — unauthenticated. `email` capped at 320 octets (RFC 5321), and
deliberately **not** `EmailStr`: rejecting a malformed address ahead of the routing decision is a
different answer for a different class of input, which is still an oracle. Response is
`{"route": …}` and nothing else. Both branches perform the same single membership lookup
unconditionally, so timing does not partition the input space the body refuses to.

**`GET /auth/passport/start`** — every exit is a `RedirectResponse` to
`{FRONTEND_URL}/login?error=passport_unavailable`, including a **catch-all around `resolve_app_id` and
`store_verifier`**. (Geddit has no try/except there, so an infra error surfaces as JSON — §6.4 does not
hold for it. Prepper closes this.) Reached only by top-level navigation, so a raised exception or a
decorator-driven JSON 429 would render as the entire page.

**`GET /auth/passport/callback`** — **every refusal is a redirect, never a status code.** This includes
the D10 access gate: a member without derived access gets
`{FRONTEND_URL}/login?error=passport_no_access`, not a `403`, because a raw JSON 403 renders as the
whole page. Failure codes:

| code | meaning |
|---|---|
| `passport_unavailable` | never left our app (start-side failure) |
| `passport_sso_failed` | came back, but the exchange or verification failed |
| `passport_no_access` | authenticated, but not a member / no derived access |

Each of the ~7 internal branches (Passport returned `?error=`, missing code/state, no stored verifier,
exchange non-200, incomplete session, token verification failed, no email claim) gets its **own log
line** — one shared user message is correct, one shared query param is not, and a shared log line makes
the search unsplittable. No email or token is logged (`security.md`: no PII in logs).

The exchange re-sends `redirect_uri` (RFC 6749 §4.1.3 — closes code substitution across two registered
callbacks). `PASSPORT_API_URL` is `.rstrip("/")`-ed at read; a trailing slash yields `//api/v1/...` and a
flat 404.

**Identity link.** After `resolve_or_provision_passport_user`, write the row directly:
`platform_user_id` from the membership projection **by verified email**, never `claims["sub"]` (a
different UUID space — Passport's Supabase auth-user id). Idempotent per `(subject, app_id)`; a row whose
`platform_user_id` disagrees is **replaced, not updated** (identity-link rows are immutable per row).
`report_identity_link_safe` is **not** called here — it verifies against Prepper's own registered
`issuer_url` and is a guaranteed no-op for a Passport-issued token. (Geddit keeps it "for parity";
`general.md` forbids dead code.)

### 4.3 Changed

- **`app/api/deps.py`** — `_resolve_current_user` gains the derived-access gate
  (`geddit-one/backend/api/deps.py:255`). Fails open while entitlements have not synced, matching the
  existing derivation. **Seam #1 (dual-issuer verify) is retained unchanged**; confirm during
  implementation that the doctrine's `JwksUnavailableError` clause-ordering footgun does not apply —
  Prepper's Passport-issuer attempt is a separate call (`verify_passport_identity`, `deps.py:312`) that
  catches broadly and returns `None`, not an except-chain fallthrough, so it should be clear.
- **`app/api/rate_limit.py`** — add IP and email buckets over the existing `_too_many` sliding window.
  Named constants: `LOGIN_ROUTE_IP_PER_MINUTE = 10`, `LOGIN_ROUTE_EMAIL_PER_MINUTE = 5`,
  `PASSPORT_START_IP_PER_MINUTE = 10` (Geddit's values). **Accepted limitation, stated not hidden:**
  these buckets are in-process, so the effective ceiling multiplies by machine count and resets on
  restart — the same weakness the file already documents for the AI limiter, and in tension with §4.1's
  own multi-machine argument. Accepted because these buckets bound enumeration throughput rather than
  spend, and moving them to Postgres is a larger change than this work warrants. Extend the module
  docstring to say so.
- **`app/api/deps.py::public_routes`** — add `POST /auth/resolve-login`, `GET /auth/passport/start`,
  `GET /auth/passport/callback`, `POST /auth/password-reset`; remove `POST /auth/register`.
- **`app/passport/access.py`** — promote `is_active_member` (§4.1), add `sso_active(settings)` (§7), and
  add `resolve_app_id(session, *, org_id=None) -> str | None`.

  `resolve_app_id` **extracts from, rather than forks,** `writeback._app_id(session, org_id)`
  (`writeback.py:98-114`) — but the extraction is not a straight move: `_app_id` filters on
  `PassportEntitlement.organization_id == org_id` and **raises 503**, and `/passport/start` is
  unauthenticated, has no org, and must always redirect rather than raise (§4.2). So the shared function
  applies the org filter **only when `org_id` is given** and **returns `None` rather than raising**;
  `writeback._app_id` becomes a thin wrapper that turns `None` into its existing 503.

  The org-less call is correct and is **not** the unscoped cross-org query CLAUDE.md warns about:
  `unit_app_access` / `entitlement` delivery is own-app scoped, so every entitlement Prepper holds names
  Prepper, and the app id is identical across orgs. It resolves the *app*, never a tenant's rows.
- **`POST /auth/login`** (D9) — keeps its shape for the app-native branch **against Prepper's own
  project**, but first re-checks membership and returns **403** for an active member, pointing at hosted
  login. Same helper as the router — one implementation, never a fork. Gated on the same `sso_active`
  flag as D11, or the kill switch admits nobody.

  This is where D9 forces a shape change: Geddit signs in **client-side**, which is exactly why its
  backend cannot enforce anything. Keeping the check requires sign-in to stay a **backend call**. The
  frontend then injects the returned tokens into Prepper's own browser client via
  `setSession({access_token, refresh_token})` and sets the provider cookie to `app-native`, so both
  branches converge on a Supabase-client-held session. The only asymmetry is where the tokens arrive
  from — a fragment on one branch, a JSON body on the other.
- **`POST /auth/oauth-complete`** (D9) — a **fourth session-minting path**, public (`deps.py:110`),
  backing Google (D7). It currently mints a session without consulting membership. Apply the same
  check, **gated on the same `sso_active`**: refuse an active member, pointing at hosted login.
- **`POST /auth/password-reset`** (D9) — new. Applies the same check, **gated on the same
  `sso_active`**, and triggers Prepper's own project's recovery mail **only** for a non-member. Returns
  an **identical non-committal response in every case** — member, non-member, unknown address alike —
  or the enumeration oracle the router refuses is rebuilt in the recovery flow.

### 4.4 Deleted

`POST /auth/register`, `RegisterRequest`, `SupabaseAuthService.register`,
`SupabaseAuthService.login_via_passport` (seam #2), `SupabaseAuthService.refresh_via_passport`,
`POST /auth/refresh-token`, and the dead `Settings.passport_org_id` (rule 9 — `config.py:77` +
`.env.example:39`, one test stub, zero reads in app code).

**Stranded callers that must be handled, not discovered later:**

| Deletion | Strands | Resolution |
|---|---|---|
| `POST /auth/refresh-token` | `backend/tests/test_auth.py:370`, `:384` | Delete those tests |
| `refreshAccessToken` | `api.ts:138` import, refresh-on-401 path | Removed with the retry logic; the Supabase client owns refresh |
| `POST /auth/register` | `frontend/src/app/register/page.tsx`, the "Sign Up" link at `login/page.tsx:181`, `/register` in `AuthGuard.tsx:7` `PUBLIC_ROUTES`, `registerUser()` at `api.ts:1358`, e2e `auth.spec.ts:78-83, 223-275`, `e2e/pages/LoginPage.ts:17` | All deleted. The invite flow is unaffected — `InviteMemberModal` posts to `/passport/brand-roles/members` |

**`auth-interceptor.ts` is NOT deleted.** It exports four things; two go — `refreshAccessToken` and its
`RefreshTokenResult` interface (`:28-31`, imported at `api.ts:138`). `registerLogoutCallback`
(`store.tsx:4,143`) and `triggerLogout` (`api.ts:138,225`) stay: they are the forced-logout plumbing,
unrelated to refresh.

### 4.4b The e2e harness — a decision, not a cleanup

`frontend/e2e/global.setup.ts:36-50` authenticates **every** Playwright spec by POSTing `/auth/login`
and injecting the result into localStorage as the `prepper_auth` / `StoredAuth` blob. This change
breaks it twice over: once `store.tsx` stops owning tokens, injecting `prepper_auth` authenticates
nothing; and the setup's own comment records that each test user has an **active Passport membership**,
so D9 would `403` all three before any spec runs. `e2e/pages/LoginPage.ts:25-29` also fills email and
password and submits in one step, which the two-step form breaks.

**Decision: e2e runs with SSO off** — no `PASSPORT_SUPABASE_URL` in the Playwright env, so
`sso_active` is false. `/auth/login` keeps working for the test users (D9 refusals are flag-gated), the
router sends everyone `app-native`, and the suite exercises the degradation path that must keep working
anyway. Two changes remain: `global.setup.ts` seeds the **Supabase client's own storage key** rather
than `prepper_auth`, and `LoginPage.login()` becomes two steps (fill email → Continue → fill password →
Sign in). The `/register` specs are deleted with the feature.

This deliberately leaves the `passport` branch outside e2e coverage. It is covered by backend tests and
the manual acceptance pass in §8; driving a real hosted login from Playwright would mean automating
Passport's own UI, which is out of scope.

**The outage property does NOT come for free — it moves from refresh to verify, and must be handled
there.** The first draft claimed porting the substrate obtained it "structurally". That is wrong, and
the hole is worth stating precisely:

A Passport JWKS/issuer outage breaks the **backend verify path**, which this spec retains unchanged.
`verify_passport_identity` catches broadly and returns `None` (`supabase_auth_service.py:347-352`),
control falls through to `verify_token` against Prepper's own project (`deps.py:319`), a Passport-issued
token fails there, and **every request 401s**. Today a 401 leads to `refreshAccessToken` → `null` →
`triggerLogout()` (`api.ts:215-227`). Removing the refresh retry without specifying what replaces it
would leave the 401 branch calling `triggerLogout()` directly — turning a ten-minute Passport blip into
a mass logout into a login that cannot work. That is the exact outcome the doctrine calls the single
highest-value line of code in the outage story.

**Required 401 behaviour in `api.ts`:** on a 401, ask the active client for a session
(`getActiveSupabaseClient().auth.getSession()`, which auto-refreshes).

| Outcome | Action |
|---|---|
| A session with a **different** access token | Retry the request once |
| **No session** (genuine revocation/expiry) | `performSignOut()` (§4.5), then throw `401` |
| The call **throws** (network/DNS/5xx — an outage) | **Do not sign out.** Surface the error and leave the session intact to ride out its TTL |

The distinction between the second and third rows *is* the outage fix; it did not disappear, it
relocated. §8 asserts both a Passport 5xx during refresh **and** a Passport JWKS outage on the request
path.

### 4.5 Sign-out (in scope — omitted from the first draft)

Prepper has `POST /auth/logout` (`auth.py:373`, public), `logoutUser()` (`api.ts:1391`),
`TopNav.handleLogout` (`TopNav.tsx:54`), `store.logout()`, and `supabase_auth_service.py:244`
`self.client.auth.sign_out()` **with no scope argument**.

Under D1's dual clients this is a live bug: Supabase's `signOut()` defaults to `scope: "global"`, which
revokes the refresh token server-side for **every** session sharing it. A Passport-authenticated client
calling it signs the user out of Passport's own hosted page and every other consumer — a production
incident recorded 2026-08-11.

**One shared `performSignOut()` helper**, used by *both* the user-initiated button
(`TopNav.handleLogout`) and the forced path (`api.ts` 401 → `triggerLogout` →
`auth-interceptor.ts:14-24` → `store.logout()`). It must:

1. Read the provider cookie and resolve the active client **first**, before anything is cleared.
2. Call `logoutUser()` **only when the provider is `app-native`**.
3. `signOut({ scope: "local" })` on the **active** client — never the default `global`.
4. `clearAuthProviderCookie()`.
5. Clear local state.

**Steps 2 and 3 are in this order deliberately — an earlier draft of this spec had them the other
way round and was wrong.** `POST /auth/logout` requires a bearer token (`auth.py:725` 401s without
one) even though it sits in `public_routes`. After the client sign-out there is no token, so a
`logoutUser()` placed last is a permanent no-op that then bounces off the 401 rule. Caught in
implementation, not in review.

A **re-entrancy guard** is required for the same reason: `logoutUser()` goes through `fetchApi`,
whose 401 rule can itself call `performSignOut()`. Without the guard that recursion is unbounded.

Step 4 answers "how does the backend know which provider minted the token?" — **it doesn't, and it
shouldn't have to.** The marker is a frontend cookie and the backend sees only a bearer token, so the
*frontend* skips the call rather than the backend deriving the issuer. `POST /auth/logout` is therefore
left unchanged.

Without a single shared helper the forced path would clear local state while leaving a live Supabase
session and a stale provider cookie behind — and the next page load would re-hydrate straight from
them.

## 5. Frontend

**New**, mirroring `geddit-one`:

- `lib/auth/authProviderCookie.ts` — `prepper_auth_provider`, values `passport | app-native`, defaulting
  to `app-native` when absent or garbage. Attributes matched to `@supabase/ssr`'s
  `DEFAULT_COOKIE_OPTIONS` so the marker cannot expire while the session it describes is still valid.
- `lib/supabase/passportClient.ts` — a second browser client for Passport's project. **Must pass
  `isSingleton: false`**: `createBrowserClient` otherwise returns the already-cached Prepper-project
  client from a shared unkeyed module-level slot. Guarded on `typeof window`.
- `lib/supabase/activeClient.ts` — `getActiveSupabaseClient()` re-reads the cookie on every call (never
  memoized), plus `setAuthProviderCookie` / `clearAuthProviderCookie`.
- `app/auth/passport-callback/page.tsx` + `parseFragment.ts` — parses the hash, `setSession(...)` on the
  Passport client, sets the cookie, navigates to the destination. Guarded by a `hasHandledRef` against
  React StrictMode's double-invoke.
- `app/login/page.tsx` — rebuilt two-step: one email field → Continue; on `app-native` the password field
  renders **in place**, email echoed read-only, with "Use a different email".

  **"Forgot password?" is deliberately NOT shipped — deviation recorded 2026-08-12.** Two earlier drafts
  of this spec asked for it, on a false premise: they described the backend route as "replacing a
  client-side `resetPasswordForEmail`", and Prepper never had one. There is no regression here, because
  there was no recovery flow to begin with.

  Shipping the link would be **actively harmful, not merely incomplete**.
  `supabase_auth_service.py:117` calls `reset_password_email(email)` with **no `redirect_to`**, so the
  mail lands on the Supabase project's Site URL — where Prepper has no set-password UI, and
  `detectSessionInUrl` would silently consume the recovery token on arrival. The user would burn their
  one-time link on a page that cannot use it.

  **Consequence to hold open:** `POST /auth/password-reset` therefore has **zero callers** — a public,
  rate-limited, mail-sending route reachable by nobody through the UI. It is retained rather than
  deleted because it is the *correct* home for the D9 check once recovery exists, and re-deriving that
  reasoning later is the expensive part. Closing this needs an `/auth/reset-password` page that handles
  the recovery fragment, plus `redirect_to` pointing at it. That is a real scope addition and is
  tracked as its own follow-up, not smuggled into this work.
  Google below step 2 only (D7). A `?error=` param renders one shared message for all three codes. No SSO
  button, no toggle.

**Changed:**

- **`store.tsx`** — stops owning tokens; keeps owning everything else. Specifically: subscribe
  `onAuthStateChange` on the client named by the cookie **at hydration**, and re-subscribe when sign-in
  changes it (the cookie is written before `setSession`, so the callback page's own navigation resolves
  the ordering). `userId` / `username` / `email` come from `GET /auth/me` after a session is present —
  they are no longer in the auth blob. `AuthGuard.tsx:91` decides on `!!userId`, so `userId` must remain
  the hydration signal, set only once `/auth/me` resolves.
- **`activeOrgId` stays in `store.tsx` and localStorage, on its own key.** It is *not* part of the
  Supabase session. All three `readAuthFromStorage()` sites (`api.ts:197, 266, 297`) read it, and it
  feeds `orgHeader()` → `X-Organization-Id` (`api.ts:172-173`) — load-bearing for org isolation. After
  the port, `api.ts` takes the token from `getActiveSupabaseClient().auth.getSession()` and
  `activeOrgId` from its own store. Dropping it would remove the acting-org header from every request.
- **`AuthGuard.tsx` needs four edits**, not three: add `/auth/passport-callback` to
  `VALID_ROUTE_PATTERNS` (`:10-39` — a non-match renders `null`, so the page would never run) **and** to
  `PASSTHROUGH_ROUTE_PATTERNS` (`:42-45`); remove `/register` from `PUBLIC_ROUTES` (`:7`) **and** its
  `/^\/register$/` entry from `VALID_ROUTE_PATTERNS` (`:13`), which becomes dead config once the page
  goes.
- **`api.ts`** — add a `getMe()` wrapper for `GET /auth/me` (`auth.py:404`). The endpoint exists; it has
  no frontend call site today, and `store.tsx` now depends on one.
- **`app/tastings/invite/[id]/page.tsx:20-31`** reads the `prepper_auth` localStorage blob directly and
  redirects to `/login?redirect=…`. Update it to the new auth source.

**Carrying the post-login destination through the round trip.** `?redirect=` on `/login` is lost the
moment the browser navigates to `/passport/start`. No new column is needed: the login page already
resolves a destination from `?redirect=` / `tasting_redirect_url` / `prepper_last_route` and writes
`prepper_last_route` to localStorage (`login/page.tsx:47-65`). Move that **resolution** to before the
`passport` navigation, and have the callback page read `prepper_last_route`.

Two constraints on that move:

- **Do not move the `tasting_redirect_url` cleanup with it** (`login/page.tsx:60-63`). Consuming the
  key before the round trip means a *failed* SSO attempt loses the tasting deep-link permanently.
  Resolve it before navigating; delete it only in the callback, once a session exists.
- **Extract the destination logic.** `login/page.tsx:47-65` and `auth/callback/page.tsx:57-64` already
  duplicate it; `passport-callback/page.tsx` would be the third copy, and `general.md` says extract on
  the third occurrence. One `resolvePostLoginDestination()` helper, used by all three.

## 6. Security properties

1. Two routes only; a non-member and a nonexistent address are indistinguishable.
2. No email-format validation before routing; length capped instead.
3. Two rate-limit buckets (IP and email) — with the per-instance caveat in §4.3 stated, not hidden.
4. Every `/passport/*` exit is a redirect, never JSON — including the D10 access refusal.
5. `/passport/start` is rate-limited and its writes are bounded and single-use.
6. Both routing branches cost the same wall time.
7. The `code_verifier` never reaches the browser, and is single-use by atomic DELETE.
8. The routing decision is enforced server-side on all three session-minting paths — `/auth/login`,
   `/auth/oauth-complete` and the callback — plus `/auth/password-reset`, which is a *precursor* to one
   and is the recovery-flow hole that would otherwise reopen the bypass. Not only in the UI.

**Open question — login CSRF. `state` is not bound to the initiating browser.** Raised in code review
2026-08-12; recorded here rather than silently accepted, because the storage model it depends on was
approved in Chunk 1.

`state` lives only server-side in `passport_login_attempt`, with nothing tying it to the browser that
called `/start`. That leaves the classic OAuth login-CSRF open: an attacker completes `/start`
themselves, captures their own `code` + `state`, then forces a victim's browser to load the callback.
The victim is silently signed in **as the attacker**, and anything they subsequently enter — recipes,
costings, supplier pricing — lands in the attacker's tenant. Note the direction: this is not account
takeover of the victim, it is the victim working inside the attacker's org without noticing.

The conventional mitigation is a `HttpOnly; SameSite=Lax` cookie holding the state, set at `/start`
and compared at the callback — cheap, and it composes with the existing table rather than replacing
it. `geddit-one` does not do this either, so adopting it would be a deviation from the reference in
the safer direction.

**DECIDED 2026-08-12: implement the state cookie.** At `/start`, alongside the existing
`passport_login_attempt` row, set a `HttpOnly; Secure; SameSite=Lax; Path=/` cookie holding the same
`state`. At the callback, require it to be present and to equal the `state` query parameter before
`pop_verifier` is called; on mismatch or absence, refuse via the normal redirect path
(`passport_sso_failed`) and clear the cookie. Clear it on every terminal outcome, success included,
so a stale value cannot authorise a later attempt.

The cookie **adds to** the server-side table rather than replacing it: the table proves the state was
issued by us and carries the verifier; the cookie proves it was issued *to this browser*. Neither
alone closes the hole.

Two implementation notes, because both are easy to get wrong:
- `SameSite=Lax` is required, not `Strict` — the callback arrives via a cross-site top-level
  redirect from Passport, and `Strict` would withhold the cookie on exactly that navigation, breaking
  every login.
- `Secure` breaks plain-HTTP local development. Set it from the same condition that decides
  environment elsewhere, rather than unconditionally.

This is a deliberate deviation from `geddit-one`, which does not bind state to the browser. It is a
deviation in the safer direction, and the reasoning should be carried back to that repo.

### Google sign-in by a member — ACCEPTED 2026-08-13

**Decision: acceptable. No code change. Recorded here rather than fixed.**

Google sign-in **is** an app-native path — it authenticates against Prepper's own Supabase project,
exactly like the password step. That is not the issue. The issue is that app-native is the
*non-member* path, and D9 is what keeps members off it: D9 works on the password path because the
backend does the authenticating and can refuse before a session exists, whereas `signInWithOAuth` +
`detectSessionInUrl` mint the session **client-side**, before `/auth/oauth-complete` is consulted.
That endpoint's 403 therefore revokes nothing. One branch, one half enforced.

D7 put Google on step 2 to keep members away from it, but step 2 is reachable by typing any
non-member address, and the Google flow ignores the email field — so a member reaches it in one
extra keystroke.

**What is actually bypassed, stated precisely — two earlier drafts of this section overstated it.**

| | Bypassed? |
|---|---|
| Passport's MFA | **Yes** — the member never passes through Passport's login |
| Passport's session policy | **Yes** — same reason |
| **Revocation** | **No.** `membership.removed` syncs, and D6's request-path gate denies on the next request regardless of which issuer minted the session |

Revocation surviving is what makes this acceptable: a removed member does not keep access, whatever
door they came through. What a member gains by using Google is skipping Passport's MFA — which is a
policy weakening, not an access-control hole.

**Revisit this if Passport's MFA becomes mandatory rather than optional**, because the trade changes
entirely at that point. The two fixes considered and declined: hide Google while SSO is on (small,
but does not cover a legacy member with a local password), or reject an own-issuer token for an
active member on the verify path (complete, but touches every request).

#### Second consequence, found after the decision: role write-back fails for these users

Not visible when the trade was accepted, and it will arrive as a bug report rather than as a
security question — so it is recorded here to make it findable.

Write-back forwards the **end user's own JWT** (`X-End-User-Token`), and Passport verifies it against
the `issuer_url` registered for Prepper — Passport's own project. A member who signed in through
Passport holds a Passport-issued token, so this works. A member who signed in **with Google** holds a
token issued by **Prepper's** project.

That member passes Prepper's local authority check — they genuinely are an Owner, or a Manager at
that brand — and is then refused by Passport with a **401**, because the forwarded token is signed by
a project it does not expect. `writeback._reraise` surfaces Passport's status verbatim, so the user
sees an authentication error while plainly logged in and plainly an admin.

**The symptom is "role assignment is broken for one person", and the cause is which button they used
to sign in.** It fails closed, so it is not a security problem — but nothing on screen connects the
two, which is precisely why it is written down here rather than left to be rediscovered.

Note this is unchanged by the login migration itself: under the retired login-proxy every session was
Passport-issued, so write-back worked for everyone who could log in at all. The Google path is the
only way to hold an own-issuer token *and* be a member — the same gap, seen from a different side.

**Residual risk, stated rather than papered over.** Prepper's own Supabase anon key ships in the browser
bundle (`lib/supabase/client.ts`), so a legacy member holding a local password can call Prepper's GoTrue
`signInWithPassword` / `resetPasswordForEmail` **directly**, bypassing the D9 endpoints entirely; the
request path then accepts the resulting own-issuer token (`deps.py:319`), because D6's gate tests
derived *access*, not which issuer minted the session. Property 8 closes the app's own doors, not
GoTrue's. Options, to be decided during implementation: reject an own-issuer token for an active member
on the verify path, or disable password grant/recovery for member emails on Prepper's project. Until one
ships, this is a known gap.

## 7. Rollout and the kill switch

**`sso_active` is defined once, as:**

```python
def sso_active(settings) -> bool:            # app/passport/access.py
    return bool(settings.sso_enabled and settings.passport_supabase_url)
```

Flag AND Passport's project URL. **The backend anon key is deliberately NOT part of it.** Under Model 3
the backend never signs into Passport's GoTrue — the exchange authenticates with `X-API-Key` — so
`passport_supabase_anon_key` stops being a backend concern and moves to the frontend as
`NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY`. If `sso_active` inherited the old
`SupabaseAuthService.sso_login_enabled` definition (`supabase_auth_service.py:115-121`, which requires
the anon key), an operator who correctly drops the now-unused backend key would silently route every
member `app-native` — the kill switch tripping itself.

`sso_login_enabled` is therefore **deleted**, not redefined: §4.4 removes both its call sites
(`auth.py:61`, `auth.py:351`). `verify_passport_identity`'s inline gate (`supabase_auth_service.py:343`)
already uses the same flag-AND-URL test and is replaced by a call to `sso_active`, so there is one
definition rather than three.

This value gates **the router and all three D9 refusals** — `/auth/login`, `/auth/oauth-complete`,
`/auth/password-reset` — with no exceptions. With it false, everyone routes `app-native`, no endpoint
refuses a member, and the app behaves exactly as it does today.

**D11 — the flag must reach the router and D9's checks.** `sso_active` (flag AND config present) is
passed to `resolve_login_route` and to every D9 membership refusal. With it off, everyone routes
`app-native` **and** `/auth/login` stops 403-ing members, so the branch actually admits the people who
need it. Without both halves, "safe only because that branch still exists" is false: the router would
still send members to Passport, and `/auth/login` would still refuse them.

**Porting the session substrate invalidates every currently signed-in session** — all users are logged
out once on deploy.

### New configuration

| Variable | Side | Notes |
|---|---|---|
| `PASSPORT_DASHBOARD_URL` | backend | Browser redirect target (`/authorize`). **A different host from `PASSPORT_API_URL`** |
| `SSO_CALLBACK_URL` | backend | Must equal the registered URI byte for byte |
| `FRONTEND_URL` | backend | Redirect target for the fragment handoff and all failure redirects |
| `NEXT_PUBLIC_PASSPORT_SUPABASE_URL` | frontend | Passport's project, for the second browser client |
| `NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY` | frontend | Anon/public key, **never** service-role |

Existing and reused: `PASSPORT_API_URL`, `PASSPORT_API_KEY` (plays the OAuth client-secret role),
`PASSPORT_SUPABASE_URL`, `SSO_ENABLED`. Both `.env.example` files updated in the same change.

### Operator prerequisites (silent failure if missed)

- Register `SSO_CALLBACK_URL` on Passport's **per-app** allow-list (Apps → Prepper → Sign-in callbacks),
  matched byte for byte. Not the Supabase project-level Redirect-URL list.
- Register Prepper's `issuer_url` = Passport's own project URL. The registry endpoint withholds this
  field, so it cannot be verified from Prepper's side and must be confirmed in the dashboard.
- `SUPABASE_ANON_KEY` set on the Passport deployment, or the exchange fails at the last step.
- Verify an `identity_link` row exists after a real login — eager linking is not guaranteed
  (`sso-login.md` records a production case where it did not hold for an active Owner).

## 8. Testing

**Backend.** Routing returns exactly two values for member / non-member / unknown address, and
`app-native` for everyone when `sso_active` is false (D11); both branches issue the same lookup.
`/passport/start` writes a row and redirects with `code_challenge_method=S256`; unconfigured,
rate-limited, and infra-error all redirect rather than raise. Callback: unknown, expired, and
**concurrently replayed** `state` each refused (the last one exercises the atomic DELETE); a non-member
and a member-without-access each **redirect with `passport_no_access`**, not 403; `identity_link` written
with the membership-derived `platform_user_id`, and a pre-existing row with a different one replaced.
Request-path gate denies a member without derived access. `/auth/login`, `/auth/oauth-complete` and
`/auth/password-reset` each refuse an active member, and `/auth/password-reset` returns an identical body
in all three cases. Regression test that `login_via_passport` no longer exists.

**Empty entitlement projection** (fresh environment, sync not yet landed): assert the degradation
explicitly rather than inferring it — `resolve_app_id` returns `None`, the router still routes members
`passport`, and every attempt bounces on `passport_unavailable`. That is correct behaviour, but it
should be pinned by a test.

**Knock-on suites to update:** `test_auth.py` (register + refresh-token cases), `test_sso_dual_verify.py`,
`test_default_deny_auth.py` and `test_route_auth_census.py` (four new routes, one removed).

**RLS.** `scripts/verify_rls.py` and `tests/test_rls_integration.py` after the migration — CLAUDE.md
mandates them after any policy change, and the SQLite suite cannot see RLS at all.

**Frontend.** Unit tests for `resolveLogin`, `parseFragment` (both ship with `geddit-one`) and
`activeClient`'s cookie-based selection — vitest is already configured (`frontend/vitest.config.ts`,
`npm test`). Type checking via `npm run build`.

**Acceptance (manual, against staging).** A Passport 5xx during refresh does **not** clear the session
(§4.4). A real hosted login produces an `identity_link` row. Sign-out from Prepper does not sign the user
out of Passport (§4.5).

## 9. Risks

| Risk | Mitigation |
|---|---|
| Everyone logged out on deploy | Expected and stated; deploy off-peak |
| **Existing members have a Prepper password but may have no Passport password set** — after the forced logout they land on Passport's hosted page and must complete its set-password step. The most visible user-facing consequence of this change | Passport mints a login for every active member eagerly and sends the mail; confirm before deploy, and brief support |
| Callback misconfiguration 403s with no detail | Per-branch log lines; three distinct `?error=` codes |
| Direct GoTrue bypass for legacy local passwords | Known gap, §6; close on the verify path or at the project |
| Request-path gate locks out real users | Fails open until entitlements sync, matching the existing derivation |
| Rate-limit buckets are per-instance | Accepted and documented (§4.3); bounds throughput, not capability |
| Legacy case-variant `users.email` rows | `resolve_or_provision` already fails closed on ambiguity |
