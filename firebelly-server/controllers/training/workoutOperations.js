const {
  Exercise,
  Relationship,
  ScheduleEvent,
  TRAINING_UPDATE_FIELDS,
  Training,
  User,
  canWriteUserResource,
  checkClientRelationship,
  createEventDebitEntry,
  dayjs,
  mongoose,
  pick,
  reverseEventDebitEntry,
} = require("./context");
const {
  progressExerciseGoals,
  autoregulateExerciseGoals,
} = require("../../services/progressionEngine");

// Engine-driven progression: resolve each exercise's library classification, then apply
// the per-exercise progression step. Supersedes the flat applyProgression for the program
// builder. See docs/program-progression-roadmap.md.
const applyEngineProgression = async (
  training,
  { scheme = "linear", step = 1, deload = false } = {}
) => {
  if (!Array.isArray(training)) return;
  const ids = [];
  training.forEach((circuit) => {
    if (Array.isArray(circuit)) {
      circuit.forEach((ex) => {
        if (ex?.exercise) ids.push(String(ex.exercise));
      });
    }
  });
  if (!ids.length) return;
  const libs = await Exercise.find({ _id: { $in: [...new Set(ids)] } })
    .select("equipment movementComplexity measurementType")
    .lean();
  const byId = new Map(libs.map((l) => [String(l._id), l]));
  training.forEach((circuit) => {
    if (!Array.isArray(circuit)) return;
    circuit.forEach((ex) => {
      if (!ex?.goals) return;
      const lib = byId.get(String(ex.exercise)) || {};
      ex.goals = progressExerciseGoals(
        ex.goals,
        {
          equipment: lib.equipment,
          movementComplexity: lib.movementComplexity,
          measurementType: lib.measurementType,
          exerciseType: ex.exerciseType,
        },
        { scheme, step, deload }
      );
    });
  });
};

// Feedback autoregulation: for each exercise, decide next goals from how it was actually
// performed (achieved) + the difficulty feedback, then reset achieved/feedback for the new
// copy. Returns a tally of decisions. Reads achieved BEFORE it is cleared.
const applyAutoregulation = async (training, { scheme = "linear" } = {}) => {
  const tally = { progress: 0, push: 0, hold: 0, backoff: 0 };
  if (!Array.isArray(training)) return tally;
  const ids = [];
  training.forEach((circuit) => {
    if (Array.isArray(circuit)) {
      circuit.forEach((ex) => {
        if (ex?.exercise) ids.push(String(ex.exercise));
      });
    }
  });
  if (!ids.length) return tally;
  const libs = await Exercise.find({ _id: { $in: [...new Set(ids)] } })
    .select("equipment movementComplexity measurementType")
    .lean();
  const byId = new Map(libs.map((l) => [String(l._id), l]));
  training.forEach((circuit) => {
    if (!Array.isArray(circuit)) return;
    circuit.forEach((ex) => {
      if (!ex?.goals) return;
      const lib = byId.get(String(ex.exercise)) || {};
      const difficulty = ex?.feedback?.difficulty;
      const { goals, decision } = autoregulateExerciseGoals(
        ex.goals,
        ex.achieved,
        {
          equipment: lib.equipment,
          movementComplexity: lib.movementComplexity,
          measurementType: lib.measurementType,
          exerciseType: ex.exerciseType,
        },
        { scheme, difficulty: difficulty == null ? 1 : difficulty }
      );
      ex.goals = goals;
      if (tally[decision] != null) tally[decision] += 1;
      if (ex.achieved) {
        for (const prop in ex.achieved) {
          if (Array.isArray(ex.achieved[prop])) {
            ex.achieved[prop] = ex.achieved[prop].map(() => "0");
          }
        }
      }
      ex.feedback = { difficulty: null, comments: [] };
    });
  });
  return tally;
};

