// Reactive load seeding v2: when a client COMPLETES a workout in an assigned program, use what
// they actually achieved — plus their difficulty feedback — to set the recommended loads for
// that same exercise in LATER, not-yet-completed workouts of the SAME program day.
//
// Progression philosophy (modeled on RIR-style autoregulation — RP / Alpha Progression /
// JuggernautAI): an increase must be EARNED twice over, by rep performance and by effort.
//   - Met or beat the target and it "felt right" (or no feedback): HOLD the weight. Only after
//     the client proves the weight on STREAK_TO_EARN consecutive sessions of that day does it
//     step up (the ACSM "2-for-2" progression rule).
//   - Explicit "Too easy" (0) earns an immediate step; "Too easy" while also beating target
//     reps by 2+ earns a double step.
//   - Explicit "Too hard" (2) blocks any increase; missing by 2+ reps eases off a step.
//   - "Rep Range" lifts advance by double progression (reps climb to maxReps before weight
//     moves, then reset to minReps) via the shared progression engine.
//   - %-of-1RM lifts re-derive the 1RM from the load logged at the prescribed % and refill each
//     future week from ITS OWN percent (the periodization ramp stays intact). A hard/failed
//     session never RAISES the stored 1RM.
//   - Timed holds carry the achieved seconds forward (+5s only on an explicit "Too easy" met).
//
// Scoping: full decisions apply only to future docs of the SAME program day (matched by
// programDay, else by title with "Week N" normalized out) — one day's heavy top set must not
// inflate another day's volume work (cross-day contamination). Cross-day, a signal may only
// FILL loads that are still zero/unset, preserving the original "new client starts at 0" fix.
// Non-uniform per-set weights (warm-up ramps to a top set) are scaled proportionally, never
// flattened. holdProgression docs are frozen and never touched.
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const {
  familyOf,
  weightIncrement,
  roundToLoadable,
  progressExerciseGoals,
} = require("./progressionEngine");

const STREAK_TO_EARN = 2; // consecutive met-at-this-weight sessions (incl. current) before a step up

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const exIdOf = (entry) => String(entry?.exercise?._id || entry?.exercise || "");
const setCount = (goals, achieved) =>
  num(goals?.sets) ||
  Math.max(
    (achieved?.weight || []).length,
    (achieved?.reps || []).length,
    (achieved?.seconds || []).length,
    (goals?.weight || []).length,
    1
  );

// Which program day a doc belongs to. Prefer the stamped programDay; otherwise read the day
// ordinal out of the title — "…Week 3, Day 1", "…• Week 5 Day 1 — Strength", "Base · Wk2 D2 …".
// Only the ordinal is stable: generated programs rename every week (block, phase, "(Deload)",
// "Wk2" vs "Week 2"), so comparing normalized titles made each week look like a different day
// and signals never carried forward. Both callers scope their query by programId, so an
// ordinal identifies the day slot unambiguously. Titles with no day marker fall back to the
// old normalized-title behaviour (e.g. a one-day-a-week program simply titled "Week 3").
const dayKeyOf = (doc) => {
  if (doc?.programDay != null) return `day:${doc.programDay}`;
  const ordinal = String(doc?.title || "").match(/\bd(?:ay)?\s*(\d+)\b/i);
  if (ordinal) return `day:${ordinal[1]}`;
  return `title:${String(doc?.title || "").toLowerCase().replace(/week\s*\d+/g, "week").trim()}`;
};

// Explicit effort only — 1 is both the default and "felt right", so it carries no signal.
// null/undefined = unrated (program-created entries store null until tapped): NOT "easy".
const effortOf = (difficulty) => {
  if (difficulty == null || difficulty === "") return null;
  const d = Number(difficulty);
  if (d === 0) return "easy";
  if (d === 2) return "hard";
  return null;
};

