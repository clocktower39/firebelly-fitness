# Firebelly Scheduler — Strategy & Blueprint

*Competitive analysis, best-practice synthesis, and an opinionated blueprint for the Firebelly Fitness scheduler.*
*Author: design/architecture pass. Competitive detail reflects product knowledge as of early 2026 — archetypes are stable; verify any specific platform feature before quoting externally.*

---

## The one-sentence thesis

Firebelly is a **hybrid facility**: 1:1 appointments (personal training) **and** capacity-based classes (cheer/stunting, group, open gym) **and** staff shifts. The single most important architectural decision is to build **one calendar with two booking primitives** — **Appointments** (availability-driven, 1:1) and **Classes** (capacity-driven, roster + waitlist) — surfaced through **role-aware views**, not two bolted-together systems. Everything below serves that thesis.

---

# PHASE 1 — Competitive Analysis

Each platform is a archetype. The lesson is the *design decision*, not the feature.

### Mindbody — "the studio marketplace OS"
- **Philosophy:** be the system of record for a studio AND a consumer discovery marketplace. Class-first.
- **Audience:** boutique studios, gyms, spas; consumers browsing classes.
- **Strengths:** mature class roster + capacity + waitlist + auto-promote; consumer app drives discovery/bookings; deep reporting; payments/packages/memberships baked in.
- **Weaknesses:** heavy, dated admin UX; steep learning curve; over-featured for a single facility; the marketplace can disintermediate the brand.
- **Fast because:** class templates + recurring schedules mean a week is set up once; one-tap book/waitlist for members. **Why it works:** classes repeat — templating removes 90% of repetitive entry.
- **Friction:** admin setup is a forest of settings; mobile admin is weaker than consumer.
- **Patterns worth copying:** **waitlist auto-promotion with a response window**, **capacity “7/12” indicators everywhere**, **class templates → recurring instances**, **membership/credit awareness at booking time** (Firebelly already does session-credit checks — keep it).

### Zen Planner — "the box/martial-arts membership engine"
- **Philosophy:** membership + attendance + retention for gyms/dojos/affiliates.
- **Audience:** CrossFit boxes, martial arts, climbing.
- **Strengths:** strong attendance/belt/skill tracking, automations, billing, staff payroll tie-ins.
- **Weaknesses:** scheduling UI is functional, not delightful; mobile is secondary.
- **Patterns worth copying:** **attendance as a first-class retention signal** (who's slipping), **skill/belt progression tied to the calendar** — directly relevant to **cheer/stunting skill tracking**.

### Wodify — "the box performance + check-in app"
- **Philosophy:** in-gym experience — check in, see the workout, log performance, track PRs.
- **Audience:** CrossFit/functional-fitness boxes.
- **Strengths:** frictionless **kiosk/self check-in**, performance/PR logging, leaderboards, class roster on a wall display.
- **Weaknesses:** narrow to the box model; less suited to 1:1 appointments.
- **Patterns worth copying:** **one-tap check-in (kiosk + coach roster tap)**, **the roster as the primary in-class screen** (coach taps names present), **attendance = tap, not a form**. This is the gold standard for *attendance speed*.

### Google Calendar — "the universal grid"
- **Philosophy:** a neutral, fast, direct-manipulation time grid.
- **Audience:** everyone.
- **Strengths:** the **drag-and-drop** benchmark — drag to move, edge-drag to resize, drag-to-create; instant week/day/month/agenda switching; keyboard shortcuts; superb performance.
- **Weaknesses:** no domain concepts (no capacity, roster, waitlist, packages).
- **Patterns worth copying:** **the interaction model itself** — direct manipulation, snap, keyboard nav, the 4 canonical views. Firebelly's calendar should *feel* this fluid. (We've started: drag-to-create exists; drag-to-reschedule is in flight.)

### Calendly — "frictionless 1:1 booking"
- **Philosophy:** eliminate the back-and-forth of scheduling an appointment. Availability in, booked slot out.
- **Audience:** anyone booking 1:1 time (sales, coaching, PT).
- **Strengths:** **availability rules** (working hours, buffers, min-notice, daily caps), a **público booking link**, timezone handling, reminders, reschedule/cancel self-service.
- **Weaknesses:** no classes/capacity/rosters; not an ops tool.
- **Patterns worth copying:** **availability-as-rules (not hand-drawn slots)**, **the booking link** (Firebelly has `/public/sessions/:trainerId` — lean into it), **self-serve reschedule within policy**, **automatic buffers**. For PT, Calendly is the model.

