# Plan: Exercise Technique System

> **Status: design / planning only — nothing active.** This documents the architecture and a
> milestone plan so we build it in small, safe, reviewable steps. No production code until approved.

A modular system that lets coaches attach advanced training methods (drop sets, tempo, AMRAP,
rest-pause, RIR, EMOM, …) to any exercise. Techniques are **reusable modifiers**, not hardcoded
builder features. Designed to scale to hundreds of techniques and to feed future AI programming,
analytics, presets, and client education.

---

## 1. Audit of the current workout system (what we're building on)

Four parallel audits (data model, builder UI, client execution, programs/progression). Key facts:

**Data model** (`models/training.js`)
- A workout is a `Training` doc. Strength work is `training: [[ exerciseEntry ]]` — an array of
  **circuits**, each a array of **exercise entries**. Grouping (superset/circuit) is *structural*:
  multiple entries sharing one inner array. There is **no circuit object / no superset flag**.
- An exercise entry = `{ exercise(ref), exerciseType, goals{…}, achieved{…}, feedback{difficulty,comments[]} }`.
- **Sets are positional parallel arrays** (`goals.weight[i]`, `goals.exactReps[i]`, `achieved.reps[i]`),
  not subdocuments. `goals.sets` is just a count.
- **No technique/tempo/RIR/RPE/rest fields exist anywhere** (only Cardio has an `rpe`). The only
  flexible field is a workout-level `cardio: Object`. Convention elsewhere is **strongly-typed
  sub-schemas** (`commentSchema`, `mesocycleSchema`, `circumferenceSchema`).
- `{ minimize: false }` is set; there is **no `schemaVersion` and no migration framework** (one-off
  scripts only). Additive optional fields with safe defaults are the established way to evolve.

**Builder UI** — the "builder" is the `Workout.jsx` page (`/workout/:_id`), which doubles as the
trainer's build/edit UI and the client's logging UI. Draft state is plain `useState` (`localTraining`,
shape `[[exerciseEntry]]`), saved via a single `updateTraining` → `POST /updateTraining`. The
per-exercise card is `Components/TrainingComponents/Exercise.jsx`; per-set inputs are `EditLoader.jsx`
(goals) / `LogLoader.jsx` (achieved). New exercises are seeded in `Workout.jsx:confirmedNewExercise`
and the `addExerciseToWorkout` thunk.

**Client execution/display** — `Exercise.jsx` already renders small chips ("Too easy"/"Too hard")
next to the exercise title (`Exercise.jsx:554-559`) — the exact pattern technique chips reuse. Clean
surfaces: per-exercise chips at the **title row**, per-set markers at the **"Set N:" column**
(`LogLoader.jsx`/`EditLoader.jsx`), circuit-wide labels at the **circuit header** (`SwipeableSet.jsx`).
Because `Exercise.jsx` is shared, anything added shows in both trainer and client views.

**Programs / progression** — programs are skeletons referencing template `Training` docs; generation
(`assign_program`, group `buildWorkoutsForUser`) **copies `template.training` wholesale**, and the
progression engine (`services/progressionEngine.js`) mutates **only `goals.*`** and never strips
sibling fields. So a `technique` field on the exercise entry **survives progression, deload, copy,
and program/group assignment "for free" — provided the schema declares it.**

### Technical debt / the one real leak
- **Mongoose strips undeclared fields on `.save()`.** A technique field MUST be declared on the
  schema or it is silently dropped. (Non-negotiable.)
- **The client goal-preset rebuild is the single place that actively drops sibling data.**
  `exercisePresetUtils.js:buildExercisePresetFromHistory` and `useExerciseGoalPreset.js:applyExerciseHistoryPreset`
  reconstruct an entry from `{exerciseType, goals, achieved}` only. Selecting/changing an exercise or
  applying a history preset would **erase attached techniques** unless taught to carry them. This same
  spot is the natural hook for AI/library-suggested techniques.
