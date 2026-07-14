# Plan 14: Lark Integration for Tasting Session Invitations

## Problem Statement

Prepper currently notifies tasting session participants via Email (SendGrid) and SMS (Twilio), but the team primarily communicates through **Lark** (all users are in the same Lark org). Participants miss or overlook email/SMS invitations because Lark is their primary workspace. Adding Lark as a notification channel will improve invitation visibility, reduce no-shows, and meet users where they already work. Additionally, participants currently have no prompt to save tasting session events to their calendar, leading to missed sessions.

## Goals

1. **Lark message delivery**: Every tasting session invitation reaches participants as a Lark direct message alongside existing Email and SMS channels
2. **Zero-friction setup**: `@larksuiteoapi/node-sdk` handles tenant token generation and caching automatically — no manual token lifecycle needed
3. **Graceful degradation**: If Lark credentials are not configured or the API is unreachable, invitations still send via Email and SMS without error
4. **Calendar awareness**: Participants receive a calendar reminder prompt within the Lark message so they can add the event to their own calendar
5. **Observability**: API response includes `lark_count` so the frontend can report how many Lark messages were sent

## Non-Goals

- **Automatic calendar event creation** (Part 3 is a text recommendation only — no Lark Calendar API integration)
- **Lark group chat messaging** (messages are 1:1 DMs only, identified by email)
- **Two-way Lark interaction** (no bot commands, no reply handling, no event subscriptions)
- **Lark user provisioning** (all users are assumed to already exist in the same Lark org)
- **Rich card messages** (text-only messages matching SMS format; rich Lark card templates are a future enhancement)

## User Stories

1. **As a session creator**, I want tasting invitations to also be sent via Lark so that participants see the invite in their primary communication tool
2. **As a tasting participant**, I want to receive a Lark DM with the session details (name, date, location, link) so that I can quickly review and join
3. **As a tasting participant**, I want the Lark message to suggest I add the event to my calendar so that I don't forget about the session
4. **As an admin**, I want the system to silently skip Lark messages if Lark is not configured so that Email/SMS delivery is never blocked

## Requirements

### Part 1: Lark Bot Setup & SDK Installation (P0)

The `@larksuiteoapi/node-sdk` handles tenant token generation, caching, and refresh automatically. No manual token lifecycle management is needed — the SDK is initialized server-side in the API route with `appId` and `appSecret`, same pattern as Twilio.

#### 1.1 Install Lark SDK
- [x] Add `@larksuiteoapi/node-sdk` to `frontend/package.json`

#### 1.2 Environment Configuration
- [x] Add `LARK_APP_ID` and `LARK_APP_SECRET` to `frontend/.env.example`
- [x] These are **server-side only** env vars (no `NEXT_PUBLIC_` prefix) — used exclusively in Next.js API routes
- [ ] (Manual) Create Lark app at open.larksuite.com, enable `im:message` permission, deploy bot to org

**Acceptance Criteria (Part 1):**
- Given `@larksuiteoapi/node-sdk` is installed, then the package is available for import in Next.js API routes
- Given `LARK_APP_ID` and `LARK_APP_SECRET` env vars exist in `.env.example`, then developers know what to configure
- No frontend state changes, no token API route, no login/logout hooks needed — SDK manages tokens internally

---

### Part 2: Lark Message Integration (P0)

#### 2.1 Lark Messaging in Invitation API Route
- [ ] In `frontend/src/app/api/send-tasting-invitation/route.ts`:
  - After building `smsText`, build the Lark message text (identical content to SMS + calendar recommendation from Part 3)
  - If `LARK_APP_ID` and `LARK_APP_SECRET` env vars are configured:
    - Initialize Lark client server-side: `new lark.Client({ appId, appSecret, appType: lark.AppType.SelfBuild, domain: lark.Domain.Lark })`
    - For each recipient, send a Lark DM using `client.im.message.create`:
      ```
      params: { receive_id_type: 'email' }
      data: {
        receive_id: recipient.email,
        msg_type: 'text',
        content: JSON.stringify({ text: larkMessageText })
      }
      ```
    - SDK handles tenant token automatically — no manual token management
    - Wrap in try/catch — failure does **not** block Email/SMS delivery
  - Track `larkCount` for successfully queued Lark messages
  - Add Lark sends to the `sendPromises` array for parallel execution with Email and SMS

