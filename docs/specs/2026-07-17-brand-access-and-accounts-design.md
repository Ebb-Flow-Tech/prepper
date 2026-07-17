# Brand Access and Accounts — Design

**Date:** 2026-07-17
**Status:** Approved for planning
**Branch target:** `staging`
**Depends on:** nothing outstanding. Builds on
[`2026-07-16-settings-refactor-design.md`](./2026-07-16-settings-refactor-design.md) (the `Tabs` and
`Table` primitives, both landed) and
[`2026-07-16-org-isolation-and-settings-design.md`](./2026-07-16-org-isolation-and-settings-design.md)
(`directory.*` narrowed to the acting org, `get_org_context`), both shipped in v0.0.64–v0.0.69.

## Problem

Three complaints, one root cause between two of them.

1. **"Brand Roles" is the wrong name** and the tab does not explain its own vocabulary. A reader sees
   `Manager`, `Staff`, `Owner`, `Admin` in one table with nothing saying which are which, or that two
   of them come from a different vocabulary entirely.
2. **The roster is shaped wrong.** It is one flat row per assignment, so a brand with four people is
   four rows that repeat the brand name, and a brand with none is invisible. The natural unit is the
   brand.
3. **The Accounts tab shows exactly one person — the logged-in user.**

### Evidence — why Accounts shows one row

`GET /users` → `UserService.list_users_paginated` → `_org_scoped_user_query`
(`backend/app/domain/user_service.py:123-174`). The scope is a JOIN through the Passport projection:

```
users.id = identity_link.subject
identity_link.platform_user_id = membership.platform_user_id
membership.organization_id = the ACTING org  AND  membership.status = 'active'
```

A local `users` row is therefore visible **only if a `PassportIdentityLink` exists for it**. Every
writer funnels through `store.create_identity_link` (`backend/app/passport/store.py:129`), and there
are three — plus a deleter:

| Writer | File | Trigger |
|---|---|---|
| `report_identity_link_safe` → `_report` | `identity.py:63-77` → the write at `identity.py:60`, called from `api/auth.py:101,133,222,279,334` | a Passport SSO login round-trip |
| snapshot import | `reconcile.py:60-61` | nightly reconcile |
| `PassportHandlers.create_identity_link` | `handlers.py:129-131` | an inbound `identity_link.*` sync event |
| **`store.remove_identity_link`** (deleter) | `store.py:134` via `handlers.py:133-135` | an inbound link-removal event |

The deleter matters: a removed link silently drops a user out of `GET /users` with no local trace.
The diagnosis' conclusion is unaffected — `models/passport.py:193-194` notes `identity_link.*` events
arrive only for this app — but Risk 1's mitigation must account for the removal path, not just
absence of a link.

So **anyone who has never signed in through Passport has no link and is invisible to everybody**. The
function says so itself (`user_service.py:146-147`): *"A user with no identity link appears to
nobody."* On staging the caller is the only linked account, so the roster is one row: themselves.

**The scoping is correct and is not being loosened.** The bug is that the tab is reading the wrong
list. The authoritative roster of people in an org is Passport's `membership` projection, which
embeds `email`, `display_name` and `role` for every member whether or not they have ever opened
Prepper. It is already projected, already org-scoped, and already exposed at
`GET /passport/brand-roles/members` (`directory.assignable_members`, `directory.py:178-215`).

> **VERIFIED against staging, 2026-07-17.** Read-only counts, no PII:
>
> | metric | count |
> |---|---|
> | active memberships in the org | **20** |
> | …with an identity link (all `GET /users` can return) | **1** |
> | …invisible to everybody today | **19** |
> | local `users` rows | 5 |
> | …with no identity link (Passport has never heard of them) | 4 |
> | identity links | 2 (only 1 resolves to a real `users` row) |
> | org role spread | **18 Admin, 1 Owner, 1 Member** |
> | brands / carrying Prepper | 11 / 10 |
> | explicit brand-role rows, active | **3** |
>
> The diagnosis holds exactly: 1 of 20 members is linked, so the roster is one row. The alternative
> causes are ruled out — sync HAS run (20 memberships, 10 brands, 1 active entitlement projected),
> and every membership is `active`, so neither "never synced" nor "tombstoned" explains it.
>
> Two findings the code reading did not predict:
>
> - **19 of 20 members are `Owner`/`Admin`**, so via the ladder they hold `Manager` at all 10
>   app-carrying brands — roughly **190 live access grants**. The current tab renders **3 rows**. It
>   is not slightly misleading; it is wrong by two orders of magnitude. This is the strongest
>   argument for Unit B, and it is why the table must be collapsed-by-default (Unit E): a flat
>   roster of 193 rows is unusable.
> - **One orphaned identity link** — 2 links exist, 1 resolves to a `users` row. Harmless (it can
>   only fail to match), but it means `identity_link` is not a reliable count of local accounts.
>
> Unit A's N+1 is confirmed real at current scale: 20 members × 6 queries ≈ 120 per roster load.

