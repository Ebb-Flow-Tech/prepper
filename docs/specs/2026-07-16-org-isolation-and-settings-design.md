# Org Isolation, Auth Gating, and Settings Refactor — Design

**Date:** 2026-07-16
**Status:** Approved for planning
**Branch target:** `staging`

## Problem

Prepper serves multiple organisations in production today. Its domain data is not isolated by
org, and 124 of its 182 routes require no authentication at all — including anonymous `DELETE` on
suppliers, recipes and categories. This is an active cross-tenant leak, not a latent one.

### Evidence

Audited every model in `backend/app/models/` (excluding `passport.py`) and every list query in
`backend/app/domain/` and `backend/app/api/`. Three findings, verified by hand:

**1. The API is unauthenticated by default: 124 of 182 routes require no token.**

`grep dependencies=` across `main.py` and all routers returns nothing; the only middleware is CORS
(`main.py:69`). There is no global guard, so every route is gated only if it opted in — and most did
not.

**Derived from the running app, not from grep** — by `backend/scripts/route_auth_census.py`, added
by this work precisely so this number is never typed again:

```
$ python -m scripts.route_auth_census
total routes          182
  gated               52
  public (auth.py)    5
  public (/health)    1
  NEEDING A TOKEN     124
```

*Method matters here, and this spec is the cautionary tale.* An earlier draft grepped three
pre-selected files and reported "14 routes". A corrected file-wide regex scan reported "127 of 177".
Both were wrong: a per-file count cannot see `POST /recipes/sub-recipes/batch` or
`POST /recipes/allergens/batch`, which live in `sub_recipes.py` / `recipe_allergens.py` but are
mounted through **separate `batch_router` `include_router` calls** in `main.py`. And `app.routes` is
no help either — on FastAPI 0.139 it yields 37 `_IncludedRouter` wrappers, not routes. Only building
the app and walking `original_router` gives the true figure. **Re-run the script rather than trusting
the table below.** See Risks.

