// The working ceiling. Both the engine ramp and feedback seeding used to keep adding once a
// client was already at the right weight, leaving the trainer to walk every later week back
// down by hand. A ceiling is the number they should reach and then hold.
const test = require("node:test");
const assert = require("node:assert");
const {
  clampToCeiling,
  progressExerciseGoals,
  deloadGoals,
} = require("../services/progressionEngine");

const ramp = () => ({
  sets: 5,
  minReps: [0, 0, 0, 0, 0], maxReps: [0, 0, 0, 0, 0],
  exactReps: ["3", "2", "1", "1", "5"],
  weight: ["65", "85", "95", "105", "132"],
  percent: [0, 0, 0, 0, 0], seconds: [0, 0, 0, 0, 0], rpe: [0, 0, 0, 0, 0],
  oneRepMax: 0,
});

test("caps the sets that exceed the ceiling and leaves the rest alone", () => {
  const g = clampToCeiling(ramp(), { ceiling: 100 });
  assert.deepEqual(g.weight, ["65", "85", "95", "100", "100"]);
});

test("a ceiling above every set changes nothing", () => {
  assert.deepEqual(clampToCeiling(ramp(), { ceiling: 200 }).weight,
    ["65", "85", "95", "105", "132"]);
});

test("no ceiling means today's behaviour, untouched", () => {
  assert.deepEqual(clampToCeiling(ramp(), {}).weight, ["65", "85", "95", "105", "132"]);
  assert.deepEqual(clampToCeiling(ramp(), undefined).weight, ["65", "85", "95", "105", "132"]);
  assert.deepEqual(clampToCeiling(ramp(), { ceiling: null }).weight, ["65", "85", "95", "105", "132"]);
});

test("never RAISES a load up to the ceiling — it only caps", () => {
  const g = clampToCeiling({ ...ramp(), weight: ["50", "50", "50", "50", "50"] }, { ceiling: 135 });
  assert.deepEqual(g.weight, ["50", "50", "50", "50", "50"]);
});

test("keeps the string-or-number shape each value already had", () => {
  const mixed = clampToCeiling({ sets: 2, weight: ["150", 150] }, { ceiling: 100 });
  assert.strictEqual(mixed.weight[0], "100", "a string stays a string");
  assert.strictEqual(mixed.weight[1], 100, "a number stays a number");
});

test("can cap reps or seconds instead of weight", () => {
  assert.deepEqual(clampToCeiling(ramp(), { ceiling: 2, unit: "reps" }).exactReps,
    ["2", "2", "1", "1", "2"]);
  const hold = { sets: 3, seconds: ["45", "45", "45"], weight: [0, 0, 0] };
  assert.deepEqual(clampToCeiling(hold, { ceiling: 30, unit: "seconds" }).seconds, ["30", "30", "30"]);
});

test("the engine's linear ramp stops at the ceiling instead of climbing past it", () => {
  const ctx = { equipment: "Barbell", exerciseType: "Reps", progression: { ceiling: 110 } };
  const out = progressExerciseGoals(ramp(), ctx, { scheme: "linear", step: 8 });
  const top = Math.max(...out.weight.map(Number));
  assert.ok(top <= 110, `top set climbed to ${top}, past the 110 ceiling`);
});

test("without a ceiling that same ramp does climb past it — proving the cap is what stops it", () => {
  const ctx = { equipment: "Barbell", exerciseType: "Reps" };
  const out = progressExerciseGoals(ramp(), ctx, { scheme: "linear", step: 8 });
  assert.ok(Math.max(...out.weight.map(Number)) > 110, "the engine should have run away here");
});

test("a deload is allowed to go below the ceiling, not pinned to it", () => {
  const ctx = { equipment: "Barbell", exerciseType: "Reps", progression: { ceiling: 132 } };
  const out = progressExerciseGoals(ramp(), ctx, { scheme: "same", step: 0, deload: true });
  const top = Math.max(...out.weight.map(Number));
  assert.ok(top < 132, `deload should cut below the ceiling, got ${top}`);
});

test("a ceiling of 0 pins the exercise to bodyweight", () => {
  // The real bug it guards: a band or bodyweight movement picking up phantom load.
  const g = clampToCeiling({ sets: 4, weight: ["27.5", "27.5", "27.5", "27.5"] }, { ceiling: 0 });
  assert.deepEqual(g.weight, ["0", "0", "0", "0"]);
});

test("a malformed ceiling is ignored rather than zeroing the prescription", () => {
  assert.deepEqual(clampToCeiling(ramp(), { ceiling: "abc" }).weight, ["65", "85", "95", "105", "132"]);
  assert.deepEqual(clampToCeiling(ramp(), { ceiling: -5 }).weight, ["65", "85", "95", "105", "132"]);
});

