# Plan: Google Calendar busy-import (Tier 2)

> Status: **planning only — nothing active.** Tier 1 (one-way export via the iCal
> subscribe feed, "Sync to calendar") is built and live. This is the next tier:
> reading the trainer's Google Calendar so the scheduler won't double-book them against
> personal events. It requires Google OAuth, which is a real (one-time) setup.

## Goal
A trainer connects their Google Calendar; the scheduler then treats their Google
**busy** times as unavailable, so open availability / bookings won't land on top of
personal events.

## Why this needs OAuth (and what that entails)
Reading someone's calendar requires their authorization. One-time setup (yours, since it's
your Google account):
- A **Google Cloud project** + **OAuth 2.0 Web client** (client id/secret) + redirect URI.
- An **OAuth consent screen**. Calendar scopes are "sensitive/restricted," so for
  production Google requires **app verification** (can take days to weeks). In testing
  mode it works immediately for a small allowlist of accounts — fine for dev and a pilot.
- **Recommend the narrowest scope:** `https://www.googleapis.com/auth/calendar.freebusy`
  (or `calendar.readonly` if freebusy alone is insufficient). FreeBusy returns only
  busy/free intervals — **no event titles/details** — which is better for privacy *and*
  eases verification.

## Decisions to confirm before building
1. **Scope:** FreeBusy-only (recommended — busy blocks, no details) vs full read.
2. **Which calendars:** primary only (simplest) vs let the trainer pick multiple.
3. **Look-ahead window:** how far forward to check (e.g. 60–90 days) + cache TTL.
4. **Granularity:** block any overlapping busy time, or only events marked "busy"
   (ignore "free"/transparent events)?

## Data model
**User (trainer)** — `firebelly-server/models/user.js`:
- `googleCalendar: { refreshToken (encrypted at rest), connectedEmail, calendarIds: [String],
  connectedAt, syncEnabled }`.
- Store the **refresh token encrypted** (e.g. AES via a server-side key in env); never
  expose it client-side or in the JWT.

## Backend (`controllers/googleCalendarController.js`, `routes/...`)
- `GET /integrations/google/connect` → build the Google consent URL (`access_type=offline`,
  `prompt=consent` to guarantee a refresh token) and redirect/return it. Trainer-only.
- `GET /integrations/google/callback` → exchange the code for tokens, store the encrypted
  refresh token + connected email, redirect back to the app.
- `GET /integrations/google/status` → `{ connected, email, syncEnabled }`.
- `POST /integrations/google/disconnect` → revoke + clear stored tokens.
- Use the **`googleapis`** (or `google-auth-library`) SDK; it handles refresh using the
  stored refresh token + client secret.

### Where busy-times plug in
The scheduler already computes availability and checks conflicts (e.g. `request_booking`'s
conflict query, and the slot/availability generation in `scheduleController`). Add a step
that, for the trainer + window, calls Google **FreeBusy** and subtracts busy intervals:
- A helper `getGoogleBusy(trainerId, from, to) -> [{start, end}]` (returns `[]` if not
  connected / on any error — **never block native scheduling if Google is down**).
- Apply it when generating open slots and as an extra guard in the booking conflict check.
- **Short-term cache** per trainer+window (e.g. 1–5 min) to avoid hammering the API.

## Frontend
- In **Billing/Scheduling preferences** (or a new "Integrations" panel): a "Connect Google
  Calendar" button (→ consent), a connected state (email + disconnect), and a "block my
  Google busy times" toggle.
- Optionally surface busy blocks visually on the trainer's calendar view as non-bookable.

## Security & privacy
- FreeBusy scope keeps event details private; explain that to trainers.
- Refresh token encrypted at rest; client secret + encryption key in env only.
- Provide disconnect/revoke; handle token revocation (`invalid_grant`) by marking
  disconnected and notifying the trainer to reconnect.
- Per-environment OAuth clients (separate dev/prod redirect URIs).

## Testing
- Google OAuth **testing mode** with allowlisted test accounts (no verification needed).
- Verify: connect → busy event in Google hides that slot in Firebelly; disconnect → slots
  return; Google API error/timeout → native scheduling unaffected; token refresh after the
  access token expires; multi-calendar selection (if enabled).

## Phasing
- **G1 — Connect:** OAuth connect/callback/status/disconnect + Integrations UI. (No
  scheduling changes yet.)
- **G2 — Apply busy times:** FreeBusy helper wired into availability generation + booking
  conflict checks, with caching + fail-open. **This is the core value.**
- **G3 (optional later):** show busy blocks on the calendar UI; per-calendar selection.

## Explicitly out of scope (Tier 3)
Full two-way sync (writing Firebelly sessions into Google as managed events + push-channel
change handling + conflict resolution) — not recommended; the export feed (Tier 1) +
busy-import (Tier 2) cover the real need.
