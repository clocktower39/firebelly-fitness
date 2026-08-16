const {
  Training,
  Exercise,
  canWriteUserResource,
  mongoose,
} = require("./context");
const Program = require("../../models/program");
const { sanitizeTrainingTechniques } = require("../../services/techniqueValidation");
// Same day-identity helper the progression engine uses, so a cascade scoped to "this program
// day" behaves identically for modern (programDay) and legacy (day-in-the-title) programs.
const { dayKeyOf } = require("../../services/reactiveProgression");

// Reference-only exercise swap inside a training[[ ]] structure. Preserves the programmed
// scheme (goals/achieved/techniques) — only the exercise ref changes. exerciseType only flips
// to "Time" when the replacement is an isometric/time-based movement, so a reps scheme is not
// left on a hold. Robust to bare ObjectId, populated { _id }, and legacy string exercise values.
//
// POSITION-PRECISE: when `pos` ({ circuitIndex, entryIndex }) is given and that exact slot still
// holds fromId, only that ONE slot is swapped — so a day holding the same exercise id in two
// slots (a generator can reuse one when a muscle pool runs dry) no longer gets both co-swapped,
// which was producing duplicates. Downstream cascade docs share the anchor's structure, so the
// same (circuitIndex, entryIndex) targets the matching slot there too. If the position is missing
// or has drifted out of alignment, we fall back to swapping the FIRST id match only (never every
// match), so a duplicate sibling is left intact instead of being rewritten as well.
const idOfEntry = (entry) => String(entry?.exercise?._id || entry?.exercise || "");
const applySwapToTraining = (training, fromId, newExercise, pos = null) => {
  const from = String(fromId);
  const swapEntry = (entry) => {
    const updated = { ...entry, exercise: newExercise._id };
    if (newExercise.measurementType === "time") updated.exerciseType = "Time";
    return updated;
  };
  // Copy the 2-D structure; only targeted entry objects are replaced.
  const next = (training || []).map((circuit) => (circuit || []).map((entry) => entry));

  const ci = pos && Number.isInteger(pos.circuitIndex) ? pos.circuitIndex : -1;
  const ei = pos && Number.isInteger(pos.entryIndex) ? pos.entryIndex : -1;
  if (ci >= 0 && ei >= 0 && next[ci] && next[ci][ei] && idOfEntry(next[ci][ei]) === from) {
    next[ci][ei] = swapEntry(next[ci][ei]);
    return { training: next, changed: 1 };
  }

  // Fallback: swap the first matching entry only.
  for (let c = 0; c < next.length; c += 1) {
    for (let e = 0; e < (next[c] || []).length; e += 1) {
      if (idOfEntry(next[c][e]) === from) {
        next[c][e] = swapEntry(next[c][e]);
        return { training: next, changed: 1 };
      }
    }
  }
  return { training: next, changed: 0 };
};

