// A lifter's one-rep max used to exist only inside a Training entry's goals, so the same
// number was duplicated into every workout that referenced it. These cover the new per-lifter
// store and the history seeding that fills the entry page.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const ExerciseMax = require("../models/exerciseMax");
const Training = require("../models/training");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const Exercise = require("../models/exercise");
const ctrl = require("../controllers/exerciseMaxController");

const call = async (fn, body, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = { locals: { user }, status(c) { statusCode = c; return this; }, json(v) { payload = v; return this; } };
  await fn({ body }, res, (e) => { err = e; });
  if (err) throw err;
  return { statusCode, payload };
};

const setOf = (w, r) => ({
  exerciseType: "Reps",
  goals: { sets: r.length, minReps: r.map(() => 0), maxReps: r.map(() => 0), exactReps: r, weight: w, percent: r.map(() => 0), seconds: r.map(() => 0) },
  achieved: { sets: r.length, reps: r, weight: w, percent: r.map(() => 0), seconds: r.map(() => 0) },
});

let trainer, client, outsider, squat, press, bodyweight;
const made = [];

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  const stamp = Date.now();
  trainer = await User.create({ firstName: "Max", lastName: "Trainer", email: `mx-tr-${stamp}@test.local`, password: "x", isTrainer: true });
  client = await User.create({ firstName: "Max", lastName: "Client", email: `mx-cl-${stamp}@test.local`, password: "x" });
  outsider = await User.create({ firstName: "Max", lastName: "Outsider", email: `mx-out-${stamp}@test.local`, password: "x", isTrainer: true });
  await Relationship.create({ trainer: trainer._id, client: client._id, accepted: true, requestedBy: trainer._id });
  squat = await Exercise.findOne({ exerciseTitle: "Barbell Back Squat" }).select("_id").lean();
  press = await Exercise.findOne({ exerciseTitle: "Standing Barbell Shoulder Press" }).select("_id").lean();
  bodyweight = await Exercise.findOne({ exerciseTitle: "Push-ups" }).select("_id").lean();
  assert.ok(squat && press && bodyweight, "fixture exercises must exist in the library");

  // squat: a true single at 300 plus a heavier-estimating rep set (280x5 -> 326.7)
  made.push((await Training.create({ title: "MAXTEST squat A", user: client._id, category: ["Strength"], date: new Date("2031-01-10"), complete: true,
    training: [[{ exercise: squat._id, ...setOf([300], [1]) }]] }))._id);
  made.push((await Training.create({ title: "MAXTEST squat B", user: client._id, category: ["Strength"], date: new Date("2031-01-20"), complete: true,
    training: [[{ exercise: squat._id, ...setOf([280, 280, 280, 280, 280], [5, 5, 5, 5, 5]) }]] }))._id);
  // press: rep sets only, no single -> must fall back to an estimate
  made.push((await Training.create({ title: "MAXTEST press", user: client._id, category: ["Strength"], date: new Date("2031-02-01"), complete: true,
    training: [[{ exercise: press._id, ...setOf([100, 100, 100], [3, 3, 3]) }]] }))._id);
  // an old, heavier single: "best ever" must NOT beat recent evidence
  made.push((await Training.create({ title: "MAXTEST squat ancient", user: client._id, category: ["Strength"], date: new Date("2019-05-05"), complete: true,
    training: [[{ exercise: squat._id, ...setOf([400], [1]) }]] }))._id);
  // a percentage-based entry marks a lift as NEEDING a max, even with no history
  made.push((await Training.create({ title: "MAXTEST pct", user: client._id, category: ["Strength"], date: new Date("2031-03-01"),
    training: [[{ exercise: bodyweight._id, exerciseType: "Reps with %",
      goals: { sets: 3, minReps: [0,0,0], maxReps: [0,0,0], exactReps: [3,3,3], weight: [0,0,0], percent: [70,70,70], seconds: [0,0,0], oneRepMax: 0 },
      achieved: { sets: 0, reps: [0,0,0], weight: [0,0,0], percent: [0,0,0], seconds: [0,0,0] } }]] }))._id);
  // a 20-rep set must NOT drive an estimate, and bodyweight work must not appear at all
  made.push((await Training.create({ title: "MAXTEST junk", user: client._id, category: ["Strength"], date: new Date("2031-02-05"), complete: true,
    training: [[{ exercise: press._id, ...setOf([200], [20]) }, { exercise: bodyweight._id, ...setOf([0], [25]) }]] }))._id);
});