#### 2.2 Update Response
- [ ] Add `lark_count` to the API response JSON: `{ success, message, email_count, sms_count, lark_count, recipient_count }`
- [ ] Update the `summary` array to include Lark: `"3 Lark message(s)"`
- [ ] Update `SendTastingInvitationResponse` in `useSendTastingInvitation.ts` to include `lark_count?: number`
- [ ] Update the "past session" early-return to include `lark_count: 0`

**Acceptance Criteria (Part 2):**
- Given `LARK_APP_ID` and `LARK_APP_SECRET` are configured, when invitations are sent, then each recipient receives a Lark DM with session details
- Given Lark env vars are NOT configured, when invitations are sent, then Email and SMS are sent normally with `lark_count: 0`
- Given the Lark API returns an error for one recipient, when invitations are sent, then other recipients' Lark messages and all Email/SMS still succeed
- Given invitations are sent successfully via all channels, then the response includes accurate `email_count`, `sms_count`, and `lark_count`
- Given the toast message displays after sending, then it shows the combined count (e.g., "Invitations sent via 3 email(s), 2 SMS, and 3 Lark message(s)")

---

### Part 3: Add-to-Calendar Applink in Lark Message (P1)

#### 3.1 Lark Calendar Applink URL
- [x] In `frontend/src/app/api/send-tasting-invitation/route.ts`, build a Lark Calendar applink URL:
  - URL: `https://applink.larksuite.com/client/calendar/event/create`
  - `startTime`: session date as Unix timestamp (seconds)
  - `endTime`: startTime + 1 hour (3600 seconds)
  - `summary`: URL-encoded "Tasting: {session_name}"
- [x] Clicking the link opens Lark's calendar event creation page with pre-filled data — the user confirms to add it to their own calendar
- [x] No server-side Calendar API calls needed — purely a client-side deep link

#### 3.2 Calendar Link in Lark DM
- [x] Append the applink to the Lark message text:
  ```
  You're invited to a tasting session: "Session Name" on Monday, March 10, 2026, 10:00 AM at Main Kitchen. Join here: https://app.example.com/tastings/invite/42

  📅 Add to your Lark Calendar: https://applink.larksuite.com/client/calendar/event/create?startTime=1741564800&endTime=1741568400&summary=Tasting%3A%20Session%20Name
  ```

**Acceptance Criteria (Part 3):**
- Given a Lark message is sent, then the message includes a clickable applink to create a calendar event
- Given a user clicks the applink, then Lark opens the calendar event creation page with session name and time pre-filled
- Given a session has no location, then the applink still works (location is not included in the URL)
- No additional Lark bot permissions needed beyond `im:message`

---

## Implementation Plan

### Step 1: SDK Installation & Environment (Part 1)
1. Install `@larksuiteoapi/node-sdk`: `npm install @larksuiteoapi/node-sdk` in `frontend/`
2. Add `LARK_APP_ID` and `LARK_APP_SECRET` to `frontend/.env.example`

### Step 2: Invitation API Integration (Part 2)
1. Initialize Lark client server-side in `send-tasting-invitation/route.ts` using env vars
2. Build Lark message text (SMS text + calendar reminder)
3. Add Lark sending logic — SDK handles token automatically
4. Add `lark_count` to response
5. Update `useSendTastingInvitation.ts` response types

### Step 3: Add-to-Calendar Applink (Part 3)
1. Build Lark Calendar applink URL with `startTime`, `endTime`, `summary` query params
2. Append the clickable link to the Lark DM text

---

## Files to Modify

