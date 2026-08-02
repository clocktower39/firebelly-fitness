// Per-exercise progression engine. Given an exercise's classification (equipment +
// movementComplexity + measurementType) and its current goals, produce the next step's
// goals under a scheme. Pure + deterministic; the caller resolves classifications and
// chains steps. See docs/program-progression-roadmap.md.

const BARBELL = ["barbell", "ez-bar", "smith machine", "trap bar", "swiss bar", "landmine"];
const DUMBBELL = ["dumbbell", "kettlebell"];
const MACHINE = ["machine", "plate loaded machine"];
const CABLE = ["cable"];
const BODYWEIGHT = [
  "bodyweight", "pull-up bar", "trx", "p-bar", "box", "band", "loop-band",
  "stability ball", "bosu-ball", "ab wheel", "baseblocks", "bench",
];

const familyOf = (equipment) => {
  const eq = (Array.isArray(equipment) ? equipment : [equipment])
    .map((e) => String(e || "").toLowerCase());
  const any = (list) => eq.some((e) => list.includes(e));
  if (any(BARBELL)) return "barbell";
  if (any(DUMBBELL)) return "dumbbell";
  if (any(MACHINE)) return "machine";
  if (any(CABLE)) return "cable";
  if (any(BODYWEIGHT)) return "bodyweight";
  return "other";
};

const loadableUnit = (family) => (family === "machine" ? 10 : 2.5);
const roundToLoadable = (w, family) => {
  const u = loadableUnit(family);
  return Math.max(0, Math.round((Number(w) || 0) / u) * u);
};

// The weight jump for one step: proportional to the current load (ACSM progression band —
// increase ~2-10% when earned; smaller % for isolation, larger for compounds), floored at the
// equipment's smallest practical jump so light loads still move, and rounded loadable. A fixed
// step was too fast at light loads (+5 on a 45 lb lift = 11%) and far too slow at heavy ones
// (+5 on a 365 lb deadlift = 1.4%).
const weightIncrement = (family, complexity, currentWeight) => {
  const w = Number(currentWeight) || 0;
  let floor;
  switch (family) {
    case "barbell":
      floor = complexity === "isolation" ? 2.5 : 5;
      break;
    case "dumbbell":
      floor = w < 40 ? 2.5 : 5; // per hand; gyms carry 2.5s up to ~40
      break;
    case "machine":
      floor = 10;
      break;
    case "cable":
      floor = 2.5;
      break;
    default:
      floor = 5;
  }
  const pct = complexity === "isolation" ? 0.025 : 0.035;
  return Math.max(floor, roundToLoadable(w * pct, family));
};

const clone = (g) => JSON.parse(JSON.stringify(g || {}));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const mapArr = (arr, fn) => (Array.isArray(arr) ? arr.map((v, i) => fn(num(v), i)) : arr);

// One progression step.
const progressOneStep = (goals, ctx, scheme) => {
  const g = goals;
  const fam = familyOf(ctx.equipment);
  const isTime = ctx.measurementType === "time" || ctx.exerciseType === "Time";

  if (isTime) {
    g.seconds = mapArr(g.seconds, (v) => Math.max(0, v + 5));
    return g;
  }
  if (fam === "bodyweight") {
    ["exactReps", "minReps", "maxReps"].forEach((k) => {
      g[k] = mapArr(g[k], (v) => Math.max(0, Math.round(v + 1)));
    });
    return g;
  }
  if (scheme === "percent") {
    g.percent = mapArr(g.percent, (v) => Math.min(100, v + 2.5));
    if (g.oneRepMax) {
      g.weight = mapArr(g.weight, (_, i) =>
        roundToLoadable((num(g.oneRepMax) * num((g.percent || [])[i])) / 100, fam)
      );
    }
    return g;
  }
  if (scheme === "rep-range") {
    // Planned double progression: +1 rep until the top of the range, then add load and
    // reset reps to the bottom.
    const sets = Math.max(
      (g.weight || []).length,
      (g.exactReps || g.minReps || []).length
    );
    for (let i = 0; i < sets; i += 1) {
      const min = num((g.minReps || [])[i]);
      const max = num((g.maxReps || [])[i]) || num((g.exactReps || [])[i]);
      const cur = (g.exactReps && g.exactReps[i] != null) ? num(g.exactReps[i]) : min;
      if (max && cur < max) {
        if (g.exactReps) g.exactReps[i] = cur + 1;
      } else {
        if (g.weight) {
          g.weight[i] = roundToLoadable(
            num(g.weight[i]) + weightIncrement(fam, ctx.movementComplexity, g.weight[i]),
            fam
          );
        }
        if (g.exactReps) g.exactReps[i] = min || max;
      }
    }
    return g;
  }
  // linear (default): add load, reps fixed.
  g.weight = mapArr(g.weight, (w) =>
    roundToLoadable(w + weightIncrement(fam, ctx.movementComplexity, w), fam)
  );
  return g;
};

// A deload: a lighter recovery week. Cuts intensity ~10% (weight, or seconds for holds, or
// reps for bodyweight) AND roughly halves the sets — deload practice in strength/physique
// sports is a ~1-week block at about half volume with intensity eased 10-20% (Bell et al.).
// Set arrays are sliced from the front, so ramp schemes keep their lightest sets and drop the
// heavy top ones.
const deloadGoals = (goals, ctx, factor = 0.9) => {
  const g = goals;
  const fam = familyOf(ctx.equipment);
  const isTime = ctx.measurementType === "time" || ctx.exerciseType === "Time";
  const sets = Math.floor(Number(g.sets) || 0);
  if (sets > 1) {
    g.sets = Math.max(1, Math.ceil(sets / 2));
    ["minReps", "maxReps", "exactReps", "weight", "percent", "seconds"].forEach((k) => {
      if (Array.isArray(g[k])) g[k] = g[k].slice(0, g.sets);
    });
  }
  if (isTime) {
    g.seconds = mapArr(g.seconds, (v) => Math.max(0, Math.round(v * factor)));
    return g;
  }
  if (fam === "bodyweight") {
    ["exactReps", "minReps", "maxReps"].forEach((k) => {
      g[k] = mapArr(g[k], (v) => Math.max(1, Math.round(v * factor)));
    });
    return g;
  }
  g.weight = mapArr(g.weight, (w) => roundToLoadable(w * factor, fam));
  return g;
};

