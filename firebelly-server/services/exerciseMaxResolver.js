const mongoose = require("mongoose");
const ExerciseMax = require("../models/exerciseMax");

// Max Callback: percentage-based prescriptions resolve a lifter's stored one-rep max instead of
// carrying their own copy of the number.
//
// The whole design turns on one asymmetry. `goals.oneRepMax` is a real schema field, so
// anything written into it on the way out comes back on the way in: `update_training` posts the
// entire workout, which is exactly how the same max ended up duplicated into 32 documents.
// So the resolved value is hydrated for readers and stripped again from anything the client
// sends back, leaving the ExerciseMax row as the only place the number actually lives.
//
// A per-entry value that DIFFERS from the store is a deliberate override and is always left
// alone — that is what makes a one-off possible.

const exIdOf = (entry) => String(entry?.exercise?._id || entry?.exercise || "");
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const maxesForUser = async (userId) => {
  // Resolution is a convenience layered onto reads and saves, so it must never be the thing
  // that breaks one. An id that cannot be cast just means "no maxes" rather than a 500 on a
  // workout save.
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return new Map();
  const rows = await ExerciseMax.find({ userId }).select("exerciseId value").lean();
  return new Map(rows.map((r) => [String(r.exerciseId), num(r.value)]));
};

// Fill in goals.oneRepMax only where the entry has none of its own.
const hydrateTraining = (training, maxes) => {
  let filled = 0;
  (training || []).forEach((circuit) =>
    (circuit || []).forEach((entry) => {
      if (!entry?.goals) return;
      if (num(entry.goals.oneRepMax) > 0) return; // explicit override — leave it
      const stored = maxes.get(exIdOf(entry));
      if (!(num(stored) > 0)) return;
      entry.goals.oneRepMax = num(stored);
      filled += 1;
    })
  );
  return filled;
};

// The mirror image. A value that merely echoes the store is not an override, so it must not be
// persisted; zeroing it keeps the store authoritative for next time.
const stripResolvedTraining = (training, maxes) => {
  let stripped = 0;
  (training || []).forEach((circuit) =>
    (circuit || []).forEach((entry) => {
      if (!entry?.goals) return;
      const stored = maxes.get(exIdOf(entry));
      if (!(num(stored) > 0)) return;
      if (num(entry.goals.oneRepMax) !== num(stored)) return; // a real override, or already 0
      entry.goals.oneRepMax = 0;
      stripped += 1;
    })
  );
  return stripped;
};

// Hydrate workouts on their way to a reader. Always works on PLAIN objects: hydrating a live
// mongoose document would leave a resolved value sitting on a dirty doc, one stray .save()
// away from being written back.
const hydrateForUser = async (userId, docs) => {
  const list = Array.isArray(docs) ? docs : [docs];
  if (!list.length || !list[0]) return docs;
  const maxes = await maxesForUser(userId);
  if (!maxes.size) return docs;
  const plain = list.map((d) => (d && typeof d.toObject === "function" ? d.toObject() : d));
  // Templates and program days are deliberately left alone. They are owned by the TRAINER, so
  // resolving them would print the trainer's maxes onto a program written for somebody else —
  // and the builder already scrubs loads off them by design (Workout.jsx `lockWeights`). A
  // template shows the percentage; the load appears once it is assigned to a lifter.
  plain.forEach((d) => {
    if (d?.isTemplate || d?.isProgramDay) return;
    hydrateTraining(d?.training, maxes);
  });
  return Array.isArray(docs) ? plain : plain[0];
};

// Strip anything the client echoed back before it is persisted.
const stripForUser = async (userId, training) => {
  const maxes = await maxesForUser(userId);
  if (!maxes.size) return 0;
  return stripResolvedTraining(training, maxes);
};

module.exports = {
  maxesForUser,
  hydrateTraining,
  stripResolvedTraining,
  hydrateForUser,
  stripForUser,
};
