# TODO

## Highest Priority

- [ ] Remove or tightly scope `express.static(__dirname)` in `firebelly-server/app.js`.
- [ ] Re-authorize Socket.IO relayed events before broadcasting client-provided workout/account IDs.
- [ ] Add route-level Joi validation to all write endpoints.
- [ ] Add missing backend negative tests for invalid bodies and unauthorized writes.
- [ ] Add client test foundation and scripts.

## Frontend

- [ ] Decompose `Progress.jsx`.
- [ ] Decompose `WorkoutOverview.jsx`.
- [ ] Decompose `GroupDetail.jsx`.
- [ ] Continue reducing `SchedulePage.jsx`.
- [ ] Move remaining API-origin image URL helpers out of UI components where practical.
- [ ] Add regression tests for `src/api/client.js` refresh/retry behavior.

## Backend

- [ ] Audit all route files for validation gaps.
- [ ] Add schema/index audit for hot queries.
- [ ] Change global goal title uniqueness to user-scoped uniqueness if uniqueness is still desired.
- [ ] Replace raw console logging with structured production-safe logging.

## Database

- [ ] Add `Training` indexes for common user/date/template lookups.
- [ ] Review invoice, billing, schedule, and group query indexes against real access patterns.

## Documentation

- [ ] Keep README command examples current after script or port changes.
- [ ] Update `DECISIONS.md` when auth, API, routing, or database patterns change.
- [ ] Update `SESSION_HANDOFF.md` after long-running refactor sessions.