- **No structural home for circuit-level techniques** (EMOM-across-a-circuit, superset) — the circuit
  is just an array. That scope is deferred (see §10) and isolated behind the registry's `scope`.

---

## 2. Architecture: techniques as reusable modifiers

Two cleanly separated layers:

```
Technique Registry (definitions)   ──  the catalog: name, category, params schema, display, validation
        │  (referenced by key)
        ▼
Exercise entry .techniques[]        ──  attachments: { key, params, appliesToSets, notes }
```

- **Definitions** = *what a technique is and how to configure/show/validate it.* They live in a
  **registry of declarative data** (param schemas + display *templates* — no functions), canonical on
  the server and served to the client via API, so a future DB-backed registry is a drop-in. Each
  definition declares a typed **param schema** that drives (a) the auto-generated config form, (b) the
  display string, and (c) validation. Adding a technique = adding one registry entry — **no builder,
  display, or DB changes.** That is the "extensible without rewriting" property.

- **Attachments** = *which techniques are applied to a given exercise and how.* Stored on the
  Training exercise entry as `techniques: [{ key, params, appliesToSets, notes }]`. The DB holds only
  the key + the configured values + where it applies — **no per-technique columns, no schema bloat.**

This is the **hybrid "code-typed registry + validated JSON attachment"** model. It keeps the database
clean while allowing every technique to have unique configurable fields.

### Data-model options considered (tradeoffs)

| Option | Verdict |
|---|---|
| **Reusable DB records** (a `TechniqueDefinition` collection) for definitions | Good *later* for coach-authored custom techniques; unnecessary infra now (CRUD, seeding) and the *applied* params still need flexible storage. **Defer to a future milestone; attachment shape is unchanged.** |
| **Configuration objects** (code registry + `{key, params}` attachments) | **Recommended.** Type-safe, versioned, drives form+display+validation; clean DB; AI emits `{key, params}`; analytics query by `key`. |
| **Polymorphic models** (collection/discriminator per technique) | Over-engineered; messy joins; hard to answer "all techniques on this workout." Rejected. |
| **Pure JSON blob** (untyped `Mixed`) | Flexible but no validation/structure → messy, error-prone, poor analytics. Rejected as the *only* mechanism. |
| **Hybrid: code registry (typed) + DB attachment (key + validated `params`)** | **Chosen.** Structure *and* flexibility; params are JSON but validated against the code schema. |

**Recommendation:** code-defined Technique Registry + a `techniques[]` attachment array on the
exercise entry, params validated against the registry. Add a DB-backed registry for custom coach
techniques later (additive; attachment shape never changes).

---

## 3. Data model

**Registry definition (code, not DB)** — illustrative shape:

```js
{
  key: "dropSet",                 // stable id; the analytics + AI + storage key
  name: "Drop Set",
  category: "Set Techniques",     // for grouping in the drawer
  scope: "set",                   // exercise | set | circuit  (drives where it attaches)
  description: "Reduce the load and continue past failure…",
  media: { url: "...", poster: "..." },   // optional, for demos / client education
  params: [
    { name: "drops",     label: "Number of drops",  type: "int",    default: 2,  min: 1, max: 6 },
    { name: "reduction", label: "Percent reduction", type: "int",   default: 20, min: 5, max: 50, unit: "%" },
    { name: "minWeight", label: "Minimum weight",   type: "number", optional: true,        unit: "lb" },
  ],
  display: (p) => `Drop set ×${p.drops} (−${p.reduction}%)`,  // → the chip/line text
  version: 1,
}
```

Param `type` ∈ `int | number | enum | bool | tempo | duration | text`. The form renderer maps each
type to a control (stepper, select, switch, tempo 4-box, mm:ss, …); the validator enforces
`min/max/required/options`. Examples from the brief map directly: Tempo →
`{eccentric, pause, concentric, topPause}`; AMRAP → `{timeLimitSec, targetRPE, failureAllowed}`;
Cluster → `{miniSetReps, intraRestSec, clusters}`.

**Attachment (Mongoose), added to the exercise entry in `models/training.js`:**