// Turn one completed exercise entry into a "signal" describing how future goals should be set.
// `workoutEffort` is the workout-level rating, used as a fallback when the exercise wasn't
// rated. Returns null when there's nothing to learn (e.g. bodyweight move with no logged load).
const analyzeEntry = (entry, workoutEffort = null) => {
  const goals = entry.goals || {};
  const ach = entry.achieved || {};
  const sets = setCount(goals, ach);
  const effort = effortOf(entry.feedback?.difficulty) || workoutEffort || "neutral";

  const percentBased =
    entry.exerciseType === "Reps with %" ||
    (Array.isArray(goals.percent) && goals.percent.some((p) => num(p) > 0));
  const anyAchievedReps = Array.isArray(ach.reps) && ach.reps.some((r) => num(r) > 0);
  const anyAchievedWeight = Array.isArray(ach.weight) && ach.weight.some((w) => num(w) > 0);
  const timeBased =
    !anyAchievedWeight &&
    !anyAchievedReps &&
    (entry.exerciseType === "Time" ||
      (Array.isArray(ach.seconds) && ach.seconds.some((s) => num(s) > 0)));

  if (timeBased) {
    let best = 0;
    (ach.seconds || []).forEach((s) => (best = Math.max(best, num(s))));
    if (best <= 0) return null;
    let hasGoal = false;
    let met = true;
    for (let i = 0; i < sets; i += 1) {
      const gs = num((goals.seconds || [])[i]);
      if (gs <= 0) continue;
      hasGoal = true;
      if (num((ach.seconds || [])[i]) < gs) met = false;
    }
    return { kind: "time", seconds: best, effort, met: hasGoal && met };
  }

  // Top logged set by weight (tie-break on reps).
  let topW = 0;
  let topR = 0;
  let topPct = 0;
  for (let i = 0; i < sets; i += 1) {
    const w = num((ach.weight || [])[i]);
    const r = num((ach.reps || [])[i]);
    if (w > topW || (w === topW && r > topR)) {
      topW = w;
      topR = r;
      topPct = num((goals.percent || [])[i]);
    }
  }
  if (topW <= 0) return null; // no logged load (e.g. bodyweight) — nothing to seed

  // Rep performance vs target: goal reps = exact || max || min.
  const goalReps = (i) =>
    num((goals.exactReps || [])[i]) ||
    num((goals.maxReps || [])[i]) ||
    num((goals.minReps || [])[i]);
  let hasGoal = false;
  let allMet = true;
  let anyBeat2 = false;
  let anyBad = false;
  for (let i = 0; i < sets; i += 1) {
    const gr = goalReps(i);
    if (gr <= 0) continue;
    hasGoal = true;
    const ar = num((ach.reps || [])[i]);
    if (ar < gr) allMet = false;
    if (ar >= gr + 2) anyBeat2 = true;
    if (gr - ar >= 2) anyBad = true;
  }
  const repResult = !hasGoal
    ? "NONE"
    : anyBad
      ? "MISS_BAD"
      : !allMet
        ? "MISS"
        : anyBeat2
          ? "BEAT"
          : "MET";

  if (percentBased && topPct > 0) {
    const derived = Math.round(topW / (topPct / 100));
    const prev = num(goals.oneRepMax);
    // A hard or badly-missed session never raises the stored 1RM.
    const oneRepMax =
      effort === "hard" || repResult === "MISS_BAD" ? Math.min(derived, prev || derived) : derived;
    return { kind: "percent", oneRepMax, effort, repResult };
  }

  return { kind: "weight", topWeight: topW, repResult, effort, goals: clone(goals) };
};

// The core rule table: what a freeform-weight signal does, given the earned-progression streak.
// Modeled on the ACSM 2-for-2 progression rule (increase only after hitting/beating the target
// on consecutive sessions) with explicit effort feedback as the immediate override: "Too easy"
// steps up now, "Too hard" never steps up, and beating the target while ALSO rating it easy
// earns a double step.
const decideWeightAction = (signal, streak = 1) => {
  const { repResult, effort } = signal;
  if (repResult === "MISS_BAD") return { action: "decrease", steps: 1 };
  if (effort === "hard") return { action: "hold", steps: 0 };
  if (effort === "easy" && repResult === "BEAT") return { action: "increase", steps: 2 };
  if (effort === "easy" && repResult === "MET") return { action: "increase", steps: 1 };
  if ((repResult === "BEAT" || repResult === "MET") && streak >= STREAK_TO_EARN) {
    return { action: "increase", steps: 1 };
  }
  return { action: "hold", steps: 0 }; // first met/beat, MISS by 1, or no rep goal: re-attempt
};

// Fill a future entry's per-set weights toward `targetTop`, preserving a non-uniform ramp's
// shape (each set scales by targetTop/currentTop) instead of flattening it.
const fillWeights = (current, sets, targetTop, fam) => {
  const cur = Array.from({ length: sets }, (_, i) => num((current || [])[i]));
  const curTop = Math.max(0, ...cur);
  const uniform = curTop <= 0 || cur.every((v) => v === cur[0]);
  if (uniform) return cur.map(() => String(roundToLoadable(targetTop, fam)));
  return cur.map((v) => String(roundToLoadable((v * targetTop) / curTop, fam)));
};

