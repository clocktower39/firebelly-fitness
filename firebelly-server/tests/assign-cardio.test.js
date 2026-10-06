// A running day's prescription lives in `cardio`/`workoutType`, not in `training`. Assigning
// a mixed strength+cardio program used to drop both, so a marathon block arrived as a week of
// empty "Strength" workouts. Also pins the dayMap weekday math, including a weekday that sits
// EARLIER in the week than the start date (Sunday after a Monday start must land on day 7).
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Program = require("../models/program");
const Training = require("../models/training");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const Exercise = require("../models/exercise");
const { assign_program } = require("../controllers/programController");

const call = async (programId, body, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = { locals: { user }, status(c) { statusCode = c; return this; }, json(v) { payload = v; return this; } };
  await assign_program({ params: { id: String(programId) }, body }, res, (e) => { err = e; });
  if (err) throw err;
  return { statusCode, payload };
};

const RUN_PLAN = {
  plan: { activity: "Run", style: "Easy", distance: "4", distanceUnit: "mi", duration: "35", rpe: "5", hrZone: "Z2 Endurance", notes: "conversational", segments: [] },
  actual: {},
};

let trainer, client, program, liftDay, runDay, lift;
const made = [];

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  const stamp = Date.now();
  trainer = await User.create({ firstName: "Cardio", lastName: "Trainer", email: `cd-tr-${stamp}@test.local`, password: "x", isTrainer: true });
  client = await User.create({ firstName: "Cardio", lastName: "Client", email: `cd-cl-${stamp}@test.local`, password: "x" });
  await Relationship.create({ trainer: trainer._id, client: client._id, accepted: true, requestedBy: trainer._id });
  lift = await Exercise.findOne({}).select("_id").lean();

  liftDay = await Training.create({
    title: "CARDIOTEST Strength", user: trainer._id, category: ["Strength"], workoutType: "Strength",
    isTemplate: true, isProgramDay: true,
    training: [[{ exercise: lift._id, exerciseType: "Reps",
      goals: { sets: 3, minReps: [0,0,0], maxReps: [0,0,0], exactReps: ["5","5","5"], weight: [0,0,0], percent: [0,0,0], seconds: [0,0,0], rpe: [0,0,0] },
      achieved: { sets: 0, reps: [0,0,0], weight: [0,0,0], percent: [0,0,0], seconds: [0,0,0] } }]],
  });
  runDay = await Training.create({
    title: "CARDIOTEST Easy Run", user: trainer._id, category: ["Cardio"], workoutType: "Cardio",
    cardio: RUN_PLAN, isTemplate: true, isProgramDay: true, training: [[]],
  });
  made.push(liftDay._id, runDay._id);

  // Day 1 = strength, Day 2 = the run.
  const week = [{ dayIndex: 1, workoutId: liftDay._id, notes: "" }, { dayIndex: 2, workoutId: runDay._id, notes: "" }];
  program = await Program.create({
    ownerId: trainer._id, title: "Cardio Assign Test", weeksCount: 1, daysPerWeek: 2, weeks: [week],
  });
});

test.after(async () => {
  await Training.deleteMany({ $or: [{ _id: { $in: made } }, { programId: program._id }] });
  await Program.deleteOne({ _id: program._id });
  await Relationship.deleteMany({ trainer: trainer._id });
  await User.deleteMany({ _id: { $in: [trainer._id, client._id] } });
  await mongoose.disconnect();
});

test("a cardio day keeps its workoutType and its run plan", async () => {
  const { statusCode, payload } = await call(program._id,
    { clientId: String(client._id), startDate: "2031-03-03" }, // a Monday
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 200, `expected success, got ${statusCode}: ${JSON.stringify(payload)}`);

  const assigned = await Training.find({ user: client._id, programId: program._id }).lean();
  assert.equal(assigned.length, 2);

  const run = assigned.find((w) => w.title.includes("Easy Run"));
  assert.ok(run, "the run day was assigned");
  assert.equal(run.workoutType, "Cardio", "a run assigned as a Strength workout is the bug");
  assert.equal(run.cardio?.plan?.distance, "4", "the prescribed distance must survive assignment");
  assert.equal(run.cardio?.plan?.style, "Easy");
  assert.equal(run.cardio?.plan?.hrZone, "Z2 Endurance");

  const strength = assigned.find((w) => w.title.includes("Strength"));
  assert.equal(strength.workoutType, "Strength");
  assert.equal(strength.training[0].length, 1, "the lifting day still carries its exercises");
});

test("dayMap places a weekday that falls before the start date later in the same week", async () => {
  await Training.deleteMany({ programId: program._id });
  // Start Monday; put day 1 on Wednesday (3) and day 2 on Sunday (0).
  const { statusCode } = await call(program._id,
    { clientId: String(client._id), startDate: "2031-03-03", dayMap: [3, 0] },
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 200);

  const assigned = await Training.find({ user: client._id, programId: program._id }).lean();
  const byTitle = Object.fromEntries(assigned.map((w) => [w.title.includes("Run") ? "run" : "lift", w.date]));
  assert.equal(new Date(byTitle.lift).toISOString().slice(0, 10), "2031-03-05", "Wednesday of the start week");
  assert.equal(new Date(byTitle.run).toISOString().slice(0, 10), "2031-03-09", "Sunday AFTER that Wednesday, not before it");
});
