# Workout feedback: per-circuit, per-exercise check-in

## Problem
Feedback was collected only at the **end** of a workout (one workout-level difficulty +
comments). Most clients never filled it out, and by the end they'd forgotten how earlier
exercises felt. We also need per-exercise difficulty to drive program auto-progression.

## What this adds (client workout player)
A **per-circuit, per-exercise difficulty check-in** rendered at the bottom of each
circuit page in `SwipeableSet` (component: `CircuitFeedback.jsx`). For each exercise the
client taps one of **Too easy / Felt right / Too hard** before swiping to the next circuit
— captured while it's fresh.

- **Default-and-confirm:** every exercise defaults to **"Felt right" (1)**, so a silent
  client still yields usable signal ("standard progression"); they only tap the exceptions.
- Writes into `localTraining[circuit][exercise].feedback.difficulty` (scale 0/1/2 =
  easy/right/hard — the field already existed in the model). Persists via the existing
  `/updateTraining` (the whole `training` array is saved; no server change needed).
- Gated with `allowFeedback={!training.isTemplate}` (threaded Workout → StrengthWorkout-
  Editor → SwipeableSet), so it shows only on real workouts, not while building templates.
- The end-of-workout overall feedback (`workoutFeedback`) is unchanged.

## Trainer surfacing
A small chip on each exercise header (`Exercise.jsx`) shows **only the actionable outliers**
— "Too easy" (0) or "Too hard" (2). Value `1` shows no chip.

Why only 0/2: difficulty defaults to `1`, so `1` is indistinguishable from "unrated" — and
for progression both mean the same thing (standard progression). Surfacing only the flags
keeps the trainer focused on what should change next cycle and avoids false "rated" signals.

## How this feeds auto-progression (next)
The program-builder progression engine will read each exercise's last-cycle difficulty +
achieved-vs-goal:
- **Too easy (0):** larger jump (e.g. +weight, or +reps then +weight).
- **Felt right (1) / unrated:** standard progression.
- **Too hard (2):** hold or deload.

## Files
- `firebelly-client/src/Components/TrainingComponents/CircuitFeedback.jsx` (new)
- `firebelly-client/src/Components/TrainingComponents/SwipeableSet.jsx` (render per circuit)
- `firebelly-client/src/Components/TrainingComponents/Exercise.jsx` (outlier chip)
- `firebelly-client/src/features/workout/components/StrengthWorkoutEditor.jsx` + `Workout.jsx`
  (thread `allowFeedback`)

## Not done yet / follow-ups
- Optional inline "＋ note" per exercise (the `feedback.comments` array already exists).
- RPE as an opt-in advanced scale (deferred).
- The program-builder auto-progression that consumes this signal.
