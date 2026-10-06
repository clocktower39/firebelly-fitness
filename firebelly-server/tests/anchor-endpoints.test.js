// The Set Progression panel's endpoints: read an exercise's progression + its occurrences in
// the week, write the rule/working weight/ceiling and each day's share, and clear it.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const Program = require("../models/program");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const ExerciseAnchor = require("../models/exerciseAnchor");
const { anchor_for_exercise, set_anchor, clear_anchor } = require("../controllers/anchorController");

const call = async (fn, body, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = { locals: { user }, status(c) { statusCode = c; return this; }, json(v) { payload = v; return this; } };
  await fn({ body }, res, (e) => { err = e; });
  if (err) throw err;
  return { statusCode, payload };
};

let trainer, client, stranger, program, lift, rel;
const made = [];

// A Texas-Method shape: Day 1 the 100% volume day, Day 3 an 80% light day.
const mkDay = async (day, weights) => {
  const doc = {
    title: `ANCHOREP D${day}`, date: new Date(Date.now() + day * 864e5),
    user: client._id, programId: program._id, programWeek: 1, programDay: day,
    complete: false, isTemplate: false, category: ["Strength"],
    training: [[{
      exercise: lift._id, customName: "", exerciseType: "Reps", isWarmup: false,
      goals: { sets: weights.length, minReps: weights.map(() => 0), maxReps: weights.map(() => 0),
        exactReps: weights.map(() => "5"), weight: weights.map(String),
        percent: weights.map(() => 0), seconds: weights.map(() => 0), rpe: weights.map(() => 0), oneRepMax: 0 },
      achieved: { sets: 0, reps: weights.map(() => 0), weight: weights.map(() => 0),
        percent: weights.map(() => 0), seconds: weights.map(() => 0) },
      feedback: { difficulty: null, comments: [] }, techniques: [], coachNote: "",
    }]],
  };
  const r = await Training.collection.insertOne(doc);
  made.push(r.insertedId);
  return r.insertedId;
};

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  const stamp = Date.now();
  trainer = await User.create({ firstName: "Anchor", lastName: "Trainer", email: `a-tr-${stamp}@test.local`, password: "x", isTrainer: true });
  client = await User.create({ firstName: "Anchor", lastName: "Client", email: `a-cl-${stamp}@test.local`, password: "x" });
  stranger = await User.create({ firstName: "Anchor", lastName: "Stranger", email: `a-st-${stamp}@test.local`, password: "x", isTrainer: true });
  rel = await Relationship.create({ trainer: trainer._id, client: client._id, accepted: true, requestedBy: trainer._id });
  lift = await Exercise.findOne({ equipment: /barbell/i }).select("_id").lean();
  program = await Program.create({ ownerId: trainer._id, title: "Anchor Endpoint Test", weeksCount: 1, daysPerWeek: 3, weeks: [] });
  await mkDay(1, [225, 225, 225, 225, 225]);
  await mkDay(3, [180, 180, 180]);
});
test.after(async () => {
  await Training.collection.deleteMany({ _id: { $in: made } });
  await ExerciseAnchor.deleteMany({ clientId: client._id });
  await Program.deleteOne({ _id: program._id });
  await Relationship.deleteOne({ _id: rel._id });
  await User.deleteMany({ _id: { $in: [trainer._id, client._id, stranger._id] } });
  await mongoose.disconnect();
});

const ids = () => ({ clientId: String(client._id), programId: String(program._id), exerciseId: String(lift._id) });

test("reads back both occurrences with their schemes, before any anchor exists", async () => {
  const { payload } = await call(anchor_for_exercise, ids(), trainer);
  assert.equal(payload.anchor, null, "no anchor yet");
  assert.equal(payload.slots.length, 2, "the exercise is used twice this week");
  assert.deepEqual(payload.slots.map((s) => s.day), [1, 3]);
  assert.equal(payload.slots[0].scheme, "5x5/5/5/5/5");
  assert.equal(payload.slots[1].scheme, "3x5/5/5");
  assert.equal(payload.slots[0].percentOfAnchor, null, "unlinked until the trainer sets it");
});

test("a trainer with no relationship to the client is refused", async () => {
  const { statusCode } = await call(anchor_for_exercise, ids(), stranger);
  assert.equal(statusCode, 403);
});

