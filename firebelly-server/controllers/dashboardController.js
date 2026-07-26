const mongoose = require("mongoose");
const Relationship = require("../models/relationship");
const Invoice = require("../models/invoice");
const Training = require("../models/training");
const ScheduleEvent = require("../models/scheduleEvent");
const invoiceController = require("./invoiceController");
const readinessController = require("./readinessController");
const { buildExerciseRecords } = require("./training/workoutCore");
const { createNotification } = require("../services/notificationService");
const { bridgeWorkoutComment } = require("../services/messagingBridge");

const DAY_MS = 24 * 3600 * 1000;
const QUIET_DAYS = 7;
const RUNWAY_DAYS = 7;
const LOW_READINESS_SCORE = 40;
const LOW_READINESS_FRESH_DAYS = 3;

// Run another controller handler in-process so the dashboard's numbers always agree with
// the page the row links to (e.g. the Session History unbilled sweep's matching rules).
const internalCall = (handler, body, user) =>
  new Promise((resolve, reject) => {
    const res = {
      locals: { user },
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(obj) { resolve({ code: this.statusCode, body: obj }); return this; },
      send(obj) { resolve({ code: this.statusCode, body: obj }); return this; },
    };
    Promise.resolve(handler({ body }, res, reject)).catch(reject);
  });

// The trainer's "needs attention" panel: one call that assembles every existing
// exception signal — unbilled sessions, past-due invoices, quiet clients, programming
// runway ending, low readiness — for actively-coached clients.
const get_attention = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers have an attention panel." });
    }
    const trainerId = new mongoose.Types.ObjectId(String(user._id));
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

    const rels = await Relationship.find({
      trainer: trainerId,
      accepted: true,
      engagementStatus: { $nin: ["paused", "inactive"] },
    })
      .populate({ path: "client", select: "firstName lastName" })
      .lean();
    const activeRels = rels.filter((r) => r?.client?._id);
    const clientIds = activeRels.map((r) => r.client._id);
    const nameOf = new Map(
      activeRels.map((r) => [
        String(r.client._id),
        `${r.client.lastName || ""}, ${r.client.firstName || ""}`.replace(/^, |, $/g, "").trim(),
      ])
    );
    const relAgeOk = new Map(
      activeRels.map((r) => [String(r.client._id), now - new Date(r.createdAt || 0) > QUIET_DAYS * DAY_MS])
    );

    const [unbilledCall, readinessCall, pastDueAgg, lastCompletedAgg, futureAgg] = await Promise.all([
      internalCall(
        invoiceController.unbilled_sessions,
        { from: new Date(now - 30 * DAY_MS).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
        user
      ),
      internalCall(readinessController.get_clients_readiness, {}, user),
      Invoice.aggregate([
        { $match: { trainerId, status: "PAST_DUE" } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$balanceDue" } } },
      ]),
      Training.aggregate([
        { $match: { user: { $in: clientIds }, isTemplate: { $ne: true }, complete: true } },
        { $group: { _id: "$user", last: { $max: "$date" } } },
      ]),
      Training.aggregate([
        { $match: { user: { $in: clientIds }, isTemplate: { $ne: true }, date: { $gte: startOfToday } } },
        { $group: { _id: "$user", last: { $max: "$date" } } },
      ]),
    ]);

    const lastCompletedBy = new Map(lastCompletedAgg.map((e) => [String(e._id), e.last]));
    const futureMaxBy = new Map(futureAgg.map((e) => [String(e._id), e.last]));

    // Quiet: actively-coached ≥7 days, no completed workout in the last 7 days.
    const quietClients = clientIds
      .map(String)
      .filter((id) => relAgeOk.get(id))
      .map((id) => ({ clientId: id, name: nameOf.get(id), lastCompletedAt: lastCompletedBy.get(id) || null }))
      .filter((c) => !c.lastCompletedAt || now - new Date(c.lastCompletedAt) > QUIET_DAYS * DAY_MS)
      .sort((a, b) => new Date(a.lastCompletedAt || 0) - new Date(b.lastCompletedAt || 0));

    // Runway: clients who train (have completed before) whose planned workouts run out
    // within a week — the "write the next block" nudge.
    const needsProgramming = clientIds
      .map(String)
      .filter((id) => lastCompletedBy.has(id))
      .map((id) => ({ clientId: id, name: nameOf.get(id), lastPlannedDate: futureMaxBy.get(id) || null }))
      .filter((c) => !c.lastPlannedDate || new Date(c.lastPlannedDate) - now < RUNWAY_DAYS * DAY_MS)
      .sort((a, b) => new Date(a.lastPlannedDate || 0) - new Date(b.lastPlannedDate || 0));

    // Low readiness: a fresh check-in (≤3 days old) scoring under 40.
    const readinessMap = readinessCall.body || {};
    const lowReadiness = Object.entries(readinessMap)
      .filter(([clientId, r]) =>
        nameOf.has(clientId) &&
        r?.latestScore != null &&
        r.latestScore < LOW_READINESS_SCORE &&
        r.latestDate &&
        now - new Date(r.latestDate) < LOW_READINESS_FRESH_DAYS * DAY_MS
      )
      .map(([clientId, r]) => ({ clientId, name: nameOf.get(clientId), score: r.latestScore, date: r.latestDate }))
      .sort((a, b) => a.score - b.score);

    const unbilledTotals = unbilledCall.code === 200 ? unbilledCall.body?.totals : null;

    return res.json({
      unbilled: {
        sessions: unbilledTotals?.sessions || 0,
        value: unbilledTotals?.value || 0,
        clients: unbilledCall.body?.groups?.length || 0,
      },
      pastDue: {
        count: pastDueAgg[0]?.count || 0,
        total: pastDueAgg[0]?.total || 0,
      },
      quietClients,
      needsProgramming,
      lowReadiness,
    });
  } catch (err) {
    return next(err);
  }
};