### Evidence — the current tab

| File | Lines | State |
|---|---|---|
| `frontend/src/components/admin/BrandRolesTab.tsx` | 235 | Flat table, one row per assignment (`:191`). Five columns (`:174-180`). Needs a prose paragraph (`:163-168`) apologising for the ladder. |
| `frontend/src/components/admin/UserManagementTab.tsx` | 175 | Still hand-rolls `<table>` (`:99`) despite `Table.tsx:6-12` recording that the primitive was extracted *for this file*. |
| `frontend/src/components/ui/Table.tsx` | 81 | No expandable-row support. No `Accordion`/`Collapsible`/`Disclosure` anywhere in `ui/`. |

## The ladder, and why it drives the whole design

Passport derives brand access; it does not grant it. An org `Owner` or `Admin` holds `Manager` at
**every** brand that carries the app, **with no `unit_app_membership` row at all**
(`backend/app/passport/access.py:8-9,280-284`).

**The ladder is a FLOOR FOR GAPS, not an override.** The SDK's `roles_at_brands`
(`passport_client/access.py:68-78`) is explicit:

```python
for m in memberships:          # explicit ACTIVE rows win over the ladder
    ...
    roles[m.unit_id] = m.role
if org_role in _LADDER_ROLES:  # the ladder fills the GAPS, it does not override (§5.1)
    for brand_id in app_brands:
        roles.setdefault(brand_id, _MANAGER)
```

`setdefault`, not assignment. Verified by executing the installed SDK:

```
Owner WITH an explicit Staff row -> {'B1': 'Staff'}
Owner WITHOUT any row            -> {'B1': 'Manager'}
```

An earlier draft of this spec asserted the opposite, and the error propagated into the data model,
the UI and a test. It is recorded here so the next reader does not re-derive it from intuition:
**an Owner can be explicitly demoted at one brand, and that demotion is real.**

This is the single most misleading thing about the current page, and `BrandRolesTab.tsx:33-41` says
as much in a source comment addressed to a reader who is not the person who needs to know. A brand
can show zero people while three Owners have full Manager access.

The fix is to stop apologising in prose and **show the derived holders as rows**. That makes the
table true, and the apology unnecessary.

## Two vocabularies — do not conflate

| Vocabulary | Values | Stored on | Source |
|---|---|---|---|
| **Org role** | `Owner` \| `Admin` \| `Member` | `passport_membership.role` | `access.py:118-130,267-305` |
| **Brand-app role** | `Manager` \| `Staff` | `passport_unit_app_membership.role` | `models/passport.py:164-186`, `access.py:394-404` |

`models/passport.py:164-186` states it directly: *"a DIFFERENT vocabulary from the org membership's
`Owner` | `Admin` | `Member`. Do not conflate them."* This matters twice below: the legend must
separate them, and the invite modal takes an **org** role, not a brand role.

## Non-goals

- Changing `GET /users` in any way. `ParticipantPicker.tsx:23` consumes `useUsers()` and needs the
  local `users.id` for tasting participants, where identity-link scoping is *correct* — a participant
  needs a real account. Its shape and its scoping both stay.
- Loosening `_org_scoped_user_query`. It is the fix from v0.0.67 and stays exactly as written.
- Making `PATCH /users/{user_id}` writable by org admins. See Unit F.
- A generic expandable-table primitive in `ui/`. This is the first occurrence; `general.md` says
  extract on the third.
- Removing org membership. The SDK exposes no `remove_membership` — Passport's App API has no such
  endpoint (it exists only as an inbound `membership.removed` sync event). Out of scope by absence.
- Renaming the `/passport/brand-roles` backend route or the `usePassportRoles` hook file. The rename
  is a UI-facing change only.

---

## Unit A — `access.brand_roles_for_org_members`

**Purpose:** derive every member's brand roles for one org, from the SDK, without an N+1.

**Why the derivation must be in Python.** The obvious cheap implementation merges Owners/Admins into
each brand in TypeScript. That reimplements Passport's ladder in a second language, and
`directory.brands_for_user` (`directory.py:79-87`) explicitly promises `my_role` comes from *"the
SAME derivation the request path uses (`roles_at_brands`), so the UI can never disagree with the
permission check."* A TS-side merge breaks that promise silently the day Passport changes the ladder.
The SDK's `roles_at_brands` stays the sole derivation.