const update_workout_date_by_id = async (req, res, next) => {
  try {
    const { _id, newDate } = req.body;
    const hasNewTitle = Object.prototype.hasOwnProperty.call(req.body, "newTitle");
    const training = await Training.findById(_id).select("user");

    if (!training) {
      return res.status(404).json({ error: "Training not found." });
    }

    // Check if the user updating the data is the owner
    if (String(training.user) !== String(res.locals.user._id)) {
      // If not the owner, check the relationship
      const relationship = await checkClientRelationship(res.locals.user._id, training.user);

      if (!relationship || !relationship.accepted) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const update = {
      date: newDate === "" ? null : newDate,
    };

    if (hasNewTitle) {
      update.title = req.body.newTitle;
    }

    const updatedTraining = await Training.findByIdAndUpdate(
      _id,
      { $set: update },
      { returnDocument: "after" }
    )
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    return res.send(updatedTraining);
  } catch (error) {
    return next(error);
  }
};

// Apply a fixed progression rule to a workout's per-set goal arrays. Used by the program
// builder to generate progressing weeks (week N+1 = week N + increment).
//   weight: { amount, mode: "add" | "percent" }   reps: { amount }
const applyProgression = (trainingArray, progression) => {
  if (!progression || !Array.isArray(trainingArray)) return;
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const weight = progression.weight || null;
  const weightAmt = weight ? Number(weight.amount) || 0 : 0;
  const repsAmt = Number(progression.reps?.amount) || 0;

  trainingArray.forEach((circuit) => {
    if (!Array.isArray(circuit)) return;
    circuit.forEach((exercise) => {
      if (!exercise || !exercise.goals) return;
      const goals = exercise.goals;
      if (weightAmt && Array.isArray(goals.weight)) {
        goals.weight = goals.weight.map((v) => {
          const base = toNum(v);
          const next =
            weight.mode === "percent" ? base * (1 + weightAmt / 100) : base + weightAmt;
          return Math.max(0, Math.round(next * 2) / 2); // round to nearest 0.5
        });
      }
      if (repsAmt) {
        ["minReps", "maxReps", "exactReps"].forEach((key) => {
          if (Array.isArray(goals[key])) {
            goals[key] = goals[key].map((v) => Math.max(0, Math.round(toNum(v) + repsAmt)));
          }
        });
      }
    });
  });
};

const copy_workout_by_id = async (req, res, next) => {
  try {
    const { newDate, _id, option = "exact", newTitle, newAccount } = req.body;
    if (!_id) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const data = await Training.findOne({ _id }).lean();
    if (!data) return res.status(404).json({ error: "Training not found." });
    const hasNewDate = newDate !== undefined && newDate !== null && newDate !== "";
    if (!hasNewDate && !data.isTemplate) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (String(data.user) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: data.user,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const copyData = { ...data };
    copyData._id = new mongoose.Types.ObjectId();
    copyData.isNew = true;
    if (hasNewDate) {
      copyData.date = dayjs.utc(newDate).startOf("day").toDate();
    }
    const nextUser = newAccount || copyData.user;
    copyData.user =
      mongoose.Types.ObjectId.isValid(nextUser) && !(nextUser instanceof mongoose.Types.ObjectId)
        ? new mongoose.Types.ObjectId(nextUser)
        : nextUser;
    copyData.workoutFeedback = { difficulty: 1, comments: [] };
    if (newTitle) copyData.title = newTitle;

    // Feedback autoregulation reads achieved + feedback, so it must run before the option
    // switch (which clears them). When on, it fully owns goal/achieved handling.
    let autoregulationTally = null;
    if (req.body.autoregulate && Array.isArray(copyData.training)) {
      copyData.complete = false;
      autoregulationTally = await applyAutoregulation(copyData.training, {
        scheme: req.body.scheme || "linear",
      });
    } else if (Array.isArray(copyData.training)) {
      switch (option) {
        case "achievedToNewGoal":
          copyData.complete = false;
          copyData.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.goals.exactReps = exercise.achieved.reps;
              exercise.goals.weight = exercise.achieved.weight;
              exercise.goals.percent = exercise.achieved.percent;
              exercise.goals.seconds = exercise.achieved.seconds;
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "copyGoalOnly":
          copyData.complete = false;
          copyData.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "exact":
        default:
          copyData.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };
            });
          });
          break;
      }
    }

    // Progression (program builder). Prefer the engine (per-exercise, classification-aware);
    // fall back to the legacy flat rule if only `progression` was sent.
    if (req.body.scheme && !req.body.autoregulate && Array.isArray(copyData.training)) {
      await applyEngineProgression(copyData.training, {
        scheme: req.body.scheme,
        step: req.body.step || 1,
        deload: Boolean(req.body.deload),
      });
    } else if (req.body.progression && Array.isArray(copyData.training)) {
      applyProgression(copyData.training, req.body.progression);
    }

    const insertResult = await Training.collection.insertOne(copyData, { ordered: false });
    const insertedId = insertResult.insertedId;

    const workoutCopy = await Training.findById(insertedId)
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    if (autoregulationTally) {
      const obj = workoutCopy.toObject ? workoutCopy.toObject() : workoutCopy;
      obj.autoregulation = autoregulationTally;
      return res.send(obj);
    }
    return res.send(workoutCopy);
  } catch (err) {
    return next(err);
  }
};

