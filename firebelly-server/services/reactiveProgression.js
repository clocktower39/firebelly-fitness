// Reactive load seeding: when a client COMPLETES a workout in an assigned program, use what
// they actually achieved to fill in the recommended loads for that same exercise in their
// LATER, not-yet-completed workouts in the same program. Fixes the "everything starts at 0 for
// a new client and stays 0" problem, and keeps upcoming weeks responsive to real performance.
//
// Per exercise, three behaviours:
//   - %-of-1RM lifts (exerciseType "Reps with %" / goal has a percent): the load logged at the
//     prescribed % implies a 1RM (weight ÷ %/100). Write that 1RM onto future occurrences and
//     re-derive each future set's weight from ITS OWN percent — so the periodization ramp fills
//     in (later weeks at higher % land heavier).
//   - freeform-weight lifts: carry the logged weight forward, +1 loadable step if the client met
//     or beat the target reps, or ease off a step if they missed by 2+.
//   - timed holds: carry the achieved seconds forward.
// Only future (date >) + incomplete workouts in the SAME program are touched; the engine's
// familyOf/weightIncrement/roundToLoadable give sane, loadable numbers.
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const { familyOf, weightIncrement, roundToLoadable } = require("./progressionEngine");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
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

// Turn one completed exercise entry into a "signal" describing how future goals should be set.
// Returns null when there's nothing to learn (e.g. bodyweight move with no logged load).
const analyzeEntry = (entry) => {
  const goals = entry.goals || {};
  const ach = entry.achieved || {};
  const sets = setCount(goals, ach);

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
    return best > 0 ? { kind: "time", seconds: best } : null;
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

  if (percentBased && topPct > 0) {
    return { kind: "percent", oneRepMax: Math.round(topW / (topPct / 100)) };
  }

  // Freeform weight: did they meet/beat the target reps? goal reps = exact || max || min.
  const goalReps = (i) =>
    num((goals.exactReps || [])[i]) ||
    num((goals.maxReps || [])[i]) ||
    num((goals.minReps || [])[i]);
  let metOrBeat = true;
  let missedBad = false;
  for (let i = 0; i < sets; i += 1) {
    const gr = goalReps(i);
    if (gr <= 0) continue;
    const ar = num((ach.reps || [])[i]);
    if (ar < gr) metOrBeat = false;
    if (gr - ar >= 2) missedBad = true;
  }
  return { kind: "weight", topWeight: topW, metOrBeat, missedBad };
};

// Apply a signal to one future exercise entry (mutates entry.goals). Returns true if changed.
const applySignalToEntry = (entry, signal, ctx) => {
  const goals = entry.goals || {};
  const family = familyOf(ctx.equipment);
  const sets = num(goals.sets) || (goals.weight || []).length || 1;
  const fill = (arr, val) => {
    const out = Array.isArray(arr) ? arr.slice(0, sets) : [];
    for (let i = 0; i < sets; i += 1) out[i] = val;
    return out;
  };

  if (signal.kind === "time") {
    goals.seconds = fill(goals.seconds, String(signal.seconds));
    return true;
  }
  if (signal.kind === "percent") {
    goals.oneRepMax = signal.oneRepMax;
    const pct = goals.percent || [];
    goals.weight = [];
    for (let i = 0; i < sets; i += 1) {
      goals.weight.push(String(roundToLoadable((signal.oneRepMax * num(pct[i])) / 100, family)));
    }
    return true;
  }
  if (signal.kind === "weight") {
    let w = signal.topWeight;
    if (signal.metOrBeat) w += weightIncrement(family, ctx.movementComplexity, w);
    else if (signal.missedBad) w = Math.max(0, w - weightIncrement(family, ctx.movementComplexity, w));
    goals.weight = fill(goals.weight, String(roundToLoadable(w, family)));
    return true;
  }
  return false;
};

// Main entry. `completed` is the just-completed Training doc (its training[].exercise may be
// populated). Returns the freshly-updated future workout docs (populated) for the client to
// upsert. Best-effort — the caller wraps in try/catch so it never blocks completion.
const applyResultsToFutureProgram = async (completed) => {
  const programId = completed?.programId;
  const clientId = completed?.user?._id || completed?.user;
  if (!programId || !clientId || !Array.isArray(completed.training)) return [];

  // Build one signal per exercise from the completed session (last occurrence wins).
  const signalByExercise = new Map();
  completed.training.forEach((circuit) =>
    (circuit || []).forEach((entry) => {
      const id = exIdOf(entry);
      if (!id) return;
      const signal = analyzeEntry(entry);
      if (signal) signalByExercise.set(id, signal);
    })
  );
  if (!signalByExercise.size) return [];

  // Future, incomplete workouts in the same program.
  const future = await Training.find({
    user: clientId,
    programId,
    complete: { $ne: true },
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
    let changed = false;
    (w.training || []).forEach((circuit) =>
      (circuit || []).forEach((entry) => {
        const signal = signalByExercise.get(exIdOf(entry));
        if (!signal) return;
        if (applySignalToEntry(entry, signal, ctxById.get(exIdOf(entry)) || {})) changed = true;
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

module.exports = { applyResultsToFutureProgram, analyzeEntry, applySignalToEntry };