**Why a new function.** `brand_roles_for_platform_user` costs **6 queries per member**:
`entitlement_status` (`access.py:174`), then `_derivation_inputs` runs units (`:143`), accesses
(`:144`), that member's app-memberships (`:145-149`), `entitlement_status` **again** (`:153`) and
`_org_role` (`:154`). Two of those — units and accesses — are **unfiltered full-table scans**.
Looping it over 50 members is ~300 queries and 100 full scans, a flat violation of
`performance.md`'s N+1 rule.

```python
def brand_roles_for_org_members(
    session: Session, org_id: str
) -> dict[str, dict[str, str]]:
    """``{platform_user_id: {brand_id: "Manager" | "Staff"}}`` for every ACTIVE member of ONE org.

    The batched form of :func:`brand_roles_for_platform_user`. Same derivation — the SDK's
    ``roles_at_brands``, called once per member — but the inputs are read ONCE and sliced in memory
    rather than re-read per member. The single form costs 6 queries per member, two of them
    unfiltered scans of ``unit`` and ``unit_app_access``; this is 4 queries total, whatever the
    member count.

    Empty when the entitlement has not synced — "derive nothing", NOT "deny", matching
    ``brand_roles_for_platform_user``.
    """
```

Implementation:

1. `entitlement_status(session, org_id)`; `None` → return `{}` (fail open, derive nothing).
2. `units = select(PassportUnit).all()` — once.
3. `accesses = select(PassportUnitAppAccess).all()` — once.
4. `select(PassportUnitAppMembership).all()` — once, grouped into a
   `dict[platform_user_id, list[row]]`. **Unscoped by org, deliberately**, matching
   `_derivation_inputs:139-141`: the SDK helper applies the org filter internally, and a receiver
   legitimately holds rows for every org it is entitled to.
5. `select(PassportMembership)` where org + `status == 'active'` — once. Gives each
   `platform_user_id` and their `org_role`.
6. Per member, call `roles_at_brands(org_id=…, entitlement_status=…, org_role=<theirs>,
   memberships=<their slice>, units_by_id=…, app_accesses=…)` — the identical kwargs
   `_derivation_inputs` builds, from in-memory data.

`_derivation_inputs` is left alone; it has three existing callers and this is additive.

## Unit B — `directory.roster` gains derived rows

**Purpose:** the roster becomes "everyone who can reach each brand", not "rows Passport happens to
store".

Today `roster` (`directory.py:122-175`) selects `PassportUnitAppMembership` joined to unit and
membership — explicit assignments only. It gains derived rows.

New per-row shape (additive; existing keys unchanged):

| Key | Type | Note |
|---|---|---|
| `assignment_id` | `str \| None` | **now nullable** — `None` for a derived holder, who has no row |
| `source` | `'assigned' \| 'derived'` | new |

**The rule:** `source = 'assigned'` **iff an active `unit_app_membership` row exists for
`(platform_user_id, unit_id)`**; otherwise `'derived'`. It keys on the presence of a row, **not** on
the person's org role.

The role itself always comes from `roles_at_brands`, never from the raw row value — that keeps the
precedence question inside the SDK, where it belongs. But `source` answers a different question: *is
there a row here to edit or remove?* An Owner with an explicit `Staff` row has one, is `Staff`, and
must keep a working `Select` and `Remove`. An Owner with no row is `Manager` by the ladder, has
nothing to edit, and gets neither.

Keying `source` on org role instead — as an earlier draft did — labels that Owner's real, editable
assignment `derived`, renders it with the wrong role, suppresses its controls and discards its
`assignment_id`, leaving a live assignment unremovable through the UI.

Implementation:

1. Existing checks unchanged: `platform_user_id_for` → `None` ⇒ `[]`; acting org ∉ caller's orgs ⇒
   `[]` (`directory.py:134-144`).
2. `roles = access.brand_roles_for_org_members(session, org_id)` (Unit A).
3. Brands to iterate: active `brand`-type units in the org **with a `unit_app_access` row** — the
   same predicate `brands_for_user` uses (`directory.py:100-108`). A brand without one confers access
   to nobody, *not even an Owner* (`directory.py:81-83`), so it produces no rows.
4. Existing explicit rows keep their `assignment_id`; `status == 'active'` only — `removed`
   tombstones stay excluded (`directory.py:128-129`).
5. For each active member × each brand, emit a row iff `roles[platform_user_id].get(brand_id)` is not
   `None`, carrying that role.
6. `email` / `display_name` / `org_role` continue to come from `PassportMembership`, which embeds
   them — there is no user aggregate to join (`directory.py:131-132`).

Deduplication: keyed on `(platform_user_id, unit_id)` — which is also the React key in Unit E, since
`assignment_id` is now nullable and cannot serve. The derived map is the sole source of `role`; an
explicit row contributes its `assignment_id` and sets `source = 'assigned'`.