// --- Recent activity feed -----------------------------------------------------------

const achievedTotals = (training) => {
  const totals = { volume: 0, hardSets: 0 };
  (training || []).forEach((circuit) =>
    (Array.isArray(circuit) ? circuit : []).forEach((entry) => {
      if (!entry || entry.isWarmup) return;
      const reps = Array.isArray(entry.achieved?.reps) ? entry.achieved.reps : [];
      const weights = Array.isArray(entry.achieved?.weight) ? entry.achieved.weight : [];
      const seconds = Array.isArray(entry.achieved?.seconds) ? entry.achieved.seconds : [];
      const setCount = Math.max(reps.length, seconds.length);
      for (let i = 0; i < setCount; i += 1) {
        const r = Number(reps[i]) || 0;
        const w = Number(weights[i]) || 0;
        const sec = Number(seconds[i]) || 0;
        totals.volume += r * w;
        if (r > 0 || sec > 0) totals.hardSets += 1;
      }
    })
  );
  return totals;
};

// Server-side twin of the client's detectSetRecords (trainingLoad.js): which exercises in
// this workout beat the client's historical bests. Same rules — first-ever exercises set
// no records, weighted sets never trip the bodyweight-reps record.
const detectPrExercises = (training, records) => {
  const prTitles = new Set();
  (training || []).forEach((circuit) =>
    (Array.isArray(circuit) ? circuit : []).forEach((entry) => {
      if (!entry || entry.isWarmup) return;
      const exerciseId = String(entry.exercise?._id || entry.exercise || "");
      const rec = records[exerciseId];
      if (!rec) return;
      const title = entry.exercise?.exerciseTitle || "Exercise";
      const reps = Array.isArray(entry.achieved?.reps) ? entry.achieved.reps : [];
      const weights = Array.isArray(entry.achieved?.weight) ? entry.achieved.weight : [];
      const seconds = Array.isArray(entry.achieved?.seconds) ? entry.achieved.seconds : [];
      const setCount = Math.max(reps.length, seconds.length);
      for (let i = 0; i < setCount; i += 1) {
        const r = Number(reps[i]) || 0;
        const w = Number(weights[i]) || 0;
        const sec = Number(seconds[i]) || 0;
        if (
          (r > 0 && w > 0 && (w > rec.maxWeight || w * (1 + r / 30) > rec.maxEstOneRepMax + 0.5)) ||
          (r > 0 && w === 0 && rec.maxRepsUnweighted > 0 && r > rec.maxRepsUnweighted) ||
          (sec > 0 && rec.maxSeconds > 0 && sec > rec.maxSeconds)
        ) {
          prTitles.add(title);
        }
      }
    })
  );
  return [...prTitles];
};

