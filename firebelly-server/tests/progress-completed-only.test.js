// The progress chart must read PERFORMANCE, not prescription. A skipped workout keeps its
// prescribed goals and an all-zero `achieved`, so before this filter it plotted as a 0 and
// pulled the client's line down. Templates were being counted too.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const {
  get_exercise_history,
  get_exercise_progress_summary,
} = require("../controllers/training/workoutCore");

const call = async (fn, body, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = {
    locals: { user },
    status(c) { statusCode = c; return this; },
    json(v) { payload = v; return this; },
    send(v) { payload = v; return this; },
  };
  await fn({ body }, res, (e) => { err = e; });
  if (err) throw err;
  // get_exercise_history is promise-chained rather than awaited, so wait for its .then to
  // settle — that involves a real query, so yield on a timer rather than draining microtasks.
  for (let i = 0; i < 200 && payload === null; i += 1) await new Promise((r) => setTimeout(r, 10));
  assert.ok(payload !== null, "the endpoint never responded");
  return { statusCode, payload };
};

// A synthetic owner keeps this isolated from the dev seed data, which already has workouts.
let owner, lift;
const made = [];

const mk = (over) => new Training({
  title: over.title, date: over.date === undefined ? new Date("2026-03-01") : over.date,
  user: owner._id, category: ["Strength"], complete: false,
  training: [[{
    exercise: lift._id, exerciseType: "Reps",
    goals: { sets: 3, minReps: [0,0,0], maxReps: [0,0,0], exactReps: [5,5,5],
      weight: [225,225,225], percent: [0,0,0], seconds: [0,0,0], oneRepMax: 0, rpe: [0,0,0] },
    achieved: over.achievedWeight === undefined
      ? { sets: 0, reps: [0,0,0], weight: [0,0,0], percent: [0,0,0], seconds: [0,0,0] }
      : { sets: 3, reps: [5,5,5], weight: Array(3).fill(over.achievedWeight), percent: [0,0,0], seconds: [0,0,0] },
    feedback: { difficulty: null, comments: [] }, techniques: [], coachNote: "",
  }]],
  ...(over.complete !== undefined ? { complete: over.complete } : {}),
  ...(over.isTemplate ? { isTemplate: true } : {}),
}).save().then((d) => { made.push(d._id); return d; });

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  owner = { _id: new mongoose.Types.ObjectId() };
  lift = await Exercise.findOne({}).select("_id").lean();
  assert.ok(lift, "the dev exercise library must not be empty");
  await Training.deleteMany({ title: /^PROG / });
});
test.after(async () => {
  await Training.deleteMany({ _id: { $in: made } });
  await Training.deleteMany({ title: /^PROG / });
  await mongoose.disconnect();
});

const body = () => ({ targetExercise: { _id: String(lift._id) }, user: { _id: owner._id } });

test("history returns only the completed workout, not the skipped or templated one", async () => {
  await mk({ title: "PROG done", date: new Date("2026-03-01"), complete: true, achievedWeight: 225 });
  await mk({ title: "PROG skipped", date: new Date("2026-03-08"), complete: false });   // all-zero achieved
  await mk({ title: "PROG template", date: undefined, isTemplate: true, complete: false });

  const { payload } = await call(get_exercise_history, body(), owner);
  assert.ok(Array.isArray(payload), `expected an array, got ${JSON.stringify(payload)}`);
  assert.equal(payload.length, 1, "only the completed workout is history");
  assert.deepEqual(payload[0].achieved.weight.map(Number), [225, 225, 225]);
});

test("a part-logged workout is excluded too — partial numbers are still misleading", async () => {
  await mk({ title: "PROG partial", date: new Date("2026-03-15"), complete: false, achievedWeight: 95 });
  const { payload } = await call(get_exercise_history, body(), owner);
  assert.equal(payload.length, 1, "still just the one completed workout");
  assert.ok(!payload.some((e) => Number(e.achieved.weight[0]) === 95), "partial data must not plot");
});

test("future-dated completed workouts stay out of history", async () => {
  const future = new Date(Date.now() + 30 * 864e5);
  await mk({ title: "PROG future", date: future, complete: true, achievedWeight: 999 });
  const { payload } = await call(get_exercise_history, body(), owner);
  assert.ok(!payload.some((e) => Number(e.achieved.weight[0]) === 999), "the future can't be history");
});

