# Plan 13: Tasting Session UX Overhaul

> Based on field observations from Temper's tasting session (6 Mar 2026). Addresses usability gaps in the tasting workflow — from invitations through feedback submission.

---

## 1. Problem Statement

During a live tasting session at Temper, several UX friction points were observed that slow down the feedback loop between tasting and recording. The tasting flow is fast-paced — chefs taste, discuss, then submit feedback after the meal — so the app must minimize cognitive load and provide clear status at a glance. Currently, there's no way to share an invite link, no visual indicator of who has submitted feedback, no loading state during image uploads, and the form state is inconsistent after submission. These gaps cause confusion and reduce trust in the tool during high-pressure service moments.

**Who is affected:** Chefs, kitchen operators, and R&D leads who run tasting sessions (estimated 2-5 sessions/week per active team).

**Cost of not solving:** Feedback gets lost or delayed, users lose confidence in the tool and revert to paper/WhatsApp, reducing the value of the entire tasting workflow.

---

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | Reduce time from "tasting ends" to "all feedback submitted" | Track avg time between session start and last note submission |
| G2 | Increase feedback completion rate per session | % of session participants who submit at least 1 note |
| G3 | Eliminate confusion around form submission state | Zero reports of "I submitted but it didn't save" |
| G4 | Make invitation sharing frictionless | Invitations sent via link copy + Lark (in addition to email/SMS) |
| G5 | Give session creators instant visibility into review progress | Visual completion indicators on session detail page |

---

## 3. Non-Goals

| # | Non-Goal | Why |
|---|----------|-----|
| N1 | Real-time collaborative tasting (live co-editing) | Too complex for v1; current async model works for Temper's workflow |
| N2 | Full Lark app/bot integration | Requires Lark developer account & approval process; v1 will explore API feasibility only |
| N3 | Camera-first capture flow (in-app camera) | Requires native capabilities; current image upload is sufficient for now |
| N4 | Multi-dimensional scoring (taste, portion, presentation as separate axes) | Significant schema change; will spec separately after validating demand |
| N5 | Offline feedback submission | Would require service worker + sync queue; premature for current user base |

---

## 4. User Stories

### Invitation & Sharing

**US-1:** As a session creator, I want to copy an invite link to my clipboard from the session detail page so that I can share it via Lark, WhatsApp, or any messaging tool.

**US-2:** As a session creator, I want to resend invitations to newly added participants so that late additions receive the same invite email/SMS.

**US-3:** As a session creator, I want the invitation email to be visually distinct and branded so that recipients don't confuse it with other automated emails.

### Session Detail Page

**US-4:** As a session creator, I want to see at a glance which recipes have received feedback and which haven't so that I can follow up with participants who haven't responded.

**US-5:** As a session participant, I want to expand/collapse recipe items in the session so that I can focus on the ones I need to review.

**US-6:** As a session participant, I want recipes sorted alphabetically so that I can quickly find a specific dish.

### Feedback Page

**US-7:** As a taster, I want to see the recipe description at the top of the feedback page so that I have context about what I'm reviewing.

**US-8:** As a taster, I want to see a loading indicator when my images are being processed so that I know the upload hasn't failed.

**US-9:** As a taster, I want the feedback form to reset cleanly after submission so that I can immediately submit another note without stale data.

### Improved Feedback Flow (v1.1)

**US-10:** As a taster, I want to give feedback on individual recipes via expandable cards so that I can review and add notes for each dish without navigating away.

**US-11:** As a taster, I want a dedicated "New Feedback" modal so that the creation flow is distinct from the review flow.

---

## 5. Requirements

### Must-Have (P0)

#### P0-1: Copy Invite Link Button
**Page:** `/tastings/[id]/page.tsx`

Add a "Copy Link" button next to the session header that copies the session URL to clipboard with a toast confirmation.

**Acceptance Criteria:**
- [ ] Button visible to session creator and admin users
- [ ] Clicking copies `{origin}/tastings/{id}` to clipboard
- [ ] Toast shows "Link copied!" on success
- [ ] Works on mobile (uses `navigator.clipboard` with fallback)

#### P0-2: Review Completion Status Indicators
**Page:** `/tastings/[id]/page.tsx`

Show per-recipe feedback status in the session recipe list.

**Acceptance Criteria:**
- [ ] Each recipe item shows a check icon if at least 1 tasting note exists for it in this session
- [ ] Unchecked recipes show an empty circle or no icon
- [ ] Count label shows "X/Y reviewed" summary at section header
- [ ] Status updates when navigating back from feedback page (TanStack Query invalidation)