// Completed workouts across actively-coached clients from the last 7 days, newest first,
// with volume/sets, PR exercises, and whether the trainer has already responded.
const get_activity = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers have an activity feed." });
    }
    const trainerId = String(user._id);
    const now = new Date();

    const rels = await Relationship.find({
      trainer: trainerId,
      accepted: true,
      engagementStatus: { $nin: ["paused", "inactive"] },
    })
      .populate({ path: "client", select: "firstName lastName" })
      .lean();
    const activeRels = rels.filter((r) => r?.client?._id);
    const clientIds = activeRels.map((r) => r.client._id);
    const nameOf = new Map(
      activeRels.map((r) => [
        String(r.client._id),
        `${r.client.lastName || ""}, ${r.client.firstName || ""}`.replace(/^, |, $/g, "").trim(),
      ])
    );

    const workouts = await Training.find({
      user: { $in: clientIds },
      isTemplate: { $ne: true },
      complete: true,
      date: { $gte: new Date(now - 7 * DAY_MS), $lte: new Date(now.getTime() + DAY_MS) },
    })
      .sort({ date: -1 })
      .limit(15)
      .select("title user date workoutType training workoutFeedback")
      .populate({ path: "training.exercise", select: "_id exerciseTitle" })
      .lean();

    const items = await Promise.all(
      workouts.map(async (workout) => {
        const totals = achievedTotals(workout.training);
        const exerciseIds = [
          ...new Set(
            (workout.training || [])
              .flat()
              .filter((e) => e && !e.isWarmup)
              .map((e) => String(e.exercise?._id || e.exercise || ""))
              .filter(Boolean)
          ),
        ];
        let prExercises = [];
        try {
          const records = await buildExerciseRecords({
            userId: workout.user,
            exerciseIds,
            beforeDate: workout.date,
            excludeWorkoutId: workout._id,
          });
          prExercises = detectPrExercises(workout.training, records);
        } catch (err) {
          console.error("activity PR detection failed (non-blocking):", err.message);
        }
        const comments = (workout.workoutFeedback?.comments || []).filter((c) => !c.deletedAt);
        return {
          workoutId: workout._id,
          clientId: workout.user,
          clientName: nameOf.get(String(workout.user)) || "Client",
          title: workout.title || "Workout",
          workoutType: workout.workoutType || "Strength",
          date: workout.date,
          volume: totals.volume,
          hardSets: totals.hardSets,
          prExercises,
          commentCount: comments.length,
          acknowledged: comments.some((c) => String(c.user?._id || c.user) === trainerId),
        };
      })
    );

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
};