`GET /passport/brand-roles` (`api/passport_roles.py:45-57`) is unchanged — it returns
`directory.roster` verbatim.

## Unit C — `writeback.invite_member` + `POST /passport/brand-roles/members`

**Purpose:** "Add User" stops creating a local row nobody can see, and invites into Passport instead.

**The capability already exists and is unwired.** SDK v1.1.0
(`passport-client-v1.1.0`, pinned in `backend/pyproject.toml`) exposes:

```python
async def upsert_membership(
    self, org_id: str, *, email: str | None = None, display_name: str | None = None,
    platform_user_id: str | None = None, role: str, end_user_token: str,
) -> MembershipRead:
    """Create or update a membership. Provide EXACTLY ONE of ``email`` / ``platform_user_id``…"""
```

Passing `email=` for someone Passport has never seen **is** what creates the platform user; the SDK
has no separate `create_user`. `writeback.py` wraps only the three `unit_app_role` calls today, so
`upsert_membership` and `update_membership` are both unused.

`writeback.invite_member` follows the shape of the existing three wrappers exactly
(`writeback.py:176-245`):

```python
async def invite_member(
    session: Session, *, actor: User, organization_id: str, email: str,
    display_name: str | None, role: str, end_user_token: str,
) -> Any:
    """Invite someone into the org, or update their org role if already a member.

    ``role`` is the ORG vocabulary — ``Owner`` | ``Admin`` | ``Member`` — NOT ``Manager``/``Staff``.

    Writes NOTHING locally. Passport returns the aggregate AND echoes a ``membership.*`` event; the
    version-guarded handler applies it. Never write the returned aggregate into the projection —
    that is the suppressed-echo mistake this module's header forbids.
    """
```

1. `_require_configured()`.
2. Local authority: **`access.is_org_admin(session, actor.id, organization_id)`** — org id passed
   explicitly. `_require_local_authority` (`writeback.py:66-90`) calls the **org-less** form at
   `:81`; that is a sanctioned exception (`access.is_org_admin`'s docstring lists writeback as one of
   three legitimate org-less callers, because Passport re-checks against the verified end user).
   There is no reason to inherit it here — `get_org_context` hands us the org. Refuse with `403`.
3. `_require_org_role(role)` — a new local guard mirroring `_require_role` (`writeback.py:156-161`),
   validating against `("Owner", "Admin", "Member")` and raising `422`. The existing `_ROLES` tuple
   is the brand vocabulary and must not be reused.
4. `pc.upsert_membership(...)` inside the async context manager; `PassportAPIError` → `_reraise`
   verbatim. A `403` (authority matrix / unregistered `issuer_url`) is a normal outcome.

Route, in `api/passport_roles.py` beside the existing `GET /members` (`:78-86`):

```python
@router.post("/members", status_code=201)
async def invite_member(data: InviteMemberRequest, ..., org: OrgContext = Depends(get_org_context),
                        token: str = Depends(get_bearer_token)) -> Any:
```

`InviteMemberRequest`: `email: EmailStr`, `display_name: str | None = None`,
`role: str  # Owner | Admin | Member`. `EmailStr` per `security.md`'s validate-at-boundaries rule.

**Ordering is load-bearing.** `assign_unit_app_role` returns `409` if the target holds no active org
membership — a brand role cannot bootstrap a member. Invite in Accounts first, assign in Brand Access
second. This is why the two tabs cannot be collapsed into one.

## Unit D — `GET /users/accounts`

**Purpose:** the Accounts roster, from Passport membership, joined to local accounts where linked.

`user_service.list_org_member_accounts(subject, organization_id, *, offset, limit)`. Membership is
the spine; `users` is LEFT JOIN'd **through the identity link**:

```
passport_membership  (org = acting org, status = 'active')
  LEFT JOIN passport_identity_link ON link.platform_user_id = membership.platform_user_id
  LEFT JOIN users                  ON users.id = link.subject
```

Note the join pair — `identity_link.subject` holds the **local** `users.id` while
`platform_user_id` holds Passport's. `user_service.py:133-135` records that joining the wrong pair
matches nothing and silently returns empty.

Row shape:

| Key | Source | Note |
|---|---|---|
| `platform_user_id`, `email`, `display_name`, `org_role` | `passport_membership` | Passport is identity truth; its `email` is displayed even if a linked `users.email` differs |
| `user_id`, `username`, `phone_number` | `users` | all `None` when unlinked |

`user_id is None` ⇒ never signed in ⇒ the UI's "Not signed in" state. The caller's own membership is
still verified first (acting org ∈ their orgs), same as `_org_scoped_user_query:155-156` — fail
closed, a forged org id returns nobody.

Paginated via the existing `PaginatedResponse.create`, `page_size` capped at 100, per
`performance.md`.

