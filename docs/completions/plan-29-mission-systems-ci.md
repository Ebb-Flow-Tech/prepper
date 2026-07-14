# Plan 29: Mission Systems CI Application

**Status**: ✅ Complete
**Priority**: High
**Scope**: Frontend only — styling/branding. No API, model, service, hook, or behaviour changes.
**Dependencies**: `mission-systems/frontend` plugin v0.3.0 → `apply-mission-systems-ci` skill (bundled styleguide + Satoshi `.woff2` + reference screenshot)
**Owner**: Engineering
**Shipped**: `0.0.50` — 2026-07-14
**Result**: 106 files changed, +1,401 / −1,824 (net **−423 lines**)

---

## Overview

Applied the **Mission Systems product CI** across the entire frontend: Satoshi typeface, a three-tier design-token architecture, the forest-green accent with a strict spend budget, a semantic feedback palette, product-wide sentence case, and the removal of dark mode.

This supersedes the interim brand pass in `0.0.49` (commit `55d0934`), which had adopted forest/Polymath tokens but left the app structurally divergent from the CI: fonts came from a third-party CDN, tokens were a single flat HSL layer, and ~250 hard-coded Tailwind palette colours bypassed the token system entirely.

**Source of truth**: `STYLEGUIDE_MISSION_SYSTEMS.md` (bundled with the skill). Section references below (§) point into it.

---

## Why

The `0.0.49` pass got the *colours* roughly right but not the *system*. Four concrete problems remained:

| Problem | Consequence |
|---|---|
| Polymath served from Adobe Typekit CDN | Third-party render-blocking request; brand font not owned |
| One flat HSL token layer (`--primary: 147 33% 17%`) | No tenant re-skin path, no dark-mode path, and hex scattered as HSL channels |
| ~250 raw Tailwind palette utilities across 46 files | Pages did **not** inherit the tokens — the design system was decorative, not load-bearing |
| `game-card` canvas aesthetic (neon glows, blue/green rarity coding) | Directly violated the accent budget; explicitly preserved in 0.0.49, now removed |

The token tiers are the load-bearing part. Everything else follows from them.

---

## Decisions taken (and why)

| Decision | Rationale |
|---|---|
| **Keep the top-nav shell**; do *not* adopt the CI's canonical 260px side-nav | Scope call by the user. A side-nav rewrite touches every page's height/scroll assumptions. Cost >> benefit for this pass. **This is the main remaining delta from the reference design.** |
| **Drop dark mode entirely** rather than re-point its alias map | Scope call by the user. The CI is light-only; §16 keeps dark mode *re-addable* without touching components. |
| **Rebind existing Tailwind utility names** (`bg-card`, `text-muted-foreground`…) onto tier-2 aliases, instead of renaming classes across the codebase | This is why 106 files inherited the CI without a class-by-class rewrite. It also preserves the tier-2 re-skin path. |
| **Convert `hsl(var(--x))` → `var(--x)`** and store hex in primitives | The styleguide mandates hex in tier 1. Only 7 files used the HSL-channel convention, so conversion was cheap. |
| **Map decorative colour to *neutral*, not to a feedback token** | A colour that carries no state meaning must not be given one. Recolouring the tasting module's purple to (say) info would have invented a state signal that doesn't exist. |
| **Star ratings → accent, not warning/amber** | A rating is a *value*, not a caution state. Amber would have been a false state signal (§3.3: never signal state with colour alone, and never with the wrong colour). |
| **Success ≠ brand accent** | `#1d3a2a` reads as "dark/authoritative", not "healthy". Success has its own legible token `#2f6b46` (§3.3). |

---

## Phase 1: Identity — Satoshi self-hosted

**Where**: `frontend/public/fonts/satoshi/` (new), `src/app/layout.tsx`, `src/app/globals.css`

| Change | Detail |
|---|---|
| Fonts vendored | 5 `.woff2` cuts copied from the skill: Light 300, Regular 400, Italic 400 italic, Medium 500, Bold 700 (§1.1) |
| `@font-face` | Declared in `globals.css` with `font-display: swap`, referencing project paths — never hot-linked from the skill |
| Typekit removed | Deleted the `<link rel="stylesheet" href="https://use.typekit.net/weg5tjh.css">` (Polymath) from `layout.tsx` |
| Manrope removed | Deleted the `next/font/google` Manrope import |
| Geist Mono kept | The one sanctioned second face (§5.4) — scoped to product codes, SKUs, IDs, and log blocks. Never prose or labels. |
| Body weight | **400**, 14px / 1.5. `300` is reserved for ≥24px display moments only (§0.7) |
| Headings | **500**, not 600/700. Hierarchy comes from size + weight on one family (§5.1) |

---

## Phase 2: Token architecture — three tiers

