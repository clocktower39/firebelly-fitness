// Background capture of the trainer's programming signal: snapshot week 1 of a generated program at
// generation, snapshot it again when the trainer publishes/assigns, and store the diff. Feeds a future
// personalization phase (the coaching-os-learning direction). Pure telemetry — every entry point is
// guarded so a failure here can NEVER block or break publish/assign.
//
// v1 CAPTURES WEEK 1 ONLY: week 1 is the base design signal the trainer actually shapes; weeks 2..N are
// deterministically engine-progressed from it, so they carry no independent programming intent yet.

const Training = require("../models/training");
const TrainingBlock = require("../models/trainingBlock");
const Goal = require("../models/goal");
const ProgrammingSignal = require("../models/programmingSignal");

const first = (a) => (Array.isArray(a) ? a[0] : undefined);

// Compact, comparable snapshot of one exercise entry (id + scheme).
function exerciseSnapshot(entry) {
  const g = entry.goals || {};
  const ex = entry.exercise || {};
  const exerciseId = ex._id ? String(ex._id) : ex ? String(ex) : null;
  return {
    exerciseId,
    title: ex.exerciseTitle || "",
    exerciseType: entry.exerciseType || "",
    sets: g.sets || 0,
    reps: first(g.exactReps) || 0,
    percent: first(g.percent) || 0,
    minReps: first(g.minReps) || 0,
    maxReps: first(g.maxReps) || 0,
    seconds: first(g.seconds) || 0,
    weight: first(g.weight) || 0,
  };
}

// Compact per-day snapshot of a program's WEEK 1 (see file header for why week 1 only). Used for BOTH the
// generation baseline and the finalize snapshot, so the two are directly comparable.
async function snapshotWeekOne(program) {
  const week = (program.weeks && program.weeks[0]) || [];
  const ids = week.map((d) => d && d.workoutId).filter(Boolean);
  const docs = await Training.find({ _id: { $in: ids } })
    .populate({ path: "training.exercise", model: "Exercise", select: "_id exerciseTitle" })
    .lean();
  const byId = new Map(docs.map((t) => [String(t._id), t]));
  return week.map((slot, dayIndex) => {
    const t = slot && slot.workoutId ? byId.get(String(slot.workoutId)) : null;
    if (!t) return { dayIndex, workoutType: null, title: "", exercises: [], cardio: null };
    const exercises = [];
    (t.training || []).forEach((circuit) =>
      (circuit || []).forEach((entry) => {
        // Warm-ups are excluded from the learning signal (they're not the trainer's programming choices).
        if (entry && entry.exercise && !entry.isWarmup) exercises.push(exerciseSnapshot(entry));
      })
    );
    const plan = t.cardio && t.cardio.plan;
    const cardio = plan
      ? { activity: plan.activity || "", distance: plan.distance || "", distanceUnit: plan.distanceUnit || "", duration: plan.duration || "" }
      : null;
    return { dayIndex, workoutType: t.workoutType || null, title: t.title || "", exercises, cardio };
  });
}

const schemeChanged = (a, b) =>
  a.exerciseType !== b.exerciseType || a.sets !== b.sets || a.reps !== b.reps ||
  a.percent !== b.percent || a.minReps !== b.minReps || a.maxReps !== b.maxReps || a.seconds !== b.seconds;

// Diff two week-1 snapshots into a summary a future learning phase can aggregate across many programs.
function diffSnapshots(generated, final) {
  const genByDay = new Map((generated || []).map((d) => [d.dayIndex, d]));
  const summary = { kept: 0, swapped: 0, added: 0, removed: 0, schemeChanges: 0, swaps: [] };
  (final || []).forEach((fDay) => {
    const gDay = genByDay.get(fDay.dayIndex);
    if (!gDay) return;
    const gEx = gDay.exercises || [];
    const fEx = fDay.exercises || [];
    const gIds = gEx.map((e) => e.exerciseId);
    const fIds = fEx.map((e) => e.exerciseId);
    const fSet = new Set(fIds);
    const gSet = new Set(gIds);
    summary.kept += gIds.filter((id) => fSet.has(id)).length;
    summary.removed += gIds.filter((id) => !fSet.has(id)).length;
    summary.added += fIds.filter((id) => !gSet.has(id)).length;
    // positional replacements = the coach swapped a slot's exercise
    const n = Math.min(gEx.length, fEx.length);
    for (let i = 0; i < n; i += 1) {
      if (gEx[i].exerciseId !== fEx[i].exerciseId) {
        summary.swapped += 1;
        summary.swaps.push({ dayIndex: fDay.dayIndex, from: gEx[i].title, to: fEx[i].title });
      }
    }
    // scheme changes for exercises the coach kept (same id)
    const fById = new Map(fEx.map((e) => [e.exerciseId, e]));
    gEx.forEach((g) => {
      const f = fById.get(g.exerciseId);
      if (f && schemeChanged(g, f)) summary.schemeChanges += 1;
    });
  });
  return summary;
}

// Record the signal for a finalized (published/assigned) generated program. Idempotent per program.
// GUARDED: never throws into the caller — a telemetry failure must not block or break publish/assign.
async function recordProgrammingSignal(program, { finalizedVia } = {}) {
  try {
    if (!program || !program.generatedFromBlock || !program.generationSnapshot) return;
    const [block, topGoal] = await Promise.all([
      TrainingBlock.findById(program.generatedFromBlock).select("user").lean(),
      Goal.findOne({ trainingBlock: program.generatedFromBlock }).sort({ importanceScore: -1, priority: 1 }).select("goalType").lean(),
    ]);
    const final = await snapshotWeekOne(program);
    const summary = diffSnapshots(program.generationSnapshot, final);
    await ProgrammingSignal.findOneAndUpdate(
      { programId: program._id },
      {
        $set: {
          trainerId: program.ownerId,
          clientId: block ? block.user : null,
          trainingBlockId: program.generatedFromBlock,
          primaryGoalType: topGoal ? topGoal.goalType || "" : "",
          finalizedVia: finalizedVia || "publish",
          generatedAt: program.createdAt || null,
          generated: program.generationSnapshot,
          final,
          summary,
        },
        $setOnInsert: { programId: program._id },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("recordProgrammingSignal failed (non-blocking):", err.message);
  }
}

module.exports = { snapshotWeekOne, diffSnapshots, recordProgrammingSignal };
