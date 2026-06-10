# Project Context

## Product

Firebelly Fitness is a personal training platform for trainers, clients, guardians, and groups. It combines workout programming, workout logging, realtime collaboration, scheduling, progress metrics, goals, groups, billing, invoices, and trainer/client relationship management.

## Primary Users

- Trainers: manage clients, workouts, sessions, groups, programs, billing, invoices, and progress.
- Clients: log workouts, review assigned training, track goals and metrics, communicate with trainers.
- Guardians: manage child accounts through scoped consent and delegated access.
- Group members: participate in group programs, messaging, scheduling, and billing flows.

## Major Workflows

- Auth: login, refresh, logout, delegated access, guardian/child access.
- Training: create workouts, update sets, cardio details, comments, templates, history, and realtime sync.
- Schedule: weekly calendar, session types, bookings, availability, billing status, trainer/client visibility.
- Goals and metrics: create goals, log metrics, review client progress, approve trainer-visible metrics.
- Groups/programs: create groups, invite members, assign programs, manage group chat and analytics.
- Billing/invoices: session purchases, ledger entries, invoices, payments, PDFs, email delivery.

## Current Development Priorities

1. Consistent backend validation for every write endpoint.
2. Socket.IO authorization hardening.
3. Remaining frontend decomposition.
4. Client test foundation.
5. Database index and schema audit.

## Non-Goals

- Do not rewrite the entire app at once.
- Do not replace working Redux flows until a feature module can own the behavior safely.
- Do not move auth back to persistent access tokens in `localStorage`.