// Swap an exercise in one workout and (scope "forward") cascade it to every later workout
// in the same program. Works in two contexts, resolved from the anchor workout itself:
//   - isTemplate  → program-template: later = later week/day slots in Program.weeks.
//   - dated (client) → later = the client's future, not-yet-completed workouts in the program.
// Completed/logged workouts are never rewritten.
const swap_exercise_forward = async (req, res, next) => {
  try {
    const { anchorWorkoutId, fromExercise, toExercise, scope = "forward", programId, excludeAnchor } = req.body;
    const trainerId = res.locals.user._id;
    // Which slot the trainer clicked (from the exercise row). Optional for back-compat, but the
    // client always sends it now so a swap targets exactly that slot and its aligned downstream
    // slots — never a same-id sibling.
    const pos =
      Number.isInteger(req.body.circuitIndex) && Number.isInteger(req.body.entryIndex)
        ? { circuitIndex: req.body.circuitIndex, entryIndex: req.body.entryIndex }
        : null;

    if (!anchorWorkoutId || !fromExercise || !toExercise) {
      return res.status(400).json({ error: "anchorWorkoutId, fromExercise, and toExercise are required." });
    }
    if (String(fromExercise) === String(toExercise)) {
      return res.status(400).json({ error: "Replacement must differ from the current exercise." });
    }

    const newExercise = await Exercise.findById(toExercise)
      .select("_id exerciseTitle measurementType")
      .lean();
    if (!newExercise) {
      return res.status(404).json({ error: "Replacement exercise not found." });
    }

    const anchor = await Training.findById(anchorWorkoutId).lean();
    if (!anchor) {
      return res.status(404).json({ error: "Workout not found." });
    }

    const targetIds = [];
    const affectedMeta = new Map(); // id -> { weekIndex, dayIndex } (template context)

    if (anchor.isTemplate) {
      // ----- Program-template context -----
      const canWrite = await canWriteUserResource(res.locals.user, anchor.user);
      if (!canWrite) return res.status(403).json({ error: "Unauthorized access." });

      if (scope === "single") {
        targetIds.push(String(anchor._id));
      } else {
        if (!programId) {
          return res.status(400).json({ error: "programId is required to cascade a template." });
        }
        const program = await Program.findOne({ _id: programId, ownerId: trainerId }).lean();
        if (!program) return res.status(404).json({ error: "Program not found." });

        let anchorPos = null;
        (program.weeks || []).forEach((week, wi) => {
          (week || []).forEach((day, di) => {
            if (day.workoutId && String(day.workoutId) === String(anchor._id)) {
              anchorPos = { wi, di };
            }
          });
        });
        if (!anchorPos) {
          return res.status(400).json({ error: "Anchor workout is not part of this program." });
        }
        (program.weeks || []).forEach((week, wi) => {
          (week || []).forEach((day, di) => {
            if (!day.workoutId) return;
            const isLater = wi > anchorPos.wi || (wi === anchorPos.wi && di >= anchorPos.di);
            if (!isLater) return;
            targetIds.push(String(day.workoutId));
            affectedMeta.set(String(day.workoutId), { weekIndex: wi, dayIndex: di });
          });
        });
      }
    } else {
      // ----- Client dated context -----
      const clientId = anchor.user;
      const canWrite = await canWriteUserResource(res.locals.user, clientId);
      if (!canWrite) return res.status(403).json({ error: "Unauthorized access." });

      if (scope === "single") {
        targetIds.push(String(anchor._id));
      } else {
        const query = {
          user: clientId,
          complete: { $ne: true },
          date: { $gte: anchor.date },
        };
        if (anchor.programId) {
          // Reliable program scoping (assigned workouts stamped with programId).
          query.programId = anchor.programId;
        } else {
          // Legacy assigned workouts without a program link: best-effort scope to future
          // workouts that actually contain the exercise being swapped.
          query.training = {
            $elemMatch: { $elemMatch: { exercise: new mongoose.Types.ObjectId(fromExercise) } },
          };
        }
        const future = await Training.find(query).select("_id").lean();
        future.forEach((d) => targetIds.push(String(d._id)));
        if (!targetIds.includes(String(anchor._id))) targetIds.push(String(anchor._id));
      }
    }

    // The client can own the open anchor locally (the editor saves it) and ask the server to
    // touch only the CASCADE targets — avoids a server write racing the editor's unsaved state.
    const writeIds = excludeAnchor
      ? targetIds.filter((id) => String(id) !== String(anchorWorkoutId))
      : targetIds;

    // Apply the swap to each target and bulk-write only those that actually changed and are
    // not completed.
    const docs = await Training.find({ _id: { $in: writeIds } }).lean();
    const ops = [];
    const affected = [];
    docs.forEach((doc) => {
      if (doc.complete) return; // never rewrite a completed/logged workout
      const { training, changed } = applySwapToTraining(doc.training, fromExercise, newExercise, pos);
      if (!changed) return;
      const sanitized = sanitizeTrainingTechniques(training);
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { training: sanitized } } } });
      affected.push({ _id: String(doc._id), date: doc.date, ...(affectedMeta.get(String(doc._id)) || {}) });
    });

    if (ops.length) {
      await Training.bulkWrite(ops);
    }

    // Return the freshly updated docs (populated) so the client can upsert them into Redux.
    const workouts = await Training.find({ _id: { $in: affected.map((a) => a._id) } })
      .populate({ path: "training.exercise", model: "Exercise", select: "_id exerciseTitle" })
      .lean();

    return res.json({ updatedCount: ops.length, affected, workouts });
  } catch (err) {
    return next(err);
  }
};

