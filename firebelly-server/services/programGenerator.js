// Phase 2 — rules-based, deterministic draft-program generator.
// Turns a client's Training Block (ranked goals + context + workout split) into a coach-reviewable
// DRAFT program. It NEVER forces a bad choice: missing data → safe fallback + a recorded assumption;
// no confident exercise → a labeled placeholder. Everything the coach must review is captured in
// `generationAssumptions`. No LLM — pure rules.

const TrainingBlock = require("../models/trainingBlock");
const Goal = require("../models/goal");
const User = require("../models/user");
const Exercise = require("../models/exercise");
const Program = require("../models/program");
const Training = require("../models/training");
const Relationship = require("../models/relationship");
const { buildProgramWeeks, mesocycleWeeks, expandMesocycles } = require("./programs");
const { progressExerciseGoals } = require("./progressionEngine");
const { sanitizeTrainingTechniques } = require("./techniqueValidation");

// Each exercise progresses under the scheme implied by its own exerciseType (a workout mixes types).
const schemeForType = (t) =>
  t === "Reps with %" ? "percent" : t === "Rep Range" ? "rep-range" : "linear";

async function progressWorkout(training, { step, deload }) {
  const ids = [];
  training.forEach((c) => c.forEach((e) => e.exercise && ids.push(e.exercise)));
  const libs = await Exercise.find({ _id: { $in: ids } })
    .select("equipment movementComplexity measurementType")
    .lean();
  const map = new Map(libs.map((l) => [String(l._id), l]));
  training.forEach((c) =>
    c.forEach((e) => {
      if (!e.goals) return;
      const lib = map.get(String(e.exercise)) || {};
      e.goals = progressExerciseGoals(
        e.goals,
        { equipment: lib.equipment, movementComplexity: lib.movementComplexity, measurementType: lib.measurementType, exerciseType: e.exerciseType },
        { scheme: schemeForType(e.exerciseType), step, deload }
      );
    })
  );
}

const zeros = (n) => Array.from({ length: n }, () => 0);
const fill = (n, v) => Array.from({ length: n }, () => v);
const round25 = (x) => Math.round(Number(x || 0) / 2.5) * 2.5;

// goalType -> scheme + seed params + mesocycle type. Default = hypertrophy.
const STRATEGY = {
  strength:    { scheme: "percent",   kind: "percent",   sets: 4, reps: 5, percent: 80, meso: "STRENGTH",    label: "4×5 @ ~80%" },
  performance: { scheme: "percent",   kind: "percent",   sets: 4, reps: 5, percent: 80, meso: "POWER",       label: "4×5 @ ~80%" },
  hypertrophy: { scheme: "rep-range", kind: "rep-range", sets: 3, minReps: 8,  maxReps: 12, meso: "HYPERTROPHY", label: "3×8–12" },
  aesthetic:   { scheme: "rep-range", kind: "rep-range", sets: 3, minReps: 8,  maxReps: 12, meso: "HYPERTROPHY", label: "3×8–12" },
  fat_loss:    { scheme: "rep-range", kind: "rep-range", sets: 3, minReps: 10, maxReps: 15, meso: "HYPERTROPHY", label: "3×10–15" },
  health:      { scheme: "rep-range", kind: "rep-range", sets: 3, minReps: 10, maxReps: 15, meso: "HYPERTROPHY", label: "3×10–15" },
  endurance:   { scheme: "rep-range", kind: "rep-range", sets: 3, minReps: 15, maxReps: 20, meso: "BASE",        label: "3×15–20" },
  sport:       { scheme: "rep-range", kind: "rep-range", sets: 3, minReps: 8,  maxReps: 12, meso: "BASE",        label: "3×8–12" },
  skill:       { scheme: "linear",    kind: "reps",      sets: 4, reps: 6, meso: "BASE",  label: "4×6" },
  mobility:    { scheme: "linear",    kind: "time",      sets: 3, seconds: 30, meso: "BASE", label: "3×30s holds" },
};
const DEFAULT_STRATEGY = STRATEGY.hypertrophy;

