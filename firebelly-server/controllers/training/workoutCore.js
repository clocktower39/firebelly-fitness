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
const { createNotification } = require("../../services/notificationService");
const { bridgeWorkoutComment } = require("../../services/messagingBridge");
const { sanitizeTrainingTechniques } = require("../../services/techniqueValidation");
const { applyResultsToFutureProgram } = require("../../services/reactiveProgression");

const create_training = async (req, res, next) => {
  try {
    const { userId, ...payload } = req.body;
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

    if (Array.isArray(payload.training)) {
      payload.training = sanitizeTrainingTechniques(payload.training);
    }
    const training = new Training({
      ...payload,
      user: targetUserId,
    });

    const saved = await training.save();
    return res.send({
      status: "success",
      training: saved,
    });
  } catch (err) {
    return next(err);
  }
};

// Total comments across a workout (workout-level + per-exercise), for detecting newly added ones.
const countComments = (doc) => {
  if (!doc) return 0;
  let n = doc.workoutFeedback?.comments?.length || 0;
  (doc.training || []).forEach((circuit) => {
    (Array.isArray(circuit) ? circuit : []).forEach((ex) => {
      n += ex?.feedback?.comments?.length || 0;
    });
  });
  return n;
};

// The most recent non-deleted comment by a given user across the whole workout (workout-level +
// per-exercise), used to surface the just-added comment text into the chat bridge.
const latestCommentText = (doc, actorId) => {
  if (!doc) return "";
  const all = [...(doc.workoutFeedback?.comments || [])];
  (doc.training || []).forEach((circuit) => {
    (Array.isArray(circuit) ? circuit : []).forEach((ex) => {
      (ex?.feedback?.comments || []).forEach((c) => all.push(c));
    });
  });
  const mine = all
    .filter((c) => c && !c.deletedAt && String(c.user) === String(actorId))
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return mine[0]?.text || "";
};