**Where**: `src/app/globals.css` (**720 → 439 lines**)

The core of the change. Components may reference **tier 2 or tier 3 only** — a component reading a raw hex or a `--c-*` primitive is a bug (§2).

### Tier 1 — Primitives (`--c-*`)

The **only** place a hex may appear.

```
--c-green-900: #1d3a2a   /* brand accent — the sole brand colour */
--c-ink-950:   #161512   /* tooltip fill only */
--c-ink-900:   #171717   /* ink        — 17.9:1 */
--c-ink-700:   #55534c   /* muted-deep —  7.7:1 */
--c-ink-500:   #6b6962   /* muted      —  5.5:1 */
--c-ink-300:   #8d8a82   /* faded      —  3.5:1, never body text */
--c-beige-100: #f6f5f1   /* sunken surface */
--c-beige-200: #eef2ef   /* selected surface */
--c-border-input: #807d76 /* control boundary — 4.1:1 */
```

Plus the four feedback hues (text + tint), 8 categorical chart series (§13), and the 4px spacing grid.

### Tier 2 — Semantic aliases

Role → primitive. **This is the layer a tenant or a dark theme re-points** (§16).

`--color-brand-accent`, `--color-text-{primary,secondary,tertiary,disabled,inverse,link}`, `--surface-{base,sunken,raised,overlay,hover,selected,accent,tooltip}`, `--color-feedback-{error,warning,success,info}` (+ `-tint`), `--border-{subtle,default,strong,input,focus}`, `--elevation-{0..3}`, `--color-scrim`.

### Tier 3 — Component tokens + legacy utility bridge

The app already used `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, etc. across 100+ files. Rather than rename every class, those names were **rebound onto tier 2**:

```css
--card:             var(--surface-raised);
--muted-foreground: var(--color-text-secondary);
--border:           var(--border-default);
--input:            var(--border-input);   /* now 1px #807d76, not a hairline */
--primary:          var(--color-brand-accent);
```

then exposed via `@theme inline`.

> **This is the key structural decision.** It is why 106 files inherited the CI without a class-by-class rewrite, and why re-skinning the product — or adding dark mode back — means editing the tier-2 map alone.

### Consequence: HSL convention removed

Tokens now hold **hex**, so `hsl(var(--token))` became invalid. Converted 48 consumer sites across 7 files (`outlets/[id]`, `suppliers/[id]`, `ingredients/[id]`, `OverviewTab`, `design-system`, and 2 others) to plain `var(--token)` / the Tailwind utility.

---

## Phase 3: Accent budget

**Where**: product-wide

Forest `#1d3a2a` is the **only** brand colour, spent solely on four named roles (§4):

1. **Primary action button** — one per view
2. **Active / selected state** — active nav item, checked checkbox/radio, toggle-on track, focus ring
3. **Brand chrome** — user avatar, logo tile
4. *(Not present this pass: the accent-filled hero metric card — no dashboard exists yet)*

Nothing else in the product is green. Charts use the categorical palette (§13), never the accent.

---

## Phase 4: Semantic feedback palette

**Where**: 46 page + feature files

| Role | Text/icon | Tint | Mapped from |
|---|---|---|---|
| `error` | `#9a3b2e` clay | `#fbf1ef` | delete buttons, error banners, archived, loss, allergen "contains" |
| `warning` | `#8a5a1f` ochre | `#f8f1e3` | wastage, "Unsaved", low stock, missing-cost callouts |
| `success` | `#2f6b46` green | `#ebf2ec` | approved, active, profit, reviewed ✓ |
| `info` | `#335a7a` slate | `#eaf0f5` | testing, in-progress, drag-over upload |

**~250 raw Tailwind palette utilities removed** — `red-*`, `green-*`, `blue-*`, `purple-*`, `violet-*`, `amber-*`, `orange-*`, `zinc-*` — remapped **by meaning, not by hue**.

**Decorative colour went neutral**, not recoloured:

- The tasting module's purple theme (wine medallion, ChefHat, panel tints, selected rows) → `bg-muted` / `text-muted-foreground` / `--surface-selected`
- Ingredient/recipe type chips, category chips, supplier-code badges → neutral beige `Badge`
- The blue/green accent bars distinguishing ingredient vs recipe rows → `--border-strong`
- Menu-sketch `is_highlight` rows → `--surface-selected`

---

## Phase 5: `game-card` aesthetic removed

**Where**: `src/app/globals.css` (−330 lines), `src/components/layout/tabs/CanvasTab.tsx`

`0.0.49` explicitly preserved the collectible-card-game styling. It is incompatible with the CI: hard-coded `hsl(210 100% 50%)` blue "ingredient rarity" and `hsl(140 70% 40%)` green "recipe rarity", neon box-shadow glows, rarity dots, dark gradient art panels, and uppercase bold white titles.