// --- the path that actually matters now that every program is feedback-only ---
const mongoose = require("mongoose");
process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Training = require("../models/training");
const Exercise = require("../models/exercise");
// the reactive path populates across refs — register the models it reaches
require("../models/user");
const { applyResultsToFutureProgram } = require("../services/reactiveProgression");

let owner, programId, lift;
const made = [];

const entry = (exId, weight, { achieved = null, ceiling = undefined } = {}) => ({
  exercise: exId, customName: "", exerciseType: "Reps", isWarmup: false,
  goals: { sets: 3, minReps: [0, 0, 0], maxReps: [0, 0, 0], exactReps: ["5", "5", "5"],
    weight: [String(weight), String(weight), String(weight)],
    percent: [0, 0, 0], seconds: [0, 0, 0], rpe: [0, 0, 0], oneRepMax: 0 },
  achieved: achieved
    ? { sets: 3, reps: ["5", "5", "5"], weight: Array(3).fill(String(achieved)), percent: [0, 0, 0], seconds: [0, 0, 0] }
    : { sets: 0, reps: [0, 0, 0], weight: [0, 0, 0], percent: [0, 0, 0], seconds: [0, 0, 0] },
  feedback: { difficulty: 0, comments: [] },   // 0 = "easy", the strongest push to increase
  techniques: [], coachNote: "",
  ...(ceiling === undefined ? {} : { progression: { unit: "weight", ceiling } }),
});

const mk = (over) => new Training({
  title: over.title, date: over.date, user: owner._id, programId,
  category: ["Strength"], complete: !!over.complete, programWeek: over.week, programDay: 1,
  training: [[over.entry]],
}).save().then((d) => { made.push(d._id); return d; });

test.before(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  owner = { _id: new mongoose.Types.ObjectId() };
  programId = new mongoose.Types.ObjectId();
  lift = await Exercise.findOne({ equipment: /barbell/i }).select("_id").lean()
    || await Exercise.findOne({}).select("_id").lean();
  assert.ok(lift, "dev exercise library must not be empty");
  await Training.deleteMany({ title: /^CEIL / });
});
test.after(async () => {
  await Training.deleteMany({ _id: { $in: made } });
  await Training.deleteMany({ title: /^CEIL / });
  await mongoose.disconnect();
});

test("feedback seeding stops at the ceiling instead of pushing past it", async () => {
  // He lifted 100 and called it easy, so seeding wants to add. The ceiling says 100 is the
  // number — this is the exact case that used to require hand-lowering every later week.
  const done = await mk({ title: "CEIL done", date: new Date("2026-05-01"), week: 1, complete: true,
    entry: entry(lift._id, 100, { achieved: 100 }) });
  const future = await mk({ title: "CEIL future", date: new Date("2026-05-08"), week: 2,
    entry: entry(lift._id, 100, { ceiling: 100 }) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  const after = await Training.findById(future._id).lean();
  const tops = after.training[0][0].goals.weight.map(Number);
  assert.ok(Math.max(...tops) <= 100, `seeded to ${Math.max(...tops)}, past the 100 ceiling`);
});

test("the same session with no ceiling does push the load up", async () => {
  const done = await mk({ title: "CEIL done2", date: new Date("2026-06-01"), week: 3, complete: true,
    entry: entry(lift._id, 100, { achieved: 100 }) });
  const future = await mk({ title: "CEIL future2", date: new Date("2026-06-08"), week: 4,
    entry: entry(lift._id, 100) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  const after = await Training.findById(future._id).lean();
  assert.ok(Math.max(...after.training[0][0].goals.weight.map(Number)) > 100,
    "without a ceiling seeding should have added weight — otherwise the test above proves nothing");
});

test("lowering a ceiling onto a week already above it pulls that week down", async () => {
  const done = await mk({ title: "CEIL done3", date: new Date("2026-07-01"), week: 5, complete: true,
    entry: entry(lift._id, 100, { achieved: 100 }) });
  // this future week is prescribed 150 but the trainer has since capped it at 120
  const future = await mk({ title: "CEIL future3", date: new Date("2026-07-08"), week: 6,
    entry: entry(lift._id, 150, { ceiling: 120 }) });

  await applyResultsToFutureProgram(await Training.findById(done._id).lean());

  const after = await Training.findById(future._id).lean();
  const tops = after.training[0][0].goals.weight.map(Number);
  assert.ok(Math.max(...tops) <= 120, `left at ${Math.max(...tops)}, above the 120 ceiling`);
});