// ---- Reorder cascade ----------------------------------------------------------------------
//
// Day scoping uses the shared dayKeyOf (programDay → the D<n>/Day <n> ordinal in the title →
// normalized title), so the cascade and the progression engine agree on what "this day" means.
const cascadeDayKey = dayKeyOf;
//
// Rearrange a workout's exercises into a given order and push that ORDER (never the loads) to
// the same program day in every later workout: "Brett's squat before his RDL felt better — keep
// it that way for the rest of the program."
//
// `shape` is the anchor's new layout as exercise ids: [[idA, idB], [idC]] (one inner array per
// circuit, warm-ups excluded). Each target workout is rebuilt to match it by moving its OWN
// entries — so every week keeps its own weights, reps and techniques and only the order changes.
const applyOrderToTraining = (training, shape) => {
  const circuits = (training || []).map((c) => (c || []).map((e) => e));

  // Rank each exercise by where it appears in the new layout.
  const rank = new Map();
  (shape || []).flat().forEach((id, i) => {
    const key = String(id);
    if (!rank.has(key)) rank.set(key, i);
  });

  // The slots (circuit + position) currently holding an exercise the layout mentions. Only
  // these are permuted, into the layout's relative order. Exercises the layout doesn't mention
  // — a later block's own lifts — keep their exact positions, and circuit grouping/sizes are
  // untouched. A full match therefore reproduces the layout exactly, while a partial match
  // (e.g. this day in a later mesocycle) moves only the shared exercises instead of shoving
  // that block's main lifts to the end.
  const slots = [];
  circuits.forEach((circuit, ci) =>
    circuit.forEach((entry, ei) => {
      if (entry?.isWarmup) return;
      if (rank.has(idOfEntry(entry))) slots.push({ ci, ei, entry });
    })
  );
  if (!slots.length) return { training: circuits, changed: 0 };

  const ordered = slots
    .map((s) => s.entry)
    .sort((a, b) => rank.get(idOfEntry(a)) - rank.get(idOfEntry(b))); // stable for duplicates

  const next = circuits.map((c) => c.slice());
  slots.forEach((slot, i) => {
    next[slot.ci][slot.ei] = ordered[i];
  });
  const before = JSON.stringify(circuits.map((c) => c.map(idOfEntry)));
  const after = JSON.stringify(next.map((c) => c.map(idOfEntry)));
  return { training: next, changed: before !== after ? 1 : 0 };
};