**Route order is load-bearing.** `@router.get("/accounts")` must be declared **before**
`@router.get("/{user_id}")` (`api/users.py:47`) or FastAPI matches `user_id="accounts"` and returns
`404 User not found`.

Auth: `require_auth` covers it by default; `tests/test_default_deny_auth.py` and
`tests/test_route_auth_census.py` pick the route up automatically. It takes `get_org_context` and
consults it, so the census's declared-but-unused check passes honestly.

## Unit E — Brand Access tab (frontend)

**Purpose:** the rename, the brand-first expandable table, the legend.

**Rename.** `settings/page.tsx:15` label `'Brand Roles'` → `'Brand Access'`; the `SettingsTab` union
member `'brand-roles'` → `'brand-access'` (`:9`); `PageHeader` title (`BrandRolesTab.tsx:108`) →
`'Brand access'`. The component and file are renamed `BrandRolesTab.tsx` → `BrandAccessTab.tsx`, with
`admin/index.ts` updated — a component named `BrandRolesTab` behind a tab named Brand Access is the
drift that costs the next reader an hour. `usePassportRoles.ts` and the backend route keep their
names; nothing user-facing says "brand-roles".

**Files.** In one file this lands near 400 lines against a 500 ceiling with no headroom, so it splits
by responsibility:

| File | Responsibility |
|---|---|
| `admin/BrandAccessTab.tsx` | shell, data fetching, assign bar, error banner |
| `admin/BrandAccessTable.tsx` | the expandable brand → people table |
| `admin/RoleLegend.tsx` | the collapsible legend |

**Table.** Parent row per brand from `usePassportBrands()`: name, people count, your role. Expanding
reveals that brand's people, grouped from `usePassportBrandRoles()` in a `useMemo` — grouping is
presentation and carries no security meaning, unlike the derivation in Unit A.

```
┌────────────────────┬────────┬────────────┐
│ Brand              │ People │ Your role  │
├────────────────────┼────────┼────────────┤
│ ▼ Harbour Kitchen  │   4    │ Manager    │
│    Jane Doe     [Owner]  Manager · auto    │
│    Sam Reed     [Member] [Manager ▾] Remove│
│    Ali Khan     [Member] [Staff   ▾] Remove│
│ ▶ Riverside Cafe   │   2    │ Manager    │
└────────────────────┴────────┴────────────┘
```

- Rows with `source === 'derived'`: role rendered as static text `Manager · auto`, **no `Select`, no
  `Remove`** — there is no row to edit or remove.
- Rows with `source === 'assigned'`: `Select` and `Remove` as today (`BrandRolesTab.tsx:203-228`) —
  **including for an Owner or Admin**, whose explicit row is real and beats the ladder.
- **React key is `(platform_user_id, unit_id)`, not `assignment_id`.** `BrandRolesTab.tsx:192` keys
  on `assignment_id`, which Unit B makes nullable — every derived row would key on `null`.
- A brand with people still appears when collapsed; the count tells the truth without expanding.
- Built with the existing `Table` primitives: parent `TableRow` whose first cell holds a toggle
  `<button aria-expanded>`; children are sibling `TableRow`s inside a keyed `Fragment`. No new `ui/`
  primitive.
- The apologetic paragraph (`:163-168`) is **deleted** — derived rows make it false. The empty state
  (`:184-190`) likewise loses its "Owners and Admins still hold Manager everywhere" caveat; if the
  table is empty now, it is genuinely empty.
- The `!brands?.length` short-circuit (`:92-103`) stays as-is. It is correct and well-explained.

**Legend.** `RoleLegend.tsx`, collapsed by default, native `<details>`/`<summary>` — accessible, zero
dependencies, no new abstraction. Summary: *"What do these roles mean?"* Content covers, in order:
the two vocabularies kept visibly apart; `Manager` and `Staff`; the ladder (Owner/Admin ⇒ Manager
everywhere, shown as `· auto`, not removable here); and that Passport, not Prepper, is the source of
truth, so a `403` on assign is a normal answer.

**Assign bar** is unchanged (`:119-159`), but its `assignable` filter (`:69-76`) needs a **guard, not
an extension**. The existing `taken` `Set` (`:72-75`) is built from every `roster` row at the selected
brand. Once derived rows are in the roster, that Set swallows every Owner and Admin at *every*
app-carrying brand — so they would vanish from the Person dropdown everywhere and could never be
given an explicit role again.

The filter must therefore key on `source === 'assigned'` only:

```ts
const taken = new Set(
  (roster ?? [])
    .filter((r) => r.unit_id === unitId && r.source === 'assigned')
    .map((r) => r.platform_user_id)
);
```

Assigning `Staff` to an Owner is a legitimate, observable act: it **demotes them at that brand**,
because the explicit row beats the ladder. The dropdown must keep offering it.