const get_training_range_end = async (req, res, next) => {
  try {
    const { startDate, userId } = req.body;
    if (!startDate) {
      return res.status(400).json({ error: "Start date is required." });
    }

    let targetUserId = res.locals.user._id;

    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const maxTraining = await Training.findOne({
      user: targetUserId,
      date: { $gte: new Date(startDate) },
    })
      .sort({ date: -1 })
      .select("date")
      .lean();

    return res.send({ maxDate: maxTraining?.date || null });
  } catch (err) {
    return next(err);
  }
};

const bulk_move_copy_workouts = async (req, res, next) => {
  try {
    const {
      action,
      rangeStart,
      rangeEnd,
      targetStartDate,
      option = "exact",
      userId,
      newAccount,
      targetQueue = false,
      conflictPolicy,
      filters = {},
      titlePrefix = "",
      titleSuffix = "",
    } = req.body;

    if (!action || !rangeStart || (!targetStartDate && !targetQueue)) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    let targetUserId = res.locals.user._id;

    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const startDate = dayjs.utc(rangeStart).startOf("day");
    let endDate = rangeEnd ? dayjs.utc(rangeEnd).endOf("day") : null;

    if (!endDate) {
      const maxTraining = await Training.findOne({
        user: targetUserId,
        date: { $gte: startDate.toDate() },
      })
        .sort({ date: -1 })
        .select("date")
        .lean();

      if (!maxTraining?.date) {
        const targetUser = await User.findById(targetUserId)
          .select("_id firstName lastName profilePicture")
          .lean();
        return res.send({ workouts: [], user: targetUser ?? { _id: targetUserId } });
      }
      endDate = dayjs(maxTraining.date).endOf("day");
    }

    if (endDate.isBefore(startDate)) {
      return res.status(400).json({ error: "Range end must be on or after start." });
    }

    const deltaDays = targetQueue
      ? 0
      : dayjs.utc(targetStartDate).startOf("day").diff(startDate, "day");

    const workoutQuery = {
      user: targetUserId,
      date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    };

    if (filters?.categoriesInclude?.length || filters?.categoriesExclude?.length) {
      workoutQuery.category = {};
      if (filters.categoriesInclude?.length) {
        workoutQuery.category.$in = filters.categoriesInclude;
      }
      if (filters.categoriesExclude?.length) {
        workoutQuery.category.$nin = filters.categoriesExclude;
      }
    }

    if (filters?.includeCompleted === false) {
      workoutQuery.complete = { $ne: true };
    }

    if (filters?.includeTemplates === false) {
      workoutQuery.isTemplate = { $ne: true };
    }

    const workoutsInRange = await Training.find(workoutQuery);

    if (!workoutsInRange.length) {
      const targetUser = await User.findById(targetUserId)
        .select("_id firstName lastName profilePicture")
        .lean();
      return res.send({ workouts: [], user: targetUser ?? { _id: targetUserId } });
    }

    const effectiveConflictPolicy =
      action === "copy" ? "allow" : conflictPolicy || "abort";

    let workoutsToProcess = workoutsInRange;
    const targetUserForConflicts = action === "copy" ? newAccount || targetUserId : targetUserId;
    const movingIds = new Set(workoutsInRange.map((workout) => String(workout._id)));
    const targetDateRanges = targetQueue
      ? []
      : workoutsInRange.map((workout) => {
          const targetDate = dayjs.utc(workout.date).add(deltaDays, "day");
          return {
            date: {
              $gte: targetDate.startOf("day").toDate(),
              $lte: targetDate.endOf("day").toDate(),
            },
          };
        });

    let deletedConflictIds = [];
    if (targetDateRanges.length) {
      const conflictQuery = {
        user: targetUserForConflicts,
        $or: targetDateRanges,
      };

      if (action === "move") {
        conflictQuery._id = { $nin: [...movingIds] };
      }

      const conflicts = await Training.find(conflictQuery).select("date _id").lean();

      if (conflicts.length) {
        const conflictDates = [
          ...new Set(conflicts.map((entry) => dayjs.utc(entry.date).format("YYYY-MM-DD"))),
        ];

        if (effectiveConflictPolicy === "abort") {
          return res.status(409).json({
            error: `Conflicts found on target dates: ${conflictDates.join(", ")}`,
            conflicts: conflictDates,
          });
        }

        if (effectiveConflictPolicy === "replace") {
          const deleteQuery = {
            user: targetUserForConflicts,
            $or: targetDateRanges,
          };
          if (action === "move") {
            deleteQuery._id = { $nin: [...movingIds] };
          }
          deletedConflictIds = conflicts.map((entry) => entry._id);
          await Training.deleteMany(deleteQuery);
        }

        if (effectiveConflictPolicy === "skip") {
          const conflictDateSet = new Set(conflictDates);
          workoutsToProcess = workoutsInRange.filter((workout) => {
            const targetDate = dayjs.utc(workout.date).add(deltaDays, "day");
            return !conflictDateSet.has(targetDate.format("YYYY-MM-DD"));
          });
        }
      }
    }

    const resetWorkoutForCopy = (workout, copyOption) => {
      if (!workout?.training) return;

      switch (copyOption) {
        case "achievedToNewGoal":
          workout.complete = false;
          workout.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.goals.exactReps = exercise.achieved.reps;
              exercise.goals.weight = exercise.achieved.weight;
              exercise.goals.percent = exercise.achieved.percent;
              exercise.goals.seconds = exercise.achieved.seconds;
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "copyGoalOnly":
          workout.complete = false;
          workout.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "exact":
        default:
          workout.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };
            });
          });
          break;
      }
    };

    const updatedWorkouts = [];
    const workoutIds = workoutsToProcess.map((workout) => workout._id);
    const previousDates = workoutsToProcess.map((workout) => ({
      id: workout._id,
      date: workout.date,
    }));

    if (action === "move") {
      const bulkOps = workoutsToProcess.map((workout) => ({
        updateOne: {
          filter: { _id: workout._id },
          update: {
            $set: {
              date: targetQueue
                ? null
                : dayjs.utc(workout.date).add(deltaDays, "day").toDate(),
              title: workout.title
                ? `${titlePrefix}${workout.title}${titleSuffix}`
                : workout.title,
            },
          },
        },
      }));

      if (bulkOps.length) {
        await Training.bulkWrite(bulkOps, { ordered: false });
      }
    } else if (action === "copy") {
      const insertDocs = [];
      for (const workout of workoutsToProcess) {
        const copyData = workout.toObject({ depopulate: true });
        copyData._id = new mongoose.Types.ObjectId();
        copyData.isNew = true;
        copyData.date = targetQueue
          ? null
          : dayjs.utc(workout.date).add(deltaDays, "day").startOf("day").toDate();
        const nextUser = newAccount || copyData.user;
        copyData.user =
          mongoose.Types.ObjectId.isValid(nextUser) && !(nextUser instanceof mongoose.Types.ObjectId)
            ? new mongoose.Types.ObjectId(nextUser)
            : nextUser;
        copyData.workoutFeedback = { difficulty: 1, comments: [] };
        if (copyData.title) {
          copyData.title = `${titlePrefix}${copyData.title}${titleSuffix}`;
        }

        if (option === "autoregulate") {
          // Bring each exercise's next-session goals from its logged results (+ difficulty
          // feedback), reset achieved, and leave the copy UNcompleted — it's a fresh workout to
          // perform, so the new numbers belong in the goals, not achieved.
          copyData.complete = false;
          await applyAutoregulation(copyData.training, { scheme: req.body.scheme || "linear" });
        } else {
          resetWorkoutForCopy(copyData, option);
        }

        insertDocs.push(copyData);
      }
      if (insertDocs.length) {
        const insertResult = await Training.collection.insertMany(insertDocs, {
          ordered: false,
        });
        updatedWorkouts.push(
          ...Object.values(insertResult.insertedIds).map((id) => ({ _id: id }))
        );
      }
    } else {
      return res.status(400).json({ error: "Invalid action." });
    }

    const hydratedIds =
      action === "copy" ? updatedWorkouts.map((workout) => workout._id) : workoutIds;
    const hydratedWorkouts = await Training.find({ _id: { $in: hydratedIds } })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    const responseUserId = action === "copy" ? newAccount || targetUserId : targetUserId;
    const responseUser =
      hydratedWorkouts[0]?.user ??
      (await User.findById(responseUserId).select("_id firstName lastName profilePicture").lean());

    const operation = {
      action,
      userId: responseUserId,
      targetQueue,
      deltaDays,
      affectedIds: workoutIds,
      createdIds: action === "copy" ? hydratedIds : [],
      previousDates,
      timestamp: new Date(),
    };

    return res.send({
      workouts: hydratedWorkouts,
      user: responseUser ?? { _id: responseUserId },
      deletedIds: deletedConflictIds,
      operation,
    });
  } catch (err) {
    console.error("[bulkMoveCopyWorkouts] error:", err);
    return next(err);
  }
};

