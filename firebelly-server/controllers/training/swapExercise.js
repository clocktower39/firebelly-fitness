const {
  Training,
  Exercise,
  canWriteUserResource,
  mongoose,
} = require("./context");
const Program = require("../../models/program");
const { sanitizeTrainingTechniques } = require("../../services/techniqueValidation");

// Reference-only exercise swap inside a training[[ ]] structure. For every entry whose
// exercise id equals fromId, point it at newExercise while preserving the programmed
// scheme (goals/achieved/techniques). exerciseType only flips to "Time" when the
// replacement is an isometric/time-based movement, so a reps scheme is not left on a hold.
// Robust to bare ObjectId, populated { _id }, and legacy string exercise values.
const applySwapToTraining = (training, fromId, newExercise) => {
  let changed = 0;
  const next = (training || []).map((circuit) =>
    (circuit || []).map((entry) => {
      const currentId = String(entry.exercise?._id || entry.exercise || "");
      if (!currentId || currentId !== String(fromId)) return entry;
      changed += 1;
      const updated = { ...entry, exercise: newExercise._id };
      if (newExercise.measurementType === "time") {
        updated.exerciseType = "Time";
      }
      return updated;
    })
  );
  return { training: next, changed };
};

// Swap an exercise in one workout and (scope "forward") cascade it to every later workout
// in the same program. Works in two contexts, resolved from the anchor workout itself:
//   - isTemplate  → program-template: later = later week/day slots in Program.weeks.
//   - dated (client) → later = the client's future, not-yet-completed workouts in the program.
// Completed/logged workouts are never rewritten.
const swap_exercise_forward = async (req, res, next) => {
  try {
    const { anchorWorkoutId, fromExercise, toExercise, scope = "forward", programId } = req.body;
    const trainerId = res.locals.user._id;

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

    // Apply the swap to each target and bulk-write only those that actually changed and are
    // not completed.
    const docs = await Training.find({ _id: { $in: targetIds } }).lean();
    const ops = [];
    const affected = [];
    docs.forEach((doc) => {
      if (doc.complete) return; // never rewrite a completed/logged workout
      const { training, changed } = applySwapToTraining(doc.training, fromExercise, newExercise);
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

module.exports = { swap_exercise_forward, applySwapToTraining };