## Unit F — Accounts tab (frontend)

**Purpose:** the roster shows the org; "Add User" becomes "Invite member".

- `api.ts`: `getMemberAccounts()` → `GET /users/accounts`, **taking no argument** and walking all
  pages internally, exactly as `getUsers` does (`api.ts:1430-1452`), including its `USERS_MAX_PAGES`
  guard and its over-cap warning.
- `hooks/useUsers.ts`: `useMemberAccounts()`, query key `['member-accounts']`. `useUsers` untouched.
- `types/index.ts`: `MemberAccount` and `InviteMemberRequest` are new. **`PassportBrandRole`**
  (`types/index.ts:1015-1023` — the roster row type) gains `source` and a nullable `assignment_id`.
- `api.ts` + `hooks/usePassportRoles.ts`: `invitePassportMember` / `useInviteMember` for Unit C's
  route. `frontend.md` requires both — no raw `fetch`, no server data outside a query hook.
- `UserManagementTab.tsx` moves onto the `Table` primitive, retiring the hand-rolled `<table>`
  (`:99-163`) that `Table.tsx:6-12` was extracted for.

Columns: Person (display name + email) · Org role (`Badge`) · Status · Phone.

**Phone is editable on your own row only.** `PATCH /users/{user_id}` refuses to edit anyone but the
caller (`api/users.py:86-90`) — the tab only gets away with inline editing today *because* it only
ever shows one person, themselves. With the full roster, every other row's phone edit would `403`.
Other rows render read-only. Widening the PATCH to org admins is a real option but is a **new write
capability on PII** and belongs in its own change with its own justification, not smuggled in behind
a display fix.

**Status column:** `user_id === null` ⇒ `Badge` "Not signed in", phone shows `—`, no edit affordance.
Otherwise blank.

**Invite modal** (`AddUserModal.tsx` reworked): email, display name, org role
(`Owner | Admin | Member`). On success it must **not** insert a row optimistically — Prepper never
writes the projection (`writeback.py:1-8`); the member appears when the `membership.*` echo lands.
The modal says so: *"Invited — they'll appear here once Passport syncs."* Invalidate
`['member-accounts']` so a manual refresh picks it up. Passport's `403` is surfaced verbatim, as
`BrandRolesTab.tsx:33-41` already does for role writes.

The `PageHeader` description (`:60`) is rewritten: roles are assigned per brand in **Brand Access**.

## Unit G — Tests

Backend (`pytest`, SQLite in-memory via `conftest.py`):

| Test | Asserts |
|---|---|
| `test_passport_directory.py` | an Owner and an Admin appear at **every** app-carrying brand with `source='derived'`, `assignment_id=None`, `role='Manager'` |
| ″ | a brand with **no** `unit_app_access` row yields no rows, not even for an Owner |
| ″ | **an explicit `Staff` row for an Owner reports `Staff` with `source='assigned'` and keeps its `assignment_id`** — the ladder is a floor for gaps, not an override, and the demotion is real |
| ″ | `status='removed'` tombstones stay excluded |
| ″ | ORG_B's members never appear in ORG_A's roster |
| `BrandAccessTable` (type check only) | — see the assign-bar note in Unit E: an Owner with no explicit row stays selectable in the Person dropdown. Not unit-tested (no FE test runner); called out for manual check. |
| `test_access.py` | `brand_roles_for_org_members` agrees with `brand_roles_for_platform_user` per member (the batched form must not drift from the single form) |
| ″ | returns `{}` when the entitlement has not synced — derive nothing, not deny |
| `test_users.py` | a member with no identity link appears with `user_id=None`, `phone_number=None` |
| ″ | a local user with **no** membership does **not** appear |
| ″ | ORG_B's members absent from ORG_A's `/users/accounts` |
| ″ | `GET /users/accounts` is not shadowed by `GET /users/{user_id}` |
| ″ | a non-member acting org fails closed (empty, not everybody) |
| `test_passport_writeback.py` | `invite_member` refuses a non-admin with `403` **before** any SDK call |
| ″ | rejects `Manager`/`Staff` with `422` — wrong vocabulary |
| ″ | writes nothing to `passport_membership` locally |
| ″ | `PassportAPIError` surfaces verbatim, detail carries no token |

`tests/test_default_deny_auth.py` and `tests/test_route_auth_census.py` cover the two new routes
without modification.

Frontend: `npm run build` (type check) and `npm run lint`.

**RLS:** no new tables and no policy changes, so `scripts/verify_rls.py` is not implicated. Noted
explicitly because `security.md` requires RLS on new tables and a reviewer will look for it.

## Risks