const update_training = async (req, res, next) => {
  try {
    const existing = await Training.findById(req.body._id).lean();
    if (!existing) {
      return res.status(404).json({ error: "Training not found." });
    }

    const canWrite = await canWriteUserResource(res.locals.user, existing.user);
    if (!canWrite) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (req.body.training && Array.isArray(req.body.training.training)) {
      req.body.training.training = sanitizeTrainingTechniques(req.body.training.training);
    }
    const updates = pick(req.body.training, TRAINING_UPDATE_FIELDS);
    const training = await Training.findByIdAndUpdate(
      req.body._id,
      { $set: updates },
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

    if (!training) {
      return res.status(404).json({ error: "Training not found." });
    }

    const wasComplete = !!existing.complete;
    const isComplete = !!training.complete;
    if (wasComplete !== isComplete) {
      const event = await ScheduleEvent.findOne({ workoutId: training._id });
      if (event && event.eventType === "APPOINTMENT" && event.status !== "CANCELLED") {
        if (isComplete) {
          const eventUpdates = { status: "COMPLETED" };
          if (!event.billingStatus || event.billingStatus === "UNBILLED") {
            eventUpdates.billingStatus = "CHARGED";
          }
          const updatedEvent = await ScheduleEvent.findByIdAndUpdate(event._id, eventUpdates, {
            returnDocument: "after",
          });
          if (updatedEvent?.billingStatus === "CHARGED") {
            await createEventDebitEntry({
              event: updatedEvent,
              userId: res.locals.user._id,
              source: "APPOINTMENT",
            });
          } else {
            await reverseEventDebitEntry({ event: updatedEvent, userId: res.locals.user._id });
          }
        } else if (event.status === "COMPLETED") {
          const updatedEvent = await ScheduleEvent.findByIdAndUpdate(
            event._id,
            { status: "BOOKED" },
            { returnDocument: "after" }
          );
          await reverseEventDebitEntry({ event: updatedEvent, userId: res.locals.user._id });
        }
      }
    }

    // When a client completes a workout in an assigned program, seed the recommended loads for
    // its exercises in their later, not-yet-done workouts from what they actually achieved
    // (best-effort; never blocks the save). Returned so the client can upsert the fresh docs.
    let reactiveUpdates = [];
    if (!wasComplete && isComplete) {
      try {
        reactiveUpdates = await applyResultsToFutureProgram(training);
      } catch (err) {
        console.error("reactive progression failed:", err.message);
      }
    }

    // Notify the client's active trainers when a workout is completed (best-effort; never
    // blocks the save). Skips whoever performed the action (e.g. a trainer completing it).
    if (!wasComplete && isComplete) {
      try {
        const clientId = training.user?._id || training.user;
        const clientName =
          [training.user?.firstName, training.user?.lastName].filter(Boolean).join(" ") ||
          "Your client";
        const rels = await Relationship.find({
          client: clientId,
          accepted: true,
          engagementStatus: "active",
        })
          .select("trainer")
          .lean();
        await Promise.all(
          rels
            .map((r) => String(r.trainer))
            .filter((trainerId) => trainerId !== String(res.locals.user._id))
            .map((trainerId) =>
              createNotification({
                userId: trainerId,
                type: "CLIENT_WORKOUT_COMPLETED",
                title: `${clientName} completed a workout`,
                body: training.title || "Tap to review their session.",
                link: `/workout/${training._id}`,
              })
            )
        );
      } catch (err) {
        console.error("workout-complete notification failed:", err.message);
      }
    }

    // Notify the other party when a comment is added to the workout (best-effort).
    try {
      if (countComments(req.body.training) > countComments(existing)) {
        const ownerId = String(training.user?._id || training.user);
        const actorId = String(res.locals.user._id);
        const actorName =
          [res.locals.user.firstName, res.locals.user.lastName].filter(Boolean).join(" ") ||
          "Someone";
        const workoutTitle = training.title || "a workout";
        const commentText = latestCommentText(req.body.training, actorId);
        const context = {
          type: "workout",
          id: training._id,
          label: workoutTitle,
          link: `/workout/${training._id}`,
        };
        if (actorId === ownerId) {
          // The client commented → notify their active trainers + bridge into each chat.
          const rels = await Relationship.find({
            client: ownerId,
            accepted: true,
            engagementStatus: "active",
          })
            .select("trainer")
            .lean();
          rels
            .map((r) => String(r.trainer))
            .filter((trainerId) => trainerId !== actorId)
            .forEach((trainerId) => {
              createNotification({
                userId: trainerId,
                type: "WORKOUT_COMMENT",
                title: `${actorName} commented`,
                body: `New comment on "${workoutTitle}".`,
                link: `/workout/${training._id}`,
              }).catch(() => {});
              bridgeWorkoutComment({
                ownerId,
                trainerId,
                senderId: ownerId,
                body: commentText,
                context,
              });
            });
        } else {
          // A trainer (or other) commented → notify the workout owner + bridge into their chat.
          createNotification({
            userId: ownerId,
            type: "WORKOUT_COMMENT",
            title: "New comment on your workout",
            body: `${actorName} commented on "${workoutTitle}".`,
            link: `/workout/${training._id}`,
          }).catch(() => {});
          bridgeWorkoutComment({
            ownerId,
            trainerId: actorId,
            senderId: actorId,
            body: commentText,
            context,
          });
        }
      }
    } catch (err) {
      console.error("workout-comment notification failed:", err.message);
    }

    const accountId = String(training.user?._id || training.user);
    global.io?.to(`workouts:${accountId}`).emit("workoutUpdated", {
      workoutId: String(training._id),
      accountId,
      workout: training,
    });

    // Push the reactively-seeded future workouts to any other connected devices too.
    reactiveUpdates.forEach((w) => {
      const acct = String(w.user?._id || w.user);
      global.io?.to(`workouts:${acct}`).emit("workoutUpdated", {
        workoutId: String(w._id),
        accountId: acct,
        workout: w,
      });
    });

    return res.send({ training, reactiveUpdates });
  } catch (err) {
    return next(err);
  }
};

const get_training_by_id = (req, res, next) => {
  Training.findOne({ _id: req.body._id })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .populate({
      path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .then((data) => {
      if (!data) {
        return res.status(404).json({ error: "Training not found." });
      }

      if (data.user._id.toString() === res.locals.user._id) {
        return res.send(data);
      }

      Relationship.findOne({ trainer: res.locals.user._id, client: data.user._id })
        .then((relationship) => {
          if (!relationship || !relationship.accepted) {
            return res.status(403).json({ error: "Unauthorized access." });
          }
          res.send(data);
        })
        .catch((err) => next(err));
    })
    .catch((err) => next(err));
};

// The next dated workout (after the current one) that the viewer can access — their own for
// clients, or any of their clients' for trainers — so you can move straight to the next one.
const get_next_workout = async (req, res, next) => {
  try {
    const current = await Training.findOne({ _id: req.body._id }).select("user date isTemplate").lean();
    if (!current) return res.status(404).json({ error: "Training not found." });
    if (current.isTemplate) return res.json({ next: null }); // templates aren't part of a dated flow

    // Access: must own it or be an accepted trainer of the owner.
    if (String(res.locals.user._id) !== String(current.user)) {
      const rel = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: current.user,
        accepted: true,
      });
      if (!rel) return res.status(403).json({ error: "Unauthorized access." });
    }

    // "Next" is the next workout in the SAME owner's dated flow — never another account. A trainer on
    // their own workout must not roll into a client's workout (and vice-versa); the access check above
    // already authorized viewing this owner's workouts.
    const next = await Training.findOne({
      user: current.user,
      isTemplate: { $ne: true },
      $or: [
        { date: { $gt: current.date } },
        { date: current.date, _id: { $gt: current._id } },
      ],
    })
      .sort({ date: 1, _id: 1 })
      .select("_id title date")
      .lean();

    return res.json({ next: next || null });
  } catch (err) {
    return next(err);
  }
};

const get_workout_queue = async (req, res, next) => {
  try {
    const clientId = req.query.clientId;
    const startDate = req.query.startDate;
    const userId = res.locals.user._id;
    let targetUserId = userId;

    if (clientId && String(clientId) !== String(userId)) {
      const relationship = await Relationship.findOne({
        trainer: userId,
        client: clientId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = clientId;
    }

    const workoutQuery = { user: targetUserId };
    if (startDate) {
      workoutQuery.date = { $gte: new Date(startDate) };
    }

    const workouts = await Training.find(workoutQuery).populate({
      path: "training.exercise",
      select: "_id exerciseTitle",
    });

    if (!workouts.length) {
      return res.send([]);
    }

    const workoutIds = workouts.map((workout) => workout._id);
    const scheduledEvents = await ScheduleEvent.find({
      workoutId: { $in: workoutIds },
      status: { $ne: "CANCELLED" },
    }).select("workoutId");

    const scheduledSet = new Set(scheduledEvents.map((event) => String(event.workoutId)));
    const filteredWorkouts = workouts.filter(
      (workout) => !scheduledSet.has(String(workout._id))
    );

    return res.send(filteredWorkouts);
  } catch (err) {
    return next(err);
  }
};


const get_workouts_by_date = async (req, res, next) => {
  const { client } = req.body;
  const user = res.locals.user;
  let clientObj;

  if (client) {
    await Relationship.findOne({ trainer: user._id, client })
      .populate({
        path: "client",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .then((relationship) => {
        if (!relationship || !relationship.accepted) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
        clientObj = relationship.client;
      })
      .catch((err) => next(err));
  }

  const targetUser = clientObj ?? user;

  const dayStart = dayjs.utc(req.body.date).startOf("day").toDate();
  const dayEnd = dayjs.utc(req.body.date).endOf("day").toDate();
  const targetUserId = targetUser._id;
  const targetUserObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
    ? new mongoose.Types.ObjectId(targetUserId)
    : null;
  const userMatch = targetUserObjectId ? { $in: [targetUserId, targetUserObjectId] } : targetUserId;

  Training.find({
    user: userMatch,
    $expr: {
      $and: [
        { $gte: [{ $toDate: "$date" }, dayStart] },
        { $lte: [{ $toDate: "$date" }, dayEnd] },
      ],
    },
  })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .populate({
      path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .then((data) => {
      return res.send({ workouts: data, user: targetUser });
    })
    .catch((err) => next(err));
};

const get_weekly_training = async (req, res, next) => {
  try {
    const selectedDate = new Date(req.body.date);
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 1);

    const { client } = req.body;
    const user = res.locals.user;

    let targetUser = user;

    if (client !== user._id) {
      const relationship = await Relationship.findOne({ trainer: user._id, client })
        .populate({
          path: "client",
          model: "User",
          select: "_id firstName lastName profilePicture",
        });

      if (!relationship || !relationship.accepted) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUser = relationship.client;
    }

    const workouts = await Training.find({
      date: { $gte: startDate, $lt: endDate },
      user: targetUser._id,
    })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      });

    return res.json({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const get_exercise_list = (req, res, next) => {
  const { user } = req.body;

  Training.find({ user })
    .then(async (data) => {
      let exerciseList = [];
      const relationship = await checkClientRelationship(res.locals.user._id, user?._id);

      if (res.locals.user._id === user._id || relationship?.accepted) {
        data.map((day) => {
          day.training.map((set) => {
            set.map((exercise) => {
              if (
                !exerciseList
                  .map((ex) => (typeof ex === "string" ? ex.toLowerCase() : ex))
                  .includes(
                    typeof exercise.exercise === "string" ? exercise.exercise.toLowerCase() : ""
                  )
              ) {
                exerciseList.push(exercise.exercise);
              }
            });
          });
        });
        res.send(exerciseList);
      } else {
        res.send({ error: "Restricted" });
      }
    })
    .catch((err) => next(err));
};

const get_exercise_history = (req, res, next) => {
  const { targetExercise, user } = req.body;
  const targetExerciseId = new mongoose.Types.ObjectId(targetExercise._id);

  // The progress chart shows HISTORY, so exclude future-dated (planned, not-yet-performed) workouts
  // — they'd clutter the chart with irrelevant data. Cutoff = end of today (UTC). Range operators are
  // type-bracketed, so this also naturally drops undated template workouts (not real history).
  const cutoff = new Date();
  cutoff.setUTCHours(23, 59, 59, 999);

  Training.find({
    user: user._id,
    date: { $lte: cutoff },
    training: {
      $elemMatch: {
        $elemMatch: { exercise: targetExerciseId },
      },
    },
  })
    .populate({
      path: "training.exercise",
      select: "_id exerciseTitle",
    })
    .lean()
    .exec()
    .then(async (data) => {
      let historyList = [];
      const relationship = await checkClientRelationship(res.locals.user._id, user._id);

      if (res.locals.user._id === user._id || relationship?.accepted) {
        data.map((day) => {
          day.training.map((set) => {
            let targetedExercise = set.filter((exercise) => {
              return exercise.exercise._id.equals(targetExerciseId);
            });
            if (targetedExercise.length > 0) {
              historyList.push({ ...targetedExercise[0], date: day.date });
            }
          });
        });
        res.send(historyList);
      } else {
        res.send({ error: "Restricted" });
      }
    })
    .catch((err) => next(err));
};

const get_exercise_progress_summary = async (req, res, next) => {
  try {
    const { user } = req.body;
    const targetUserId = typeof user === "object" ? user?._id : user;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: "A valid user is required." });
    }

    const relationship = await checkClientRelationship(res.locals.user._id, targetUserId);
    const canView = String(res.locals.user._id) === String(targetUserId) || relationship?.accepted;

    if (!canView) {
      return res.status(403).json({ error: "Restricted" });
    }

    const workouts = await Training.find({ user: targetUserId })
      .select("date training")
      .populate({
        path: "training.exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    const summariesByExercise = new Map();

    workouts.forEach((workout) => {
      const workoutDate = workout.date;
      workout.training?.forEach((set) => {
        set?.forEach((item) => {
          const exercise = item.exercise;
          const exerciseId = exercise?._id ? String(exercise._id) : String(exercise || "");
          if (!exerciseId || exerciseId === "null" || exerciseId === "undefined") return;

          const exerciseTitle = exercise?.exerciseTitle || item.exerciseTitle || "Exercise";
          const existing =
            summariesByExercise.get(exerciseId) || {
              exercise: { _id: exerciseId, exerciseTitle },
              entryCount: 0,
              latestDate: null,
              historyPreview: [],
            };

          const dateValue = workoutDate ? dayjs.utc(workoutDate).valueOf() : 0;
          const latestValue = existing.latestDate ? dayjs.utc(existing.latestDate).valueOf() : 0;

          existing.entryCount += 1;
          existing.exercise.exerciseTitle = exerciseTitle;
          if (dateValue >= latestValue) {
            existing.latestDate = workoutDate;
          }
          existing.historyPreview.push({
            date: workoutDate,
            exerciseType: item.exerciseType,
            achieved: item.achieved,
          });

          summariesByExercise.set(exerciseId, existing);
        });
      });
    });

    const summaries = Array.from(summariesByExercise.values())
      .map((summary) => ({
        ...summary,
        historyPreview: summary.historyPreview
          .filter((entry) => entry.date)
          .sort((a, b) => dayjs.utc(a.date).valueOf() - dayjs.utc(b.date).valueOf())
          .slice(-12),
      }))
      .sort((a, b) => dayjs.utc(b.latestDate).valueOf() - dayjs.utc(a.latestDate).valueOf());

    return res.send(summaries);
  } catch (err) {
    return next(err);
  }
};

// Preferred default sport for a NEW Sports workout: the user's MOST-USED favorite sport. Ties break
// by the order the sports sit in the user's favorites (first favorite wins). If they have favorites
// but haven't logged any yet, the first favorite; if no favorites, their most-used sport overall;
// nothing logged at all → "" (the client keeps its own default). Body { user } targets self or a
// client (relationship-gated), matching get_exercise_progress_summary.
const get_sports_default = async (req, res, next) => {
  try {
    const { user } = req.body || {};
    const targetUserId = (typeof user === "object" ? user?._id : user) || res.locals.user._id;
    if (!mongoose.Types.ObjectId.isValid(String(targetUserId))) {
      return res.status(400).json({ error: "A valid user is required." });
    }
    const relationship = await checkClientRelationship(res.locals.user._id, targetUserId);
    const canView = String(res.locals.user._id) === String(targetUserId) || relationship?.accepted;
    if (!canView) return res.status(403).json({ error: "Restricted" });

    const targetUser = await User.findById(targetUserId).select("favoriteSports").lean();
    const favorites = Array.isArray(targetUser?.favoriteSports) ? targetUser.favoriteSports : [];

    const agg = await Training.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(String(targetUserId)),
          workoutType: "Sports",
          isTemplate: { $ne: true },
        },
      },
      { $group: { _id: "$sports.sport", count: { $sum: 1 } } },
    ]);
    const counts = {};
    agg.forEach((a) => { if (a._id) counts[a._id] = a.count; });

    let sport = "";
    if (favorites.length) {
      let best = -1;
      favorites.forEach((f) => {
        const c = counts[f] || 0;
        if (c > best) { best = c; sport = f; }
      });
    } else {
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      sport = top ? top[0] : "";
    }
    return res.json({ sport, counts });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_training,
  update_training,
  get_training_by_id,
  get_next_workout,
  get_workout_queue,
  get_workouts_by_date,
  get_weekly_training,
  get_exercise_list,
  get_exercise_history,
  get_exercise_progress_summary,
  get_sports_default,
};
