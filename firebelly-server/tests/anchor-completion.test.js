// The completion hook: finishing a workout moves that exercise's anchor, and every other
// occurrence in the week re-renders from it. The bug this prevents is a 5x5 volume day and
// its 80% light day each seeding themselves until they no longer relate.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const ExerciseAnchor = require("../models/exerciseAnchor");
require("../models/user");
const { applyResultsToFutureProgram } = require("../services/reactiveProgression");

let clientId, programId, lift;
const made = [];

// Texas-Method shape: D1 is the 100% volume day, D2 the 80% light day.
const entry = (pct, load, { achieved = null, difficulty = null } = {}) => ({
  exercise: lift._id, customName: "", exerciseType: "Reps", isWarmup: false,
  goals: { sets: 5, minReps: [0,0,0,0,0], maxReps: [0,0,0,0,0],
    exactReps: ["5","5","5","5","5"], weight: Array(5).fill(String(load)),
    percent: [0,0,0,0,0], seconds: [0,0,0,0,0], rpe: [0,0,0,0,0], oneRepMax: 0 },
  achieved: achieved
    ? { sets: 5, reps: ["5","5","5","5","5"], weight: Array(5).fill(String(achieved)),
        percent: [0,0,0,0,0], seconds: [0,0,0,0,0] }
    : { sets: 0, reps: [0,0,0,0,0], weight: [0,0,0,0,0], percent: [0,0,0,0,0], seconds: [0,0,0,0,0] },
  feedback: { difficulty, comments: [] },
  techniques: [], coachNote: "",
  progression: { percentOfAnchor: pct, applyTo: "all", unit: "weight" },
});

const mk = async (over) => {
  const doc = { title: over.title, date: over.date, user: clientId, programId,
    programWeek: over.week, programDay: over.day, complete: !!over.complete,
    category: ["Strength"], isTemplate: false, training: [[over.entry]] };
  const r = await Training.collection.insertOne(doc);
  made.push(r.insertedId);
  return { ...doc, _id: r.insertedId };
};

const anchorRow = (over = {}) => ExerciseAnchor.create({
  trainerId: new mongoose.Types.ObjectId(), clientId, programId, exerciseId: lift._id,
  working: 225, unit: "weight", rule: "feedback", step: 0, ceiling: null, earnsOnDay: 1, ...over,
});

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  clientId = new mongoose.Types.ObjectId();
  programId = new mongoose.Types.ObjectId();
  lift = await Exercise.findOne({ equipment: /barbell/i }).select("_id equipment").lean()
    || await Exercise.findOne({}).select("_id equipment").lean();
  assert.ok(lift, "dev exercise library must not be empty");
});
test.afterEach(async () => {
  await Training.collection.deleteMany({ _id: { $in: made } });
  made.length = 0;
  await ExerciseAnchor.deleteMany({ clientId });
});
test.after(async () => { await mongoose.disconnect(); });

const topOf = async (id) => {
  const d = await Training.collection.findOne({ _id: id });
  return Math.max(...d.training[0][0].goals.weight.map(Number));
};

test("the 100% day earning a raise moves the 80% day too", async () => {
  await anchorRow();
  const done = await mk({ title: "ANC d1", date: new Date("2026-05-04"), week: 1, day: 1,
    complete: true, entry: entry(100, 225, { achieved: 225, difficulty: 0 }) }); // 0 = easy
  const light = await mk({ title: "ANC d2", date: new Date("2026-05-06"), week: 1, day: 2,
    entry: entry(80, 180) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  const a = await ExerciseAnchor.findOne({ clientId });
  assert.ok(a.working > 225, `anchor should have climbed, got ${a.working}`);
  const expectedLight = Math.round((a.working * 0.8) * 2) / 2;
  assert.equal(await topOf(light._id), expectedLight,
    "the light day must re-render from the new working weight");
});

test("the light day reporting TOO HARD lowers the anchor, even though it can't raise it", async () => {
  await anchorRow();
  const done = await mk({ title: "ANC d2 hard", date: new Date("2026-05-06"), week: 1, day: 2,
    complete: true, entry: entry(80, 180, { achieved: 180, difficulty: 2 }) }); // 2 = too hard
  const volume = await mk({ title: "ANC d1 next", date: new Date("2026-05-11"), week: 2, day: 1,
    entry: entry(100, 225) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  const a = await ExerciseAnchor.findOne({ clientId });
  assert.ok(a.working < 225, `a "too hard" on the light day should lower it, got ${a.working}`);
  assert.equal(await topOf(volume._id), a.working, "the volume day follows the anchor down");
});

test("the light day feeling EASY cannot raise the anchor", async () => {
  await anchorRow();                       // earnsOnDay = 1
  const done = await mk({ title: "ANC d2 easy", date: new Date("2026-05-06"), week: 1, day: 2,
    complete: true, entry: entry(80, 180, { achieved: 180, difficulty: 0 }) });
  await mk({ title: "ANC d1 next", date: new Date("2026-05-11"), week: 2, day: 1, entry: entry(100, 225) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  assert.equal((await ExerciseAnchor.findOne({ clientId })).working, 225,
    "only the nominated day earns raises");
});

test("a weekly rule steps by its own amount, and the ceiling stops it", async () => {
  await anchorRow({ rule: "weekly", step: 1, working: 134, ceiling: 135 });
  const done = await mk({ title: "ANC wk", date: new Date("2026-05-04"), week: 1, day: 1,
    complete: true, entry: entry(100, 134, { achieved: 134 }) });
  await mk({ title: "ANC wk next", date: new Date("2026-05-11"), week: 2, day: 1, entry: entry(100, 134) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());
  assert.equal((await ExerciseAnchor.findOne({ clientId })).working, 135, "+1 to the ceiling");

  // a second completion must not push past it
  const done2 = await mk({ title: "ANC wk2", date: new Date("2026-05-11"), week: 2, day: 1,
    complete: true, entry: entry(100, 135, { achieved: 135 }) });
  await mk({ title: "ANC wk3", date: new Date("2026-05-18"), week: 3, day: 1, entry: entry(100, 135) });
  await applyResultsToFutureProgram(await Training.findById(done2._id).lean());
  assert.equal((await ExerciseAnchor.findOne({ clientId })).working, 135, "held at the ceiling");
});

test("an exercise with NO anchor still uses the old per-workout seeding", async () => {
  // no anchorRow() here
  const plain = (load, achieved) => {
    const e = entry(100, load, { achieved, difficulty: 0 });
    delete e.progression;            // unlinked, as most of the library is
    return e;
  };
  const done = await mk({ title: "ANC none", date: new Date("2026-05-04"), week: 1, day: 1,
    complete: true, entry: plain(100, 100) });
  const future = await mk({ title: "ANC none next", date: new Date("2026-05-11"), week: 2, day: 1,
    entry: plain(100) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  assert.ok(await topOf(future._id) > 100, "unanchored exercises must keep progressing as before");
  assert.equal(await ExerciseAnchor.countDocuments({ clientId }), 0, "and no anchor gets invented");
});