1. **The Accounts diagnosis is unverified against staging.** See the callout above. Cheapest
   mitigation: before Unit D, count `passport.identity_link` rows on staging, and compare against
   `passport.membership` where `status='active'`. If many members are linked, the cause is elsewhere
   and this unit is wrong. Check the removal path too (`handlers.py:133-135`): a link that was
   created and later removed presents identically to one that never existed.
2. **Unit A duplicates derivation-input assembly.** `brand_roles_for_org_members` and
   `_derivation_inputs` must build identical kwargs; if they drift, the batched roster disagrees with
   the request-path check — the exact failure the SDK-derivation rule exists to prevent. The
   `test_access.py` agreement test is the guard, and is the most important test in this spec. It must
   include an **Owner holding an explicit `Staff` row**, which is the case the first draft of this
   spec got backwards.
3. **Invite has no local echo.** A member invited via Unit C appears only after sync delivers
   `membership.*`. If the webhook is down, the modal reports success and nothing appears — indistin-
   guishable from a bug to the user. Accepted: writing the aggregate locally is explicitly forbidden.
   The modal's wording is the whole mitigation.
4. **One-org staging.** Every cross-org assertion here seeds its own ORG_B. Per `CLAUDE.md`, the
   mechanisms are verified but the deployment is not — this spec does not change that.
5. **`GET /users/accounts` returns PII** (email, phone) for the whole org to any member, not just
   admins. That matches the existing `GET /users` posture, which is org-scoped but not
   admin-scoped — so this is not a widening. Flagged because it is worth an explicit decision rather
   than an inherited default.

## The three rules the page must obey

Stated by the product owner after the first implementation, which honoured none of them in the UI.

1. **Only an org Owner/Admin may CHANGE an existing Manager/Staff role at a brand.**
2. **A brand Manager may only assign `Staff`** — and, per the matrix, only remove `Staff`, never a
   peer Manager.
3. **A user only sees the brands they have access to.**

**Rules 1 and 2 are presentation.** Passport already enforces them (`writeback.py:16-20`) and
returns `403`. The defect was that the UI rendered a `Select` and a `Remove` on every row for
everyone, so a Manager clicked a control that was always going to fail. Fixed by mirroring the
matrix in `BrandAccessTab`/`BrandAccessTable` via `isOrgAdmin` (read from `my_org_role` for the
**acting** org) and the brand's own `my_role`. **Do not re-implement the matrix in Prepper's
backend**: `_require_local_authority` is a pre-filter, Passport is the gate, and a second copy would
drift.

**Rule 3 is enforcement, and only Prepper can do it.** The roster is served from Prepper's
projection — Passport never sees the request. `brands_for_user` returned EVERY app-carrying brand in
the org with `my_role: None` on unreachable ones; `roster` then returned every brand's people, names
and emails included. The derived rows made an existing hole worth closing: unscoped it went from 3
rows to ~190. Both are now filtered to `access.brand_roles(session, subject)`. An Owner/Admin still
sees every brand — through the LADDER, not an exception, which is why scoping costs them nothing.

Three existing directory tests broke on this and were **fixed, not weakened**: they asserted a
plain `Member` with no role row could see `BRAND`, which was only ever true because the old code
showed you brands you could not access. They test dark-brand filtering and org narrowing; they now
grant their subject a real role so they test that and not the leak.

### Changing a derived role — the dead-end this created

The first cut rendered `source === 'derived'` as static text with no controls. On live data **187 of
190 rows are derived**, so the page was ~98% inert, and the only way through — assign an explicit
role, which overrides the ladder — lived in a separate widget the table never pointed at.

The error was answering two questions with one flag. A derived holder has no row to **remove**;
that does not mean their role cannot be **changed**. Derived rows now carry a `Select` that calls
**assign** (creating the override) rather than **set** (which needs an `assignment_id` that does not
exist) — for an org admin only, per rule 1. A Manager cannot override a derived Manager, since
creating that role is an assignment and rule 2 caps them at `Staff`.

## Two bugs found by using the thing (2026-07-17, post-implementation)

### 1. Accounts showed the same person several times — a LEFT JOIN fan-out

`list_org_member_accounts` joined `membership → identity_link → users`. **`identity_link` is not
one-per-person**: a platform user can carry several rows for the same app — staging has one with
two, of which one is orphaned (its `subject` resolves to no `users` row). Joined, they fan out to
one row per LINK, so that member rendered twice — once "Not signed in", once not — and `count()`
reported **21 members where 20 exist**. `DISTINCT` would not have helped: the rows genuinely differ.

Fixed by resolving the link in Python (three flat reads, no join), with a **resolving link beating
an orphan** — otherwise a real account reads "Not signed in" because a stale link sorted first.
Verified against staging: 20 rows, 20 total, no duplicates. Regression tests:
`test_a_member_with_two_identity_links_appears_exactly_once`, `test_total_count_is_members_not_links`.