### Wellhub (Gympass) — "the corporate-benefit aggregator"
- **Philosophy:** demand aggregation — route corporate-benefit members into partner facilities' classes.
- **Audience:** enterprises + their employees; facilities as supply.
- **Strengths:** discovery + check-in for benefit members; fills off-peak capacity.
- **Weaknesses:** you're a line item in someone else's app; little control of the experience.
- **Patterns worth copying:** **mostly N/A for a single facility** — the lesson is *don't* build a marketplace. The one transferable idea: **member-facing discovery** ("what can I do today?") matters; surface a clean, filterable public/member class list.

### Motion — "AI auto-scheduling of your day"
- **Philosophy:** tasks + meetings auto-arranged into an optimal day; the calendar plans itself.
- **Audience:** busy knowledge workers/managers.
- **Strengths:** **auto-scheduling**, conflict resolution, focus-time protection, a clean daily plan.
- **Weaknesses:** opinionated/automated in ways ops staff may not want for a shared facility schedule.
- **Patterns worth copying:** **for the coach's *own* day** — auto-arrange a coach's sessions + admin time + protect prep/travel buffers. A "**My Day**" auto-built view for coaches is a differentiator no fitness tool nails.

### Sunsama — "the calm, intentional daily planner"
- **Philosophy:** deliberate daily planning; one focused day at a time; calm UX.
- **Audience:** individuals who want intention over density.
- **Strengths:** **best-in-class Day/Agenda view**, gentle pacing, daily shutdown/review ritual, drag tasks onto time.
- **Weaknesses:** single-user; not multi-resource ops.
- **Patterns worth copying:** **the Day/Agenda experience for mobile coaches** — a calm, scannable "here's your day, in order," with the next session always obvious. This is exactly what a coach wants on their phone between sessions.

---

# PHASE 2 — Firebelly Context (by role)

Firebelly = PT + cheer/stunting + group classes + open gym + staff scheduling + athletes + parents/guardians + attendance + capacity + waitlists. Mobile coaches & parents; desktop admins/front-desk.

| Role | Primary device | Top job-to-be-done | What they need from the scheduler |
|---|---|---|---|
| **Front desk** | Desktop (+ tablet kiosk) | Check people in, book/move sessions, handle walk-ins | Fast roster check-in, drag-to-move, see capacity/waitlist at a glance, book in <15s |
| **Coaches** | Mobile | "What's my day? Who's coming? Mark attendance." | A calm **My Day** agenda, one-tap check-in/roster, see athlete notes, claim open slots |
| **Athletes** (teens) | Mobile | See my classes, book open gym, know where to be | Dead-simple "my schedule," one-tap book/cancel within policy |
| **Parents/Guardians** | Mobile | Manage *my kids'* schedules, book classes, get reminders | Multi-child view, capacity-aware booking + waitlist, reliable reminders, easy reschedule |
| **Administrators** | Desktop | Build the week, manage staff/capacity, see attendance/$$ | Class templates + recurrence, staff assignment, capacity rules, attendance + revenue reporting |

**Key Firebelly-specific truths:**
- **Parents book for athletes** — the booking model must support a guardian acting on behalf of one or more children (Firebelly already has delegated/guardian access — the scheduler must respect it natively).
- **Cheer/stunting = recurring teams + skill progression + safety ratios** (coach:athlete) — capacity isn't just a number, it's a *ratio/safety* constraint.
- **Open gym = capacity + waiver/check-in**, low-touch.
- **Coaches are mobile-first and time-poor** — every coach action must be ≤2 taps.

---

# PHASE 3 — Best-in-Class, Ranked

