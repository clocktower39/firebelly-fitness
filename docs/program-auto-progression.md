# Program auto-progression (v1)

## Goal
Stop hand-building every week of a multi-week program. Let the trainer define one base
week, then **auto-generate the later weeks with progressively heavier/harder goals**.

## What v1 does
In the Program Builder, an **"Auto-progress"** action (next to "Copy Week") fills every week
**after a chosen base week** with a progressed copy of that base week:
- **Weight / week** — `+X lb` or `+X%`.
- **Reps / week** — `+Y` reps (applied to min/max/exact rep goals).
- Progression is **cumulative from the base week**: week N = base + `(N − base) × increment`
  (percent compounds), weight rounded to the nearest 0.5 lb. Idempotent — re-running
  regenerates the later weeks from the base.

## How it works (reuses the copy engine)
- **Server:** `copy_workout_by_id` (`controllers/training/workoutOperations.js`) now accepts
  a `progression` rule and applies it to the copied workout's per-set goal arrays via a new
  `applyProgression(training, { weight:{amount,mode}, reps:{amount} })` helper. No new
  endpoint, no validator change (the route is unvalidated). Verified end-to-end:
  +5 lb/+1 rep → 105 / 9–11; +10% → 110; no-progression leaves goals untouched.
- **Client:** `workoutApi.copyWorkoutById` passes `progression`; `ProgramBuilder` loops the
  target weeks, copies each base-week workout (`option: "copyGoalOnly"`) with the cumulative
  rule, and assigns the new template to the target day slot. Copied workouts are independent
  templates (the base week is unaffected).

## Deliberately deferred
- **"Advance the exercise"** — swapping to a harder variant needs an exercise-progression
  graph (which exercise → which) on the Exercise model; not built yet.
- **Double progression** (add reps to top of range, then add weight and reset) — needs the
  rep range semantics; v1 is straight linear increments.
- **Feedback-driven autoregulation** — the per-circuit difficulty signal (see
  `workout-circuit-feedback.md`) isn't wired in yet. Next step: bias the per-exercise
  increment by last cycle's difficulty (too easy → bigger jump, too hard → hold/deload)
  instead of a flat rule. The `applyProgression` engine is the place that consumes it.

## Files
- `firebelly-server/controllers/training/workoutOperations.js` (`applyProgression` + hook)
- `firebelly-client/src/api/workoutApi.js` (`progression` param)
- `firebelly-client/src/Pages/AppPages/ProgramBuilder.jsx` (Auto-progress dialog + handler)