The orphan links are a separate, pre-existing data oddity worth a look: a link should only exist for
someone who has signed in, yet 2 of 3 point at no `users` row.

### 2. "Update / remove doesn't work" — it always worked; the UI discarded the answer

Reported as: change a role or click Remove, **nothing happens, no error**. Everything was working.
Proof, from `passport.unit_app_membership` on staging:

```
Staff  active  version 4   <- THREE successful writes, echoed back
Staff  active  version 2   <- one
```

A `version > 1` is only reachable if Prepper wrote to Passport AND the echo returned. So the API
key, the `issuer_url` registration, the authority matrix and the sync echo were all fine.

The defect was `useInvalidateRoles`: on success it invalidated, refetching the projection **before
the echo landed**, painting the old value straight back. With `refetchOnWindowFocus: false` and a
5-minute `staleTime` (`providers.tsx`) nothing refetched again — so a successful change looked like
a permanent no-op. **We refetched at the one instant guaranteed to be wrong, then never again.**

Fixed by applying **Passport's own returned aggregate** to the cache instead of invalidating. This
is not the optimistic update the old comment forbade: the value is Passport's answer, not Prepper's
guess, and the projection is still only ever written by sync. A plain optimistic update would have
been *worse* — `onSettled` refetches the pre-echo projection and the row snaps back.

The old comment ("re-reading is the honest thing to do — Prepper must never apply the change locally
to make the UI feel instant") is **overturned deliberately**, and the reasoning is recorded in its
place. It was honest and useless.

The three write routes also returned Passport's **aggregate** while being typed `PassportBrandRole`
(a roster row, with `email`/`unit_name`/`org_role` the aggregate lacks). That compiled only because
nothing read the body; now something does, so `PassportBrandRoleAggregate` is the real shape.

**One prediction survives**, in `useRemoveBrandRole`: Passport says the row is gone but not what the
person is left with, and that depends on the ladder (Owner/Admin ⇒ derived `Manager`; anyone else ⇒
off the brand). It re-states the ladder on the client — normally forbidden — and is tolerable only
because it is transient and the next refetch overrules it. First thing to delete if the ladder ever
changes.

**`useInviteMember` still has the original shape** (invalidate, then wait for the echo). It is not a
bug there only because the modal SAYS so — "Invited — they'll appear here once Passport syncs." If
that message ever goes, this trap comes back.

## Open question — onboarding someone with no Passport account

**Raised after implementation; not answered.** The invite grants org membership. It does **not**
create a credential, and Prepper must never try to: login authenticates against PASSPORT's project
(`auth.py:60` — *"one credential for every app, and no Prepper-side invite/SMTP"*), and
`sso_login_enabled` is true wherever `passport_supabase_url` + anon key are set, which is staging.

| invitee | what happens |
|---|---|
| **has a Passport account** | Signs in immediately with their existing Passport password. The membership was the only missing piece, and this is the first time Prepper could grant it. **Works.** |
| **no Passport account** | `upsert_membership(email=…)` creates the platform-user record. Whether Passport then provisions a GoTrue credential and emails them is **Passport's server-side behaviour — undocumented in the SDK (no `invite`/`email`/`password` anywhere in its README) and unverified.** If it does not, they must be set up in Passport's own admin UI first. |

**This is not a regression.** The `AddUserModal` it replaced registered against *Prepper's* Supabase
(`supabase_auth_service.register` uses `service_role_key`) while login checks *Passport's* — so its
accounts could never sign in, and were invisible in the roster besides. The path was already dead.

**Do not "fix" this by adding SMTP to Prepper.** That forks identity, which is the thing Passport
exists to prevent. Answer it by reading Passport's membership-creation behaviour, then either
document "the invitee must exist in Passport" in the modal, or have Passport own the invite email.

## Decisions

1. **Phone is editable on your own row only. Settled 2026-07-17; not revisited without new
   information.** The tempting alternative — let org admins edit anyone's — was rejected *on the
   staging data*: **18 of the org's 20 members hold `Admin`**, so "admins may edit" is
   operationally "everyone may edit everyone's contact details" while reading, in code review, like
   a restriction. A permission that excludes 2 of 20 people is not a permission. `PATCH
   /users/{user_id}` therefore keeps its self-only rule (`api/users.py:86-90`) and stays
   deliberately un-org-scoped (`:81-84`). A person sets their own phone at first sign-in, which is
   already what `register/page.tsx` does.
2. Should `Owner`/`Admin` be assignable in the invite modal, or `Member` only? Specced as **all
   three**, since Passport's authority matrix is the real gate and will refuse what the actor may not
   do. Restricting the dropdown would be a second, weaker gate that lies about what is possible.