Deleted the CSS and rebuilt the consumers on tokens:

- **Staged ingredient/recipe cards** → 12px radius, hairline border, `--elevation-1`, hover `--elevation-2`, sentence-case 14/500 title, neutral `Badge variant="unit"` for the stat chip. `game-card-frame` and `game-card-rarity` decoration divs deleted outright.
- **Drag overlay** → the four near-identical blocks were extracted into a single `DragPreviewCard` (per the "extract on the third occurrence" rule in `.claude/rules/general.md`).
- Ingredients and recipes are now told apart by **label and image**, not by a colour code.

Also removed: `.flow-ui-hover-lift`, `.flow-ui-active-scale`, `.mono-gradient*` — consumers moved to the elevation ramp and native `:active` states.

---

## Phase 6: Component primitives

**Where**: `src/components/ui/` (15 files)

| Component | Change |
|---|---|
| `Button` | 8px radius (no pill buttons in product UI, §9); accent-filled primary; full state set — `hover` / `active` / `focus-visible` / `disabled` / `loading`. **Disabled uses a muted fill + `--color-text-disabled`, never opacity alone** (§10.1). Added `loading` prop (preserves width, sets `aria-busy`). |
| `Badge` | 999px pill, 12px/500, feedback tint + matching text (§12.4). **Dropped the hard-coded `violet-100/violet-700` "unit" variant** → neutral beige pill. |
| `Card` | 12px radius, `--elevation-1`, hover `--elevation-2`. Title 16/500 (was `font-semibold`). |
| `Modal` / `ConfirmModal` | 16px radius, overlay surface, `--elevation-3`, warm `--color-scrim` `rgba(23,23,23,0.32)` replacing `bg-black/50` (§12.6). |
| `Input` / `Textarea` / `Select` / `SearchInput` | **1px `--border-input` (`#807d76`)** — see *Fixed* below. 8px radius, 40px comfortable height, `--color-text-tertiary` placeholder. |
| `Checkbox` | 18px box, 4px radius, **accent fill when checked** (was `blue-500`). |
| `Switch` | 999px track ~36×20, `--border-strong` off / **accent on** (was `blue-500`), 150ms knob slide. |
| `DropdownButton` | 12px radius, overlay surface, `--elevation-2` (§12.7). |
| `EditableCell` | `purple-400` border removed → `border-input` + `focus-visible` ring. |
| `PageHeader` | H1 24/500 `-0.015em` (was `font-bold`). |
| `Skeleton` | Beige shimmer, `aria-hidden`; the global reduced-motion rule neutralises the pulse. |

---

## Phase 7: Sentence case

**Where**: product-wide

Per §0.4 / §7.3, the **only** uppercase text permitted anywhere in the product is the **nav section eyebrow** (`.nav-eyebrow` — 11px/500, `+0.06em`, uppercase, `--color-text-tertiary` grey).

- Removed every other `uppercase` class: canvas table headers, canvas field labels, `RightPanel` group headings, `TastingTab` labels, settings field labels (`USERNAME`, `EMAIL ADDRESS`, `ROLE`…), the login divider.
- De-title-cased ~120 user-visible strings: `"Add New Supplier"` → `"Add supplier"`, `"Account Information"` → `"Account information"`, `"Sign Up"` → `"Sign up"`, `"Selling Price"` → `"Selling price"`.
- **Surviving `uppercase`**: single-letter avatar initials only (intentional, matches the reference).

---

## Phase 8: TopNav

**Where**: `src/components/layout/TopNav.tsx`

Kept the top-nav shell. Applied the CI to it:

- Active item → `--surface-selected` fill + weight 500 + `aria-current="page"` (§7.2)
- Added the forest user avatar (sanctioned brand chrome)
- Nav items → 8px hit area, sentence case, 120ms transitions
- Tooltip → the spec's dark warm fill (`--surface-tooltip`), white 12px text, 6px radius (§12.7)
- Mobile nav items → ≥44px touch targets (§6.2, §15)
- Removed the light/dark logo swap; `"Logout"` → `"Log out"`

---

## Phase 9: Dark mode removed

