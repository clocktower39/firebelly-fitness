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
const { snapshotWeekOne } = require("./programmingSignal");
const { getTrainerExercisePreferences, MIN_SIGNALS } = require("./trainerPreferences");
const { getTrainerSchemePreferences, schemeParams } = require("./trainerSchemePreferences");

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

// Per-day muscle slots keyed by day type. Vocab matches the library (Quadriceps/Abdominals/Back/...).
// Core has ~1 exercise in the library, so core work targets Abdominals. Per-muscle pools are large
// (40–197), so the selector rotates through them (usedIds) to keep days from repeating exercises.
const DAY_TYPES = {
  full:  [{ label: "Squat / legs", muscles: ["Quadriceps"] }, { label: "Chest", muscles: ["Chest"] }, { label: "Back", muscles: ["Back"] }, { label: "Hinge / posterior", muscles: ["Hamstrings", "Glutes"] }, { label: "Shoulders", muscles: ["Shoulders"] }, { label: "Core", muscles: ["Abdominals"] }],
  upper: [{ label: "Chest", muscles: ["Chest"] }, { label: "Back", muscles: ["Back"] }, { label: "Shoulders", muscles: ["Shoulders"] }, { label: "Triceps", muscles: ["Triceps"] }, { label: "Biceps", muscles: ["Biceps"] }, { label: "Core", muscles: ["Abdominals"] }],
  lower: [{ label: "Squat / quads", muscles: ["Quadriceps"] }, { label: "Hinge / hamstrings", muscles: ["Hamstrings"] }, { label: "Glutes", muscles: ["Glutes"] }, { label: "Calves", muscles: ["Calves"] }, { label: "Core", muscles: ["Abdominals"] }],
  push:  [{ label: "Chest (flat)", muscles: ["Chest"] }, { label: "Shoulders", muscles: ["Shoulders"] }, { label: "Triceps", muscles: ["Triceps"] }, { label: "Chest (incline)", muscles: ["Chest"] }, { label: "Core", muscles: ["Abdominals"] }],
  pull:  [{ label: "Back (vertical)", muscles: ["Back"] }, { label: "Back (horizontal)", muscles: ["Back"] }, { label: "Biceps", muscles: ["Biceps"] }, { label: "Posterior chain", muscles: ["Hamstrings", "Glutes"] }, { label: "Forearms / core", muscles: ["Forearms", "Abdominals"] }],
  legs:  [{ label: "Squat / quads", muscles: ["Quadriceps"] }, { label: "Hinge / hamstrings", muscles: ["Hamstrings"] }, { label: "Glutes", muscles: ["Glutes"] }, { label: "Calves", muscles: ["Calves"] }, { label: "Core", muscles: ["Abdominals"] }],
};
// Split by number of strength days/week. Repeats (e.g. upper/lower/upper/lower) still differ because
// exercise rotation gives each day different lifts for the same pattern.
const SPLIT_BY_DAYS = {
  1: ["full"],
  2: ["upper", "lower"],
  3: ["push", "pull", "legs"],
  4: ["upper", "lower", "upper", "lower"],
  5: ["upper", "lower", "push", "pull", "legs"],
  6: ["push", "pull", "legs", "push", "pull", "legs"],
  7: ["push", "pull", "legs", "upper", "lower", "push", "pull"],
};
const strengthSplit = (n) => SPLIT_BY_DAYS[Math.max(1, Math.min(7, n))] || fill(Math.max(1, n), "full");
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// The wizard's equipment vocab differs from the library (plurals / gym terms) — map it so the
// equipment filter actually matches; unmappable "gym"/"cardio machine" fall through to no filter.
const EQUIP_MAP = { Dumbbells: "Dumbbell", Kettlebells: "Kettlebell", Bands: "Band", "Loop bands": "Loop-Band", "Pull-up bar": "Pull-up Bar", "Squat rack": "Barbell", "Cable machine": "Cable" };
const mapEquipment = (list) => {
  const out = new Set();
  (list || []).forEach((e) => { if (e === "Full gym" || e === "Cardio machine") return; out.add(EQUIP_MAP[e] || e); });
  return [...out];
};
const MAX_STRENGTH_EXERCISES = 5;

// Convert HH:MM:SS (goal time) into total minutes (string) for a cardio plan.
function goalMinutes(hms) {
  if (!hms) return "";
  const p = String(hms).split(":").map((n) => Number(n) || 0);
  const [h, m, s] = p.length === 3 ? p : [0, p[0] || 0, p[1] || 0];
  const total = h * 60 + m + Math.round(s / 60);
  return total > 0 ? String(total) : "";
}
const distUnitShort = (u) => (u === "Kilometers" ? "km" : u === "Meters" ? "m" : u === "Yards" ? "yd" : "mi");