const get_workouts_by_range = async (req, res, next) => {
  try {
    const { client, rangeStart, rangeEnd, filters = {} } = req.body;
    if (!rangeStart || !rangeEnd) {
      return res.status(400).json({ error: "Range start and end are required." });
    }
    const user = res.locals.user;
    let clientObj;

    if (client && String(client) !== String(user._id)) {
      const relationship = await Relationship.findOne({ trainer: user._id, client })
        .populate({
          path: "client",
          model: "User",
          select: "_id firstName lastName profilePicture",
        });
      if (!relationship || !relationship.accepted) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      clientObj = relationship.client;
    }

    const targetUser = clientObj ?? user;
    const startDate = dayjs.utc(rangeStart).startOf("day").toDate();
    const endDate = dayjs.utc(rangeEnd).endOf("day").toDate();

    const targetUserId = targetUser._id;
    const targetUserObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
      ? new mongoose.Types.ObjectId(targetUserId)
      : null;
    const userMatch = targetUserObjectId ? { $in: [targetUserId, targetUserObjectId] } : targetUserId;

    const workoutQuery = {
      user: userMatch,
      $expr: {
        $and: [
          { $gte: [{ $toDate: "$date" }, startDate] },
          { $lte: [{ $toDate: "$date" }, endDate] },
        ],
      },
    };

    if (filters?.categoriesInclude?.length || filters?.categoriesExclude?.length) {
      workoutQuery.category = {};
      if (filters.categoriesInclude?.length) {
        workoutQuery.category.$in = filters.categoriesInclude;
      }
      if (filters.categoriesExclude?.length) {
        workoutQuery.category.$nin = filters.categoriesExclude;
      }
    }

    if (filters?.includeCompleted === false) {
      workoutQuery.complete = { $ne: true };
    }

    if (filters?.includeTemplates === false) {
      workoutQuery.isTemplate = { $ne: true };
    }

    const workouts = await Training.find(workoutQuery)
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    return res.send({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const undo_bulk_move_copy = async (req, res, next) => {
  try {
    const { operation } = req.body;
    if (!operation || !operation.action) {
      return res.status(400).json({ error: "Missing operation." });
    }
    const targetUserId = operation.userId || res.locals.user._id;
    if (String(targetUserId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: targetUserId,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    if (operation.action === "copy") {
      if (operation.createdIds?.length) {
        await Training.deleteMany({ _id: { $in: operation.createdIds } });
      }
      return res.send({ deletedIds: operation.createdIds || [] });
    }

    if (operation.action === "move") {
      const bulkOps = (operation.previousDates || []).map((entry) => ({
        updateOne: {
          filter: { _id: entry.id },
          update: { $set: { date: entry.date } },
        },
      }));
      if (bulkOps.length) {
        await Training.bulkWrite(bulkOps, { ordered: false });
      }
      const workouts = await Training.find({ _id: { $in: operation.affectedIds || [] } })
        .populate({
          path: "training.exercise",
          model: "Exercise",
          select: "_id exerciseTitle",
        })
        .populate({
          path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
          model: "User",
          select: "_id firstName lastName profilePicture",
        });
      return res.send({ workouts });
    }

    return res.status(400).json({ error: "Invalid operation." });
  } catch (err) {
    return next(err);
  }
};

const debug_training_by_ids = async (req, res, next) => {
  try {
    const { ids = [], userId, ignoreUser = false } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: "ids array is required." });
    }

    let targetUserId = res.locals.user._id;
    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const targetUserObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
      ? new mongoose.Types.ObjectId(targetUserId)
      : null;
    const userMatch = targetUserObjectId ? { $in: [targetUserId, targetUserObjectId] } : targetUserId;

    const query = {
      _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    };
    if (!ignoreUser) {
      query.user = userMatch;
    }

    const trainings = await Training.find(query)
      .select("_id date user title category")
      .lean();

    return res.send({ trainings, count: trainings.length });
  } catch (err) {
    return next(err);
  }
};

const delete_workout_by_id = async (req, res, next) => {
  try {
    const workoutId = req.body._id;
    const data = await Training.findOne({ _id: workoutId }).select("_id user").lean();

    if (!data) {
      return res.status(404).json({ error: "Training not found." });
    }

    const accountId = String(data.user);
    if (accountId !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: accountId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    await Training.deleteOne({ _id: workoutId });

    global.io?.to(`workouts:${accountId}`).emit("workoutDeleted", {
      workoutId: String(workoutId),
      accountId,
    });

    return res.send({
      status: "Record deleted",
      deletedId: String(workoutId),
      accountId,
    });
  } catch (err) {
    return next(err);
  }
};

// Bulk-delete a client's (or your own) workouts in a date range, mirroring
// bulk_move_copy_workouts' selection model (date range + filters). Completed workouts and
// templates are excluded unless the caller opts in, so logged history is protected by default.
// The full deleted docs are returned inside `operation` so the client can undo by sending them
// back to undo_bulk_delete (matches the move/copy "operation lives client-side" design).
const bulk_delete_workouts = async (req, res, next) => {
  try {
    const { rangeStart, rangeEnd, userId, filters = {} } = req.body;

    if (!rangeStart) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    let targetUserId = res.locals.user._id;
    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }
    const accountId = String(targetUserId);

    const startDate = dayjs.utc(rangeStart).startOf("day");
    let endDate = rangeEnd ? dayjs.utc(rangeEnd).endOf("day") : null;
    if (!endDate) {
      const maxTraining = await Training.findOne({
        user: targetUserId,
        date: { $gte: startDate.toDate() },
      })
        .sort({ date: -1 })
        .select("date")
        .lean();
      if (!maxTraining?.date) {
        return res.send({ deletedIds: [], count: 0, operation: null, accountId });
      }
      endDate = dayjs(maxTraining.date).endOf("day");
    }
    if (endDate.isBefore(startDate)) {
      return res.status(400).json({ error: "Range end must be on or after start." });
    }

    const workoutQuery = {
      user: targetUserId,
      date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    };
    if (filters?.categoriesInclude?.length || filters?.categoriesExclude?.length) {
      workoutQuery.category = {};
      if (filters.categoriesInclude?.length) workoutQuery.category.$in = filters.categoriesInclude;
      if (filters.categoriesExclude?.length) workoutQuery.category.$nin = filters.categoriesExclude;
    }
    // Protect logged history and program templates by default; caller must opt in to include them.
    if (filters?.includeCompleted !== true) workoutQuery.complete = { $ne: true };
    if (filters?.includeTemplates !== true) workoutQuery.isTemplate = { $ne: true };

    // Stash the full docs before deleting so undo can re-insert them verbatim (ids preserved).
    const deletedDocs = await Training.find(workoutQuery).lean();
    if (!deletedDocs.length) {
      return res.send({ deletedIds: [], count: 0, operation: null, accountId });
    }
    const ids = deletedDocs.map((d) => d._id);
    const deletedIds = ids.map(String);

    await Training.deleteMany({ _id: { $in: ids } });

    // Cross-device parity: reuse the single-delete socket event the client already handles.
    deletedIds.forEach((id) =>
      global.io?.to(`workouts:${accountId}`).emit("workoutDeleted", { workoutId: id, accountId })
    );

    const operation = {
      action: "delete",
      userId: accountId,
      deletedIds,
      deletedDocs, // full snapshots for undo
      timestamp: new Date(),
    };

    return res.send({ deletedIds, count: deletedIds.length, operation, accountId });
  } catch (err) {
    return next(err);
  }
};

// Undo a bulk delete by re-inserting the stashed docs (idempotent — skips any already restored).
const undo_bulk_delete = async (req, res, next) => {
  try {
    const { operation } = req.body;
    if (!operation || operation.action !== "delete" || !Array.isArray(operation.deletedDocs)) {
      return res.status(400).json({ error: "Invalid undo operation." });
    }

    let targetUserId = res.locals.user._id;
    if (operation.userId && String(operation.userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: operation.userId,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = operation.userId;
    }
    const accountId = String(targetUserId);

    // Only restore docs that belong to the authorized target and aren't already back.
    const wanted = operation.deletedDocs.filter((d) => d && String(d.user) === accountId);
    const wantedIds = wanted.map((d) => d._id);
    const existing = await Training.find({ _id: { $in: wantedIds } }).select("_id").lean();
    const existingSet = new Set(existing.map((e) => String(e._id)));
    const toInsert = wanted.filter((d) => !existingSet.has(String(d._id)));

    if (toInsert.length) {
      // Mongoose insertMany casts the JSON-round-tripped strings back to ObjectIds/Dates and
      // preserves the provided _id values.
      await Training.insertMany(toInsert, { ordered: false });
    }

    const restored = await Training.find({ _id: { $in: wantedIds } })
      .populate({ path: "training.exercise", model: "Exercise", select: "_id exerciseTitle" })
      .populate({ path: "user", model: "User", select: "_id firstName lastName profilePicture" })
      .lean();

    return res.send({
      workouts: restored,
      user: restored[0]?.user ?? { _id: targetUserId },
      accountId,
      restoredCount: toInsert.length,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  applyEngineProgression,
  update_workout_date_by_id,
  copy_workout_by_id,
  get_training_range_end,
  bulk_move_copy_workouts,
  get_workouts_by_range,
  undo_bulk_move_copy,
  debug_training_by_ids,
  delete_workout_by_id,
  bulk_delete_workouts,
  undo_bulk_delete,
};
