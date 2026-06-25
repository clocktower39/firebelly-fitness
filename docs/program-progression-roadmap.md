# Program progression & periodization — roadmap

Consolidates the design agreed for smart, per-exercise progression driven by exercise
classification + client feedback, organized into periodized program planning. Supersedes
the flat `program-auto-progression.md` v1 (which applied one rule to every exercise).

## Vision
A trainer builds a periodized plan; the app generates each week's targets with the
**right progression for each exercise** (a barbell squat, a dumbbell curl, a plank, and a
run all progress differently), then **autoregulates** from what the client actually did and
how hard it felt.

---

## 1. Exercise classification (library)
Most of it is already there — we add two cheap attributes, auto-seeded then trainer-reviewed.

- **`equipment`** — already populated on 789/795. Sets the progression *family* + base increment.
- **NEW `movementComplexity`** — `compound` (multi-joint) vs `isolation` (single-joint).
  Drives increment size and a sensible default scheme. Auto-seed by name
  (squat/press/row/lunge/deadlift/pull-up/dip → compound; curl/extension/raise/fly/
  kickback/calf → isolation). First-pass heuristic: ~332 compound, ~250 isolation, ~19
  ambiguous, ~194 "neither" (mostly core + conditioning) → **trainer review screen** fixes
  the rest.
- **NEW `measurementType`** — `reps` (default) / `time` / `distance`. So **isometric holds**
  (plank, hollow, superman, dead hang, wall sit, L-sit) default the workout entry to **Time**,
  not weight+reps. Auto-seed by name (~47 found on first pass).
- Per-exercise **override** for the ~5–10% heuristics miss and any edge cases.
- *(Maybe later:* a `loadableBodyweight` flag — pull-ups/dips can add belt weight, push-ups can't.)*

**Live sync:** test and live exercise docs share `_id`s (the dev copy preserved them), so the
new fields promote to live via a **targeted, field-level write by `_id`** (not a wholesale
overwrite) — run only with explicit confirmation. Build/classify on test → review → promote.

## 2. Increments (planned step per exercise)
| Family | Step |
|---|---|
| Barbell **compound** (incl. Smith/Trap) | +5 lb |
| Barbell **isolation** / EZ-bar | +2.5 lb |
| Dumbbell / Kettlebell *(weight is per hand)* | **+2.5 lb ≤ 40, +5 lb above** |
| Machine / Plate-loaded | +10 lb |
| Cable | +2.5 lb |
| Bodyweight / Band | +1 rep |
| Holds (time) | +5 s |

All computed targets **round to a loadable weight** for that equipment (micro-plates 2.5/1.25
near limits) — never an unloadable number.

## 3. Schemes (per program, override per exercise)
Default reflects how most clients are actually trained here:
- **Linear (default):** fixed reps, +increment weight each step. (Strength athletes.)
- **Rep-range (double progression):** reps climb within min–max, weight jumps at the top.
  (Bodybuilding/shaping clients.)
- **%1RM:** weight = est. 1RM × %; progress by **raising intensity (the %)** on heavy/low-volume
  days. Track an **estimated 1RM** (Epley from weight×reps) to power this + detect stalls/PRs.

## 4. Periodization (program structure)
- **Microcycle = 1 week** (existing week grid).
- **Mesocycle = a 3–6 week block** with a focus (Hypertrophy / Strength / Power / Peak /
  Deload / Base), a scheme, and a **deload** (typically the final week, reduced volume/
  intensity ~10%). The progression engine runs *within* a meso.
- **Macrocycle = the whole plan** — an ordered sequence of mesocycles
  (e.g. 4-wk hypertrophy → 4-wk strength → 3-wk peak).
- Builder UX: stack mesocycles; each auto-generates its weeks + deload; **tooltips teach the
  terms** so clients/trainers learn micro/meso/macro.

## 5. Feedback autoregulation (the 5 affirmed recommendations)
1. **Linear default, double-progression as the *stall fallback*.** When a weight jump is too
   much (missed target by **≥2 reps**), drop back to the prior weight, raise the **rep** target,
   make them earn it, then re-load and reset reps. (The trainer's revert rule, generalized.)
2. **Planned deloads** — at meso ends, or auto-triggered after ~2 failed jumps; ~10% backoff.
3. **Progress only when *earned*** — add weight only if last session hit the reps and wasn't
   "too hard." The weekly plan is the schedule; feedback + achieved is the gate.
4. **Round to real loadable weights** (see §2), incl. micro-loading near limits.
5. **Estimated-1RM tracking** for %1RM days, PR flags, and stall detection.

Inputs: the **per-circuit per-exercise difficulty** (already collected) + achieved-vs-target.

---

## Phased plan
- **Phase 0 — done:** per-circuit, per-exercise difficulty feedback (`workout-circuit-feedback.md`).
- **Phase 1 — Engine + classification:** add `movementComplexity` + `measurementType`
  (auto-seed + review/override UI); per-exercise progression engine (equipment+complexity →
  increment; schemes; round-to-loadable; est-1RM); rebuild program-builder progression to use
  it (replaces the flat v1). Promote classification to live (confirmed).
- **Phase 2 — Periodization + deloads:** mesocycle/macrocycle structure, block types, deloads;
  educational UI.
- **Phase 3 — Autoregulation:** earned-progression gate, stall/revert rule, auto-deloads,
  micro-loading — all feedback-driven.

## Deferred / out of scope here
- **Advance-to-harder-variant** (bodyweight ladders) — needs an exercise-variant graph.
- **Cardio/conditioning** rework (sleds, runs, ropes) — separate cardio effort; some library
  entries (sprints, 100-yard runs) will be removed by the trainer.