**Where**: `src/lib/theme.tsx` (deleted), `src/lib/providers.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, + 50 component files

| Removed | Detail |
|---|---|
| `lib/theme.tsx` | `ThemeProvider`, `useTheme`, `localStorage` persistence, system-theme listener — **file deleted** |
| `providers.tsx` | `ThemeProvider` wrapper unwrapped |
| `layout.tsx` | Pre-paint FOUC `<script>`, `suppressHydrationWarning`, `color-scheme: light dark` |
| `globals.css` | The entire `.dark` token map (~80 lines) |
| `tailwind.config.ts` | `darkMode: ['class', '.dark']` |
| Components | **258 now-dead `dark:` utility classes** across 50 files |

> Dark mode remains **re-addable without touching components**: add a second tier-2 alias map under `[data-theme="dark"]` re-pointing surfaces/text/borders to dark primitives (§16). Additive, not a rewrite.

---

## Fixed (bugs surfaced by the migration)

### 1. Unreadable text on the accent fill — **contrast failure**

The brand accent changed from a **light** terracotta to a **dark** forest green. Six controls rendered `text-black` on that fill → black on dark green, effectively illegible.

**Where**: `OverviewTab.tsx` (image-upload FAB, "Add category" button, tasting "Generate" button), the version-tree "Current" pill, the "Owned" badge.
**Fix**: all now use `text-primary-foreground` (white on forest = 12.4:1).

### 2. Input border failed WCAG 1.4.11 — **a11y failure**

Form controls used `border-input` at `rgba(23,23,23,0.16)` ≈ **1.4:1** against white. WCAG 1.4.11 requires **3:1** for a non-text UI boundary, so field edges were not reliably perceivable.

**Fix**: all text inputs, textareas, selects, search inputs and checkboxes now use a **1px `#807d76`** border at **4.1:1** (§3.4). Hairlines are retained for *dividers and card edges*, where the 3:1 rule does not apply — the styleguide is explicit that this tradeoff is intentional.

### 3. Design-system logo swatch invisible

The "logo on dark" swatches rendered the *dark* logo cut on a dark fill after the light/dark image swap was removed. Now reference the existing light logo assets (`Reciperep logo inline light 840x180.png`).

---

## Verification

| Check | Result |
|---|---|
| `npm run build` | ✅ Pass — compiled successfully, 27/27 static pages generated |
| `tsc --noEmit` | ✅ Pass |
| `npm run lint` | ✅ **0 errors** (87 pre-existing warnings, all unused-vars in `lib/hooks/`) |
| Playwright — desktop 1280×800 | ✅ Satoshi resolving, computed weight **400**, 14px base |
| Playwright — mobile 390×844 | ✅ **Zero horizontal overflow** (`scrollWidth === clientWidth`) |
| Visual vs reference screenshot | ✅ Component language matches (buttons, pills, cards, inputs, elevation, type scale). ⚠️ Layout intentionally differs — see *Known gaps*. |

### Compliance greps — all clean across `src/`

```
raw Tailwind palette colors ....... 0
hsl(var(--x)) token syntax ........ 0
dark: utilities ................... 0
game-card CSS ..................... 0
flow-ui-* CSS ..................... 0
bg-black scrims ................... 0
raw shadow-sm|md|lg|xl ............ 0
Adobe Typekit / Polymath / Manrope  0
uppercase (non-eyebrow) ........... 4  ← 2 avatar initials + 2 design-system prose strings
```

---

## Known gaps / follow-ups

| Gap | Detail |
|---|---|
| **No side-nav shell** | The app still uses a top nav. The CI's canonical layout (§7, §17) is a persistent ~260px left side-nav with a workspace switcher, uppercase section eyebrows, and an accent-filled hero metric card. **This is the main remaining delta from the reference design** — a deliberate scope decision, not a defect. |
| **`/design-system` unreachable by URL** | Not registered in `AuthGuard`'s `VALID_ROUTE_PATTERNS`, so a direct visit while logged in redirects to `/settings`. The showcase *is* reachable via **Settings → Design**. Pre-existing; not fixed here. |
| **`CanvasTab.tsx` is 3,179 lines** | ~6× the 500-line limit in `.claude/rules/performance.md`. **15 files exceed the limit** (next worst: `menu-sketch/[id]/page.tsx` 1,859; `lib/api.ts` 1,768). Pre-existing and untouched structurally, but the clearest refactor target. |
| **No hero metric card** | The accent's fourth named role (one accent-filled hero metric per view) is unused because no dashboard exists. Reserve it if/when one is built. |

---

## Files changed (106)

| Area | Count | Notes |
|---|---|---|
| `public/fonts/satoshi/` | 5 | **new** — Satoshi `.woff2` cuts |
| `src/app/globals.css` | 1 | rewritten, 720 → 439 lines |
| `src/app/layout.tsx`, `tailwind.config.ts`, `lib/providers.tsx` | 3 | fonts, darkMode, provider |
| `src/lib/theme.tsx` | 1 | **deleted** |
| `src/components/ui/` | 15 | primitives |
| `src/components/layout/` | 12 | TopNav, RightPanel, TopAppBar, canvas tabs |
| `src/app/**` (pages) | 29 | |
| `src/components/**` (features) | 42 | ingredients, tasting, suppliers, outlets, recipes, admin, settings, menu |