// Progress an exercise's goals by `step` increments under `scheme`. Chained so per-step
// rules (dumbbell 40lb threshold, rep-range fill) resolve correctly. When `deload` is set,
// a recovery cut is applied after the progression (used for a block's deload week).
const progressExerciseGoals = (
  goals,
  ctx = {},
  { scheme = "linear", step = 1, deload = false } = {}
) => {
  let g = clone(goals);
  const n = Math.max(0, Math.floor(Number(step) || 0));
  for (let s = 0; s < n; s += 1) g = progressOneStep(g, ctx, scheme);
  if (deload) g = deloadGoals(g, ctx);
  return g;
};

// --- Feedback autoregulation (Phase 3) ---

// How the last session went versus its goal, and whether it was actually performed. Uses
// reps when the goal is rep-based, else seconds (holds). repMiss is in reps (drives the
// "missed by 2+" back-off); for time goals it stays 0 and the decision rests on difficulty.
const assessSession = (goals, achieved) => {
  const goalReps =
    (goals.exactReps && goals.exactReps.length && goals.exactReps) ||
    (goals.maxReps && goals.maxReps.length && goals.maxReps) ||
    (goals.minReps && goals.minReps.length && goals.minReps) ||
    [];
  const goalSecs = (goals.seconds && goals.seconds.length && goals.seconds) || [];
  const achReps = (achieved && achieved.reps) || [];
  const achSecs = (achieved && achieved.seconds) || [];
  const achWeight = (achieved && achieved.weight) || [];
  const performed =
    achReps.some((r) => num(r) > 0) ||
    achWeight.some((w) => num(w) > 0) ||
    achSecs.some((s) => num(s) > 0);
  let repMiss = 0;
  let hasGoal = false;
  let completed = true;
  if (goalReps.length) {
    goalReps.forEach((g, i) => {
      const gr = num(g);
      if (!gr) return;
      hasGoal = true;
      const miss = gr - num(achReps[i]);
      repMiss = Math.max(repMiss, miss);
      if (miss > 0) completed = false;
    });
  } else if (goalSecs.length) {
    goalSecs.forEach((g, i) => {
      const gs = num(g);
      if (!gs) return;
      hasGoal = true;
      if (num(achSecs[i]) < gs) completed = false;
    });
  } else {
    completed = false;
  }
  return { performed, repMiss, completed: hasGoal && completed, hasGoal };
};

// Back-off: the session was too hard or missed by 2+. Drop intensity one step and raise the
// rep target ("lower the weight and up the reps"); for holds/bodyweight, ease the target.
const backoffGoals = (goals, ctx) => {
  const g = goals;
  const fam = familyOf(ctx.equipment);
  const isTime = ctx.measurementType === "time" || ctx.exerciseType === "Time";
  if (isTime) {
    g.seconds = mapArr(g.seconds, (v) => Math.max(1, Math.round(v * 0.9)));
    return g;
  }
  if (fam === "bodyweight") {
    ["exactReps", "minReps", "maxReps"].forEach((k) => {
      g[k] = mapArr(g[k], (v) => (num(v) ? Math.max(1, Math.round(v) - 2) : v));
    });
    return g;
  }
  g.weight = mapArr(g.weight, (w) =>
    roundToLoadable(Math.max(0, w - weightIncrement(fam, ctx.movementComplexity, w)), fam)
  );
  ["exactReps", "minReps", "maxReps"].forEach((k) => {
    g[k] = mapArr(g[k], (v) => (num(v) ? Math.max(1, Math.round(v) + 2) : v));
  });
  return g;
};

// Decide next-week goals from how the session actually went + the difficulty feedback
// (0 easy / 1 right / 2 hard). Returns { goals, decision }.
const autoregulateExerciseGoals = (
  goals,
  achieved,
  ctx = {},
  { scheme = "linear", difficulty = 1 } = {}
) => {
  const a = assessSession(goals, achieved);
  // Not actually performed (e.g. a planned week with no logged results): progress normally.
  if (!a.performed) {
    return { goals: progressExerciseGoals(goals, ctx, { scheme, step: 1 }), decision: "progress" };
  }
  const d = Number(difficulty);
  if (d === 2 || a.repMiss >= 2) {
    return { goals: backoffGoals(clone(goals), ctx), decision: "backoff" };
  }
  if (a.completed && d === 0) {
    return { goals: progressExerciseGoals(goals, ctx, { scheme, step: 2 }), decision: "push" };
  }
  if (a.completed) {
    return { goals: progressExerciseGoals(goals, ctx, { scheme, step: 1 }), decision: "progress" };
  }
  // Missed by 1 and not too hard → earned-progression: hold the load and re-attempt.
  return { goals: clone(goals), decision: "hold" };
};

module.exports = {
  familyOf,
  weightIncrement,
  roundToLoadable,
  deloadGoals,
  progressExerciseGoals,
  assessSession,
  backoffGoals,
  autoregulateExerciseGoals,
};
