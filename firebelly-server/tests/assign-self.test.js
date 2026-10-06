// A trainer running their own programming: "assign to myself" used to 403, because
// assign_program demanded an accepted Relationship and nobody has one with themselves.
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

let trainer, outsider, program, dayDoc, lift;
const made = [];

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  const stamp = Date.now();
  trainer = await User.create({ firstName: "Self", lastName: "Trainer", email: `self-tr-${stamp}@test.local`, password: "x", isTrainer: true });
  outsider = await User.create({ firstName: "Self", lastName: "Outsider", email: `self-out-${stamp}@test.local`, password: "x" });
  lift = await Exercise.findOne({}).select("_id").lean();
  dayDoc = await Training.create({
    title: "SELFASSIGN D1", user: trainer._id, category: ["Strength"], isTemplate: true, isProgramDay: true,
    training: [[{ exercise: lift._id, exerciseType: "Reps",
      goals: { sets: 3, minReps: [0,0,0], maxReps: [0,0,0], exactReps: ["5","5","5"], weight: [0,0,0], percent: [0,0,0], seconds: [0,0,0], rpe: [0,0,0] },
      achieved: { sets: 0, reps: [0,0,0], weight: [0,0,0], percent: [0,0,0], seconds: [0,0,0] } }]],
  });
  made.push(dayDoc._id);
  program = await Program.create({
    ownerId: trainer._id, title: "Self Assign Test", weeksCount: 2, daysPerWeek: 1,
    weeks: [[{ dayIndex: 1, workoutId: dayDoc._id, notes: "" }], [{ dayIndex: 1, workoutId: dayDoc._id, notes: "" }]],
  });
});
test.after(async () => {
  await Training.deleteMany({ $or: [{ _id: { $in: made } }, { programId: program._id }] });
  await Program.deleteOne({ _id: program._id });
  await Relationship.deleteMany({ trainer: trainer._id });
  await User.deleteMany({ _id: { $in: [trainer._id, outsider._id] } });
  await mongoose.disconnect();
});

test("a trainer can assign a program to themselves without a self-relationship", async () => {
  assert.equal(await Relationship.countDocuments({ trainer: trainer._id, client: trainer._id }), 0,
    "precondition: nobody has a relationship with themselves");
  const { statusCode, payload } = await call(program._id,
    { clientId: String(trainer._id), startDate: "2031-03-03" },
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 200, `expected success, got ${statusCode}: ${JSON.stringify(payload)}`);
  assert.equal(payload.count, 2, "one day a week over two weeks");
  const mine = await Training.find({ user: trainer._id, programId: program._id, isTemplate: { $ne: true } }).lean();
  assert.equal(mine.length, 2);
  assert.ok(mine.every((w) => String(w.assignedBy) === String(trainer._id)));
});

test("assigning to someone who is not their client is still refused", async () => {
  const { statusCode } = await call(program._id,
    { clientId: String(outsider._id), startDate: "2031-03-03" },
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 403);
});

test("an accepted client still works", async () => {
  await Relationship.create({ trainer: trainer._id, client: outsider._id, accepted: true, requestedBy: trainer._id });
  const { statusCode, payload } = await call(program._id,
    { clientId: String(outsider._id), startDate: "2031-04-07" },
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 200);
  assert.equal(payload.count, 2);
});