Ungated routes by module (script output; excludes `auth.py`'s 5 and `/health`):

| Module | Ungated | Module | Ungated |
|---|---|---|---|
| `ingredients` | 9 | `recipe_recipe_categories` | 9 |
| `sub_recipes` | 8 | `suppliers` | 8 |
| `recipes` | 7 | `menu_sketches` | 6 |
| `recipe_images` | 6 | `supplier_ingredient_tags` | 6 |
| `allergens` | 5 | `categories` | 5 |
| `ingredient_allergens` | 5 | `ingredient_tasting_notes` | 5 |
| `menu_sketch_section_item_comments` | 5 | `recipe_categories` | 5 |
| `tasting_note_images` | 5 | `menu_sketch_sections` | 4 |
| `recipe_ingredients` | 4 | `instructions` | 3 |
| `tasting_history` | 3 | `users` | 3 |
| `costing` | 2 | `menu_sketch_section_items` | 2 |
| `recipe_allergens` | 2 | `recipe_tastings` | 2 |
| `tasting_notes` | 2 | `category_agent` | 1 |
| `feedback_summary_agent` | 1 | `ingredient_tastings` | 1 |

Severity, by kind:

- **Anonymous destruction.** `DELETE /suppliers/{supplier_id}` (`suppliers.py:147`, verified — takes
  only `session: Session = Depends(get_session)`), `DELETE /recipes/{recipe_id}`,
  `DELETE /allergens/{id}`, `DELETE /categories/{id}`, `DELETE /menu-sketches/{id}`,
  `DELETE /recipe-images/{id}`, all of `sub_recipes.py`. No token required.
- **Anonymous PII read.** `GET /users` (`users.py:16-27`) returns every user's email, username and
  phone; `GET /users/{user_id}` leaks the same one id at a time.
- **Anonymous spend.** `POST /categorize-ingredient` (`category_agent.py`) and
  `POST /summarize-feedback/{recipe_id}` (`feedback_summary_agent.py`) invoke Anthropic on an
  unauthenticated caller's request. `security.md` requires rate limits on public endpoints; these
  are effectively public and have none.
- **Anonymous write to commercial data.** `POST`/`PATCH` on suppliers and ingredients — prices and
  supplier relationships.

This is not a set of oversights to enumerate. It is an **inverted default**: `security.md` states
"a new route is protected unless it's explicitly opted into public access", and the codebase does
the exact opposite. Unit 4a therefore fixes the default rather than the 124 instances.

**2. Org isolation does not exist in the domain layer.** `organization_id` appears on exactly three
link tables — `recipe_outlets` (`recipe_outlet.py:21`), `menu_outlets` (`menu.py:146`),
`outlet_supplier_ingredient` (`outlet_supplier_ingredient.py:27`) — and never appears in a `WHERE`
clause anywhere. No core entity table has an org column. The docstring at `recipe_outlet.py:8`
says the column exists "so every query can be org-scoped"; no query does.

**3. `is_org_admin` is cross-org.** `access.org_role` (`access.py:247`) selects memberships filtered
on `platform_user_id` and `status == 'active'` with no `organization_id` predicate (:261-273), and
`is_org_admin` (:276-278) delegates to it. So an Owner of org B takes the unfiltered branch in org
A's tasting sessions (`api/tastings.py:112`), ingredient service (`ingredient_service.py:383`) and
supplier service (`supplier_service.py:143`).

Brand scoping is sound by contrast: `access.accessible_unit_ids()` (`access.py:315-336`) fails
closed and is correctly org-implicit. The problem is that most of the domain never calls it, and
the tables it would filter have no column to filter on. Recipes do call it, but the conditions are
OR'd (`recipe_service.py:70-84`): `owner_id == me OR is_public OR in_accessible_units`. `is_public`
is a plain client-settable boolean, so a public recipe is visible to every authenticated user in
every org.

### Decisions taken during design

| Question | Decision |
|---|---|
| Scope of this work | Close auth holes **and** full org isolation + switcher + settings refactor |
| Multi-org status | Multiple orgs live in production now |
| Do users span orgs? | Yes — so active-org context is required, and backfill is ambiguous for their rows |
| Allergens | Global reference vocabulary — no org column |
| Categories, ingredients, suppliers, recipes | Per-org — org column required |
| `is_public` semantics | Redefined as "public **within my org**" |
| Org context transport | `X-Organization-Id` header, validated server-side against the projection |
| Undecidable backfill rows | Report counts first; decide the rule after seeing real numbers |
| Unlinked users | Resolve platform user by link, falling back to email; 403 if neither resolves |
| Auth approach | **Global default-deny + a seven-entry public allowlist** — fix the default, not the 124 instances |
| Delivery | **PR 1 = authentication only**, no schema; org isolation follows in PR 2–3 |

## Non-goals

- Passport-side changes. Prepper projects Passport's data; org/unit structure stays Passport-owned.
- Any local role vocabulary. Roles remain derived per-brand via `access.role_at_unit`.
- Reworking brand scoping. `accessible_unit_ids` is correct and stays as-is.
- A service-token / API-key inbound auth path. None exists; none is added here. Noted as a
  follow-up in Open Risks.
- Unrelated refactoring of the other settings tabs (`UserManagementTab`, Design).

## Unit 1 — Org context dependency

**Purpose:** establish, per request, which org the caller is acting in, and prove they may.

**Interface:** a new FastAPI dependency in `backend/app/api/deps.py`:

```python
class OrgContext(NamedTuple):
    user: User
    organization_id: str

def get_org_context(
    authorization: str | None = Header(None),
    x_organization_id: str | None = Header(None),
    session: Session = Depends(get_session),
) -> OrgContext:
```

**Behaviour:**

1. Resolve the `User` exactly as `get_current_user` does today (`deps.py:88-146`), preserving
   dual-issuer verification and the 401/404 semantics.
2. Resolve the platform user, **with an email fallback**:
   - `access.platform_user_id_for(session, subject)` (`access.py:107-115`) — the identity link.
   - If that returns `None`, fall back to `platform_user_id_for_email(session, user.email)` — the
     same resolution the SSO login path already performs at `api/auth.py:90`.
   - If both return `None` → **403** (`No Passport identity for this user`).

   **Why the fallback is required.** `report_identity_link_safe` (`auth.py:101`) is best-effort and
   asynchronous: the comment at `auth.py:98-100` states the link "is not present on THIS request" —
   it round-trips through Passport and syncs back. Without the fallback, every freshly-logged-in SSO
   user would 403 on every org-scoped route until sync lands. The email path closes that window
   using a mechanism the login path already trusts, rather than failing open.

   **This deliberately reverses the fail-open at `access.py:243`** (`return True  # not linked yet
   — Passport is not authoritative for this user`). That fail-open exists so switching the
   projection on does not lock everyone out, and it is correct for a boolean "may use Prepper at
   all" question. It cannot survive contact with org scoping: there is no org to fail open *into*.
   A request must name exactly one org or scope nothing. The email fallback preserves the fail-open's
   *intent* — don't lock out users Passport does know — without needing an org that doesn't exist.
3. Resolve the active org set via `access.orgs_for_platform_user` (`access.py:50-63`), then select
   the org:
   - Header present and in the active set → use it.
   - Header present, not in the set → **403** (`Not a member of this organization`).
   - Header absent, caller has exactly one active org → use it. Single-org callers never send it.
   - Header absent, caller has zero active orgs → **403**.
   - Header absent, caller has more than one → **400** (`X-Organization-Id required`).
4. Apply the kill switch **for the selected org only**, replacing the all-orgs check at `deps.py:131`.

**Why the header is safe:** the header proposes; the projection disposes. Membership is re-derived
server-side per request, so a forged header yields 403. This satisfies `security.md`'s
"never trust client-supplied tenant IDs — re-derive them from the session token".

**Native login loses org-scoped routes.** SSO-off native login (`auth.py:109` onward, documented as
"the reversible fallback") authenticates users who have no Passport identity at all — neither link
nor email match. Under this design they resolve to no platform user and 403 on every org-scoped
route. This is accepted: org scoping is derived from Passport, so a user Passport has never heard of
cannot be scoped, and the alternative is inventing a local org concept the architecture explicitly
refuses. The consequence is that **the SSO-off fallback ceases to be a working fallback** for
anything but `/auth/*`. See Risks — this is the sharpest edge in the design and should be confirmed
against how (or whether) native login is actually used before step 1 ships.

**Kill-switch change:** `is_org_blocked` today 403s only if *every* org the user belongs to is
suspended (fails open by design). Under org context it becomes per-org: acting in a suspended org
is blocked even if another of the caller's orgs is healthy. This is a deliberate behaviour change
and the correct reading of an entitlement kill switch.

**`get_current_user` is retained** unchanged for genuinely org-agnostic routes (`/auth/me`). It is
not deleted; `get_org_context` calls the same resolution path.

**Related fix — `is_org_admin`.** `access.org_role` (`access.py:247`) gains an `organization_id`
parameter; `is_org_admin` (:276-278), which delegates to it, gains the same. All three call sites
(`api/tastings.py:112`, `ingredient_service.py:383`, `supplier_service.py:143`) pass the active org
from `OrgContext`.

**Delegate, don't duplicate.** `access._org_role` (`access.py:117-129`) is already exactly the
org-scoped membership lookup this needs — `_org_role(session, platform_user_id, org_id)`. The
org-aware `org_role` delegates to it rather than reimplementing the predicate at :261-273. The
existing `_org_role` is private and already correct; the public `org_role`'s bug is that it never
calls it with an org.

**Performance note:** `get_current_user` already performs dual-issuer verification plus a user
lookup, and is not cheap. `get_org_context` adds an identity-link lookup and a membership query.
`GET /ingredients` is called on every keystroke of the ingredient search
(`app/menu-sketch/[id]/page.tsx:342`). Both added queries are indexed point lookups on
`passport.identity_link` and `passport.membership`; if profiling shows this on the hot path, cache
the org set per request via `functools.lru_cache` on the request scope — **not** a cross-request
cache, since membership changes must take effect immediately.

## Unit 2 — Data model

**Purpose:** give every per-org entity a column to scope by.

| Table | Change | Rationale |
|---|---|---|
| `recipes` | `organization_id` (nullable → NOT NULL in migration 3), indexed | per-org |
| `ingredients` | same | carries prices — commercially sensitive |
| `suppliers` | same | carries commercial relationships |
| `categories` | same | each org curates its own |
| `tasting_sessions` | same | per-org |
| `menus` | same | per-org |
| `menus_sketch` | same | per-org |
| `allergens` | none | global real-world vocabulary |
| `users` | **none — scoped by join, not by column** | see below |
| `recipe_ingredients`, `recipe_recipes`, `recipe_categories`, `recipe_images`, menu sections/items, tasting notes/participants, `supplier_ingredients` | none | scope inherits from the parent — via a parent check **this spec must create**; see below |
| `recipe_outlets`, `menu_outlets`, `outlet_supplier_ingredient` | none — column exists | start filtering on it |

Index on `organization_id` for each new column; composite `(organization_id, is_active)` where an
`is_active`/status filter already accompanies every list query (`categories`, `suppliers`,
`ingredients`), per `performance.md`'s index-aware rule.

**Child-table rationale — and the check that does not yet exist.** The decision to omit org columns
from child tables stands: a child row is reachable only through its parent, and duplicating the
parent's org onto the child creates state that can disagree with it — a worse failure mode than a
join.

**But the justification "the existing parent check already gates access" is false, and it matters.**
`recipe_ingredients.py`, `recipe_images.py`, `sub_recipes.py`, `instructions.py`, `costing.py`,
`menu_sketch_sections.py` and `menu_sketch_section_item_comments.py` have **no authentication at
all**, let alone a parent check — they are among the 124 (see Problem §1). So org-scoping `recipes`
while leaving `GET /recipes/{id}/ingredients` and `GET /recipes/{id}/costing` as they are means the
isolation work is **defeated at its own child tables**: org B reads org A's ingredient list, costs
and sub-recipe tree through the child route.

Therefore, as part of PR 3, each child router gains an explicit parent check:

```
resolve parent (e.g. recipe_id) → 404 if parent.organization_id != active_org
```

404 rather than 403, so the route does not confirm the parent exists to a non-member. This is the
check the child-table decision *assumes*; it has to be built, not cited.

**Routers affected — derive this list from the census, do not trust this table.** An earlier draft of
this list omitted every tasting router, which is the worst possible omission: CLAUDE.md's domain
invariants make tasting access participants-only, so an unscoped `GET /tasting-sessions/{id}/notes`
leaks precisely what the invariant forbids.

**Derive this from route shapes, not module names.** Every omission below was caused by grouping by
module: a module can mount several routers at several prefixes, and two routes in one module can
need entirely different checks.

| Parent | Child routers needing the check |
|---|---|
| recipe | `recipe_ingredients`, `recipe_images`, `sub_recipes`, `instructions`, `costing`, `recipe_categories`, `recipe_recipe_categories`, `recipe_allergens`, **`recipe_units`**, **`feedback_summary_agent`** |
| **menu** | **`menus.menu_items_router`** (`GET /menu-items/{section_id}`), **`menus.menu_outlets_router`**, menu sections |
| menu sketch | `menu_sketch_sections`, `menu_sketch_section_items`, `menu_sketch_section_item_comments` |
| **tasting session** | **`tasting_notes`, `ingredient_tasting_notes`, `recipe_tastings`, `ingredient_tastings`, `tasting_history`, `tasting_note_images`** |
| ingredient | `ingredient_allergens` |
| supplier | `supplier_ingredient_tags`, `supplier_ingredients` (**different check — see below**) |

Four entries deserve calling out, each missed by an earlier draft of this very table:

- **`GET /menu-items/{section_id}` (`menus.py:593`) is the worst of them — a live, gated,
  unscoped leak.** `menus.py` defines **three** routers (`router`, `menu_outlets_router`,
  `menu_items_router`, :78-80) mounted at three prefixes (`main.py:223/228/233`) — the same
  several-routers-per-module pattern that hid the `batch_router` routes from the census. It takes
  `get_current_user` and then performs **no access check whatsoever**: it selects `MenuItem` by
  `section_id` with nothing else. Its sibling `get_menus_by_unit` (`menus.py:560`) does it correctly,
  checking `accessible_unit_ids` and 404ing. So any authenticated user in any org can enumerate
  `section_id` integers and read another org's menu items — recipe names and prices.
  It is **inside the 52 the census reports as "gated"**, which is exactly why every earlier draft
  missed it. See the "gated but unscoped" note below.
- **`recipe_units`** — its 5 routes are **already gated** (verified), so it is not among the 124 and
  never appears in Problem §1. It still needs the org parent check: authenticated is not scoped.
  Unit 2's model row covers `recipe_outlets` ("column exists — start filtering on it"); this is the
  router half of that.
- **`feedback_summary_agent`** — `POST /summarize-feedback/{recipe_id}` is a recipe-child route,
  currently **ungated**. PR 1 authenticates it; without a parent check in PR 3, an authenticated
  org-B user can summarise **org A's** recipe feedback — a cross-org leak *and* Anthropic spend on
  someone else's data. It appears in Problem §1 only under "anonymous spend", which is what hid it.
- **`supplier_ingredients` needs a different check, and the formula above does not apply to it.**
  Its only route is `GET /supplier-ingredients` — a cross-supplier **list with no parent id** in the
  path or body, so there is nothing to resolve and 404. It is not a leak today (already unit-scoped
  via `accessible_unit_ids`, failing closed). It needs the same treatment as any other list: an
  `organization_id = :active_org` predicate via its supplier join, not a parent check. Listed here
  so the table does not give false assurance.

**"Gated but unscoped" is a category this spec's tooling does not report.** The census answers "does
this route authenticate?", and its 52 "gated" routes are **not** thereby safe — `/menu-items/{id}`
proves it. PR 3 must audit all 52 for scoping, not just close the 124. Extending
`route_auth_census.py` to flag gated-routes-without-an-access-call would make this mechanical rather
than a matter of remembering; recorded in Open Questions.

The tasting children get the org check **in addition to** the existing participants-only rule, not
instead of it. Unit 2's own child-table row already named "tasting notes/participants" and
"`supplier_ingredients`"; an earlier draft of this router list silently dropped them, which is the
same class of incompleteness as the route census, one layer down.

The `two_org_fixture` in Testing asserts cross-org access through **child** routes specifically, not
only through parents — that is the assertion that would have caught this.

**`users` gets no org column, deliberately.** A user's org membership is Passport-owned and already
projected into `passport.membership`. Copying it onto `users.organization_id` would (a) duplicate
Passport-owned state, which this codebase explicitly refuses to do — CLAUDE.md: "Roles are read
per-brand at the point of the check — never projected onto the `users` row" — and (b) be wrong for
multi-org users, who have no single org. `GET /users` is instead scoped **by join**:

```
users             .id               = identity_link.subject          -- NOT platform_user_id
identity_link     .platform_user_id = membership.platform_user_id
membership        .organization_id  = :active_org AND membership.status = 'active'
```

**The join column is `identity_link.subject`.** `subject` holds the local `users.id` (the app's
Supabase `sub`); `platform_user_id` holds Passport's id. Joining `users.id` to `platform_user_id`
matches nothing and returns an empty list. Confirmed by `access.platform_user_id_for`
(`access.py:110-114`, `WHERE PassportIdentityLink.subject == subject`) and by the RLS bridge
(`p3rtrls5m6n7:28`, `l.subject = auth.uid()::text`).

**There is no existing template for this join.** `directory.assignable_members`
(`directory.py:135-140`) selects from `PassportMembership` **alone** — it never touches `users` and
never joins `identity_link`; it uses the acting user's link only to derive `org_ids` (:127-133). Its
`in_(org_ids)` → `==` narrowing is a separate change (see Unit 4b). The users-join above is new
code, not a copy of an existing shape.

**Users with no identity link do not appear in any org's list** — they have no membership row to
join to. That is correct (they are not a member of the org being listed) but interacts with the
unlinked-user question in Unit 1; see that section.

## Unit 3 — Migration and backfill

**Purpose:** populate the new columns without guessing at production data.

Three separate migrations. Nothing destructive runs before the orphan counts are reviewed.

**Migration 1 — additive.** Add nullable `organization_id` columns and indexes. No behaviour
change. Safe to deploy alone; reversible by dropping the columns.

**Migration 2 — derive and report.** Backfill only what is authoritatively derivable:

- **Recipes:** from `recipe_outlets.organization_id` via any active link. Where a recipe has links
  in more than one org — possible today, since nothing prevents it — leave NULL and count it as
  undecidable.
- **Menus:** from `menu_outlets.organization_id`, same rule.
- **Suppliers:** from `outlet_supplier_ingredient.organization_id` where a link exists.
- **Everything else** (ingredients, categories, tasting sessions, menu sketches, and recipes with
  no unit link): from `owner_id`/`creator_id` → `passport.identity_link` → `passport.membership`,
  **only where that platform user has exactly one active org**.
- All else: leave NULL.

Then emit counts per resource: derivable-from-link, derivable-from-single-org-owner, and
undecidable. This migration writes no NULLs over existing values and is idempotent.

**Checkpoint — RESOLVED 2026-07-16.** The report ran against staging and the rule is chosen:
**every undecidable row goes to the founding org (Mission Groups, `7f141311-…`).**

Two things the report established that this spec had wrong:

1. **The owner derivation must resolve link-OR-email, not link alone.** `identity_link` is written
   on SSO login, so users who have not logged in since SSO went live have none — staging has **2
   links for 5 users**, and the only recipe owner was not among them. Link-only derived **0** of 11
   recipes and **0** of 13 tasting sessions; adding the email path (the same chain
   `get_org_context` uses) derived all of them.
2. **`ingredients` / `categories` / `menus_sketch` can derive nothing at all** — no owner column,
   no unit link. On staging that is 6984 rows, ~96% of the total. The spec's premise that backfill
   would be "ambiguous for some rows" was wrong: for these three it is *impossible*, and no
   ownership rule can help because there is no ownership. They were a globally shared pool.

   **Decision: they remain per-org.** Ingredient pricing and supplier terms are commercially
   sensitive; a second org must not inherit Mission Groups' catalogue. So they take the founding-org
   rule with everything else.

**Migration 2 must refuse rather than guess.** The founding-org rule is only sound while there is
exactly one org with data. The migration therefore asserts that `passport.organization` holds
exactly one org (or that only one org appears across the link tables) and **aborts** otherwise,
directing the operator to re-run the report. Applying "everything belongs to the one org" to a
database that has since acquired a second is the precise failure this whole checkpoint exists to
prevent.

Staging coverage at the time of the decision (`python -m scripts.org_backfill_report`):

| table | total | by link | by owner | undecidable |
|---|---:|---:|---:|---:|
| recipes | 19 | 1 | 10 | 8 |
| menus | 3 | 1 | 2 | 0 |
| tasting_sessions | 14 | 0 | 13 | 1 |
| suppliers | 295 | 291 | 0 | 4 |
| ingredients | 6890 | 0 | 0 | 6890 |
| categories | 77 | 0 | 0 | 77 |
| menus_sketch | 17 | 0 | 0 | 17 |

These are **staging's** numbers, where exactly one org exists. Re-run against production before
migration 2 executes there.

The *decision* is deferred; its *interface* is not. Each candidate rule implies a different
predicate in Units 4 and 5, pre-specified here so the choice cannot silently change their contract:

**The chosen rule is "quarantine"'s simpler cousin — founding-org — so the column becomes `NOT NULL`
and neither Unit 4b nor Unit 5 needs the NULL special case.** The table below is retained because
the rule only holds while one org has data; if migration 2's assertion ever fires, the decision
reopens and these are the options.

| Rule | Column | Unit 4b read predicate | Unit 5 RLS predicate |
|---|---|---|---|
| **Oldest membership wins** | `NOT NULL` | `organization_id = :active_org` | `organization_id IN (SELECT current_org_ids())` |
| **Quarantine to holding org** | `NOT NULL` | `organization_id = :active_org` (holding org is a real org; only its admins are members) | same as above |
| **NULL = owner-only** | stays nullable | `(organization_id = :active_org OR (organization_id IS NULL AND owner_id = :me))` | `(organization_id IN (SELECT current_org_ids()) OR (organization_id IS NULL AND owner_id = auth.uid()))` |

The NULL branch is the one that changes the interface. A bare `organization_id = :active_org` drops
NULL rows entirely — under that rule an owner-only row would become invisible **to its own owner**,
which is the opposite of the rule's intent. If that rule is chosen, every query site and every RLS
policy uses the two-clause form above, and the column never becomes `NOT NULL`.

The first two rules are strictly simpler and should be preferred if the orphan count is small enough
to make them safe. The NULL rule buys safety at the cost of a permanent special case in every query.

**Migration 3 — enforce.** Apply the chosen rule, then set `NOT NULL` **only if the undecidable
count reaches zero**. If the chosen rule is "NULL = owner-only", the column stays nullable and that
special case is documented at each query site.

**`NOT NULL` must ship WITH the write path, never before it (learned the hard way, 2026-07-16).**
An early cut of migration 2 set `NOT NULL` immediately after backfilling and **broke every write on
staging within seconds**: the column became mandatory in the database while no application code
populated it on insert, so every `INSERT` failed with `NotNullViolation` (verified against real
staging — `INSERT INTO categories` raised). Backfilling EXISTING rows and constraining FUTURE ones
are different changes with different prerequisites:

| Change | Prerequisite |
|---|---|
| Backfill existing rows | the rule is chosen (migration 2) |
| `NOT NULL` | **every create path stamps `organization_id` from the org context** (migration 3) |

So migration 2 asserts zero NULLs and stops. `NOT NULL` lands in migration 3, in the same change as
the create-path stamping, and not one migration earlier.

**Ordering constraint:** migration 2 reads `passport.identity_link` and `passport.membership`. Both
are projections. If the projection is stale or incomplete for a given user, that user's rows fall to
undecidable rather than being assigned wrongly — the safe direction. Migration 2 should therefore
run after a `python -m app.passport.reconcile` pass, so the projection is as complete as possible.

## Unit 4 — Query enforcement

**Purpose:** make every read and write respect the active org.

### 4a. Default-deny (PR 1)

**Fix the default, not the 124 instances.** A global dependency on the FastAPI app requires
authentication for every route, with a short explicit allowlist for the genuinely public ones.

```python
def public_routes(settings: Settings) -> frozenset[tuple[str, str]]:
    p = settings.api_v1_prefix                     # NOT hardcoded — see below
    return frozenset({
        ("POST", f"{p}/auth/login"),
        ("POST", f"{p}/auth/register"),
        ("POST", f"{p}/auth/oauth-complete"),
        ("POST", f"{p}/auth/refresh-token"),
        ("POST", f"{p}/auth/logout"),
        ("POST", f"{p}/passport/sync"),   # HMAC-verified in sync_router.py:36-53, not JWT
        ("GET",  "/health"),              # liveness probe — mounted outside the prefix
    })
```

**Derive the prefix from settings; do not hardcode `/api/v1`.** `api_v1_prefix` is a live `Settings`
field (`config.py:32`), documented in `.env.example:9`, and every `include_router` builds its prefix
from it (`main.py:80` onward). Verified: with `API_V1_PREFIX=/api/v2`, login moves to
`/api/v2/auth/login`, a hardcoded allowlist stops matching, and **login returns 401** — unreachable.
CI would never catch it (CI uses the default); it bricks production only. This is the third
incarnation of the same bug rounds 4 and 5 each caught: a path typed rather than derived. `/health`
stays literal because it is registered outside the prefix (`main.py`).

**One asymmetry to know about.** `main.py:45` takes a **module-level snapshot** —
`settings = get_settings()` — and every `include_router` prefix is built from that snapshot, not
from a fresh `get_settings()` call. `require_auth`, by contrast, must call `get_settings()` per
request. In production both read the same env at import, so they agree. But a **test** that
monkeypatches `API_V1_PREFIX` and clears the cache would mount routes at the *old* prefix while the
allowlist computes the *new* one — the allowlist would never match and login would 401 inside the
very test meant to prove the prefix fix. If that test is wanted, it must rebuild the app the way
fixture 2 does (see Testing). Fixture 2 works only because `mount_passport_sync` calls
`get_settings()` freshly (`sync_router.py:51`) rather than using the snapshot.

Registered once as `FastAPI(dependencies=[Depends(require_auth)])`. Per-router
`include_router(..., dependencies=[...])` is rejected: it needs repeating on all **37**
`include_router` calls in `main.py` and a new router can still be added ungated.

**Match on `request.url.path`, NOT `request.scope["route"].path`.** This is not a style preference —
it is the difference between a working app and a bricked one. Verified empirically against the
project's actual environment (venv: Python 3.12, **FastAPI 0.139.0**):

| Expression | Value for `POST /api/v1/auth/login` |
|---|---|
| `request.scope["route"].path` | **`/login`** — router-relative |
| `request.url.path` | `/api/v1/auth/login` — full |

On FastAPI 0.139, `include_router` no longer rewrites child routes with the mounted prefix; it
appends an `_IncludedRouter` wrapper and each route **keeps its relative path**. So an allowlist
of full paths matched against `scope["route"].path` **never matches**, `POST /api/v1/auth/login`
returns 401, and no one can ever obtain a token. Matching relative paths instead is not a fix either
— `/login`-style relative paths can collide across 37 routers, so an allowlist entry could
accidentally open an unrelated route.

*(This behaviour is version-dependent: on FastAPI 0.109 both expressions return the full path.
`pyproject.toml:10` pins only `fastapi>=0.109.0`, which spans both behaviours — see below.)*

**Verified properties of this mechanism**, all measured on FastAPI 0.139.0 rather than assumed:

- `POST /api/v1/auth/login` → **200** (allowlist matches on `url.path`).
- `GET /health` → **200** (allowlist).
- An unauthenticated call to a gated route → **401**.
- An unauthenticated call with an *invalid* path param (`/items/abc` on `item_id: int`) → **401,
  not 422**. The app-level dependency runs **before** path-param validation, so the fixture in
  Testing can call routes with dummy params.
- `app.dependency_overrides` **does** work on an app-level dependency, so the conftest plan is
  viable.

**Pin FastAPI to an exact version** in `pyproject.toml`. The correctness of this design depends on
`include_router`'s flattening behaviour, which changed within the currently-allowed range. Shipping
default-deny against an unpinned dependency means a routine `pip install -U` can silently brick
login. The pin is part of PR 1.

**`/health` needs the allowlist and the reason is not what it looks like.** It is a real `APIRoute`
on `app.router`, so app-level dependencies **do** apply to it — it would 401 and Fly's health checks
would fail the deploy. `/docs`, `/openapi.json`, `/redoc` and `/docs/oauth2-redirect` are genuinely
unaffected, but **because they are plain Starlette `Route`s, not `APIRoute`s** — not because of their
path prefix. Reasoning by prefix here is what hid `/health`.

**`POST /passport/sync` stays out of the JWT path.** It is authenticated by HMAC
(`sync_router.py:36-53`, `passport_webhook_secret`) because Passport calls it machine-to-machine. It
is allowlisted for JWT purposes and remains HMAC-gated — allowlisted is not ungated. Note it is
**conditionally mounted**: `mount_passport_sync` returns early when `passport_webhook_secret` is
unset, so it is absent from the default and test environments (verified — it does not appear in the
OpenAPI schema). An allowlist entry for an unmounted route is inert, but Testing must account for it.

**`require_auth` must NOT depend on `get_current_user`.** `get_current_user` raises 401
unconditionally when the `Authorization` header is missing (`deps.py:98-102`), and FastAPI resolves
sub-dependencies **before** the parent's body runs. So `require_auth`'s allowlist early-return would
never execute. Measured with exactly that wiring:

```
POST /api/v1/auth/login  (no token) -> 401   # want 200
GET  /health             (no token) -> 401   # want 200
```

Login unreachable, `/health` failing Fly's deploy check — the same brick as the `scope["route"].path`
bug, via a different route.

**A "never-raising resolver returning `User | None`" is also wrong** — it was this spec's first
attempt at the fix and it is worse than the bug. `get_current_user` has **five** outcomes today
(`deps.py:88-146`): 401 missing header, 401 unverifiable token, **403 `is_org_blocked`** (the
Passport entitlement kill switch, :131), **404 no user row** (:140), or the `User`. Collapsing every
failure into `None` collapses all of them into 401, which:

- **deletes the kill switch** — measured: a suspended org returns **200** where it returns 403
  today, with `is_org_blocked` never consulted. A live entitlement bypass, shipped in the PR whose
  purpose is closing a security hole. And permanent, not a PR1→PR2 window: routes gated only by
  `get_current_user` (`/auth/me`, `GET /passport/organizations`, `PATCH /users/{id}`) never receive
  `get_org_context` and would never get it back.
- **turns 404 into 401** — breaking `tests/test_auth.py:506`
  (`test_get_current_user_token_valid_but_user_not_found`), which asserts 404 today, and
  contradicting Unit 1's promise to preserve "the 401/404 semantics".

**The correct shape is to check the allowlist BEFORE touching credentials**, and have
`get_current_user` depend on `require_auth` so the resolution is shared:

```python
def require_auth(
    request: Request,
    authorization: str | None = Header(None),
    session: Session = Depends(get_session),
) -> User | None:
    if (request.method, request.url.path) in public_routes(get_settings()):
        return None                      # public: credentials are never inspected
    return _resolve_current_user(session, authorization)   # full existing semantics: 401/401/403/404

def get_current_user(user: User | None = Depends(require_auth)) -> User:
    if user is None:                     # only reachable on a public route
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
```

`_resolve_current_user` is today's `get_current_user` body (`deps.py:88-146`) extracted verbatim —
it keeps raising 401/403/404 exactly as now. Nothing about its behaviour changes; only its caller.

**Ordering is the whole design.** Resolving credentials before the allowlist check is what bricked
the two previous attempts, and it would also break `completeOAuth` (`api.ts:1346`), which sends a
**Supabase** token on the public `/auth/oauth-complete` — a token the JWT path would reject. Public
routes must not have their credentials validated at all.

Verified together, on the real environment, rather than as separate snippets:

| Request | Result | |
|---|---|---|
| `POST /auth/login`, no creds | **200** | public |
| `POST /auth/oauth-complete`, Supabase token | **200** | public — token not validated |
| `GET /health`, no creds | **200** | public |
| any gated route, no token | **401** | default-deny works |
| any gated route, good token | **200** | |
| `/auth/me`, unverifiable token | **401** | preserved |
| `/auth/me`, **suspended org** | **403** | **kill switch preserved** |
| `/auth/me`, **no user row** | **404** | preserved |
| `/auth/me`, good token | **200**, resolver ran **1×** | caching preserved |

The **1×** matters. FastAPI caches sub-dependencies per request by callable identity, so the 52
routes already using `get_current_user` share the single `require_auth` resolution. Had `require_auth`
verified independently, each of those 52 would pay **two full dual-issuer JWT verifications and two
user lookups** — `get_current_user` is not cheap — a real regression from a change meant to be pure
hardening.

Why this shape:

- **One line makes the default safe.** The 124 ungated routes are closed by the default, not by 124
  reviewable-in-theory edits.
- **A route added tomorrow is protected.** This is the posture `security.md` already mandates and
  the codebase inverts.
- **The public surface is auditable in one screen** — seven entries, each justifiable.

**Rate limits.** `category_agent.py` and `feedback_summary_agent.py` invoke Anthropic. Once
authenticated they are no longer anonymous spend, but `security.md` requires rate limits on
abuse-adjacent routes. Not solved in PR 1 (authentication is the bleeding wound); recorded in Open
Questions.

### 4b. Org scoping (PR 3)

> **Status.** Create-stamping is done for all seven tables. Read scoping is done for the four
> catalogues that were **wholly unscoped** — ingredients, suppliers, categories, menu sketches —
> via `domain/org_scope.py`, whose `org_scope(model, org)` is the one home for the predicate
> (including the transitional `IS NULL` arm; see Unit 3). `organization_id` moved from a create
> **method** parameter to a **required constructor** argument on those four services: a service
> that cannot be built without an org cannot silently read every org's rows, and the read surface
> is far too wide (`list`, `list_paginated`, `count`, `get_*`, `_name_exists`) to thread an
> argument through method by method without missing one.
>
> Three things found while doing it, none of which the spec anticipated:
> - `get_*` used `session.get()` — fetch by primary key alone, so `GET /{id}` returned another
>   org's row on a guessed integer. Because `update_*` and `soft_delete_*` resolve through the same
>   method, scoping it closed the cross-org **writes** as well.
> - `_name_exists` was global, so "Desserts" existing in any org blocked every other org from
>   creating it — uniqueness leaking tenant contents through a 409.
> - `fork_sketch` resolved via `session.get()` **and** stamped no org on the copy, so a fork
>   crossed orgs and landed as NULL, i.e. visible to everyone.
>
> **Recipes** are scoped at both ends — the list query and `guards.py`, which its own docstring
> requires to agree. `is_public` had no org predicate under it, so it meant public to the
> *instance*: every tenant's public recipes were readable by everyone, by id as well as in the
> list. The guard now answers two questions rather than one — `_in_org` fails to a **404** (a row
> in another tenant is not yours to know exists), `_may_see_recipe` fails to the historical **403**
> (a row in your org but outside your brands). The admin branch got *simpler*: under `org_scope`,
> `Recipe.organization_id.in_(admin_orgs)` could only ever widen past the active org, so it
> collapses to `organization_id in admin_org_ids`.
>
> **Tasting sessions** were scoped by participation, which held, and by `admin_org_ids`, which did
> not — that set is a union, so an Admin of both orgs saw ORG_B's sessions while acting in ORG_A.
> Now `is_org_admin`, a question about the active org. `list()`, `list_paginated()` and `count()`
> were deleted: no callers, and `list()` selected every session in the deployment unfiltered while
> `count()` took no admin argument. An unscoped query with no caller is a leak that has not
> happened yet.
>
> Still outstanding here: `user_service` (`GET /users`), menus, the `directory.*` narrowing, and
> the pagination noted at the end of this section.

Default-deny establishes *authentication*. Org context establishes *scope*, and only applies to
routes touching org-scoped data. On top of the global gate:

| Route class | Gate | Examples |
|---|---|---|
| Org-scoped data | `Depends(get_org_context)` | recipes, ingredients, suppliers, categories, tasting sessions, menu sketches, **menus**, `GET /users`, `GET /users/{id}` |
| Authenticated but org-agnostic | global gate only (`get_current_user` where the row is needed) | `PATCH /users/{id}`, `GET /auth/me`, `GET /passport/organizations` |
| Public | the `public_routes(settings)` allowlist | `auth.py`'s five, `POST /passport/sync` (HMAC), `GET /health` |

**`PATCH /users/{id}` is authenticated but org-agnostic.** Two things follow:

1. It must **not** take `get_org_context`. A brand-new registrant has no identity link and no
   membership, so no org context can be established — gating it on org context would 403 every new
   user mid-registration, replacing one bug with a worse one. It edits your own user row; that is
   org-agnostic by nature.
2. `frontend/src/app/register/page.tsx:73` calls it **before** `login()` at :77, so no token is in
   storage. Under default-deny this 401s. `register/page.tsx` is fixed to call `login()` before
   `updateUser`. This fix **is** load-bearing — registration-with-phone breaks without it, and it
   has no automated coverage (see Testing). It ships in **PR 1**, with the default-deny gate that
   makes it necessary, not in PR 3.
3. Authorisation is `user_id == current_user.id` — a user may PATCH only themselves. This is a
   **new** check: today the route has none, so any caller can edit any user's row. Ships in PR 1.

**`POST /users` does not exist** — registration goes through `api/auth.py`, which is correctly
gated as a public endpoint. No change there.

**Read scoping.** Every list/get query gains `WHERE organization_id = :active_org`:

- `category_service.py:47-53`, `supplier_service.py`, `ingredient_service.py`,
  `menu_sketch_service.py:27-31`, `user_service.py:128` — currently return whole tables.
- `recipe_service.py:70-84` — the OR'd conditions get an outer org predicate:
  `organization_id = :active_org AND (owner_id = me OR is_public OR id IN unit_recipe_ids)`.
  This is what redefines `is_public` as org-scoped.
- `GET /users` becomes org-scoped, returning only members of the active org.

**The directory functions need narrowing too.** `directory.assignable_members`
(`passport/directory.py:131-140`) filters on `organization_id.in_(org_ids)` — the **union of every
org the caller belongs to**, not a single active org. It is safe relative to today's total absence
of scoping, but it is *not* a model for active-org filtering and is not already correct. Under org
context, `assignable_members`, `brands_for_user` and `roster` each take an `organization_id` and
filter on equality rather than `in_`.

**The union is narrowed in the directory layer, not the tab.** `directory.py` is the single place
every brand-roles read passes through, so narrowing there fixes the API for all callers; narrowing
in `BrandRolesTab` would leave the endpoint still returning the union to anything else that calls
it. The "Org scoping" paragraph in Unit D of the
[settings refactor spec](./2026-07-16-settings-refactor-design.md) therefore describes a
*consequence* of this change, not a separate fix.

`access.brand_roles` (`access.py:182-195`) deliberately unions across orgs, and its docstring
explains why: a brand UUID belongs to exactly one org, so the maps cannot collide. That reasoning
remains valid for brand-scoped authorisation checks and it is **not** changed here. The distinction:
`access.brand_roles` answers "what may this user do at this brand", which is org-agnostic and safe
to union; `directory.*` answers "what should this screen list", which must respect the active org.

**Write scoping.** Creates stamp `organization_id` from the active org, never from the request body.
Updates and deletes verify the existing row's org matches the active org — mismatch is 404, not 403,
so the endpoint does not confirm the row exists to a non-member.

**Pagination.** `performance.md` requires all list endpoints to paginate.
`user_service.py:128` (`select(User).order_by(...)` — unbounded) and
`menu_sketch_service.py:27-31` (unbounded) currently violate this. Both are being touched here, so
both get `limit`/`offset` with a server-enforced max, matching the existing pattern in
`categories.py:37-42`.

## Unit 5 — RLS

**Purpose:** make defence-in-depth actually defend.

Per `security.md`, RLS is required on every table and is defence-in-depth — the backend connects via
a `BYPASSRLS` service role (`h1i2j3k4l5m6_add_row_level_security.py:23-26`), so these policies do
not gate the app path. They protect against compromised JWTs, injection, and accidental anon-key
paths.

**RLS is deliberately coarser than the app layer, and cannot mirror it.** `security.md` asks
policies to mirror application rules; that is not achievable here and the asymmetry is intentional.
RLS evaluates on a direct Postgres connection with no HTTP request, so it cannot see
`X-Organization-Id`. Its ceiling is therefore the caller's **org union** — every org they belong to
— while the app layer narrows further to the single active org. RLS answers "could this user ever
see this row in any org?"; the app answers "should they see it right now, in this org?". RLS being
the weaker of the two is correct for a defence-in-depth layer: it is a backstop against a bypassed
app layer, not a substitute for one. What matters is that RLS is no longer `USING (true)`.

Current policies do not isolate by org and are strictly weaker than the app layer:

- `ingredients_select`, `categories_select`, `allergens_select` are `USING (true)`
  (lines 406, 434, 462).
- `recipes_select` is `owner_id = auth.uid() OR is_public OR is_admin()` (:237) — no unit or org
  predicate.
- `is_admin()` (`p3rtrls5m6n7:49-56`) has no `organization_id` filter — the same cross-org bug as
  the application-layer `is_org_admin`.

Changes:

- Add a `current_org_ids()` SQL helper returning the calling `auth.uid()`'s active org set from the
  projection, alongside the existing helpers.
- Rewrite the per-org tables' `SELECT` policies to `USING (organization_id IN (SELECT
  current_org_ids()))`, combined with existing owner/public predicates.
- `allergens_select` stays `USING (true)` with a comment stating it is a global reference
  vocabulary — the exception `security.md` explicitly allows for reference data.
**The helpers: add, do not change.** `is_admin()` and `is_manager_or_admin()` both have the
cross-org bug — neither has an `organization_id` predicate. But changing their signatures is not
viable:

- **The live bodies are not where they look.** `p3rtrls5m6n7:49-56` / `:60-73` are **dead** —
  `p4rtschema7n8o_move_passport_projection_to_schema.py:55-81` `CREATE OR REPLACE`d both with
  `passport.`-qualified bodies (`passport.identity_link`, `passport.membership`,
  `passport.unit_app_membership`). Any new migration must be based on the **p4** bodies; basing it
  on p3 would reintroduce the unqualified `passport_identity_link` names and break every RLS-gated
  query on Postgres.
- **~98 call sites.** `is_admin()` is called 47× in `h1i2j3k4l5m6`; `is_manager_or_admin()` 39×
  there and **12× in `i1j2k3l4m5n6_menu_sketch_relational_refactor.py`**. `DROP FUNCTION
  public.is_admin()` errors with policies depending on it; `CASCADE` silently drops those policies,
  leaving RLS-enabled tables with **no policy set** — which under RLS denies everything, or under a
  misconfiguration allows everything. Either way, catastrophic.
- **Most call sites have no org to pass.** `is_admin(organization_id)` is impossible on `users`,
  `allergens`, `recipe_ingredients`, `recipe_images`, `tasting_notes`, `menu_sketch_section*` and
  every other table Unit 2 deliberately gives **no org column**.

**Therefore:** add two **new** functions and leave the existing ones untouched.

```sql
CREATE FUNCTION public.is_admin_in(target_org text) RETURNS boolean ...   -- p4 body + AND m.organization_id = target_org
CREATE FUNCTION public.is_manager_or_admin_in(target_org text) RETURNS boolean ...
```

- Tables **with** an org column (the Unit 2 list) get rewritten policies calling
  `is_admin_in(organization_id)` — the org comes from the row under evaluation.
- Tables **without** an org column are child tables. Their policies scope through the **parent's**
  org (e.g. `recipe_images_select` via `can_access_recipe(recipe_id)`, itself org-aware once
  `recipes` is scoped), not via a bare `is_admin()`.
- The old zero-arg `is_admin()` / `is_manager_or_admin()` survive **only** as call targets of
  policies not rewritten in this migration. Each remaining call site is enumerated in the migration's
  docstring with a note on why it is safe (child table, reference data, or scoped via parent). If
  the count reaches zero, drop them then — not before.

This is deliberately additive: no signature change, no cascade, no 98-site edit, and no window where
a table has RLS enabled and no policy.

**Update `security.md`**, which documents `is_admin()` / `is_manager_or_admin()` / `current_user_id()`
and tells future work to use them. It must point at the `_in` variants for org-scoped tables, or the
next author reaches for the org-blind forms — the exact bug this fixes.

## Unit 6 — Frontend org context and switcher

**Purpose:** let a multi-org user choose which org they are acting in, and make that choice
impossible to confuse.

**Placement:** `TopNav`, not Settings. The active org changes what every page shows; it cannot live
two clicks deep in a settings tab. Rendered only when the user has more than one org — single-org
users see a static org name, no control.

**State:** the `StoredAuth` shape (`store.tsx:23-29`) today carries `{ userId, jwt, refreshToken,
username, email }` and no org. It gains `activeOrgId`. Persisted to `localStorage['prepper_auth']`
alongside the JWT via the existing `setStoredAuth` (`store.tsx:46-53`), whose atomicity invariant
(only persist when `userId && jwt && username`) is preserved by adding `activeOrgId` to the same
blob. The org *list* is server state and belongs in a TanStack Query hook (`useOrganizations`), not
in the store — per `frontend.md`, no local state for server data. Only the selected id is client
state.

**Transport:** `api.ts:182-191` already attaches the JWT from `readAuthFromStorage()` uniformly
across `fetchApi`, `fetchApiFormData` (`api.ts:255`) and `fetchApiBlob` (`api.ts:282`). The
`X-Organization-Id` header is attached in the same three places, from the same source. No call site
changes. `completeOAuth` (`api.ts:1346`) hand-rolls its own fetch and is pre-login — it does not
send the header and does not need to.

**Switching invalidates everything.** `queryClient.clear()` on org change. Anything less risks
rendering org A's cached recipes under org B's name — the exact failure this work exists to prevent.
Per-key invalidation is not sufficient because every cached key is now org-dependent.

**New backend endpoint.** Nothing today returns org *names* to the client. `PassportOrganization`
(`models/passport.py:47`) has `id/name/slug/status` and is projected but never read — `directory.py`
and `access.py` do not import it. Add `GET /passport/organizations` returning the caller's active
orgs as `{ id, name, slug, my_org_role }[]`, sourced from the projection, joined to
`access.orgs_for_platform_user`, with `my_org_role` from `access.org_role`. This is the only new
read endpoint.

It is gated by `get_current_user`, **not** `get_org_context` — it is the endpoint that tells the
client which orgs it may select, so requiring an already-selected org would be circular. It is
correctly org-agnostic: it returns the caller's own union by definition.

**It must use the same platform-user resolution as Unit 1, email fallback included.** Sourcing the
org list from `access.orgs_for_platform_user` requires a `platform_user_id`. Without the fallback, a
freshly-logged-in SSO user — whose identity link has not synced yet (`auth.py:98-100`) — gets an
**empty org list**, hits "Org selection on login" below, and cannot proceed into the app, while
`get_org_context` would have resolved them fine. The two paths resolve identically or the app
deadlocks for exactly the users Unit 1's fallback exists to rescue. Extract the resolution
(link → email → `None`) into one helper that both call.

This is a **fourth** call site of `access.org_role` alongside the three in Unit 1. It has no single
active org, so it passes each org's id as it builds the list — one call per org returned. The
switcher mounts once, so the loop is not a hot path.

`my_org_role` is included here rather than via a second endpoint because the Profile tab needs it
(see the [settings refactor spec](./2026-07-16-settings-refactor-design.md), Unit C) and it is one
join away from data this endpoint already loads.

**Org selection on login.** After login, if the user has exactly one org, select it. If more than
one and a previously-selected org is still in their active set, restore it. Otherwise prompt before
rendering the app shell — an unselected org must not fall back to "some org".

## Settings refactor — split into its own spec

The Profile and Brand Roles UI/UX refactor was originally scoped into this spec as a seventh unit.
It has been extracted to
[`2026-07-16-settings-refactor-design.md`](./2026-07-16-settings-refactor-design.md).

**Why:** it is an independent subsystem — it shares no code path with Units 1–6, it is not a
security fix, and it is the largest single chunk of the original scope. Keeping it here would let a
cosmetic refactor gate a live cross-tenant leak. It depends on this spec only for what it displays
(Units 4b and 6), and that dependency is one-directional: this spec needs nothing from it.

Sequence it after PR 4, or in parallel by another pair of hands.

## Testing

**`conftest.py` must be updated, or the suite goes red.** `_override_deps` (`conftest.py:292-295`)
overrides `get_current_user`:

```python
app.dependency_overrides[get_current_user] = lambda: user
```

Under default-deny (Unit 4a), the **global** `require_auth` dependency also runs, and it is not
overridden — every test would 401. And a route later given `Depends(get_org_context)` executes that
dependency for real. Required:

- `_override_deps` overrides `require_auth` in **PR 1**, and additionally `get_org_context` in
  **PR 3** (returning `OrgContext(user, <fixture org>)`).
- **`use_user` (`conftest.py:251-254`) is the second override site** and overrides only
  `get_current_user`. It gains `require_auth` in PR 1 and `get_org_context` in PR 3 — otherwise it
  silently stops switching the acting user on org-scoped routes: a test that passes while asserting
  nothing.
- These are the only two sites. `test_auth.py:444-445` overrides sessions only, deliberately.

**Once overridden, a green suite proves nothing about the gate** — the override replaces the very
dependency under test. Fixture 1 is the only thing that can observe it.

New fixtures required:

1. **`unauthenticated_client`** — bare `TestClient(app)` with only `get_session` overridden,
   mirroring `test_auth.py:435-450`.

   **It must be generated from the app's own route table, not from a hand-written list.** A
   hand-listed subset is exactly the failure this spec has already made twice — 14 claimed, then
   127, against 124 actual. Such a fixture goes green while dozens of routes stay exposed: a test
   that certifies the hole is shut. Generating it means a route added later with no gate **fails the
   suite by default**, which is the entire point of default-deny.

   **Enumerate via `app.openapi()["paths"]`, NOT `app.routes`.** Measured on the real app
   (FastAPI 0.139.0): `len(app.routes) == 42` — four Starlette doc routes, `/health`, and **37
   `_IncludedRouter` wrappers**, one per `include_router` call, between them holding all 181
   `/api/v1` routes. `_IncludedRouter` has **no `.path` and no `.methods`**, so
   `[(m, r.path) for r in app.routes for m in r.methods]` raises `AttributeError`, or — with
   `getattr` guards — silently yields only `/openapi.json`, `/docs`, `/redoc` and
   `/docs/oauth2-redirect`. **Green, while all 124 routes stay open.** Recursing via
   `_IncludedRouter.original_router` does work but is private API. `app.openapi()["paths"]` is public
   and returns full paths — verified to yield all 182.

   ```python
   def _all_routes():
       paths = app.openapi()["paths"]
       return [(m.upper(), p) for p, ops in paths.items() for m in ops
               if m.upper() not in ("HEAD", "OPTIONS")
               and (m.upper(), p) not in public_routes(get_settings())]

   @pytest.mark.parametrize("method,path", _all_routes())
   def test_route_requires_auth(unauthenticated_client, method, path):
       url = re.sub(r"\{[^}]+\}", "1", path)   # dummy path params
       assert unauthenticated_client.request(method, url).status_code == 401
   ```

   Asserting **401 specifically** — never 200, 404 or 422, each of which means the handler or the
   validator ran. The app-level dependency is verified to run before path-param validation, so a
   dummy `1` substituted into `{id}` slots is safe even on `int`-typed params.

   **Tripwire for schema-invisible routes.** `app.openapi()["paths"]` omits routes declared
   `include_in_schema=False` — such a route would never be asserted and the fixture would stay green
   around it. None exist today (verified). Assert that the OpenAPI method count equals
   `len(_collect_api_routes(app))` from `route_auth_census.py` (both 182 today); that catches the
   divergence and pins the fixture to the census.

   **Guard against override leakage.** `unauthenticated_client` and `_override_deps` both mutate
   `dependency_overrides` on the **same module-level `app` singleton** (`main.py:290`,
   `conftest.py:28`). If any fixture skips its teardown, `require_auth` stays overridden and this
   entire suite silently certifies a hole that is wide open. The fixture must assert
   `require_auth not in app.dependency_overrides` before running — a test suite whose failure mode
   is "passes while proving nothing" needs its own tripwire.

2. **`public_routes_are_public`** — the inverse: every entry in `public_routes(settings)` is reachable without
   a token. Guards against an allowlist typo silently locking out login.

   **`POST /api/v1/passport/sync` needs a purpose-built fixture — and "just set the secret" does not
   work.** It is mounted only when `passport_webhook_secret` is set (`mount_passport_sync` returns
   early otherwise). Two facts make this awkward, both verified:

   - `app = create_app()` runs at **import time** (`main.py:290`) and `conftest.py:28` does
     `from app.main import app`. By the time any fixture body runs, the app is already frozen
     without the sync route. Setting an env var in the fixture changes nothing.
   - `get_settings` is `@lru_cache`d (`config.py:84`), so even calling `create_app()` inside the
     fixture still reads the cached settings and still omits the route.

   The working sequence is: monkeypatch the env → `get_settings.cache_clear()` → `create_app()` →
   re-apply the `get_session` override **on that new app instance** → `get_settings.cache_clear()`
   again on teardown, or the poisoned cache leaks into every later test.

   **Do not "fix" this by filtering the allowlist to mounted entries.** That makes the test pass
   and means **the one allowlist entry that exists only in production is the one never asserted** —
   if its path string were wrong, production (secret set) breaks while CI stays green. That is the
   same class of blind spot as a hand-written route list.

   **The route census is environment-dependent:** 182 routes without the sync mount, 183 with it.
   Fixture 1's denominator therefore differs between CI and production. Both fixtures derive from
   `app.openapi()["paths"]` at runtime, so neither hard-codes a total — but do not write "182" into
   an assertion.
3. **`two_org_fixture`** — two orgs, each with a user, brands, and one of every per-org resource.
   Asserts org A cannot read org B's recipes, ingredients, suppliers, categories, tasting sessions,
   menu sketches, **menus**, or users — **one assertion per row of Unit 2's org-column table**, so
   the suite cannot drift from the schema. This is the isolation regression suite.
   (`menus` is the cautionary case: an earlier draft gave it an org column and a backfill, then
   omitted it from both the scoped-route list and this fixture — a table scoped in the schema and
   nowhere else. Its 9 routes are all authenticated, which is exactly why the gap was invisible:
   authenticated is not scoped.)
   **It must assert through child routes too** — `GET /recipes/{id}/ingredients`,
   `/recipes/{id}/costing`, `/recipes/{id}/sub-recipes`, `/recipe-images/{id}` — not only through
   parents. Child tables have no org column and are scoped only by the parent check Unit 2 requires;
   a parents-only suite would pass while the child routes leak (see Unit 2).
4. **`multi_org_user_fixture`** — one user in both orgs. Asserts: no header → 400; header for org A
   → sees only A; header for org B → sees only B; header for org C (not a member) → 403.

Additional coverage:

- `get_org_context`: each branch (valid, forged, absent+single, absent+multi, absent+zero,
  suspended org).
- `is_org_admin` regression: Owner of org B is **not** admin in org A — the bug at `access.py:261-273`.
- `directory.*` narrowing: a caller in orgs A and B, acting in A, gets only A's brands, roster and
  assignable members — the `in_` → `==` change.
- `is_public` regression: a public recipe in org A is invisible to org B.
- Kill switch: acting in a suspended org is blocked even when another of the caller's orgs is healthy.
- Migration 2 backfill: derivable-from-link, derivable-from-single-org-owner, and undecidable cases
  each produce the expected result and counts.
- `register/page.tsx` ordering fix: verified via `npm run build` plus a manual registration pass;
  the phone-number path has no automated coverage today.

Per `testing.md`: `pytest`, `ruff check .`, `mypy app/` for backend; `npm run build` and
`npm run lint` for frontend.

## Sequencing

**PR 1 — authentication only.** No schema, no org scoping. Ships first, alone.

1. Unit 4a: `require_auth` as a global dependency + the settings-derived `public_routes()` allowlist.
2. Pin `fastapi` to an exact version in `pyproject.toml` (currently `>=0.109.0`, spanning two
   incompatible `include_router` behaviours — see Unit 4a).
3. `conftest.py`: `_override_deps` and `use_user` both override `require_auth`. (`get_org_context`
   does not exist yet; they gain that override in PR 3.)
4. `unauthenticated_client` parametrised over `app.openapi()["paths"]` asserting 401 on every non-public route (176: the 124 ungated plus the 52 already gated) +
   `public_routes_are_public` asserting the allowlist still works.
5. `register/page.tsx` ordering fix (`login()` before `updateUser`) + the
   `user_id == current_user.id` check on `PATCH /users/{id}`.

This closes the **entire authentication hole** — all 124 routes, including every unauthenticated
`DELETE` and both AI-spend routes. It carries no migration and no behaviour change for authenticated
users. Migration 1 was originally bundled here and has been **moved to PR 2**: PR 1 became far more
important to review carefully once the true route count was known, and it should carry nothing that
isn't load-bearing to closing the hole.

**PR 2 — additive schema + backfill report.**

6. Unit 1: `get_org_context` incl. the email fallback (additive — nothing depends on it yet).
   `org_role`/`is_org_admin` gain an **optional** `organization_id` that delegates to `_org_role`.

   **Sequencing correction (found in implementation, 2026-07-16.)** This spec assumed the
   `is_org_admin` fix could land in PR 2 because "PR 2 only adds `get_org_context` without wiring
   it". False: `is_org_admin` has **13 call sites**, and making `organization_id` *required* forces
   every one to supply an org — which they cannot do until their route takes `get_org_context`,
   i.e. PR 3. The signature change and its callers are atomic.
   Resolution: the parameter is optional in PR 2, so the correct per-org form exists and is tested
   (`tests/test_org_context.py`) while callers keep compiling. **PR 3 removes the default** and
   threads the active org through all 13. The org-less form remains the live cross-org bug until
   then and is documented as such in `access.org_role`'s docstring.
7. Migration 1 (additive nullable columns + indexes) — no behaviour change.
8. `reconcile` pass, then migration 2 (derive + report).
9. **Checkpoint: review orphan counts, choose the undecidable rule.** Work stops here for a decision.

**PR 3 — isolation enforcement.**

10. Migration 3 (enforce, per the chosen rule's row in the predicate table).
11. Unit 4b org scoping: `get_org_context` on org-scoped routes, read/write predicates,
    **the child-router parent checks** (Unit 2), `directory.*` narrowing.
12. Unit 5 (RLS: `is_admin_in` / `is_manager_or_admin_in`, policy rewrites, `security.md`).

**PR 4 — multi-org UX.**

13. Unit 6 (frontend switcher + `GET /passport/organizations`, sharing Unit 1's resolution helper).

**PR 5 — settings.**

14. [Separate spec](./2026-07-16-settings-refactor-design.md). Depends on Units 4b and 6; blocks
    nothing.

## Risks

**~~Native login stops working for org-scoped routes.~~ CLOSED 2026-07-16.** This was flagged as the
sharpest edge in the design: SSO-off native login (`auth.py:109`) is documented as "the reversible
fallback", and users on that path would 403 on every org-scoped route because Passport has no
identity for them. It is **dead config** — the deployed env sets both Passport Supabase secrets, so
`sso_login_enabled` is on and the native branch is unreachable (see Open Question 3). Nobody is
stranded. Worth noting the "reversible fallback" no longer falls back: if Passport is down, nobody
logs in, with or without this work.

**124 routes are open until PR 1 ships**, including anonymous `DELETE` on suppliers, recipes,
allergens, categories, menu sketches and recipe images, and anonymous Anthropic spend via the two
agent routes. PR 1 is scoped to close this and nothing else, precisely so nothing can delay it.

**Default-deny will break any caller that legitimately relied on an open route.** The frontend does
not (`api.ts:182-191` attaches the JWT uniformly, and `AuthGuard` means no authenticated-page
component mounts without one). Verified unaffected: seed scripts (no HTTP — they import services
directly), CI, and E2E (`frontend/e2e/global.setup.ts:139,162` already sends a real token). Known
breakage: both `postman_collection.json` copies (zero `Authorization` references) will 401 —
annoyance, not breakage. **The residual risk is anything outside the repo** — a monitor, an
integration, an ops script — that nobody has told us about. There is no service-token escape hatch
(see below), so such a caller has no path back in. Rolling PR 1 back is one revert.

**The route inventory must be re-derived, not trusted.** This spec's own route count was wrong by
~7× in an earlier draft — 14 claimed, then 127, against 124 actual — because the check was run against three
pre-selected files rather than the whole API. A corrected file-wide scan still missed the two
`batch_router` routes. Two mechanism claims (`scope["route"].path`, `app.routes`) were asserted as
"verified" from a toy app and a wrong interpreter, and each would have bricked login. Every wrong
number in this document was a count someone typed rather than derived.

Two mitigations, both structural rather than exhortative:

- **`backend/scripts/route_auth_census.py`** regenerates the census from the running app. Problem §1
  is its output. Re-run it; do not trust the table.
- The `unauthenticated_client` fixture parametrises over `app.openapi()["paths"]` — the running app —
  rather than any list written by hand, **including the tables in this document**.

Treat Problem §1 as evidence of scale, not as the definitive inventory. The same applies to Unit 2's
child-router table, whose drafts omitted first every tasting router, then `recipe_units` and
`feedback_summary_agent`. **Verify any empirical claim in this spec against
`backend/venv/Scripts/python.exe`** (Python 3.12, FastAPI 0.139.0) — the global interpreter is 3.9 /
FastAPI 0.109.0 and disagrees on exactly the behaviour the design depends on.

**`is_public` redefinition is a visible behaviour change.** Recipes currently visible across orgs
stop being visible. That is the fix, but to anyone relying on it, it looks like data disappearing.
Quantify affected recipes during migration 2 and communicate before deploying.

**Backfill depends on projection completeness.** Migration 2 reads `identity_link` and `membership`.
A stale projection sends rows to undecidable rather than to a wrong org — the safe direction — but
inflates the orphan count. Run `reconcile` first.

**No service-token path exists.** After gating, JWT is the only inbound door. `postman_collection.json`
(both copies, zero `Authorization` references) will 401 — annoyance, not breakage. But any future
ops script, monitor, or seeder needing these reads has no way in. Not solved here; flagged for a
follow-up if a real consumer appears. Seed scripts are unaffected — they import services and hit the
DB directly, no HTTP.

**Org-context cost on a hot path.** `get_org_context` adds two indexed lookups to every request,
including `GET /ingredients` on every search keystroke. Measure before optimising, per
`performance.md`'s "cache only after measuring". If needed, cache per-request only — never
cross-request, since membership revocation must take effect immediately.

**`queryClient.clear()` on org switch discards all cached data**, including unrelated in-flight
work. Accepted deliberately: the alternative failure mode is showing one org's data under another's
name.

## Open questions

1. **The undecidable-rows rule** — deliberately deferred to the checkpoint after migration 2, when
   real counts exist. Not a gap in this spec; a decision that requires data this spec cannot produce.
   Its interface is pre-specified in the predicate table, so the deferral cannot change Units 4 or 5.
2. **Recipes linked to units in more than one org** — nothing today prevents it. Migration 2 counts
   them as undecidable. If the count is non-zero, this is a product question (should it be
   possible?) as much as a migration one.
3. ~~**Is SSO-off native login used anywhere?**~~ **RESOLVED 2026-07-16 — no.** The deployed env
   has both `passport_supabase_url` and `passport_supabase_anon_key` set (confirmed by the user),
   and `sso_enabled` defaults `True`, so `sso_login_enabled`
   (`supabase_auth_service.py:93-99`) is on and **every login already goes through Passport**. The
   native branch at `auth.py:109` is unreachable dead config. Therefore the unlinked-user 403 in
   Unit 1 strands nobody, and the Risks entry below is closed. Retiring the dead branch is a
   separate tidy-up, not a blocker.
4. **Rate limits on the AI agent routes.** `POST /categorize-ingredient` and
   `POST /summarize-feedback/{recipe_id}` spend Anthropic credits per call. PR 1 makes them
   authenticated, which stops anonymous abuse but not an authenticated user looping them.
   `security.md` requires rate limits on abuse-adjacent routes and the repo has no rate-limiting
   mechanism at all. Out of scope here; needs its own small piece of work.
5. **`platform_user_id_for_email` has no ambiguity guard.** `access.py:227-232` uses `.first()`,
   unlike `resolve_or_provision_passport_user`, which fails closed on case-variant duplicates
   (`deps.py:73-80`). Two distinct platform users sharing an email would resolve arbitrarily. This
   is pre-existing, but Unit 1 puts it on the request path for every unlinked user, which raises its
   consequence. Consider mirroring the `deps.py:73-80` guard.
6. **Extend the census to flag "gated but unscoped".** `route_auth_census.py` answers "does this
   route authenticate?" — it reported `GET /menu-items/{section_id}` as gated while it was a live
   cross-org leak. A second pass flagging routes that carry an auth dependency but never call
   `access.*` or an org predicate would have caught it, and would mechanise PR 3's audit of all 52
   gated routes. Not required to ship PR 1; strongly wanted before PR 3.
7. **Should `is_public` be dropped rather than redefined?** Once reads are both org-scoped and
   unit-scoped, an org-wide public flag has a narrow remaining purpose — "visible to my whole org
   regardless of brand". That may be wanted, or may be vestigial. Out of scope here; the migration
   is the cheap moment to ask, so it is recorded rather than silently preserved.