const reorder_exercises_forward = async (req, res, next) => {
  try {
    // excludeAnchor defaults to FALSE: the reorder is applied to the open workout too, so the
    // whole change lands in one action and the reported count is the honest total (the swap
    // cascade persists its anchor immediately for the same reason). The server rewrites the
    // anchor to exactly the order the editor already shows, so it can't fight unsaved edits.
    const { anchorWorkoutId, shape, programId, excludeAnchor = false } = req.body;
    if (!anchorWorkoutId || !Array.isArray(shape) || !shape.length) {
      return res.status(400).json({ error: "anchorWorkoutId and shape are required." });
    }

    const anchor = await Training.findById(anchorWorkoutId).lean();
    if (!anchor) return res.status(404).json({ error: "Workout not found." });

    const canWrite = await canWriteUserResource(res.locals.user, anchor.user);
    if (!canWrite) return res.status(403).json({ error: "Unauthorized access." });

    const targetIds = [];
    const affectedMeta = new Map();

    if (anchor.isTemplate) {
      // ----- Program-template context: the SAME day slot in every later week -----
      if (!programId) {
        return res.status(400).json({ error: "programId is required to cascade a template." });
      }
      const program = await Program.findOne({
        _id: programId,
        ownerId: res.locals.user._id,
      }).lean();
      if (!program) return res.status(404).json({ error: "Program not found." });

      let anchorPos = null;
      (program.weeks || []).forEach((week, wi) => {
        (week || []).forEach((day, di) => {
          if (day.workoutId && String(day.workoutId) === String(anchor._id)) anchorPos = { wi, di };
        });
      });
      if (!anchorPos) {
        return res.status(400).json({ error: "Anchor workout is not part of this program." });
      }
      (program.weeks || []).forEach((week, wi) => {
        const day = (week || [])[anchorPos.di];
        if (!day?.workoutId || wi < anchorPos.wi) return;
        targetIds.push(String(day.workoutId));
        affectedMeta.set(String(day.workoutId), { weekIndex: wi, dayIndex: anchorPos.di });
      });
    } else {
      // ----- Client dated context: this program day, forward, not yet completed -----
      const query = {
        user: anchor.user,
        complete: { $ne: true },
        date: { $gte: anchor.date },
      };
      // Scope to the program when the workouts carry the link. Legacy assigned programs predate
      // programId AND programDay — their week/day lives in the title ("…: Week 4, Day 1"), which
      // differs per week, so we can't filter by title in the query. dayKeyOf normalizes the week
      // out and does the day matching below over the client's (few) future workouts.
      if (anchor.programId) query.programId = anchor.programId;

      const future = await Training.find(query).select("_id title programDay date").lean();
      const anchorKey = cascadeDayKey(anchor);
      future
        .filter((d) => cascadeDayKey(d) === anchorKey) // same program day only — never Day 1 → Day 2
        .forEach((d) => targetIds.push(String(d._id)));
      if (!targetIds.includes(String(anchor._id))) targetIds.push(String(anchor._id));
    }

    // The open editor owns the anchor locally and saves it itself; touching it here would race
    // that save, so by default only the downstream copies are written.
    const writeIds = excludeAnchor
      ? targetIds.filter((id) => String(id) !== String(anchorWorkoutId))
      : targetIds;

    const docs = await Training.find({ _id: { $in: writeIds } }).lean();
    const ops = [];
    const affected = [];
    docs.forEach((doc) => {
      if (doc.complete) return; // a logged workout happened in its own order — leave it alone
      const { training, changed } = applyOrderToTraining(doc.training, shape);
      if (!changed) return;
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { training: sanitizeTrainingTechniques(training) } },
        },
      });
      affected.push({
        _id: String(doc._id),
        date: doc.date,
        ...(affectedMeta.get(String(doc._id)) || {}),
      });
    });

    if (ops.length) await Training.bulkWrite(ops);

    const workouts = await Training.find({ _id: { $in: affected.map((a) => a._id) } })
      .populate({ path: "training.exercise", model: "Exercise", select: "_id exerciseTitle mediaUrl" })
      .lean();

    // Counts the UI needs to say something true:
    //   updatedCount      — every workout actually rewritten (this one + later ones)
    //   laterUpdatedCount — just the future ones, for "…and N later workouts"
    //   consideredCount   — eligible future workouts on this day, so "0 updated" can say
    //                       "they already use this order" instead of "none were found".
    const isAnchor = (id) => String(id) === String(anchorWorkoutId);
    const consideredCount = docs.filter((d) => !d.complete && !isAnchor(d._id)).length;
    const laterUpdatedCount = affected.filter((a) => !isAnchor(a._id)).length;

    return res.json({
      updatedCount: ops.length,
      laterUpdatedCount,
      consideredCount,
      affected,
      workouts,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  swap_exercise_forward,
  applySwapToTraining,
  reorder_exercises_forward,
  applyOrderToTraining,
};