**Backend dependency:** The `GET /tasting-sessions/{id}/notes` endpoint already returns notes per recipe. Frontend can derive status from existing data — no new endpoint needed. If performance is a concern, add a lightweight `GET /tasting-sessions/{id}/stats` field for `recipes_with_feedback_count`.

#### P0-3: Image Upload Loading State
**Page:** `/tastings/[id]/r/[recipeId]/page.tsx`
**Component:** `ImageUploadPreview.tsx`

Show a spinner/progress indicator while images are being uploaded during feedback submission.

**Acceptance Criteria:**
- [ ] When form is submitted with ≥1 image, a loading spinner appears on the submit button
- [ ] Submit button is disabled and shows "Uploading..." text during image processing
- [ ] If upload fails, error toast is shown and form remains editable
- [ ] Spinner appears immediately on submit, not after a delay

#### P0-4: Form State Reset After Submission
**Page:** `/tastings/[id]/r/[recipeId]/page.tsx`

Reset all form fields after successful feedback submission.

**Acceptance Criteria:**
- [ ] After successful note creation, all fields reset to defaults (empty text, no images, no rating, no decision)
- [ ] The "Add Feedback" form collapses after submission
- [ ] Newly submitted note appears in the feedback list immediately
- [ ] If submission fails, form retains all entered data (no data loss)

#### P0-5: Recipe Description on Feedback Page
**Page:** `/tastings/[id]/r/[recipeId]/page.tsx`

Display the recipe description below the recipe name in the header.

**Acceptance Criteria:**
- [ ] Recipe description shown below recipe name in muted/secondary text
- [ ] If description is null/empty, nothing is shown (no "No description" placeholder)
- [ ] Description is read-only, not editable from this page
- [ ] Truncated to 3 lines with "Show more" expand if longer

---

### Nice-to-Have (P1)

#### P1-1: Expandable/Collapsible Recipe Items
**Page:** `/tastings/[id]/page.tsx`

Make recipe items in the session list expandable to show a preview of feedback notes inline.

**Acceptance Criteria:**
- [ ] Each recipe row has a chevron toggle (reuse existing `▶` → `▼` pattern from `FeedbackNoteCard`)
- [ ] Expanded state shows: note count, latest note snippet, latest rating
- [ ] All items collapsed by default
- [ ] Expand/collapse state is local (not persisted)

#### P1-2: Alphabetical Sorting for Recipes
**Page:** `/tastings/[id]/page.tsx`

Add a sort toggle for the recipe list in session detail.

**Acceptance Criteria:**
- [ ] Default sort: order added (current behavior)
- [ ] Toggle to sort alphabetically (A-Z) by recipe name
- [ ] Sort preference persists during the session (local state)
- [ ] Sort applies to both recipes and ingredients lists

#### P1-3: Resend Invitations
**Page:** `/tastings/[id]/page.tsx`

Allow session creators to resend invitations from the detail page.

**Acceptance Criteria:**
- [ ] "Send Invitations" button visible to session creator
- [ ] Sends to all current participants (uses existing `useSendTastingInvitation` hook)
- [ ] Toast confirms "Invitations sent to X participants"
- [ ] Button disabled for past sessions

#### P1-4: Redesigned Invitation Email
**File:** `/frontend/src/app/api/send-tasting-invitation/route.ts`

Improve the email template to be more visually distinct and informative.

**Acceptance Criteria:**
- [ ] Branded header with Prepper logo/name and distinct color scheme
- [ ] Personalized greeting using recipient name (if available from User record)
- [ ] Creator name included ("Invited by {creator_name}")
- [ ] Session notes preview included (if available)
- [ ] Clear, prominent CTA button ("Open Tasting Session")
- [ ] Responsive design tested on major email clients (Gmail, Outlook, Apple Mail)

---

### Future Considerations (P2)

#### P2-1: Lark Integration
Explore Lark Open Platform API for:
- Bot-based session invitations
- Calendar event creation from tasting sessions
- Push notifications for feedback reminders

**Research needed:** Lark developer account setup, bot permissions model, webhook capabilities. Spike estimate: 1-2 days.

#### P2-2: Improved Feedback Flow with Expandable Cards
Replace the current navigate-to-recipe pattern with an in-page feedback experience:
- Dropdown selector for recipe/ingredient
- Expandable cards showing all existing feedback inline
- Modal for new feedback creation

This is a significant UX restructure — requires design mockups and user testing before implementation.

#### P2-3: Multi-Dimensional Scoring
Add structured scoring dimensions beyond the single overall rating:
- Taste (1-5)
- Portion size (1-5)
- Presentation (1-5)

**Schema impact:** New columns on `TastingNote` model. Backward-compatible (nullable fields). Requires backend migration + frontend form update.