```js
const techniqueSchema = new mongoose.Schema({
  key:          { type: String, required: true },           // → registry definition
  scope:        { type: String, enum: ["exercise","set","circuit"], default: "exercise" },
  appliesToSets:{ type: [Number], default: [] },            // empty = whole exercise; else set indices
  params:       { type: mongoose.Schema.Types.Mixed, default: {} }, // validated against the registry
  notes:        { type: String, default: "" },              // coach notes
}, { _id: true });

// inside the exercise entry, alongside goals/achieved/feedback:
techniques: { type: [techniqueSchema], default: [] }
```

- `params` is the only flexible field; it is **validated server-side against the registry** before
  save (and client-side in the form), so it never becomes a junk drawer. `minimize:false` keeps it.
- `appliesToSets` handles "drop set on the last set only" etc.; it is re-normalized when the set count
  changes (hook into `Exercise.jsx:setPropertyCheck`).
- `TRAINING_UPDATE_FIELDS` already whitelists `training` as a unit, so attachments survive edits.

No migration needed: old docs simply have `techniques: []`. Optional `schemaVersion` on the attachment
only if a future param rename requires it (see §8 Versioning).

---

## 4. Coach UX (minimal clicks, enjoyable)

```
Exercise card → "＋ Technique" → Technique Drawer
   ├─ Search bar (fuzzy, all techniques)
   ├─ Favorites + Recently used (per coach, top of the drawer)
   ├─ Category sections (Set · Rep Scheme · Tempo · Execution · Intensity · Density)
   └─ pick → Config panel (auto-generated from param schema)
            ├─ typed fields (steppers / selects / tempo boxes / mm:ss)
            ├─ "Applies to": whole exercise · last set · choose sets
            ├─ coach notes (optional)
            └─ live preview chip  →  Add
```

- The drawer is a bottom sheet on mobile, side drawer on desktop. Two taps to a configured technique
  (open → pick → add with sensible defaults; tweak only if needed).
- Attached techniques render as removable chips on the exercise card. Multiple allowed.
- Favorites + recents are per-coach (small per-user store) — the "minimal clicks at scale" lever.
- The config form is 100% generated from the registry param schema; adding a technique needs zero UI
  work.

---

## 5. Workout display (clean, readable with many techniques)

Reuse the existing chip pattern (`Exercise.jsx:554-559`):

- **Per-exercise:** compact chips next to the title — `Tempo 3-1-X-1` · `RIR 1` · `AMRAP 5:00`.
  Cap at N visible with a "＋k more" expander; tap a chip → details / client-education popover (future).
- **Per-set:** a small marker in the `Set N:` column — e.g. `Drop ×2` on the last set only.
- **Circuit-level (later):** a label in the circuit header — `Superset`, `EMOM 10:00`.

Display text comes from each definition's `display(params)`, so it stays consistent everywhere
(builder preview, trainer view, client view).

---

## 6. Future-proofing (each mapped to this design)

- **AI-generated workouts** — the registry *is* the contract; AI emits `techniques:[{key,params}]`,
  validated against the registry. Same hook that seeds library/preset suggestions.
- **Saved coach presets / personal libraries** — a preset is a saved set of attachments (per-coach
  collection); reuses the attachment shape verbatim.
- **Favorites / recently used** — per-coach store (settings or small collection).
- **Team templates / group assignment** — techniques on template workouts already flow through
  `buildWorkoutsForUser` (opaque copy).
- **Client education popovers + video demos** — `description` + `media` on the definition.
- **Analytics / usage stats** — aggregate on `training.training[][].techniques.key` (stable,
  indexable dimension).
- **Import/export** — attachments are portable `{key, params}` JSON.
- **Versioning** — definitions carry `version`; if a param is renamed/removed, a small registry
  migration maps old attachments forward (and `schemaVersion` is added to the attachment only if
  needed).