// Seed a real cardio workout. workoutType Cardio uses the freeform `cardio.plan` object (not `training`);
// we write the FULL field shape (matches the client's DEFAULT_CARDIO_FIELDS, incl. segments/clientPrompts)
// so the editor hydrates cleanly, and always leave at least a duration target so the day isn't blank.
function cardioTemplateData(cardioGoal, assumptions) {
  const plan = {
    activity: "Run", style: "Easy", distance: "", distanceUnit: "mi", duration: "30",
    avgPace: "", avgSpeed: "", rpe: "5", avgHeartRate: "", elevationGain: "", elevationUnit: "ft",
    routeType: "", surface: "", shoes: "", cadence: "", strideLength: "", strideUnit: "in",
    routeLink: "", weather: "", temperature: "", temperatureUnit: "F", hrZone: "Z2 Endurance",
    notes: "Auto-generated draft — adjust the activity, distance and duration for the client.",
    clientPrompts: [], segments: [],
  };
  if (cardioGoal) {
    const t = (cardioGoal.title || "").toLowerCase();
    if (/(bike|cycl|spin)/.test(t)) plan.activity = "Bike";
    else if (/swim/.test(t)) plan.activity = "Swim";
    else if (/row/.test(t)) plan.activity = "Row";
    else if (/walk|hike|ruck/.test(t)) plan.activity = "Walk";
    if (cardioGoal.distanceValue) { plan.distance = String(cardioGoal.distanceValue); plan.distanceUnit = distUnitShort(cardioGoal.distanceUnit); }
    const mins = goalMinutes(cardioGoal.goalTime) || goalMinutes(cardioGoal.startingTime);
    if (mins) plan.duration = mins;
    plan.notes = `Target from the goal "${cardioGoal.title}" — a starting point; adjust for the client.`;
    if (!cardioGoal.distanceValue && !mins && assumptions) {
      assumptions.push(`Cardio goal "${cardioGoal.title}" had no distance/time on file — seeded a 30-minute easy session; set a real target.`);
    }
  } else if (assumptions) {
    assumptions.push("Cardio day has no matching goal — seeded a 30-minute easy session; set the activity and target.");
  }
  return { plan, actual: {} };
}

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