| Capability | 1st (winner) | Why it wins | Runner-up |
|---|---|---|---|
| **Day view** | Sunsama | Calm, ordered, "next thing obvious" — ideal mobile coach view | Motion |
| **Week view** | Google Calendar | Fast grid, drag, density without clutter | Calendly (avail overlay) |
| **Month view** | Google Calendar | Honest overview + drag across days | Mindbody |
| **Agenda/list view** | Sunsama / Motion | Scannable, mobile-perfect | Calendly |
| **Booking appointments** | Calendly | Availability rules → zero back-and-forth | Acuity-style |
| **Booking classes** | Mindbody | Capacity + roster + waitlist + credits at booking | Wodify |
| **Mobile scheduling** | Calendly (book) + Wodify (in-gym) | Each owns its moment | Mindbody app |
| **Drag-and-drop editing** | Google Calendar | The benchmark: move/resize/create | Motion |
| **Availability management** | Calendly | Rules > hand-drawn slots (buffers, caps, min-notice) | Motion |
| **Waitlists** | Mindbody | Auto-promote + response window | Zen Planner |
| **Capacity indicators** | Wodify / Mindbody | "7/12" everywhere; never overbook | Zen Planner |
| **Staff scheduling** | Zen Planner / Mindbody | Assign staff, payroll-aware | (dedicated tools beat all) |
| **Attendance tracking** | Wodify | Tap-to-check-in roster + kiosk | Zen Planner |
| **Schedule discovery** | Mindbody | "What can I do today?" filterable | Wellhub |
| **Notifications** | Calendly | Reliable reminders + reschedule links | Mindbody |

**Synthesis:** Firebelly should feel like **Google Calendar's interaction model + Calendly's appointment availability + Mindbody's class roster/waitlist/capacity + Wodify's tap-to-check-in + Sunsama's mobile Day view.** Explicitly **not** a marketplace (Mindbody/Wellhub) and **not** fully auto-scheduled (Motion) for the shared facility grid — though Motion-style auto-planning is a great *coach's-own-day* future feature.

---

# PHASE 4 — The Firebelly Scheduler We Should Build

## Information architecture

Two booking primitives, one calendar:
- **Appointment** — 1:1 (PT). Created from **coach availability**. Capacity = 1. Self-serve bookable via availability rules + booking link.
- **Class** — many:1 (cheer, group, open gym). Created from a **class template** + recurrence. Has **capacity**, **roster**, **waitlist**, optional **coach:athlete ratio**.
- **Shift** — staff working time (admin view), the supply that backs appointments/classes.

Everything else (attendance, billing, notifications) hangs off these three.

## Navigation structure

- **Top-level "Schedule"** with a **view switcher: Day · Week · Month · Agenda** (segmented control; Day default on mobile, Week default on desktop).
- **Scope switcher** (who/what am I looking at): *My schedule* / *A coach* / *A class/program* / *Whole facility* (role-gated).
- **Primary actions** always reachable: **+ New** (Appointment | Class | Shift | Block time) and **Today**.

## Screen hierarchy

1. **Schedule (home)** → the calendar in the chosen view.
2. **Event detail** → a popover for quick actions; a full sheet only for deep edits.
3. **Class roster / check-in** → the in-class operational screen (tap attendance).
4. **Availability** → coach availability rules (not hand-drawn).
5. **Templates & recurrence** → admin builds the repeating week once.
6. **Reporting** → attendance, utilization, revenue.

## Calendar hierarchy

- **Month** = overview + jump + drag-across-days (admin/planning).
- **Week** = the desktop workhorse (grid, drag, capacity chips).
- **Day** = mobile default + front-desk "today" (timeline + check-in).
- **Agenda** = the coach/parent mobile list ("my next things").

## Core user flows (target interaction cost)

- **Parent books a class for a child:** open Agenda → "Book" → pick class (capacity shown) → confirm. *3 taps; auto-waitlist if full.*
- **Coach checks in a class:** open My Day → tap class → tap names present. *2 taps + N.*
- **Front desk reschedules:** Week view → **drag** the event. *1 gesture.*
- **Admin builds the week:** create class template → set recurrence → done. *Once per term.*
- **Athlete books open gym:** Agenda → "Open gym" → time → confirm. *3 taps.*

## Mobile-first considerations
- **Day/Agenda default**; the 7-column week is desktop-only (no horizontal-scroll grid on phones).
- Every coach/parent action ≤2 taps; primary CTA in the **thumb zone**.
- Roster check-in optimized for one-handed tapping; large targets.
- Offline-tolerant check-in (gyms have dead zones) — optimistic, sync later.

## Desktop considerations
- Week grid with **drag-to-move/resize/create**, keyboard nav, multi-resource columns (coaches/rooms side by side).
- Bulk ops: copy week, duplicate class, assign coach to many.
- Reporting dashboards.

