# Security Rules

## Secrets & logging
- Never log passwords, tokens, or PII.
- Never commit `.env` files.
- Never print secrets — not even under DEBUG.

## Auth
- Supabase auth with user types `normal` / `admin`.
- JWT verification delegates to the shared `missiongroupsystems-auth` library in `supabase_auth_service.py` — don't reimplement.
- `AuthGuard` component protects client routes — don't scatter checks across components.

## Access control
- Hierarchical outlet-based access for recipes and tasting sessions.
- Non-admin users restricted to outlets within their hierarchy.
- Tasting sessions: non-admin users only access sessions they participate in (403 otherwise); admin bypasses.
- Read-only mode for users without edit permissions — respect it in the UI.

## Supabase Storage
- Recipe images go through `recipe-images` bucket via the backend.
- Never expose the Supabase service key to the client.
- Validate MIME type and size server-side.

## External keys
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TWILIO_*`, SendGrid — server-side only.
- Twilio invitations degrade gracefully to email-only if Twilio isn't configured — don't throw.

## Database migrations — RLS
- New tables MUST include `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY` in the same migration. Don't ship a table without RLS.
- Apply RLS even though the backend connects via service role (which bypasses RLS) — RLS is defense-in-depth: it protects against compromised JWTs, SQL injection, and accidental anon-key paths.
- Use the helpers in `backend/alembic/versions/h1i2j3k4l5m6_add_row_level_security.py` (`is_admin()`, `is_manager_or_admin()`, `current_user_id()`) — don't reimplement.
- Reference data uses `USING (true)` on SELECT only, with a comment explaining why. Writes always gated to admin/manager.
- Outlet-scoped data filters by hierarchy (e.g., recipes/tasting_sessions). Mirror the application-layer rules.

## High-risk areas
User roles (`user_type`), outlet hierarchies, tasting access, and applied migrations require explicit plan confirmation before modifying.

## Universal security baseline

- **Validate at boundaries.** Schema-validate every HTTP / webhook / external payload with pydantic (backend) or zod (frontend). Never trust client-supplied IDs, role claims, or tenant IDs — re-derive them from the session token.
- **Parameterized queries only.** No string concat or f-string SQL — use SQLModel / SQLAlchemy bind params.
- **Secrets only via env or secret stores.** Never hardcode, never commit `.env`, never log tokens / JWT payloads / API keys / request bodies that may carry them.
- **AuthN + AuthZ on every non-public endpoint.** Guard by default — a new route is protected unless it's explicitly opted into public access.
- **Rate-limit public endpoints.** Auth, webhooks, OTP, and any user-enumeration-adjacent routes must have a rate limit.
- **RLS role claims come from `app_metadata`.** Read roles / tenant claims from `app_metadata`, never `user_metadata` (user-editable).
- **No PII or secrets in error messages.** Scrub emails, phone numbers, names, and tokens from responses and exception reports — not just logs.