test("the summary counts only performed sessions", async () => {
  const { payload } = await call(get_exercise_progress_summary, { user: { _id: owner._id } }, owner);
  const row = payload.find((s) => String(s.exercise._id) === String(lift._id));
  assert.ok(row, "the completed exercise should appear");
  assert.equal(row.entryCount, 1,
    "skipped, partial, templated and future-dated sessions must not be counted");
});

test("a client with nothing completed gets an empty chart rather than a row of zeros", async () => {
  const empty = { _id: new mongoose.Types.ObjectId() };
  const doc = await new Training({
    title: "PROG only-planned", date: new Date("2026-04-01"), user: empty._id,
    category: ["Strength"], complete: false,
    training: [[{ exercise: lift._id, exerciseType: "Reps",
      goals: { sets: 1, minReps: [0], maxReps: [0], exactReps: [5], weight: [135], percent: [0], seconds: [0], oneRepMax: 0, rpe: [0] },
      achieved: { sets: 0, reps: [0], weight: [0], percent: [0], seconds: [0] },
      feedback: { difficulty: null, comments: [] }, techniques: [], coachNote: "" }]],
  }).save();
  made.push(doc._id);
  const { payload } = await call(get_exercise_history, { targetExercise: { _id: String(lift._id) }, user: { _id: empty._id } }, empty);
  assert.deepEqual(payload, [], "no completed work means no data points");
});

// --- the Cardio and Training Load charts on the same page read /workoutsRange ---
const { get_workouts_by_range } = require("../controllers/training/workoutOperations");

test("workoutsRange can return performed sessions only, for the cardio + load charts", async () => {
  const body = {
    rangeStart: "2026-02-01", rangeEnd: "2026-03-31",
    user: String(owner._id),
    filters: { includeTemplates: false, includeIncomplete: false },
  };
  const { payload } = await call(get_workouts_by_range, body, owner);
  const rows = payload?.workouts || [];
  assert.ok(rows.length >= 1, "the completed workout should come back");
  assert.ok(rows.every((w) => w.complete === true), "every row must be a completed session");
  assert.ok(!rows.some((w) => w.isTemplate), "no templates");
});

test("workoutsRange still returns everything when the caller doesn't ask to filter", async () => {
  const body = { rangeStart: "2026-02-01", rangeEnd: "2026-03-31", user: String(owner._id) };
  const { payload } = await call(get_workouts_by_range, body, owner);
  const rows = payload?.workouts || [];
  assert.ok(rows.some((w) => w.complete !== true),
    "the calendar and bulk tools still need to see planned work");
});

test("includeCompleted:false keeps working — it is the opposite request, not a duplicate", async () => {
  const body = {
    rangeStart: "2026-02-01", rangeEnd: "2026-03-31",
    user: String(owner._id), filters: { includeCompleted: false },
  };
  const { payload } = await call(get_workouts_by_range, body, owner);
  const rows = payload?.workouts || [];
  assert.ok(rows.length >= 1, "there are incomplete workouts in range");
  assert.ok(rows.every((w) => w.complete !== true), "only outstanding work");
});

// --- PR badges and goal maths read the same data and had the same flaw ---
const { buildExerciseRecords } = require("../controllers/training/workoutCore");

test("a PR cannot be set by a workout that was never finished", async () => {
  // The part-logged session from earlier lifted 95; the completed one lifted 225. A third,
  // unfinished session claims a much heavier lift — it must not become the record.
  await mk({ title: "PROG fake-pr", date: new Date("2026-03-20"), complete: false, achievedWeight: 500 });
  const records = await buildExerciseRecords({ userId: owner._id, exerciseIds: [String(lift._id)] });
  const rec = records[String(lift._id)];
  assert.ok(rec, "the completed workout should still produce a record");
  assert.equal(Number(rec.maxWeight), 225,
    `expected the completed 225, got ${rec.maxWeight}`);
  // 500 was never finished and 999 is dated in the future — neither is a record.
  assert.ok(Number(rec.maxWeight) !== 500 && Number(rec.maxWeight) !== 999);
});