test("saving links both days and renders their loads from the working weight", async () => {
  const { payload } = await call(set_anchor, {
    ...ids(), working: 225, unit: "weight", rule: "feedback", step: 0, ceiling: 245, earnsOnDay: 1,
    slots: [{ day: 1, percentOfAnchor: 100, applyTo: "all" }, { day: 3, percentOfAnchor: 80, applyTo: "all" }],
  }, trainer);
  assert.equal(payload.anchor.working, 225);
  assert.equal(payload.anchor.ceiling, 245);
  assert.equal(payload.anchor.earnsOnDay, 1);
  assert.equal(payload.stamped, 2, "both days stamped");

  const day3 = await Training.collection.findOne({ _id: made[1] });
  assert.deepEqual(day3.training[0][0].goals.weight.map(Number), [180, 180, 180], "80% of 225");
  const day1 = await Training.collection.findOne({ _id: made[0] });
  assert.ok(day1.training[0][0].goals.weight.every((w) => Number(w) === 225));
});

test("raising the working weight moves BOTH days together", async () => {
  await call(set_anchor, {
    ...ids(), working: 250, unit: "weight", rule: "feedback", step: 0, ceiling: null, earnsOnDay: 1,
    slots: [{ day: 1, percentOfAnchor: 100, applyTo: "all" }, { day: 3, percentOfAnchor: 80, applyTo: "all" }],
  }, trainer);
  const day1 = await Training.collection.findOne({ _id: made[0] });
  const day3 = await Training.collection.findOne({ _id: made[1] });
  assert.ok(day1.training[0][0].goals.weight.every((w) => Number(w) === 250));
  assert.ok(day3.training[0][0].goals.weight.every((w) => Number(w) === 200), "80% of 250");
});

test("the read-back reports what each slot resolves to, for the preview", async () => {
  const { payload } = await call(anchor_for_exercise, ids(), trainer);
  assert.equal(payload.anchor.working, 250);
  assert.deepEqual(payload.slots.map((s) => [s.day, s.percentOfAnchor, s.resolved]),
    [[1, 100, 250], [3, 80, 200]]);
});

test("clearing removes the anchor and unlinks the days", async () => {
  const { payload } = await call(clear_anchor, ids(), trainer);
  assert.equal(payload.cleared, 2);
  assert.equal(await ExerciseAnchor.countDocuments({ clientId: client._id }), 0);
  const day3 = await Training.collection.findOne({ _id: made[1] });
  assert.equal(day3.training[0][0].progression.percentOfAnchor, null, "unlinked");
  assert.ok(day3.training[0][0].goals.weight.every((w) => Number(w) === 200),
    "the last rendered loads stay — clearing stops future linkage, it doesn't rewind history");
});

// A program whose LAST week is a deload must not report the deload's halved scheme as the
// week's normal shape — "most recent by date" landed on exactly that.
test("the panel describes the next upcoming day, not the final deload week", async () => {
  const deloadDay = {
    title: "ANCHOREP deload", date: new Date(Date.now() + 90 * 864e5),
    user: client._id, programId: program._id, programWeek: 12, programDay: 1,
    complete: false, isTemplate: false, category: ["Strength"],
    training: [[{
      exercise: lift._id, customName: "", exerciseType: "Reps", isWarmup: false,
      goals: { sets: 2, minReps: [0, 0], maxReps: [0, 0], exactReps: ["5", "5"],
        weight: ["225", "225"], percent: [0, 0], seconds: [0, 0], rpe: [0, 0], oneRepMax: 0 },
      achieved: { sets: 0, reps: [0, 0], weight: [0, 0], percent: [0, 0], seconds: [0, 0] },
      feedback: { difficulty: null, comments: [] }, techniques: [], coachNote: "",
    }]],
  };
  const r = await Training.collection.insertOne(deloadDay);
  made.push(r.insertedId);
  try {
    const { payload } = await call(anchor_for_exercise, ids(), trainer);
    const d1 = payload.slots.find((s) => s.day === 1);
    assert.equal(d1.scheme, "5x5/5/5/5/5",
      `expected week 1's full scheme, got the later week's "${d1.scheme}"`);
  } finally {
    await Training.collection.deleteOne({ _id: r.insertedId });
  }
});
