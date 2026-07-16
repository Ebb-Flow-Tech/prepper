# Settings Refactor — Profile and Brand Roles — Design

**Date:** 2026-07-16
**Status:** Approved for planning
**Branch target:** `staging`
**Depends on:** [`2026-07-16-org-isolation-and-settings-design.md`](./2026-07-16-org-isolation-and-settings-design.md)
— **Unit 4b** (`directory.*` narrowing, which makes Unit D's roster show one org) and **Unit 6**
(`GET /passport/organizations` with `my_org_role`, which Unit C displays). The dependency is
one-directional: this spec consumes what those units produce; the isolation spec needs nothing from
this one and must not wait on it.

## Problem

The Settings tabs work but are structurally inconsistent, duplicate markup the UI library already
provides, and one of them cannot scroll. Separately, Profile shows no organisation context at all —
the original user report was "I don't see Org info and a dropdown to select orgs".

The org *dropdown* is Unit 6 of the isolation spec (it belongs in `TopNav`, not Settings, because it
changes what every page shows). The org *info* is here.

### Evidence

| File | Lines | State |
|---|---|---|
| `app/settings/page.tsx` | 62 | Hand-rolls its tab bar with raw `<button>`s and local `useState`. Third hand-rolled tab bar in the codebase. |
| `components/settings/UserProfileTab.tsx` | 114 | Uses only `Skeleton`. Local `timeAgo()` (:8) and `Field()` (:19) helpers. All fields read-only. |
| `components/admin/BrandRolesTab.tsx` | 238 | Uses **zero** UI primitives despite `Select`, `Button`, `Badge`, `Card` existing. Raw `<select>` × 3 + raw `<button>` in the assign bar (:106). Hand-rolled `<table>` (:164). |
| `components/admin/UserManagementTab.tsx` | 175 | Uses `PageHeader`; hand-rolls its own `<table>`. |

Structural inconsistencies:

- `UserProfileTab` and `UserManagementTab` each own their scroll container (`h-full w-full
  overflow-auto`) and set **different** max-widths (`max-w-2xl` vs `max-w-7xl`).
- `BrandRolesTab` does neither — it renders `p-6 space-y-6` inside the page's `overflow-hidden`
  flex, **so it cannot scroll**. This is a live bug, not just an inconsistency: a long roster is
  unreachable.
- `UserManagementTab` uses `PageHeader`; the other two hand-roll headings.
- There is no `Tabs` primitive and no `Table` primitive in `components/ui/`.
- `Pagination` exists (`Pagination.tsx`, 51 lines) but is **not exported** from `ui/index.ts`.

## Non-goals

- The org switcher control itself — that is Unit 6 of the isolation spec, and it lives in `TopNav`.
- Making Profile fields editable. They are read-only today because the data is Passport-owned;
  that stays true. This is a presentation refactor, not a new capability.
- Reworking `UserManagementTab` or the Design tab beyond the shared shell and `Table` primitive.
- Any change to `usePassportRoles.ts` mutation semantics.

## Unit A — UI primitives

**Purpose:** stop three components from hand-rolling the same markup.

1. **`Tabs`** (`components/ui/Tabs.tsx`) — `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, controlled
   via `value`/`onValueChange`, matching the forwardRef convention every other primitive uses.
   Settings is the third hand-rolled tab bar; this is the third occurrence, which is where
   `general.md` says to extract.
2. **`Table`** (`components/ui/Table.tsx`) — `Table`/`TableHeader`/`TableBody`/`TableRow`/
   `TableHead`/`TableCell`. `BrandRolesTab` and `UserManagementTab` both hand-roll `<table>` with
   duplicated `px-6 py-3` classes. The primitive keeps the `overflow-x-auto` container
   `BrandRolesTab:164` already has — that behaviour is preserved, not new, and `performance.md`
   requires it so the page body never scrolls horizontally.
3. **Export `Pagination`** from `ui/index.ts`.

All three use the existing semantic tokens (`border-border`, `bg-card`, `text-muted-foreground`) and
the `cn` helper at `lib/utils.ts`. No new dependencies.

## Unit B — Settings shell

**Purpose:** one scroll container, one max-width, one owner.

`app/settings/page.tsx` adopts `Tabs` and takes ownership of the scroll container and max-width. Tab
components render **content only** — no `h-full w-full overflow-auto`, no `max-w-*`. This fixes
`BrandRolesTab`'s inability to scroll and resolves the `max-w-2xl` / `max-w-7xl` disagreement.

Max-width: `max-w-5xl`. Profile's `max-w-2xl` is too narrow for the roster table; `UserManagement`'s
`max-w-7xl` is too wide for Profile's field pairs. One value, chosen for the widest content that
must not wrap — the roster's five columns.

The tab list stays hard-coded (`profile | brand-roles | accounts | design`) and ungated. Per
`settings/page.tsx:11-12`, Prepper has no role flags; authority is per-brand and lives in Passport.
No role gating is added here.

## Unit C — Profile tab

**Purpose:** show the user who they are, which org they are in, and what they can do.

Rebuild `UserProfileTab` on `Card`/`PageHeader`/`Badge`. Structure:

1. **Account** — username, email, phone. Read-only, as today. `Field()` (:19) becomes a small local
   component or a `Card` row; it does not need to be a shared primitive at one usage.
2. **Organisation** — *new*. The active org's name, the user's org role from `access.org_role`, and
   an org switcher affordance only if they have more than one org (linking to the `TopNav` control,
   not duplicating it). This is the "Org info" from the original report.
3. **Your brands** — the existing `brands.filter(b => b.my_role !== null)` list (:42), grouped under
   the active org, each brand's role as a `Badge` rather than bare text.
4. **Footer** — keep "Brands, outlets and roles are managed in Passport." It is correct and it is
   the answer to the question the screen provokes.

`timeAgo()` (:8) stays local — it has one caller.

**New data need:** the user's org role is not exposed over HTTP today. `access.org_role`
(`access.py:247`) exists but no endpoint returns it. Unit 6 of the isolation spec adds
`GET /passport/organizations`; that response gains a `my_org_role` field rather than adding a
second endpoint.

## Unit D — Brand Roles tab

**Purpose:** same behaviour, built on primitives, with the one genuinely misleading thing made
visible.

Rebuild `BrandRolesTab` on `Select`/`Button`/`Table`/`Badge`.

**Preserve deliberately** — each of these encodes a hard-won correctness property:

- The **`assignable` memo** (:54-61) filtering out people who already hold a role at the selected
  brand, avoiding a pointless 409.
- The **empty-brands explainer** (:75). A 403 from Passport is a normal outcome, not an error state.
- **No optimistic updates** (`usePassportRoles.ts:51-58`). The write goes to Passport and echoes
  back via sync; applying locally would make Prepper the source of truth for a row it does not own.
  Mutations invalidate; they do not patch the cache.
- The **error banner** (:99) surfacing Passport's message verbatim via `errorMessage()`. Passport's
  message is more accurate than anything Prepper could synthesise.

**Promote from comment to UI copy** — the doc block at :14-27 explains the org-Owner "ladder": org
Owners and Admins hold Manager at **every** brand with **no row in the table**. So an empty roster
does not mean nobody has access. This is the single most misleading thing about the screen and it is
currently explained only to whoever reads the source. It becomes visible copy near the roster.

**Org scoping.** `BrandRolesTab` currently unions brands across every org the caller belongs to.
Under the isolation spec's Unit 4b, the `directory.*` functions narrow to the active org, so the tab
shows the active org's brands only and the "Org role" column becomes meaningful rather than
ambiguous. **This requires no change in the tab** — it follows from the API narrowing. Listed here
only so the behaviour change is not mistaken for a regression during review.

**File size.** `BrandRolesTab` at 238 lines is within `performance.md`'s 500-line limit. Moving to
primitives should shrink it. If the rebuild approaches the limit, extract the assign bar
(`AssignBrandRoleBar`) as its own component — it has clear boundaries already (three selects, one
button, one mutation).

## Testing

Per `testing.md`, frontend verification is `npm run build` (type checking) and `npm run lint`. Both
must pass. There is no frontend test runner in this repo, so the checks are:

- `npm run build` — types clean, including the new primitives' props.
- `npm run lint` — no new warnings.
- **Manual pass**, since no automated coverage exists for these screens:
  - Settings tabs switch; each tab scrolls with long content — specifically `BrandRolesTab`, the
    bug this fixes.
  - Profile shows org name and org role; a single-org user sees no switcher affordance.
  - Brand Roles: assign, change and remove a role each round-trip and reflect after invalidation.
  - Brand Roles with zero brands shows the explainer, not an error.
  - The org-Owner ladder copy is visible when the roster is empty.
- No `any` per `frontend.md`; primitives are typed like their neighbours.

## Risks

**No automated frontend coverage.** These screens have none today and this spec adds none — a test
runner is out of scope. The rebuild is verified by types, lint, and a manual pass. The mitigation is
that behaviour is deliberately unchanged: every preserved property above is called out precisely so
a reviewer can check it survived.

**The `assignable` memo and the no-optimistic-update rule are easy to lose in a rewrite.** Both look
like omissions rather than decisions. They are called out in Unit D for exactly this reason.

**`max-w-5xl` is a judgement call.** If the roster table proves cramped, the shell's max-width is a
one-line change; it is not load-bearing.

## Open questions

None. This spec is fully specified and can be planned as-is once Unit 6 of the isolation spec lands
`GET /passport/organizations` with `my_org_role`.