// One-tap trainer reaction: atomically appends a comment to the workout's feedback thread
// ($push — never clobbers concurrent edits) and fires the same notification + chat bridge
// a hand-typed comment gets.
const react_to_workout = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can react here." });
    }
    const { workoutId, text } = req.body || {};
    const body = String(text || "").trim().slice(0, 500);
    if (!workoutId || !mongoose.Types.ObjectId.isValid(String(workoutId)) || !body) {
      return res.status(400).json({ error: "workoutId and text are required." });
    }
    const workout = await Training.findById(workoutId).select("title user").lean();
    if (!workout) return res.status(404).json({ error: "Workout not found." });
    const relationship = await Relationship.findOne({
      trainer: user._id,
      client: workout.user,
      accepted: true,
    }).lean();
    if (!relationship) return res.status(403).json({ error: "Unauthorized access." });

    const comment = { user: user._id, text: body, timestamp: new Date() };
    await Training.updateOne(
      { _id: workout._id },
      { $push: { "workoutFeedback.comments": comment } }
    );

    const trainerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Your trainer";
    const workoutTitle = workout.title || "your workout";
    createNotification({
      userId: workout.user,
      type: "WORKOUT_COMMENT",
      title: `${trainerName} commented on your workout`,
      body,
      link: `/workout/${workout._id}`,
    }).catch(() => {});
    bridgeWorkoutComment({
      ownerId: String(workout.user),
      trainerId: String(user._id),
      senderId: String(user._id),
      body,
      context: {
        type: "workout",
        id: workout._id,
        label: workoutTitle,
        link: `/workout/${workout._id}`,
      },
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
};

// Month numbers for the forwardable client recap. Month = "YYYY-MM"; workout dates are
// UTC-anchored, so the window is computed in UTC.
const get_recap = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) return res.status(403).json({ error: "Only trainers can build recaps." });
    const { clientId, month } = req.body || {};
    if (!clientId || !mongoose.Types.ObjectId.isValid(String(clientId)) || !/^\d{4}-\d{2}$/.test(String(month || ""))) {
      return res.status(400).json({ error: "clientId and month (YYYY-MM) are required." });
    }
    const relationship = await Relationship.findOne({ trainer: user._id, client: clientId, accepted: true }).lean();
    if (!relationship) return res.status(403).json({ error: "Unauthorized access." });

    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    const prevStart = new Date(Date.UTC(y, m - 2, 1));

    const monthQuery = { user: clientId, isTemplate: { $ne: true }, complete: true };
    const [workouts, prevWorkouts, sessionsAttended] = await Promise.all([
      Training.find({ ...monthQuery, date: { $gte: start, $lt: end } })
        .select("title date training")
        .populate({ path: "training.exercise", select: "_id exerciseTitle" })
        .lean(),
      Training.find({ ...monthQuery, date: { $gte: prevStart, $lt: start } }).select("training").lean(),
      ScheduleEvent.countDocuments({
        trainerId: user._id, clientId, eventType: "APPOINTMENT", status: "COMPLETED",
        startDateTime: { $gte: start, $lt: end },
      }),
    ]);

    let volume = 0;
    let hardSets = 0;
    const dayKeys = new Set();
    const prTitles = new Set();
    for (const workout of workouts) {
      const totals = achievedTotals(workout.training);
      volume += totals.volume;
      hardSets += totals.hardSets;
      dayKeys.add(String(workout.date).slice(0, 10));
      const exerciseIds = [
        ...new Set(
          (workout.training || []).flat()
            .filter((e) => e && !e.isWarmup)
            .map((e) => String(e.exercise?._id || e.exercise || ""))
            .filter(Boolean)
        ),
      ];
      try {
        const records = await buildExerciseRecords({
          userId: clientId, exerciseIds, beforeDate: workout.date, excludeWorkoutId: workout._id,
        });
        detectPrExercises(workout.training, records).forEach((t) => prTitles.add(t));
      } catch (err) {
        console.error("recap PR detection failed (non-blocking):", err.message);
      }
    }
    const prevVolume = prevWorkouts.reduce((sum, w) => sum + achievedTotals(w.training).volume, 0);

    return res.json({
      month,
      workoutsCompleted: workouts.length,
      daysTrained: dayKeys.size,
      volume,
      hardSets,
      prevVolume,
      prevWorkoutsCompleted: prevWorkouts.length,
      prExercises: [...prTitles],
      sessionsAttended,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { get_attention, get_activity, react_to_workout, get_recap };