#### P2-4: Camera-First Capture Flow
Optimize for the observed workflow: photo first → feedback later.
- Quick-capture mode: open camera, snap, auto-attach to session
- Batch photo upload to session, then assign to recipes
- Consider PWA camera access for mobile

---

## 6. Success Metrics

| Metric | Type | Target | Measurement |
|--------|------|--------|-------------|
| Feedback completion rate | Leading | 80% of participants submit ≥1 note per session (up from ~50% estimated) | Count notes / count participants per session |
| Time to complete all feedback | Leading | < 15 min after session ends | Timestamp of last note - session end time |
| Invite link usage | Leading | 30% of sessions use copy-link at least once | Track clipboard copy events (analytics) |
| Form submission errors | Leading | 0 reports of lost feedback | Support tickets + in-app error tracking |
| Tasting feature retention | Lagging | No drop-off in weekly active sessions after changes | Session creation count week-over-week |

---

## 7. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Should review status show per-participant or just per-recipe? (i.e., "2/5 tasters reviewed" vs "reviewed/not reviewed") | Product | No — start with per-recipe binary, upgrade later |
| Q2 | What Lark workspace does Temper use? Need to verify API access and bot creation process. | Engineering | No — P2 item |
| Q3 | Should the improved feedback flow (P2-2 expandable cards) replace navigation entirely or be an alternative view? | Design | No — P2 item, needs mockups |
| Q4 | Are there email deliverability issues (spam folder)? Or is it purely a visual recognition problem? | Product | No — can address template first |
| Q5 | Should multi-dimensional scores (taste/portion/presentation) be configurable per session or fixed? | Product | No — P2 item |

---

## 8. Implementation Sequence

### Phase 1 — Quick Wins (P0)
All frontend-only changes. No backend modifications needed.

| # | Change | File(s) | Estimate |
|---|--------|---------|----------|
| P0-1 | Copy invite link button | `tastings/[id]/page.tsx` | Small |
| P0-2 | Review completion indicators | `tastings/[id]/page.tsx` | Medium |
| P0-3 | Image upload loading state | `ImageUploadPreview.tsx`, `tastings/[id]/r/[recipeId]/page.tsx` | Small |
| P0-4 | Form state reset | `tastings/[id]/r/[recipeId]/page.tsx` | Small |
| P0-5 | Recipe description on feedback page | `tastings/[id]/r/[recipeId]/page.tsx` | Small |

### Phase 2 — Enhancements (P1)
Mix of frontend and minor backend work.

| # | Change | File(s) | Estimate |
|---|--------|---------|----------|
| P1-1 | Expandable recipe items | `tastings/[id]/page.tsx` | Medium |
| P1-2 | Alphabetical sorting | `tastings/[id]/page.tsx` | Small |
| P1-3 | Resend invitations | `tastings/[id]/page.tsx` | Small |
| P1-4 | Email template redesign | `api/send-tasting-invitation/route.ts` | Medium |

### Phase 3 — Future (P2)
Requires research spikes and design work before implementation.

- P2-1: Lark integration (spike first)
- P2-2: Expandable feedback cards (design mockups first)
- P2-3: Multi-dimensional scoring (schema migration)
- P2-4: Camera-first capture (PWA research)

---

## Files Summary

| File | Changes |
|------|---------|
| `frontend/src/app/tastings/[id]/page.tsx` | Copy link button, review status indicators, expandable items, alphabetical sort, resend invitations |
| `frontend/src/app/tastings/[id]/r/[recipeId]/page.tsx` | Recipe description display, form state reset, image upload loading |
| `frontend/src/components/tasting/ImageUploadPreview.tsx` | Loading spinner during upload |
| `frontend/src/app/api/send-tasting-invitation/route.ts` | Email template redesign |

---

## Verification

1. `cd frontend && npm run lint && npm run build` — no build errors
2. Manual tests:
   - `/tastings/[id]` → verify "Copy Link" button copies URL to clipboard
   - `/tastings/[id]` → verify check/no-check indicators per recipe based on existing notes
   - `/tastings/[id]` → verify expand/collapse on recipe items (P1)
   - `/tastings/[id]` → verify alphabetical sort toggle (P1)
   - `/tastings/[id]/r/[recipeId]` → verify recipe description shown below name
   - `/tastings/[id]/r/[recipeId]` → submit feedback with images → verify spinner shown during upload
   - `/tastings/[id]/r/[recipeId]` → submit feedback → verify form resets to empty state
   - `/tastings/[id]/r/[recipeId]` → submit feedback → verify new note appears in list immediately
3. `cd backend && pytest` — no regressions (no backend changes in Phase 1)