// Pick one exercise for a slot, rotating through the matched pool for variety. `usedIds` accumulates
// across the whole program so days don't repeat lifts; when a pool is exhausted it falls back to reuse.
async function pickExercise({ muscles, equipment, usedIds, prefScore, slotLabel, dayNum, assumptions }) {
  const eq = equipment && equipment.length ? { equipment: { $in: equipment } } : {};
  const muscle = { "muscleGroups.primary": { $in: muscles } };
  const tiers = [
    { q: { verified: true, ...muscle, ...eq }, relax: null },
    { q: { ...muscle, ...eq }, relax: null },
    { q: { ...muscle }, relax: "any-equipment" },
    { q: { verified: true, ...eq }, relax: "any-muscle" },
  ];
  for (const t of tiers) {
    const pool = await Exercise.find(t.q).limit(60).lean();
    if (!pool.length) continue;
    pool.sort((a, b) => (b.movementComplexity === "compound" ? 1 : 0) - (a.movementComplexity === "compound" ? 1 : 0));
    // Trainer preference (when personalized): float favored lifts up, demote avoided ones. Stable sort →
    // among equal preference the compound-first order holds. Never excludes — an avoided lift is still
    // selectable if it's all that's left, so the fallback chain and variety rotation are unaffected.
    if (prefScore) {
      const pref = (e) => prefScore.get(String(e._id)) || 0;
      pool.sort((a, b) => pref(b) - pref(a));
    }
    const chosen = pool.find((e) => !usedIds.has(String(e._id))) || pool[0];
    if (t.relax) assumptions.push(`${slotLabel} (day ${dayNum}): no equipment/verified match — used ${t.relax} pick "${chosen.exerciseTitle}".`);
    return chosen;
  }
  return null;
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

  // --- plan the week: honor the block's split, else derive from days/week + the goal mix ---
  const cardioGoals = activeGoals.filter((g) => g.goalType === "endurance" || g.category === "Cardio");
  const split = block.workoutSplit || {};
  const splitSum = Object.keys(split).reduce((s, k) => s + Number(split[k] || 0), 0);
  let days = [];
  if (splitSum > 0) {
    Object.keys(split).forEach((type) => { for (let i = 0; i < Number(split[type] || 0); i += 1) days.push(type); });
    days = days.slice(0, 7);
    if (cardioGoals.length && !days.includes("Cardio")) {
      if (days.length < 7) days.push("Cardio"); else days[days.length - 1] = "Cardio";
      assumptions.push("Added a Cardio day for the client's endurance goal (the split had none).");
    }
  } else {
    const total = Math.min(7, Math.max(1, Number(client?.weeklyFrequency) || 3));
    const nCardio = cardioGoals.length ? Math.min(2, Math.max(1, Math.floor(total / 3))) : 0;
    const nStrength = Math.max(1, total - nCardio);
    days = [...fill(nStrength, "Strength"), ...fill(nCardio, "Cardio")];
    assumptions.push(`No workout split set — planned ${nStrength} strength + ${nCardio} cardio day(s) from ${total} days/week and the goal mix.`);
  }
  const daysPerWeek = Math.min(7, Math.max(1, days.length));

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

  // Goal-referenced strength lifts to anchor as the primary mover on a relevant day.
  const anchorGoals = activeGoals.filter((g) => g.exercise && (g.goalType === "strength" || g.category === "Strength"));

  // Choose a split from the number of strength days; selection rotates a shared usedIds set for variety.
  const nStrength = days.filter((t) => t === "Strength").length;
  const strengthDayTypes = strengthSplit(nStrength);
  const equipment = mapEquipment(equipmentAccess);
  const usedIds = new Set(dislikedIds);
  if (nStrength) assumptions.push(`Strength split (${nStrength} day${nStrength > 1 ? "s" : ""}/week): ${strengthDayTypes.map(titleCase).join(" · ")}.`);

  // Personalization (v1: exercise choices only). Below MIN_SIGNALS this is a strict no-op — selection
  // is byte-for-byte the rules-based default. getTrainerExercisePreferences is internally guarded.
  const prefs = await getTrainerExercisePreferences(trainerId);
  const prefScore = prefs.sampleSize >= MIN_SIGNALS ? prefs.score : null;
  if (prefScore) assumptions.push(`Personalized from ${prefs.sampleSize} of your past programs — biased exercise picks toward your usual choices.`);

  // Scheme learning (v2): seed sets/reps/% from the trainer's usual schemes when there's enough signal.
  const schemePrefs = await getTrainerSchemePreferences(trainerId);
  const useScheme = schemePrefs.sampleSize >= MIN_SIGNALS ? schemePrefs.byType : null;
  if (useScheme) assumptions.push(`Using your usual set/rep schemes from ${schemePrefs.sampleSize} past programs.`);

  // Place each anchor lift on the first strength day whose focus covers its muscle (else the next open day).
  const anchorLibs = await Exercise.find({ _id: { $in: anchorGoals.map((g) => g.exercise) } }).select("muscleGroups").lean();
  const anchorMuscle = new Map(anchorLibs.map((l) => [String(l._id), (l.muscleGroups?.primary || [])[0]]));
  const anchorByDay = {};
  const takenDays = new Set();
  anchorGoals.forEach((g) => {
    const mus = anchorMuscle.get(String(g.exercise));
    let idx = strengthDayTypes.findIndex((dt, i) => !takenDays.has(i) && (DAY_TYPES[dt] || []).some((s) => s.muscles.includes(mus)));
    if (idx < 0) idx = strengthDayTypes.findIndex((_, i) => !takenDays.has(i));
    if (idx >= 0) { anchorByDay[idx] = g; takenDays.add(idx); }
  });

  // --- build BASE-WEEK templates, one per day ---
  const baseTemplates = [];
  let strengthDayIdx = 0;
  let cardioDayIdx = 0;
  for (let d = 0; d < days.length; d += 1) {
    const type = days[d];

    if (type === "Cardio") {
      const g = cardioGoals[cardioDayIdx] || cardioGoals[0] || null;
      cardioDayIdx += 1;
      const t = await new Training({
        title: `Cardio — Day ${d + 1} (draft)`, user: trainerId, category: ["Cardio"], workoutType: "Cardio",
        cardio: cardioTemplateData(g, assumptions), training: [[]], isTemplate: true,
      }).save();
      baseTemplates.push(t);
      continue;
    }

    if (type !== "Strength") {
      // Yoga/Pilates/Sports → labeled placeholder for the coach (not fabricated).
      assumptions.push(`${type} day (day ${d + 1}) left as a placeholder for you to specify.`);
      const t = await new Training({
        title: `${type} — placeholder (coach to specify)`,
        user: trainerId, category: [type], workoutType: type, training: [[]], isTemplate: true,
      }).save();
      baseTemplates.push(t);
      continue;
    }

    // Strength day: this day's split focus (upper/lower/push/pull/legs/full), filled with rotated picks.
    const dayType = strengthDayTypes[strengthDayIdx] || "full";
    const slots = DAY_TYPES[dayType] || DAY_TYPES.full;
    const circuits = [];

    // anchor a goal lift as the primary mover on this day if one was assigned here
    const anchor = anchorByDay[strengthDayIdx];
    if (anchor) {
      if (strategy.scheme === "percent" && anchor.startingWeight) {
        const reps = anchor.targetReps || strategy.reps || 5;
        const est1RM = Math.round(anchor.startingWeight * (1 + reps / 30)); // Epley
        assumptions.push(`Anchored "${anchor.title}" at ~${strategy.percent}% of an estimated ${est1RM} 1RM (from ${anchor.startingWeight} × ${reps}).`);
        circuits.push([makeEntry(anchor.exercise, "percent", { ...schemeParams("percent", { sets: strategy.sets, reps: strategy.reps, percent: strategy.percent }, useScheme), oneRepMax: est1RM })]);
      } else {
        assumptions.push(`Anchored "${anchor.title}" as a rep-range lift${anchor.startingWeight ? ` starting ~${anchor.startingWeight}` : " — no starting load, coach to set"}.`);
        circuits.push([makeEntry(anchor.exercise, "rep-range", { ...schemeParams("rep-range", { sets: strategy.sets, minReps: strategy.minReps || 8, maxReps: strategy.maxReps || 12 }, useScheme), weight: anchor.startingWeight || 0 })]);
      }
      usedIds.add(String(anchor.exercise));
    }

    // fill this day's slots, rotating through each muscle's pool (usedIds) so no two days repeat lifts
    for (const slot of slots) {
      if (circuits.length >= MAX_STRENGTH_EXERCISES) break;
      const ex = await pickExercise({ muscles: slot.muscles, equipment, usedIds, prefScore, slotLabel: slot.label, dayNum: d + 1, assumptions });
      if (!ex) {
        assumptions.push(`Couldn't confidently pick a ${slot.label} for day ${d + 1} — left an open slot for you.`);
        continue;
      }
      usedIds.add(String(ex._id));
      // accessories aren't %-locked (no 1RM) → rep-range; keep time/reps schemes for mobility/skill blocks
      const kind = strategy.kind === "percent" ? "rep-range" : strategy.kind;
      const baseParams =
        kind === "rep-range" ? { sets: strategy.sets, minReps: strategy.minReps || 8, maxReps: strategy.maxReps || 12 }
        : kind === "time" ? { sets: strategy.sets, seconds: strategy.seconds || 30 }
        : { sets: strategy.sets, reps: strategy.reps || 8 };
      circuits.push([makeEntry(ex._id, kind, schemeParams(kind, baseParams, useScheme))]);
    }

    const hasContent = circuits.length > 0;
    if (!hasContent) assumptions.push(`Strength day ${d + 1} has no exercises yet — add some in the builder.`);
    const t = await new Training({
      title: hasContent ? `${titleCase(dayType)} — Day ${d + 1} (draft)` : `Strength — Day ${d + 1} (add exercises)`,
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
      const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : undefined);
      const t = await new Training({
        title: base.title.replace(/Day (\d+)/, `Week ${w + 1} Day $1`),
        user: trainerId, category: base.category, workoutType: base.workoutType,
        training: clonedTraining,
        cardio: clone(base.cardio), sports: clone(base.sports), yoga: clone(base.yoga), pilates: clone(base.pilates),
        isTemplate: true,
      }).save();
      program.weeks[w][d].workoutId = t._id;
    }
  }

  // Snapshot week 1 as the immutable baseline for the programming-signal diff (captured later at
  // publish/assign). Guarded — a telemetry snapshot failure must never break generation.
  try {
    program.generationSnapshot = await snapshotWeekOne(program);
  } catch (err) {
    console.error("generationSnapshot capture failed (non-blocking):", err.message);
  }

  await program.save();
  block.program = program._id;
  await block.save();

  return { programId: program._id, assumptions };
}

module.exports = { generateProgramFromBlock, progressWorkout };
