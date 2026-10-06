const mongoose = require("mongoose");
const ExerciseAnchor = require("../models/exerciseAnchor");
const Training = require("../models/training");
const Program = require("../models/program");
const Exercise = require("../models/exercise");
const Relationship = require("../models/relationship");
const { loadForSlot, resolveAnchorToFutureWorkouts } = require("../services/anchorProgression");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const exIdOf = (entry) => String(entry?.exercise?._id || entry?.exercise || "");

const ensureTrainerOf = async (user, clientId) => {
  if (!user?.isTrainer) return false;
  if (String(user._id) === String(clientId)) return true;
  return Boolean(await Relationship.findOne({ trainer: user._id, client: clientId, accepted: true }));
};

// Describe the exercise's occurrences in the client's week, so the panel can show the whole
// group at once. Shape comes from ONE doc per program day (the most recent), which both
// survives duplicate week/day docs and reflects edits made after assignment.
const currentSlots = async (clientId, programId, exerciseId) => {
  const docs = (await Training.find({
    user: clientId, programId, isTemplate: { $ne: true },
  }).select("programDay date complete training").lean()).filter((d) => d.programDay && d.date);
  const perDay = new Map();
  docs.sort((a, b) => b.date - a.date).forEach((d) => { if (!perDay.has(d.programDay)) perDay.set(d.programDay, d); });

  const slots = [];
  [...perDay.entries()].sort((a, b) => a[0] - b[0]).forEach(([day, d]) =>
    (d.training || []).forEach((circuit) => (circuit || []).forEach((e) => {
      if (e.isWarmup || exIdOf(e) !== String(exerciseId)) return;
      const g = e.goals || {};
      const timed = (g.seconds || []).some((s) => num(s) > 0);
      slots.push({
        day,
        scheme: timed
          ? `${g.sets}x${(g.seconds || []).join("/")}s`
          : e.exerciseType === "Rep Range"
            ? `${g.sets}x${(g.minReps || [])[0]}-${(g.maxReps || [])[0]}`
            : `${g.sets}x${(g.exactReps || []).join("/")}`,
        percentOfAnchor: e.progression?.percentOfAnchor ?? null,
        applyTo: e.progression?.applyTo || "top",
        currentTop: Math.max(0, ...(g.weight || []).map(num)),
      });
    })));
  return slots;
};

const anchor_for_exercise = async (req, res, next) => {
  try {
    const { clientId, programId, exerciseId } = req.body;
    if (!await ensureTrainerOf(res.locals.user, clientId)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const [anchor, program, exercise] = await Promise.all([
      ExerciseAnchor.findOne({ clientId, programId, exerciseId }).lean(),
      Program.findById(programId).select("title").lean(),
      Exercise.findById(exerciseId).select("exerciseTitle measurementType").lean(),
    ]);
    const slots = await currentSlots(clientId, programId, exerciseId);
    const working = anchor ? num(anchor.working) : 0;
    return res.json({
      anchor: anchor || null,
      programTitle: program?.title || "",
      exerciseTitle: exercise?.exerciseTitle || "",
      // what the panel should default `unit` to for a brand-new anchor
      suggestedUnit: exercise?.measurementType === "time" ? "seconds" : "weight",
      slots: slots.map((s) => ({
        ...s,
        // what this slot WOULD render at, so the trainer sees the effect before saving
        resolved: s.percentOfAnchor === null ? null
          : loadForSlot(working, s.percentOfAnchor, anchor?.unit || "weight"),
      })),
    });
  } catch (err) {
    return next(err);
  }
};

const set_anchor = async (req, res, next) => {
  try {
    const { clientId, programId, exerciseId, working, unit, rule, step, ceiling, earnsOnDay, slots } = req.body;
    if (!await ensureTrainerOf(res.locals.user, clientId)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    // A null/empty working weight means "not established yet" — the first completed session on
    // the earning day sets it. That is a legitimate state, not an error.
    const anchor = await ExerciseAnchor.findOneAndUpdate(
      { clientId, programId, exerciseId },
      {
        $set: {
          trainerId: res.locals.user._id,
          working: working === null || working === "" ? 0 : num(working),
          unit: unit || "weight",
          rule: rule || "feedback",
          step: num(step),
          ceiling: ceiling === null || ceiling === "" ? null : num(ceiling),
          earnsOnDay: earnsOnDay === null || earnsOnDay === "" ? null : num(earnsOnDay),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Stamp each slot's share onto every future occurrence of this exercise. Written through
    // the raw collection: a free-text warm-up row carries no exercise id, and a hydrated
    // .save() throws casting that to an ObjectId even on a row we never touch.
    const byDay = new Map((slots || []).map((s) => [Number(s.day), s]));
    let stamped = 0;
    if (byDay.size) {
      const docs = await Training.find({
        user: clientId, programId, isTemplate: { $ne: true }, complete: { $ne: true },
      }).lean();
      for (const d of docs) {
        const slot = byDay.get(Number(d.programDay));
        if (!slot) continue;
        let changed = false;
        (d.training || []).forEach((circuit) => (circuit || []).forEach((e) => {
          if (e.isWarmup || exIdOf(e) !== String(exerciseId)) return;
          const pct = slot.percentOfAnchor;
          e.progression = {
            ...(e.progression || {}),
            unit: unit || "weight",
            applyTo: slot.applyTo || "top",
            percentOfAnchor: pct === null || pct === "" ? null : num(pct),
          };
          changed = true;
        }));
        if (changed) {
          await Training.collection.updateOne({ _id: d._id }, { $set: { training: d.training } });
          stamped += 1;
        }
      }
    }

    const meta = await Exercise.findById(exerciseId).select("equipment movementComplexity").lean();
    const touched = await resolveAnchorToFutureWorkouts(anchor, { exerciseMeta: meta || {} });
    return res.json({
      anchor: anchor.toObject ? anchor.toObject() : anchor,
      stamped,
      rendered: touched.length,
      slots: await currentSlots(clientId, programId, exerciseId),
    });
  } catch (err) {
    return next(err);
  }
};

const clear_anchor = async (req, res, next) => {
  try {
    const { clientId, programId, exerciseId } = req.body;
    if (!await ensureTrainerOf(res.locals.user, clientId)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    await ExerciseAnchor.deleteOne({ clientId, programId, exerciseId });
    // Unlink the slots so the exercise returns to ordinary per-workout feedback seeding.
    const docs = await Training.find({
      user: clientId, programId, isTemplate: { $ne: true }, complete: { $ne: true },
    }).lean();
    let cleared = 0;
    for (const d of docs) {
      let changed = false;
      (d.training || []).forEach((circuit) => (circuit || []).forEach((e) => {
        if (exIdOf(e) !== String(exerciseId) || !e.progression) return;
        if (e.progression.percentOfAnchor === null || e.progression.percentOfAnchor === undefined) return;
        e.progression = { ...e.progression, percentOfAnchor: null };
        changed = true;
      }));
      if (changed) { await Training.collection.updateOne({ _id: d._id }, { $set: { training: d.training } }); cleared += 1; }
    }
    return res.json({ cleared });
  } catch (err) {
    return next(err);
  }
};

module.exports = { anchor_for_exercise, set_anchor, clear_anchor };