## Feature tiers by ROI

**Must-have (the product doesn't work without these)**
- One calendar, two primitives (Appointment/Class) + Day/Week/Agenda views
- Class capacity + roster + **waitlist with auto-promote**
- **Tap-to-check-in attendance** (roster + kiosk)
- Coach **availability rules** + self-serve appointment booking (+ booking link)
- Parent/guardian **multi-child booking** respecting delegated access
- Reliable **reminders** (class tomorrow / session in 2h) + self-serve reschedule within policy
- Drag-to-reschedule (desktop)

**High-impact**
- Class **templates + recurrence** (admin builds week once)
- Coach:athlete **ratio/safety capacity** for cheer/stunting
- Capacity indicators ("7/12") everywhere; never silently overbook
- **My Day** coach agenda (Sunsama-style)
- Attendance → **retention signals** (who's slipping)
- Month overview + cross-day drag

**Nice-to-have**
- Kiosk self check-in display; in-gym roster wall view
- Skill/progression tracking tied to cheer classes (Zen Planner lesson)
- Waitlist analytics; utilization heatmap
- Public member discovery ("what's on today")

**Future**
- **Motion-style auto-planning of a coach's own day** (sessions + prep + travel buffers)
- Demand-based suggestions ("open a 5pm slot — it always fills")
- Automated coverage when a coach calls out (suggest substitutes by availability + skill)

---

# PHASE 5 — UI Recommendations (wireframe-level)

For each: Purpose · Benefits · Drawbacks · Complexity · Priority.

### 1. Main Scheduler Screen
- **Layout:** sticky header [Today | ◀ date ▶ | **Day/Week/Month/Agenda** switcher | scope dropdown | **+ New**]; body = calendar; FAB **+** on mobile.
- **Purpose:** one home for all scheduling; instant view/scope switching.
- **Benefits:** no hunting; consistent mental model; thumb-zone CTA.
- **Drawbacks:** view switcher must stay simple, not a settings forest.
- **Complexity:** M · **Priority:** P0.

### 2. Calendar Layout
- **Week (desktop):** time grid, **coach/room columns**, capacity chips on class blocks, drag-to-move/resize/create, "now" line.
- **Day (mobile):** single-column timeline, large blocks, capacity chips, swipe between days.
- **Purpose/Benefits:** density on desktop, clarity on mobile; direct manipulation.
- **Drawbacks:** multi-resource columns add layout complexity.
- **Complexity:** L · **Priority:** P0 (Day/Week), P1 (multi-resource columns).

### 3. Appointment Creation
- **Flow:** **+ New → Appointment** → client (typeahead, multi-child for parents) → type (auto price/duration/credits) → time (from availability, snapped) → confirm. Defaults pre-filled; one screen.
- **Purpose:** book a 1:1 in seconds.
- **Benefits:** session-type defaults remove fields; availability prevents conflicts.
- **Drawbacks:** must handle custom/walk-in clients (already supported).
- **Complexity:** M · **Priority:** P0.

### 4. Class Creation
- **Flow:** **+ New → Class** → template (or new) → coach(es) + room → capacity + ratio → **recurrence** (weekly/term) → publish. Edits offer "this / this + future."
- **Purpose:** build repeating classes once.
- **Benefits:** templates + recurrence kill repetitive entry; ratio enforces safety.
- **Drawbacks:** recurrence + "edit this/future" is genuinely complex — do it right or not at all.
- **Complexity:** L · **Priority:** P0 (single), P1 (recurrence engine).

### 5. Attendance Management
- **Layout:** class → **roster list**, tap a name to toggle present/absent/late; "Check in all"; no-shows flagged; offline-tolerant.
- **Purpose:** mark attendance in seconds, in-gym.
- **Benefits:** tap not form (Wodify); feeds retention + billing.
- **Drawbacks:** needs solid optimistic/offline sync.
- **Complexity:** M · **Priority:** P0.

### 6. Waitlist Management
- **Behavior:** full class → **Join waitlist** (position shown); a spot frees → **auto-promote #1** with a response window, else next; admin can reorder.
- **Purpose:** never lose demand; fill cancellations automatically.
- **Benefits:** zero manual backfill; fairness via position + window.
- **Drawbacks:** notification timing/race conditions need care.
- **Complexity:** M · **Priority:** P1 (high).

### 7. Coach View ("My Day")
- **Layout:** mobile Agenda — ordered list of today's sessions/classes; each row: time, title, **capacity/roster count**, location; tap → roster/check-in; "claim open slot."
- **Purpose:** the coach's single glance between sessions.
- **Benefits:** calm, ordered, ≤2 taps to act (Sunsama/Motion lesson).
- **Drawbacks:** must aggregate appts + classes + shifts cleanly.
- **Complexity:** M · **Priority:** P0.

### 8. Parent View
- **Layout:** **child switcher** (chips) → that child's upcoming + bookable classes (capacity shown); "Book / Join waitlist / Cancel"; family agenda across all children.
- **Purpose:** manage multiple kids without confusion.
- **Benefits:** respects guardian access; capacity-aware; reminders reduce no-shows.
- **Drawbacks:** multi-child + policy (cancel windows) edge cases.
- **Complexity:** M · **Priority:** P0.

### 9. Mobile View (cross-cutting)
- **Default Day/Agenda**, bottom-thumb CTA, big targets, swipe between days, no 7-col grid.
- **Purpose:** the device most coaches/parents/athletes actually use.
- **Complexity:** M · **Priority:** P0.

### 10. Admin View
- **Layout:** desktop Week with **multi-resource columns**, template/recurrence manager, capacity/ratio rules, staff assignment, **reporting** (attendance, utilization, revenue).
- **Purpose:** run the facility.
- **Benefits:** build-once week; visibility into $$ and fill rates.
- **Drawbacks:** power features must stay out of coach/parent views.
- **Complexity:** L · **Priority:** P1.

---

# PHASE 6 — Simplification Review

The goal is **fewer clicks, not more features.** Grounded in the current Firebelly scheduler (`features/schedule/`):

**Remove / retire**
- The always-on **simultaneous calendar + full table** on one page — make the **table an "Agenda/List" view**, not a permanent second panel. (Reduces scroll + cognitive load.)
- Hand-drawn one-off availability as the *primary* path — replace with **availability rules**; keep drag-to-create as a convenience.
- The **15-field edit dialog as the default click target** — it should be the rare "deep edit," reached via "More," never the first thing you see. (We've started this with the quick-edit popover.)

**Consolidate**
- The three different booking dialogs (selection / trainer-book / edit) into **one Appointment composer** with smart defaults — same component for create and edit.
- **Copy day / copy week / copy event** under one "Duplicate…" action with a target picker (instead of three menu items).
- Status changes scattered across the edit form → **one inline status control** in the popover (done).

**Click reduction**
- **Reschedule = drag** (in flight) — not dialog → date picker → time pickers → save.
- **Check-in = tap a name** — not open → edit → status → save.
- **Book = 3 taps max** with session-type defaults pre-filling price/duration/credits.
- **Week navigation = arrows + visible "Today" + obvious date picker** (date-picker discoverability fixed).

**One-click / one-tap actions to add**
- "Check in all," "Mark no-show," "Message class," "Duplicate to next week," "Promote from waitlist," "Claim open slot."

**Drag-and-drop opportunities**
- Move event (drag), resize event (edge-drag), drag-to-create (exists), drag an athlete from waitlist into a freed roster spot, drag a coach onto a class to assign.

---

# PHASE 7 — Final Deliverable

## 1. Executive summary

Firebelly's scheduler should be **one calendar with two primitives (Appointments + Classes)**, expressed through **Day/Week/Month/Agenda** views, and tuned to the device each role actually uses: **mobile Agenda for coaches/parents/athletes, desktop Week for admins/front-desk.** Borrow the proven models — **Google Calendar's direct manipulation, Calendly's availability-driven appointment booking, Mindbody's class roster/waitlist/capacity, Wodify's tap-to-check-in, Sunsama's calm Day view** — and deliberately **avoid** the marketplace (Mindbody/Wellhub) and full auto-scheduling (Motion) for the shared grid. The current implementation is a capable trainer-centric week calendar; the gaps that matter most are **classes/capacity/waitlists, attendance check-in, parent multi-child booking, availability rules, and a mobile-first Day/Agenda** — in that order. Win by **removing clicks**: drag to reschedule, tap to check in, three-tap booking, and a popover instead of a 15-field form.

## 2. Competitive comparison (condensed)

| Platform | Model | Best at | Firebelly takeaway |
|---|---|---|---|
| Mindbody | Studio + marketplace | Classes, waitlist, capacity, credits | Copy class ops; skip marketplace |
| Zen Planner | Membership/box | Attendance, progression, retention | Skill tracking for cheer; retention signals |
| Wodify | Box experience | Tap check-in, PRs, roster wall | Attendance UX gold standard |
| Google Calendar | Universal grid | Drag/resize, views, speed | The interaction model |
| Calendly | 1:1 booking | Availability rules, booking link | The PT appointment model |
| Wellhub | Aggregator | Corporate demand | Don't build a marketplace |
| Motion | AI auto-schedule | Auto-planning a day | Future: coach's-own-day auto-plan |
| Sunsama | Intentional planner | Day/Agenda calm | The mobile coach view |

## 3. Best-in-class feature matrix
*(See Phase 3 table — winners per capability.)* Headline picks Firebelly should emulate: **Day=Sunsama, Week/Month/DnD=Google, Appointments/Availability/Notifications=Calendly, Classes/Waitlist/Discovery=Mindbody, Attendance/Capacity=Wodify.**

## 4. Firebelly Scheduler blueprint
*(See Phase 4.)* One calendar · Appointment + Class + Shift · Day/Week/Month/Agenda · scope switcher · role-aware (My Day for coaches, multi-child for parents, multi-resource Week for admins) · availability rules + booking link · capacity/roster/waitlist · tap-to-check-in · templates/recurrence.

## 5. Prioritized improvement roadmap

> ROI-ordered. Phase 1 items are the highest value-per-effort *and* mostly build on what exists today.

### PHASE 1 — Highest ROI (make today's scheduler faster + mobile-real)
- **Mobile Day/Agenda view** (Day default on phones; retire the horizontal-scroll week on mobile).
- **Tap-to-check-in attendance** on a roster (works for PT no-shows too).
- **Finish drag-to-reschedule** + quick-edit popover (in flight) and ship the click-reduction quick-wins.
- **Coach "My Day"** agenda.
- **Reasoning:** these slash interaction cost for the most-active, most-mobile users (coaches) with mostly front-end work on existing data.
- **Expected impact:** dramatically faster daily ops; fewer no-shows (visible attendance); the app finally feels right on a phone.

### PHASE 2 — Classes as a first-class primitive
- **Class entity**: capacity + roster + **waitlist (auto-promote)** + coach:athlete ratio.
- **Class templates + weekly/term recurrence**.
- **Capacity indicators** ("7/12") across all views.
- **Reasoning:** cheer/stunting/group/open-gym are core to Firebelly and the current model is appointment-centric. This unlocks the actual business.
- **Expected impact:** Firebelly can run classes natively; admins build the week once; no overbooking; demand captured via waitlist.

### PHASE 3 — Self-serve + families + availability
- **Coach availability rules** (working hours, buffers, min-notice, caps) + **public booking link** (extend `/public/sessions`).
- **Parent multi-child booking** respecting delegated/guardian access; family agenda.
- **Reliable notifications** (reminders, waitlist promotion, reschedule links) + self-serve reschedule within policy.
- **Reasoning:** moves booking load off staff onto members/parents, safely; fills the calendar without phone tag.
- **Expected impact:** fewer front-desk bookings, fewer no-shows, happier parents, higher utilization.

### PHASE 4 — Future enhancements
- **Motion-style auto-planning of a coach's own day** (sessions + prep + travel buffers).
- **Coverage automation** when a coach calls out (suggest substitutes by availability + skill).
- **Demand suggestions** ("open a 5pm slot — it always fills"); utilization heatmaps.
- **Skill/progression tracking** tied to cheer classes; **kiosk/wall roster** displays.

---

## Opinionated bottom line
Don't rebuild the scheduler as a clone of Mindbody. Build the **calendar Firebelly's coaches and parents will actually use on their phones**: one calendar, two primitives, four views, ruthless click-reduction, classes + attendance + waitlists as the business core, and self-serve booking for families. Ship Phase 1 on top of the current code now; treat Phase 2 (Classes) as the real product investment.