**Built in M5:** `GET /techniques` is the live registry/AI contract (definitions + param schemas — an
AI emits attachments as `{key, params}` validated against it); client-education popovers (tap a
technique chip → its description + coach notes); and a technique-usage analytics endpoint
(`GET /techniques/usage`, trainer-scoped across clients, backed by a multikey index on
`training.techniques.key`). Saved presets, import/export, and team-template sharing remain
design-ready — the attachment `{key, params}` shape is already portable and definitions are versioned.

---

## 7. Risks & mitigations

1. **Undeclared schema field dropped on save** → declare `techniqueSchema` on the entry. (Covered by M1.)
2. **Goal-preset rebuild erases techniques** (`exercisePresetUtils.js` / `useExerciseGoalPreset.js`)
   → update both to carry `techniques`; add a regression test. (The #1 integration task.)
3. **Copy modes that rebuild goals** (`WorkoutOptionModal` / `copy_workout_by_id` branches) spread the
   rest of the entry, so techniques survive — **verify each branch with a test.**
4. **`appliesToSets` drift** when set count changes → normalize in `setPropertyCheck`.
5. **Invalid params** → validate against the registry on the server (and client) before save.
6. **Display clutter** → chip cap + expander; keep `display()` terse.
7. **Backward compatibility** → default `[]`; old workouts unaffected.

---

## 8. Implementation milestones (small, independently shippable)

- **M0 — Registry foundation (no UI, no DB).** The shared registry module + param-schema utilities
  (form-field descriptor, `display()`, validator) + a curated starter set (~8–10: Tempo, RIR/RPE,
  Drop Set, Rest-Pause, AMRAP, Rep Goal, Cluster, Myo-Reps, an Execution style, a Pause). Pure,
  unit-tested in isolation. Ships nothing user-visible.
- **M1 — Data model + persistence.** Add `techniqueSchema`/`techniques[]` to `training.js`; Joi pass;
  server-side validation against the registry; seed `techniques: []` in the two creation paths; **fix
  the goal-preset rebuild leak.** Tests: persist, round-trip `update_training`, survive progression /
  autoregulation / each copy mode / program + group assignment / preset rebuild.
- **M2 — Read-only display.** Render technique chips (title row) + per-set markers from stored data,
  in both trainer and client views. Additive, low-risk.
- **M3 — Builder UX.** The "＋ Technique" button + drawer (search, categories, auto-generated config,
  applies-to, preview) writing to `localTraining`. The big UX piece.
- **M4 — Coach quality-of-life.** Favorites + recently used (per coach), coach notes surfacing.
- **M5 — Future hooks.** Analytics indexing, client-education popovers, the AI `{key,params}` contract
  doc, saved presets. Each independent.

Each milestone is built on the test site and deployed only on approval, per our workflow.

---

## 9. Test plan (highlights)

- **Registry (unit):** every definition has a valid param schema; `display()` renders; validator
  enforces min/max/required/options.
- **Persistence (integration):** technique round-trips through `update_training`; survives
  `progressExerciseGoals` / `autoregulateExerciseGoals`; survives each `copy_workout_by_id` mode;
  survives `assign_program` + `buildWorkoutsForUser`; **survives the goal-preset rebuild** (regression).
- **Set logic:** `appliesToSets` stays valid when sets are added/removed.
- **UI:** drawer search/filter; config form generates from schema; invalid input blocked; chips render
  and remove; multiple techniques on one exercise.
- **Back-compat:** a pre-existing workout (no `techniques`) loads and saves unchanged.

---

## 10. Decisions to confirm before M0

1. **Registry in code first** (recommended) vs DB-backed custom techniques now. *Rec: code-first;
   DB-backed custom techniques as a later milestone.*
2. **Scope phase 1 = exercise + set** (covers tempo, RIR, drop set, AMRAP, rest-pause, cluster, myo,
   execution, intensity). **Defer circuit-level** (EMOM-across-a-circuit, superset) to a later
   milestone since the circuit has no object today. *Rec: yes, phase it.*
3. **Starter technique set for M0** — the ~8–10 above, or a different first batch you want.