// Apply a signal to one future exercise entry (mutates entry.goals). `sameDay` gates the full
// decision; cross-day a signal may only fill loads that are still zero/unset. Returns true if
// the entry changed.
const applySignalToEntry = (entry, signal, ctx, { sameDay = true } = {}) => {
  const goals = entry.goals || {};
  const family = familyOf(ctx.equipment);
  const sets = num(goals.sets) || (goals.weight || []).length || 1;
  const fill = (arr, val) => {
    const out = Array.isArray(arr) ? arr.slice(0, sets) : [];
    for (let i = 0; i < sets; i += 1) out[i] = val;
    return out;
  };

  if (signal.kind === "time") {
    const empty = !(goals.seconds || []).some((s) => num(s) > 0);
    if (!sameDay && !empty) return false;
    const target =
      sameDay && signal.effort === "easy" && signal.met ? signal.seconds + 5 : signal.seconds;
    goals.seconds = fill(goals.seconds, String(target));
    return true;
  }

  if (signal.kind === "percent") {
    if (!sameDay && num(goals.oneRepMax) > 0) return false;
    goals.oneRepMax = signal.oneRepMax;
    const pct = goals.percent || [];
    const weight = Array.isArray(goals.weight) ? goals.weight.slice(0, sets) : [];
    for (let i = 0; i < sets; i += 1) {
      // Only sets with a prescribed % re-derive; others keep their existing load.
      if (num(pct[i]) > 0) {
        weight[i] = String(roundToLoadable((signal.oneRepMax * num(pct[i])) / 100, family));
      } else if (weight[i] == null) {
        weight[i] = "0";
      }
    }
    goals.weight = weight;
    return true;
  }

  if (signal.kind === "weight") {
    const empty = !(goals.weight || []).some((w) => num(w) > 0);
    if (!sameDay) {
      if (!empty) return false;
      goals.weight = fill(goals.weight, String(roundToLoadable(signal.topWeight, family)));
      return true;
    }
    const { action, steps } = signal.decision || decideWeightAction(signal);

    // Rep Range on both sides: double progression via the shared engine — reps climb to
    // maxReps before weight moves. The ladder is anchored at what was actually achieved.
    const repRange =
      entry.exerciseType === "Rep Range" &&
      (signal.goals?.maxReps || []).some((r) => num(r) > 0) &&
      (goals.maxReps || []).some((r) => num(r) > 0);
    if (repRange) {
      let base = clone(signal.goals);
      base.weight = (base.weight || []).map(() => String(signal.topWeight));
      if (action === "increase") {
        base = progressExerciseGoals(base, ctx, { scheme: "rep-range", step: steps });
      } else if (action === "decrease") {
        base.weight = base.weight.map((w) =>
          String(
            roundToLoadable(
              Math.max(0, num(w) - weightIncrement(family, ctx.movementComplexity, num(w))),
              family
            )
          )
        );
      }
      const at = (arr, i) => (arr || [])[Math.min(i, Math.max(0, (arr || []).length - 1))];
      const baseTop = base.weight.length ? Math.max(...base.weight.map(num)) : signal.topWeight;
      goals.weight = fillWeights(goals.weight, sets, baseTop, family);
      goals.exactReps = Array.from({ length: sets }, (_, i) =>
        num(at(base.exactReps, i)) ? String(num(at(base.exactReps, i))) : at(goals.exactReps, i)
      );
      return true;
    }

    let w = signal.topWeight;
    if (action === "increase") {
      for (let s = 0; s < steps; s += 1) {
        w = roundToLoadable(w + weightIncrement(family, ctx.movementComplexity, w), family);
      }
    } else if (action === "decrease") {
      w = Math.max(0, w - weightIncrement(family, ctx.movementComplexity, w));
    }
    goals.weight = fillWeights(goals.weight, sets, w, family);
    return true;
  }
  return false;
};