// Movement-pattern slots for a strength day (muscle strings match the library's freeform vocab; the
// selector falls back if they don't hit).
const STRENGTH_SLOTS = [
  { label: "Squat", muscles: ["Quads", "Quadriceps", "Glutes"] },
  { label: "Hinge", muscles: ["Hamstrings", "Glutes", "Lower Back", "Back"] },
  { label: "Upper push", muscles: ["Chest", "Shoulders", "Triceps"] },
  { label: "Upper pull", muscles: ["Back", "Lats", "Biceps"] },
  { label: "Accessory", muscles: ["Core", "Abs", "Shoulders", "Arms"] },
];
const MAX_STRENGTH_EXERCISES = 5;

// Build a well-formed { exerciseType, goals } for a seed.
function seedGoals(kind, p) {
  const s = p.sets || 3;
  const g = { sets: s, minReps: zeros(s), maxReps: zeros(s), exactReps: zeros(s), weight: zeros(s), percent: zeros(s), seconds: zeros(s), oneRepMax: p.oneRepMax || 0 };
  if (kind === "percent") {
    g.exactReps = fill(s, p.reps || 5);
    g.percent = fill(s, p.percent || 80);
    if (p.oneRepMax) g.weight = fill(s, round25((p.oneRepMax * (p.percent || 80)) / 100));
    return { exerciseType: "Reps with %", goals: g };
  }
  if (kind === "rep-range") {
    g.minReps = fill(s, p.minReps || 8);
    g.maxReps = fill(s, p.maxReps || 12);
    g.exactReps = fill(s, p.minReps || 8); // required for rep-range double-progression to advance
    g.weight = fill(s, round25(p.weight || 0));
    return { exerciseType: "Rep Range", goals: g };
  }
  if (kind === "time") {
    g.seconds = fill(s, p.seconds || 30);
    return { exerciseType: "Time", goals: g };
  }
  g.exactReps = fill(s, p.reps || 8);
  g.weight = fill(s, round25(p.weight || 0));
  return { exerciseType: "Reps", goals: g };
}

function makeEntry(exerciseId, kind, p) {
  const { exerciseType, goals } = seedGoals(kind, p);
  const achieved = { sets: 0, reps: zeros(goals.sets), weight: zeros(goals.sets), percent: zeros(goals.sets), seconds: zeros(goals.sets) };
  return { exercise: exerciseId, exerciseType, goals, achieved, feedback: { difficulty: null, comments: [] }, techniques: [] };
}

// Pick one exercise for a slot with a safe fallback chain. Returns { exercise } or { exercise: null }.
async function selectExercise({ muscles, equipmentAccess, excludeIds, slotLabel, assumptions }) {
  const eq = equipmentAccess && equipmentAccess.length ? { equipment: { $in: equipmentAccess } } : {};
  const notUsed = { _id: { $nin: excludeIds } };
  const muscle = { "muscleGroups.primary": { $in: muscles } };
  const tries = [
    { q: { verified: true, ...muscle, ...eq, ...notUsed }, relax: null },
    { q: { ...muscle, ...eq, ...notUsed }, relax: "unverified" },
    { q: { ...muscle, ...notUsed }, relax: "any-equipment" }, // ignore equipment
    { q: { verified: true, ...eq, ...notUsed }, relax: "any-muscle" }, // ignore muscle match
  ];
  for (const t of tries) {
    const found = await Exercise.find(t.q).limit(12).lean();
    if (found.length) {
      found.sort((a, b) => (b.movementComplexity === "compound" ? 1 : 0) - (a.movementComplexity === "compound" ? 1 : 0));
      const chosen = found[0];
      if (t.relax) assumptions.push(`${slotLabel}: no verified/matching exercise — fell back to ${t.relax} pick "${chosen.exerciseTitle}" (please confirm).`);
      return { exercise: chosen };
    }
  }
  return { exercise: null };
}

