# Notifications — plan & taxonomy

Delivery engine (built): `createNotification({userId,type,title,body,link})` → persists +
socket emit + web push. Type-agnostic, so each type below is just a caller (event) or a job
sweep (scheduled). Web push lets these land with the app closed. See the web-push foundation
in services/pushService.js + services/notificationService.js.

## Types

### Event-triggered (one `createNotification` at the trigger point)
| Type | Who | Trigger | Toggleable | Notes |
|---|---|---|---|---|
| CLIENT_WORKOUT_COMPLETED | trainer | workout `complete` flips true | yes | **built** |
| GOAL_MET | client (+trainer?) | goal `achievedDate` set | yes | Goals model already tracks achievement |
| SESSION_CONFIRMED | client | session booked/confirmed | yes | confirmation when a session is set on a day |
| PROGRAM_ASSIGNED | client | trainer assigns a program | yes | |
| SESSIONS_LOW | client + trainer | a session debit leaves the aggregate balance at exactly 1 | no (always-on) | **built**; hooked in billingLedgerService.createEventDebitEntry |
| SESSIONS_OUT | client + trainer | a session debit crosses the balance from positive to <= 0 (ran out) | no (always-on) | **built**; same hook (covers multi-credit jumps over 1) |
| CLIENT_REQUEST | trainer | client sends a trainer request (manage_relationship) | no | **built** |
| TRAINER_REQUEST_ACCEPTED | client | trainer accepts the request (change_relationship_status) | no | **built** |
| SESSION_CANCELLED | other party | a booked session is cancelled (cancel_schedule_event / update_schedule_event) | no | **built** |
| SESSION_DECLINED | client | trainer declines a still-REQUESTED session | no | **built** (cancel of a REQUESTED event) |
| SESSION_RESCHEDULED | client | trainer changes a session's start time | no | **built** |
| WORKOUT_COMMENT | client or trainer(s) | a comment is added to a workout | no | **built**; comment-count diff in update_training |
| MESSAGE_RECEIVED | either | new chat message | yes | **depends on messaging system (separate project)** |
| (existing) BOOKING_REQUEST / PACKAGE_REQUEST / INVOICE_PAST_DUE | trainer | already wired | — | |

### Time-scheduled (need a job sweep + per-user timing settings)
| Type | Who | Trigger | Settings it needs |
|---|---|---|---|
| WORKOUT_REMINDER | client | workout-day, at chosen time | reminder time-of-day, opt-in |
| WORKOUT_OVERDUE | client | workout not completed N min/hours after its scheduled start | "how long after start" threshold, opt-in |
| SESSION_REMINDER | client | N hours before a session | "how early" lead time (default ~2h), opt-in |
| MEASUREMENT_REMINDER | client | weekly / monthly / quarterly / custom cadence | cadence + day/time, opt-in |

## Notification settings (design around the full list)
Per-user (JWT-settings pattern: user model + tokenService + allowlist + Joi validator + client):
- **timezone** (required for all scheduled types; capture from browser).
- **Per-type opt-in** toggles (a map: `{ WORKOUT_REMINDER: true, ... }` or individual booleans).
- **Timing controls:**
  - `workoutReminderTime` (HH:MM)
  - `workoutOverdueAfterMinutes` (how long after scheduled start before "overdue")
  - `sessionReminderLeadMinutes` (how early before a session, default 120)
  - `measurementCadence` (WEEKLY/MONTHLY/QUARTERLY/CUSTOM) + day/time
- **Channel prefs** (per type or global): in-app / push / email.
- **Quiet hours** (optional do-not-disturb window).
- **Push enable/subscription** (browser permission + subscription via /push).

## Messaging system — separate mini-project (future)
A full chat system is its own build. It then feeds MESSAGE_RECEIVED notifications. Wishlist
within it: **custom notification sounds per chat** (carried in the push payload → the service
worker / client plays the chosen sound). The notification settings can reserve a "Messages"
section now, but the chat itself is out of scope until tackled separately.

## Phasing
1. **A (done):** workout-completed → trainer + real-time bell.
2. **Web push (in progress):** server foundation done; client service worker + subscribe flow next.
3. **Settings + timezone:** the schema above (opt-ins + timing) via the JWT pattern.
4. **Scheduled jobs:** workout reminder/overdue, session reminder, measurement reminder
   (setInterval sweeps like pastDueJob, honoring per-user timezone + timing settings).
5. **Event types:** GOAL_MET, SESSION_CONFIRMED, PROGRAM_ASSIGNED (cheap hooks).
6. **Messaging** (separate project) → MESSAGE_RECEIVED + custom sounds.