// How many consecutive completed sessions of this program day (most recent first, current
// included) met their rep targets at >= the current top weight without a "Too hard" rating.
const streakFor = (exId, currentTop, priorDocs) => {
  let streak = 1;
  for (const doc of priorDocs) {
    let entry = null;
    (doc.training || []).forEach((c) =>
      (c || []).forEach((e) => {
        if (!e.isWarmup && exIdOf(e) === exId) entry = e; // last occurrence wins
      })
    );
    if (!entry) break;
    const s = analyzeEntry(entry, effortOf(doc.workoutFeedback?.difficulty));
    if (
      s &&
      s.kind === "weight" &&
      (s.repResult === "MET" || s.repResult === "BEAT") &&
      s.effort !== "hard" &&
      s.topWeight >= currentTop - 0.01
    ) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
};

// Main entry. `completed` is the just-completed Training doc (its training[].exercise may be
// populated). Returns the freshly-updated future workout docs (populated) for the client to
// upsert. Best-effort — the caller wraps in try/catch so it never blocks completion.
const applyResultsToFutureProgram = async (completed) => {
  const programId = completed?.programId;
  const clientId = completed?.user?._id || completed?.user;
  if (!programId || !clientId || !Array.isArray(completed.training)) return [];
  const workoutEffort = effortOf(completed.workoutFeedback?.difficulty);
  const completedKey = dayKeyOf(completed);

  // Build one signal per exercise from the completed session (last occurrence wins).
  const signalByExercise = new Map();
  completed.training.forEach((circuit) =>
    (circuit || []).forEach((entry) => {
      if (entry.isWarmup) return; // warm-ups don't seed future loads
      const id = exIdOf(entry);
      if (!id) return;
      const signal = analyzeEntry(entry, workoutEffort);
      if (signal) signalByExercise.set(id, signal);
    })
  );
  if (!signalByExercise.size) return [];

  // Earned progression: a MET without explicit "easy" only steps up once the client has proven
  // the weight on STREAK_TO_EARN consecutive sessions of this day. One history query serves
  // every exercise that needs a streak.
  const needsStreak = [...signalByExercise.values()].some(
    (s) =>
      s.kind === "weight" &&
      (s.repResult === "MET" || s.repResult === "BEAT") &&
      s.effort === "neutral"
  );
  let priorDocs = [];
  if (needsStreak) {
    priorDocs = (
      await Training.find({
        user: clientId,
        programId,
        complete: true,
        date: { $lte: completed.date },
        _id: { $ne: completed._id },
      })
        .sort({ date: -1 })
        .limit(12)
        .lean()
    ).filter((d) => dayKeyOf(d) === completedKey);
  }
  for (const [id, signal] of signalByExercise) {
    if (signal.kind !== "weight") continue;
    const streak =
      (signal.repResult === "MET" || signal.repResult === "BEAT") && signal.effort === "neutral"
        ? streakFor(id, signal.topWeight, priorDocs)
        : 1;
    signal.decision = decideWeightAction(signal, streak);
  }

  // Future, incomplete workouts in the same program. holdProgression docs are frozen: the
  // trainer has pinned their prescribed loads, so completions must never reseed them.
  const future = await Training.find({
    user: clientId,
    programId,
    complete: { $ne: true },
    holdProgression: { $ne: true },
    date: { $gt: completed.date },
  }).lean();
  if (!future.length) return [];

  const ctxById = new Map(
    (
      await Exercise.find({ _id: { $in: [...signalByExercise.keys()] } })
        .select("_id equipment movementComplexity measurementType")
        .lean()
    ).map((l) => [String(l._id), l])
  );

  const ops = [];
  future.forEach((w) => {
    const sameDay = dayKeyOf(w) === completedKey;
    let changed = false;
    (w.training || []).forEach((circuit) =>
      (circuit || []).forEach((entry) => {
        if (entry.isWarmup) return; // never overwrite a warm-up's loads
        const signal = signalByExercise.get(exIdOf(entry));
        if (!signal) return;
        if (applySignalToEntry(entry, signal, ctxById.get(exIdOf(entry)) || {}, { sameDay })) {
          changed = true;
        }
      })
    );
    if (changed) {
      ops.push({ updateOne: { filter: { _id: w._id }, update: { $set: { training: w.training } } } });
    }
  });
  if (!ops.length) return [];

  await Training.bulkWrite(ops);

  const ids = ops.map((o) => o.updateOne.filter._id);
  return Training.find({ _id: { $in: ids } })
    .populate({ path: "training.exercise", model: "Exercise", select: "_id exerciseTitle" })
    .populate({ path: "user", model: "User", select: "_id firstName lastName profilePicture" })
    .lean();
};

module.exports = {
  applyResultsToFutureProgram,
  analyzeEntry,
  applySignalToEntry,
  decideWeightAction,
  dayKeyOf,
  STREAK_TO_EARN,
};