async function generateProgramFromBlock({ trainingBlockId, trainerId }) {
  const assumptions = [];

  const block = await TrainingBlock.findById(trainingBlockId);
  if (!block) throw new Error("Training block not found.");
  const clientId = block.user;
  const rel = await Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
  if (!rel) throw new Error("No accepted relationship with this client.");

  const client = await User.findById(clientId).lean();
  const goals = await Goal.find({ trainingBlock: block._id, user: clientId }).sort({ importanceScore: -1, priority: 1 });
  const activeGoals = goals.filter((g) => g.status !== "achieved" && g.status !== "dropped");
  const topGoal = activeGoals[0] || goals[0] || null;

  // --- strategy ---
  const primaryType = topGoal?.goalType || "";
  const strategy = STRATEGY[primaryType] || DEFAULT_STRATEGY;
  if (!topGoal) assumptions.push("This block has no goals — generated a general hypertrophy template.");
  else if (!primaryType) assumptions.push(`Top goal "${topGoal.title}" has no goal type — assumed hypertrophy (${strategy.label}).`);
  else assumptions.push(`Primary goal type "${primaryType}" → ${strategy.meso} blocks, ${strategy.label} on strength days.`);

  if (!client?.trainingExperience) assumptions.push("No training experience on file — assumed intermediate loads/volume.");
  const equipmentAccess = Array.isArray(client?.equipmentAccess) ? client.equipmentAccess : [];
  if (!equipmentAccess.length) assumptions.push("No equipment access on file — selected from the full library; confirm availability.");
  const dislikedIds = (client?.dislikedExercises || []).map((id) => String(id));

  // --- days from the block's workout split ---
  const split = block.workoutSplit || {};
  let days = [];
  Object.keys(split).forEach((type) => { for (let i = 0; i < Number(split[type] || 0); i += 1) days.push(type); });
  if (!days.length) {
    const dpw = Number(client?.weeklyFrequency) || 3;
    days = fill(dpw, "Strength");
    assumptions.push(`No workout-type split set — assumed ${dpw} full-body Strength days/week.`);
  }
  const daysPerWeek = Math.min(7, Math.max(1, days.length));
  days = days.slice(0, daysPerWeek);

  // --- mesocycles summing to the block length ---
  const totalWeeks = Math.min(52, Math.max(1, Number(block.weeks) || 12));
  const mesocycles = [];
  let remaining = totalWeeks;
  while (remaining > 0) {
    const w = Math.min(remaining, 6);
    mesocycles.push({ name: `${strategy.meso} block ${mesocycles.length + 1}`, type: strategy.meso, weeks: w, deloadLastWeek: w >= 4 });
    remaining -= w;
  }
  const weeksCount = mesocycleWeeks(mesocycles);
  assumptions.push(`Structured ${weeksCount} weeks as ${mesocycles.length} ${strategy.meso} block(s); last week of each ≥4-week block is a deload.`);

  // Goal-referenced strength lifts to anchor (one per strength day, in priority order).
  const anchorGoals = activeGoals.filter((g) => g.exercise && (g.goalType === "strength" || g.category === "Strength"));

  // --- build BASE-WEEK templates, one per day ---
  const excludeIds = [...dislikedIds];
  const baseTemplates = [];
  let strengthDayIdx = 0;
  for (let d = 0; d < days.length; d += 1) {
    const type = days[d];
    if (type !== "Strength") {
      // Non-strength day → labeled placeholder, never fabricated content.
      assumptions.push(`${type} day (day ${d + 1}) left as a placeholder for you to specify.`);
      const t = await new Training({
        title: `${type} — placeholder (coach to specify)`,
        user: trainerId, category: [type], workoutType: type, training: [[]], isTemplate: true,
      }).save();
      baseTemplates.push(t);
      continue;
    }

    const circuits = [];
    const usedThisDay = new Set();

    // anchor a goal lift on this strength day if available
    const anchor = anchorGoals[strengthDayIdx];
    if (anchor) {
      if (strategy.scheme === "percent" && anchor.startingWeight) {
        const reps = anchor.targetReps || strategy.reps || 5;
        const est1RM = Math.round(anchor.startingWeight * (1 + reps / 30)); // Epley
        assumptions.push(`Anchored "${anchor.title}" at ~${strategy.percent}% of an estimated ${est1RM} 1RM (from ${anchor.startingWeight} × ${reps}).`);
        circuits.push([makeEntry(anchor.exercise, "percent", { sets: strategy.sets, reps: strategy.reps, percent: strategy.percent, oneRepMax: est1RM })]);
      } else {
        assumptions.push(`Anchored "${anchor.title}" as a rep-range lift${anchor.startingWeight ? ` starting ~${anchor.startingWeight}` : " — no starting load, coach to set"}.`);
        circuits.push([makeEntry(anchor.exercise, "rep-range", { sets: strategy.sets, minReps: strategy.minReps, maxReps: strategy.maxReps, weight: anchor.startingWeight || 0 })]);
      }
      excludeIds.push(String(anchor.exercise));
      usedThisDay.add(String(anchor.exercise));
    }

    // fill remaining slots by movement pattern (rotate start per day for variety)
    for (let s = 0; circuits.length < MAX_STRENGTH_EXERCISES && s < STRENGTH_SLOTS.length; s += 1) {
      const slot = STRENGTH_SLOTS[(s + strengthDayIdx) % STRENGTH_SLOTS.length];
      const { exercise } = await selectExercise({
        muscles: slot.muscles, equipmentAccess, excludeIds: [...excludeIds, ...usedThisDay], slotLabel: `${slot.label} (day ${d + 1})`, assumptions,
      });
      if (!exercise) {
        assumptions.push(`Couldn't confidently pick a ${slot.label} for day ${d + 1} — left an open slot for you.`);
        continue;
      }
      const p = strategy.kind === "percent"
        ? { sets: strategy.sets, reps: strategy.reps, percent: strategy.percent } // no 1RM for accessories → % of nothing
        : { sets: strategy.sets, minReps: strategy.minReps, maxReps: strategy.maxReps };
      // accessories without a 1RM shouldn't be percent-locked; use rep-range so they're usable
      const kind = strategy.kind === "percent" ? "rep-range" : strategy.kind;
      const params = kind === "rep-range"
        ? { sets: strategy.sets, minReps: strategy.minReps || 8, maxReps: strategy.maxReps || 12 }
        : p;
      circuits.push([makeEntry(exercise._id, kind, params)]);
      excludeIds.push(String(exercise._id));
      usedThisDay.add(String(exercise._id));
    }

    const hasContent = circuits.length > 0;
    if (!hasContent) assumptions.push(`Strength day ${d + 1} has no exercises yet — add some in the builder.`);
    const t = await new Training({
      title: hasContent ? `Strength — Day ${d + 1} (draft)` : `Strength — Day ${d + 1} (add exercises)`,
      user: trainerId, category: ["Strength"], workoutType: "Strength",
      training: sanitizeTrainingTechniques(hasContent ? circuits : [[]]),
      isTemplate: true,
    }).save();
    baseTemplates.push(t);
    strengthDayIdx += 1;
  }

  // --- create the DRAFT program + attach base week ---
  const weeks = buildProgramWeeks(weeksCount, daysPerWeek);
  const program = new Program({
    ownerId: trainerId,
    title: `${block.title || "Training Block"} — Draft`,
    description: "Auto-generated draft — review every day before publishing.",
    weeksCount, daysPerWeek, status: "DRAFT", weeks, mesocycles,
    generatedFromBlock: block._id, generationAssumptions: assumptions,
  });
  for (let d = 0; d < baseTemplates.length; d += 1) program.weeks[0][d].workoutId = baseTemplates[d]._id;

  // --- fill weeks 2..N by progressing from the base week (replicates handleAutoProgress) ---
  const plan = expandMesocycles(mesocycles);
  let step = 0;
  for (let w = 1; w < weeksCount; w += 1) {
    const isDeload = Boolean(plan[w]?.isDeload);
    if (!isDeload) step += 1;
    for (let d = 0; d < baseTemplates.length; d += 1) {
      const base = baseTemplates[d];
      const clonedTraining = JSON.parse(JSON.stringify(base.training));
      await progressWorkout(clonedTraining, { step, deload: isDeload });
      const t = await new Training({
        title: base.title.replace(/Day (\d+)/, `Week ${w + 1} Day $1`),
        user: trainerId, category: base.category, workoutType: base.workoutType,
        training: clonedTraining, isTemplate: true,
      }).save();
      program.weeks[w][d].workoutId = t._id;
    }
  }

  await program.save();
  block.program = program._id;
  await block.save();

  return { programId: program._id, assumptions };
}

module.exports = { generateProgramFromBlock };