test.after(async () => {
  await Training.deleteMany({ _id: { $in: made } });
  await ExerciseMax.deleteMany({ userId: { $in: [client._id, trainer._id] } });
  await Relationship.deleteMany({ trainer: trainer._id });
  await User.deleteMany({ _id: { $in: [trainer._id, client._id, outsider._id] } });
  await mongoose.disconnect();
});

test("the strongest evidence wins, whether that is a single or a rep set", async () => {
  const h = await ctrl.seedFromHistory(client._id);
  const s = h.get(String(squat._id));
  assert.ok(s, "squat should appear in history");
  assert.equal(s.bestSingle.weight, 300, "both kinds of evidence are reported");
  assert.equal(s.bestEstimate.value, ctrl.epley(280, 5), "estimate comes from the 280x5");
  assert.ok(s.bestEstimate.value > 300, "precondition: the rep set implies more than the single");
  // Most logged singles are warm-ups inside a ramp, so a single that is LIGHTER than the
  // working set's estimate must not be treated as the max.
  assert.equal(s.suggested, ctrl.epley(280, 5), "the heavier estimate wins over a lighter single");
  assert.equal(s.suggestedSource, "estimated");
});

test("a single that really is the heaviest effort is used as tested", async () => {
  // press history is 100x3 (-> 110). A 130 single beats it; a 90 single would not.
  const heavy = await Training.create({ title: "MAXTEST press single", user: client._id, category: ["Strength"],
    date: new Date("2031-02-10"), complete: true, training: [[{ exercise: press._id, ...setOf([130], [1]) }]] });
  made.push(heavy._id);
  const h = await ctrl.seedFromHistory(client._id);
  const p = h.get(String(press._id));
  assert.equal(p.suggested, 130);
  assert.equal(p.suggestedSource, "tested");
  await Training.deleteOne({ _id: heavy._id });
});

test("with no single at all, the suggestion is an estimate and says so", async () => {
  const h = await ctrl.seedFromHistory(client._id);
  const p = h.get(String(press._id));
  assert.equal(p.bestSingle, null);
  assert.equal(p.suggestedSource, "estimated");
  assert.equal(p.suggested, ctrl.epley(100, 3), "100x3 drives it");
  assert.equal(p.bestEstimate.fromReps, 3);
});

test("a 20-rep set is ignored and unloaded work never appears", async () => {
  const h = await ctrl.seedFromHistory(client._id);
  const p = h.get(String(press._id));
  // 200x20 estimates to ~333, far above the 100x3 set's 110 — so if the rep cap were missing
  // it would dominate. The cap is what keeps a conditioning set out of a 1RM.
  assert.ok(ctrl.epley(200, 20) > ctrl.epley(100, 3), "precondition: the 20-rep set would win uncapped");
  assert.equal(p.bestEstimate.fromReps, 3, "the estimate must come from the 3-rep set");
  assert.equal(p.bestEstimate.fromWeight, 100);
  assert.equal(p.suggested, ctrl.epley(100, 3));
  // it is present only because a percentage entry references it, with no derived suggestion
  const bw = h.get(String(bodyweight._id));
  assert.ok(bw, "a lift referenced by a % entry is offerable even with no loaded history");
  assert.equal(bw.suggested, null, "no loaded sets means no suggestion");
  assert.equal(bw.needsMax, true);
});

test("the entry page lists stored maxes first, with history alongside", async () => {
  const { statusCode, payload } = await call(ctrl.maxes_for_user, { clientId: String(client._id) },
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 200);
  const squatRow = payload.rows.find((r) => r.exerciseId === String(squat._id));
  assert.ok(squatRow, "squat row present");
  assert.equal(squatRow.stored, null, "nothing stored yet");
  assert.equal(squatRow.suggested, ctrl.epley(280, 5), "strongest recent evidence");
  assert.ok(squatRow.lastSet, "carries the most recent set for context");
  // The bodyweight lift appears ONLY because a percentage entry references it, and it offers
  // no suggestion because nothing loaded was ever logged for it.
  const bwRow = payload.rows.find((r) => r.exerciseId === String(bodyweight._id));
  assert.ok(bwRow && bwRow.needsMax && bwRow.suggested === null,
    "a %-referenced lift is listed but suggests nothing");
});

test("a trainer can save a client's max, and it is one row per lift", async () => {
  const first = await call(ctrl.set_max,
    { clientId: String(client._id), exerciseId: String(squat._id), value: 300, source: "tested" },
    { _id: trainer._id, isTrainer: true });
  assert.equal(first.statusCode, 200);
  assert.equal(first.payload.max.value, 300);

  // saving again must UPDATE, not create a second row
  const second = await call(ctrl.set_max,
    { clientId: String(client._id), exerciseId: String(squat._id), value: 315 },
    { _id: trainer._id, isTrainer: true });
  assert.equal(second.statusCode, 200);
  assert.equal(second.payload.max.value, 315);
  assert.equal(await ExerciseMax.countDocuments({ userId: client._id, exerciseId: squat._id }), 1,
    "the unique index means one max per lift, not one per save");
  assert.equal(String(second.payload.max.setBy), String(trainer._id), "records who set it");
});