| File | Change | Part |
|------|--------|------|
| `frontend/.env.example` | Add `LARK_APP_ID`, `LARK_APP_SECRET` | 1 |
| `frontend/package.json` | Add `@larksuiteoapi/node-sdk` dependency | 1 |
| `frontend/src/app/api/send-tasting-invitation/route.ts` | Add Lark client init + messaging logic + `lark_count` response | 2 |
| `frontend/src/lib/hooks/useSendTastingInvitation.ts` | Add `lark_count` to response type | 2 |

---

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `LARK_APP_ID` | `frontend/.env` | Lark app ID from open.larksuite.com |
| `LARK_APP_SECRET` | `frontend/.env` | Lark app secret from open.larksuite.com |

---

## API Reference

### Lark Send Message (via SDK)
```typescript
import * as lark from '@larksuiteoapi/node-sdk';

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Lark,
});

// SDK handles tenant token generation + caching automatically
await client.im.message.create({
  params: { receive_id_type: 'email' },
  data: {
    receive_id: 'user@example.com',
    msg_type: 'text',
    content: JSON.stringify({ text: 'Your message here' }),
  },
});
```

---

## E2E Testing Plan

### Test Environment Setup
- Use Lark sandbox/test app credentials (separate from production)
- Tests should be runnable with `LARK_APP_ID` and `LARK_APP_SECRET` env vars set
- When env vars are not set, Lark-specific tests should be skipped (not fail)

### Part 1 Tests: SDK & Environment Setup

#### 1.1 SDK Available for Import
```
Scenario: @larksuiteoapi/node-sdk is installed and importable
  Given the package is installed in frontend/
  When the send-tasting-invitation route imports lark from '@larksuiteoapi/node-sdk'
  Then the import resolves without error
  And lark.Client, lark.AppType, and lark.Domain are available
```

#### 1.2 Environment Variables Documented
```
Scenario: .env.example includes Lark config
  Given a developer clones the repo
  When they check frontend/.env.example
  Then LARK_APP_ID and LARK_APP_SECRET are listed with placeholder values
```

### Part 2 Tests: Lark Message Sending

#### 2.1 Lark Messages Sent When Configured
```
Scenario: Lark DMs are sent to all recipients
  Given LARK_APP_ID and LARK_APP_SECRET are configured
  And 3 recipients are selected
  When POST /api/send-tasting-invitation is called
  Then 3 Lark DMs are sent (one per recipient email)
  And emails and SMS are also sent
  And response includes lark_count: 3
  And response message mentions "3 Lark message(s)"
```

#### 2.2 Lark Not Configured — Skip Lark
```
Scenario: Lark messages are skipped when env vars not set
  Given LARK_APP_ID and LARK_APP_SECRET are NOT configured
  When POST /api/send-tasting-invitation is called
  Then emails and SMS are sent normally
  And no Lark API calls are made
  And response includes lark_count: 0
```

#### 2.3 Lark API Error — Graceful Degradation
```
Scenario: Email/SMS still sent when Lark API fails
  Given LARK_APP_ID and LARK_APP_SECRET are configured
  But the Lark API returns a 401 or 500 error
  When POST /api/send-tasting-invitation is called
  Then emails and SMS are still sent successfully
  And response includes lark_count: 0
  And error is logged to console
```

#### 2.4 Partial Lark Failure
```
Scenario: Some Lark messages fail, others succeed
  Given 3 recipients, one with an email not registered in Lark
  When POST /api/send-tasting-invitation is called
  Then 2 Lark messages succeed and 1 fails
  And all 3 emails are sent
  And response includes lark_count: 2
```

#### 2.5 Lark Message Content
```
Scenario: Lark message contains correct session details
  Given a tasting session with name "Spring Tasting", date "March 15, 2026 2:00 PM", location "Main Kitchen"
  When the Lark message is sent
  Then message contains: session name, formatted date, location, invite link
  And message ends with a calendar reminder line
```

