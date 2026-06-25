# Plan: Google Calendar busy-import (Tier 2)

> Status: **planning only — nothing active.** Tier 1 (one-way export via the iCal
> subscribe feed, "Sync to calendar") is built and live. This is the next tier:
> reading the trainer's Google Calendar so the scheduler won't double-book them against
> personal events. It requires Google OAuth, which is a real (one-time) setup.
> **v1 decisions are locked (see "Decisions" below); implementation is not started.**

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
- **Decided scope (v1): `https://www.googleapis.com/auth/calendar.freebusy`** — busy/free
  intervals only, **no event titles/details**. Best privacy and avoids the heaviest
  verification. Full `calendar.readonly` is a deferred upgrade (see Decisions #1).

## Decisions (locked for v1)
1. **Scope — FreeBusy only.** One OAuth grant governs what we can read; it can't be
   "FreeBusy for clients, full-read for the trainer." We pull only busy/free, so:
   - **Clients** viewing a trainer's availability see only blocked vs. open slots (no details).
   - **Trainers** see their personal time as **busy blocks** inside Firebelly (no titles);
     their own Firebelly sessions still render in full, and Google itself holds the details.
   - **Why not full read:** `calendar.readonly` is a Google **"restricted" scope** →
     heaviest verification (annual third-party CASA security assessment — slow, can cost
     money). FreeBusy (`auth/calendar.freebusy`) avoids all of that and is all the
     scheduler actually needs.
   - **Upgrade path (deferred):** if showing a trainer their *own* external event titles
     in-app later proves worth it, switch to `calendar.readonly` then and accept the heavier
     verification. Clients would still only ever be shown busy/free.
2. **Calendars — primary only.** The trainer's `primary` Google calendar; needs nothing
   beyond FreeBusy. Multi-calendar selection is deferred — it requires *listing* the
   trainer's calendars (a broader scope that undercuts #1). Keep `calendarIds[]` in the
   model so adding it later is additive.
3. **Window & cache — query the view/booking window; cap ~90 days; cache 2–5 min; fail
   open.** Don't pull a giant fixed range — query FreeBusy only for the window actually
   being shown or booked (tied to how far ahead clients can book, capped ~90 days). Cache
   per trainer+window for ~2–5 min. On any Google error/timeout, **ignore busy-import for
   that request** — native scheduling is never blocked.
4. **Granularity — busy-marked time only.** Block only time Google reports as busy;
   FreeBusy already honors each event's Busy/Free ("transparency") setting, so this is
   inherent. **Refinement (finalize at build):** likely **ignore all-day busy events** so a
   single all-day event doesn't wipe a whole day of bookable slots.

**Display rule (independent of scope):** clients are *only ever* shown busy/free; the
trainer's own Firebelly view shows their Firebelly sessions in full plus Google busy blocks
(titles only if/when the scope is upgraded per #1).

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