test("a stored max outranks lifts with only a suggestion", async () => {
  const { payload } = await call(ctrl.maxes_for_user, { clientId: String(client._id) },
    { _id: trainer._id, isTrainer: true });
  const squatRow = payload.rows.find((r) => r.exerciseId === String(squat._id));
  assert.equal(squatRow.stored.value, 315);
  // Program-needed lifts lead the list; among the rest, a lift with a max on record comes
  // before lifts that only have a suggestion.
  const idx = payload.rows.indexOf(squatRow);
  const firstPlain = payload.rows.findIndex((r) => !r.needsMax && !r.stored);
  assert.ok(firstPlain === -1 || idx < firstPlain, "stored lifts precede suggestion-only lifts");
  assert.ok(payload.rows.slice(0, idx).every((r) => r.needsMax),
    "only program-needed lifts may precede a stored max");
});

test("an empty value clears the max rather than storing zero", async () => {
  const { statusCode, payload } = await call(ctrl.set_max,
    { clientId: String(client._id), exerciseId: String(squat._id), value: "" },
    { _id: trainer._id, isTrainer: true });
  assert.equal(statusCode, 200);
  assert.equal(payload.status, "cleared");
  assert.equal(await ExerciseMax.countDocuments({ userId: client._id, exerciseId: squat._id }), 0);
});

test("a client can read and write their own maxes without being a trainer", async () => {
  const read = await call(ctrl.maxes_for_user, {}, { _id: client._id, isTrainer: false });
  assert.equal(read.statusCode, 200);
  const write = await call(ctrl.set_max, { exerciseId: String(press._id), value: 120 },
    { _id: client._id, isTrainer: false });
  assert.equal(write.statusCode, 200);
  assert.equal(write.payload.max.value, 120);
});

test("someone else's trainer cannot read or write these maxes", async () => {
  const read = await call(ctrl.maxes_for_user, { clientId: String(client._id) },
    { _id: outsider._id, isTrainer: true });
  assert.equal(read.statusCode, 403);
  const write = await call(ctrl.set_max, { clientId: String(client._id), exerciseId: String(squat._id), value: 999 },
    { _id: outsider._id, isTrainer: true });
  assert.equal(write.statusCode, 403);
  assert.equal(await ExerciseMax.countDocuments({ userId: client._id, exerciseId: squat._id }), 0);
});


test("a one-rep set estimates to exactly the weight lifted", () => {
  // The bare Epley formula returns weight × 1.033 at r=1, which would turn a logged
  // 300 × 1 into a 310 lb "max".
  assert.equal(ctrl.epley(300, 1), 300);
  assert.equal(ctrl.epley(115, 1), 115);
  assert.ok(ctrl.epley(300, 2) > 300, "multi-rep sets still estimate upward");
});

test("recent evidence beats a heavier all-time best", async () => {
  const h = await ctrl.seedFromHistory(client._id);
  const s = h.get(String(squat._id));
  // 400 × 1 from 2019 is the heaviest single ever logged, but it is years outside the window.
  assert.equal(s.allTimeBest.weight, 400, "all-time best is still reported as context");
  assert.ok(s.suggested < 400, "the 2019 single must not drive the suggestion");
  assert.equal(s.suggested, ctrl.epley(280, 5), "it comes from recent work");
  assert.equal(s.suggestedFromRecent, true);
});

test("lifts a program needs a max for sort to the top", async () => {
  const { payload } = await ctrl.maxes_for_user === undefined ? {} : await (async () => {
    let out = null;
    const res = { locals: { user: { _id: client._id, isTrainer: false } }, status() { return this; }, json(v) { out = v; return this; } };
    await ctrl.maxes_for_user({ body: {} }, res, (e) => { throw e; });
    return { payload: out };
  })();
  const needed = payload.rows.filter((r) => r.needsMax);
  assert.ok(needed.length >= 1, "at least one lift is flagged as needed");
  assert.equal(payload.rows[0].needsMax, true, "a needed lift leads the list");
  const firstUnneeded = payload.rows.findIndex((r) => !r.needsMax);
  const lastNeeded = payload.rows.map((r) => r.needsMax).lastIndexOf(true);
  assert.ok(lastNeeded < firstUnneeded || firstUnneeded === -1, "needed lifts are grouped first");
});