#### 2.6 Past Session — No Invitations
```
Scenario: No invitations sent for past sessions
  Given a tasting session with a date in the past
  When POST /api/send-tasting-invitation is called
  Then response includes email_count: 0, sms_count: 0, lark_count: 0
  And no API calls are made to SendGrid, Twilio, or Lark
```

#### 2.7 All Channels in Parallel
```
Scenario: Email, SMS, and Lark are sent concurrently
  Given all three channels are configured
  When invitations are sent to recipients with email, phone, and Lark
  Then all three types of messages are dispatched via Promise.all()
  And the total response time is not significantly longer than the slowest channel
```

### Part 3 Tests: Add-to-Calendar Applink

#### 3.1 Applink URL in Lark Message
```
Scenario: Lark message includes a calendar applink
  Given a Lark DM is sent for a tasting session
  When the message text is built
  Then it contains a URL starting with https://applink.larksuite.com/client/calendar/event/create
  And the URL includes startTime matching the session Unix timestamp
  And the URL includes endTime = startTime + 3600
  And the URL includes summary = URL-encoded "Tasting: {session_name}"
```

#### 3.2 Applink Opens Pre-filled Calendar Creation
```
Scenario: Clicking the applink opens Lark calendar with pre-filled data
  Given a recipient clicks the calendar applink in the Lark DM
  Then Lark opens the calendar event creation page
  And the event name and time are pre-filled from the URL parameters
```

#### 3.3 Calendar Link Does Not Affect SMS
```
Scenario: SMS message does NOT include calendar link
  Given the same invitation is sent via SMS and Lark
  When comparing message content
  Then SMS contains only the original format (no calendar line)
  And Lark contains the SMS text plus the calendar applink
```

### Integration Tests (Full Flow)

#### I.1 End-to-End: Create Session with Lark Invitations
```
Scenario: Full flow from session creation to Lark delivery
  Given a logged-in user
  And LARK_APP_ID and LARK_APP_SECRET are configured
  When the user creates a new tasting session with 2 participants
  Then the session is created in the database
  And POST /api/send-tasting-invitation is called
  And 2 emails, N SMS, and 2 Lark messages are sent
  And the user sees a success toast with delivery summary
```

#### I.2 End-to-End: No Lark Config
```
Scenario: Full flow without Lark configuration
  Given Lark env vars are NOT set
  When the user creates a tasting session
  And invitations are sent via Email and SMS only
  And the success toast does not mention Lark
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lark message delivery rate | >95% of recipients receive DM | `lark_count` / total recipients in API responses |
| Invitation channel coverage | 100% of invitations include Lark attempt when configured | Logs showing Lark send attempts per invitation batch |
| Graceful degradation | 0 blocked invitations due to Lark failures | Error logs showing Email/SMS delivery alongside Lark errors |
| Login latency impact | <500ms additional latency from Lark token fetch | Performance monitoring on login flow |

---

## Open Questions

1. ~~**[Engineering]** SDK vs raw fetch?~~ **Resolved: use `@larksuiteoapi/node-sdk`** — handles token generation, caching, and refresh automatically.
2. ~~**[Engineering]** Manual token lifecycle?~~ **Resolved: not needed** — SDK manages tenant token internally.
3. **[Product]** Should the calendar recommendation also be appended to the SMS message, or only Lark? **Recommendation: Lark only** — SMS character limits make it costly, and the SMS already has the essential info.
4. **[Engineering]** Should we verify that a recipient's email exists in Lark before attempting to send, or just let the API fail gracefully? **Recommendation: let it fail gracefully** — the API returns an error for unknown users, and we already handle per-recipient failures.

---

## Timeline Considerations

- **No external dependencies**: all work is frontend-only (Next.js API routes + React state)
- **Lark bot must be created and deployed to the org** before testing — this is a manual admin step
- **Parts 1 & 2 are tightly coupled** and should ship together
- **Part 3 is a minor text change** that can ship with Parts 1 & 2 or independently
