// Max Callback resolution. The whole design turns on an asymmetry: `goals.oneRepMax` is a real
// schema field, and `update_training` posts the entire workout back, so anything written into
// it on the way out returns on the way in. These pin hydrate-on-read / strip-on-write and the
// cases where a per-entry value must survive as a deliberate override.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const ExerciseMax = require("../models/exerciseMax");
const Training = require("../models/training");
const User = require("../models/user");
const Exercise = require("../models/exercise");
const {
  maxesForUser, hydrateTraining, stripResolvedTraining, hydrateForUser, stripForUser,
} = require("../services/exerciseMaxResolver");

const pctEntry = (exerciseId, pct, oneRepMax = 0) => ({
  exercise: exerciseId,
  exerciseType: "Reps with %",
  goals: { sets: 1, minReps: [0], maxReps: [0], exactReps: [3], weight: [0], percent: [pct], seconds: [0], oneRepMax },
  achieved: { sets: 0, reps: [0], weight: [0], percent: [0], seconds: [0] },
});

let lifter, squat, press;
const made = [];

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  lifter = await User.create({ firstName: "Call", lastName: "Back", email: `cb-${Date.now()}@test.local`, password: "x" });
  squat = await Exercise.findOne({ exerciseTitle: "Barbell Back Squat" }).select("_id").lean();
  press = await Exercise.findOne({ exerciseTitle: "Standing Barbell Shoulder Press" }).select("_id").lean();
  await ExerciseMax.create({ userId: lifter._id, exerciseId: squat._id, value: 400, source: "tested" });
});

test.after(async () => {
  await Training.deleteMany({ _id: { $in: made } });
  await ExerciseMax.deleteMany({ userId: lifter._id });
  await User.deleteOne({ _id: lifter._id });
  await mongoose.disconnect();
});

test("a percentage entry with no max of its own resolves from the lifter's row", async () => {
  const maxes = await maxesForUser(lifter._id);
  const training = [[pctEntry(squat._id, 75)]];
  assert.equal(hydrateTraining(training, maxes), 1);
  assert.equal(training[0][0].goals.oneRepMax, 400, "75% of 400 can now be computed = 300");
});

test("a per-entry max that differs is an override and is never touched", async () => {
  const maxes = await maxesForUser(lifter._id);
  const training = [[pctEntry(squat._id, 75, 350)]];
  assert.equal(hydrateTraining(training, maxes), 0, "nothing to fill");
  assert.equal(training[0][0].goals.oneRepMax, 350);
  assert.equal(stripResolvedTraining(training, maxes), 0, "an override must not be stripped");
  assert.equal(training[0][0].goals.oneRepMax, 350);
});

test("a resolved value posted back is stripped, so it is never persisted", async () => {
  const maxes = await maxesForUser(lifter._id);
  const training = [[pctEntry(squat._id, 75)]];
  hydrateTraining(training, maxes);
  assert.equal(training[0][0].goals.oneRepMax, 400, "precondition: hydrated");
  assert.equal(stripResolvedTraining(training, maxes), 1);
  assert.equal(training[0][0].goals.oneRepMax, 0, "the row stays the only copy");
});

test("hydrate then strip is a round trip — the document is unchanged", async () => {
  const maxes = await maxesForUser(lifter._id);
  const training = [[pctEntry(squat._id, 75), pctEntry(press._id, 60), pctEntry(squat._id, 90, 420)]];
  // Snapshot the same object rather than a JSON clone: cloning turns the ObjectIds into
  // strings, so the two sides could never match whatever hydration did.
  const before = JSON.stringify(training);
  hydrateTraining(training, maxes);
  assert.notEqual(JSON.stringify(training), before, "precondition: hydration changed something");
  stripResolvedTraining(training, maxes);
  assert.equal(JSON.stringify(training), before,
    "a save after a read must not alter stored prescriptions");
});

test("a lift with no stored max is left alone entirely", async () => {
  const maxes = await maxesForUser(lifter._id);
  const training = [[pctEntry(press._id, 60)]];
  assert.equal(hydrateTraining(training, maxes), 0);
  assert.equal(training[0][0].goals.oneRepMax, 0, "no row, no load — unchanged behaviour");
});

test("templates are never resolved: they belong to the trainer, not a lifter", async () => {
  const tmpl = await Training.create({
    title: "MAXCB template", user: lifter._id, category: ["Strength"],
    isTemplate: true, isProgramDay: true, training: [[pctEntry(squat._id, 75)]],
  });
  made.push(tmpl._id);
  const [out] = await hydrateForUser(lifter._id, [tmpl]);
  assert.equal(out.training[0][0].goals.oneRepMax, 0,
    "a template shows the percentage only — resolving it would print one person's max onto everyone's program");
});

test("an assigned workout IS resolved", async () => {
  const w = await Training.create({
    title: "MAXCB assigned", user: lifter._id, category: ["Strength"],
    date: new Date("2031-04-04"), training: [[pctEntry(squat._id, 75)]],
  });
  made.push(w._id);
  const out = await hydrateForUser(lifter._id, w);
  assert.equal(out.training[0][0].goals.oneRepMax, 400);
  const stillStored = await Training.findById(w._id).lean();
  assert.equal(stillStored.training[0][0].goals.oneRepMax, 0,
    "hydration is for the reader only and must not reach the database");
});

test("resolution never breaks a save when the user id is unusable", async () => {
  assert.equal((await maxesForUser("not-an-objectid")).size, 0);
  assert.equal((await maxesForUser(null)).size, 0);
  assert.equal(await stripForUser("not-an-objectid", [[pctEntry(squat._id, 75, 400)]]), 0);
});

test("clearing the row returns percentage sets to showing no load", async () => {
  await ExerciseMax.deleteOne({ userId: lifter._id, exerciseId: squat._id });
  const maxes = await maxesForUser(lifter._id);
  const training = [[pctEntry(squat._id, 75)]];
  assert.equal(hydrateTraining(training, maxes), 0);
  assert.equal(training[0][0].goals.oneRepMax, 0);
  // restore for any later test
  await ExerciseMax.create({ userId: lifter._id, exerciseId: squat._id, value: 400, source: "tested" });
});
