// Previous/next workout navigation: neighbours must come from the SAME owner's dated flow,
// must be exact inverses of each other, and must never cross into another account.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Training = require("../models/training");
const { get_next_workout } = require("../controllers/training/workoutCore");

const call = async (id, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = { locals: { user }, status(c) { statusCode = c; return this; }, json(v) { payload = v; return this; } };
  await get_next_workout({ body: { _id: String(id) } }, res, (e) => { err = e; });
  if (err) throw err;
  return { statusCode, payload };
};

// A synthetic owner id: the seeded dev trainer already has workouts, so using it would make
// "the first workout has nothing before it" depend on unrelated seed data. Training.user is an
// ObjectId ref the controller only string-compares, so a standalone id isolates the flow.
let owner, other, made = [];
const mk = (date, title, extra = {}) =>
  new Training({
    title, date: new Date(date), user: owner._id, category: ["Strength"],
    training: [[]], ...extra,
  }).save().then((d) => { made.push(d._id); return d; });

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  owner = { _id: new mongoose.Types.ObjectId() };
  other = { _id: new mongoose.Types.ObjectId() };
  await Training.deleteMany({ title: /^NBR / });
});
test.after(async () => {
  await Training.deleteMany({ _id: { $in: made } });
  await Training.deleteMany({ title: /^NBR / });
  await mongoose.disconnect();
});

test("walks forward and backward through the owner's workouts", async () => {
  const a = await mk("2030-01-01", "NBR A");
  const b = await mk("2030-01-05", "NBR B");
  const c = await mk("2030-01-09", "NBR C");

  const mid = (await call(b._id, owner)).payload;
  assert.equal(String(mid.prev._id), String(a._id));
  assert.equal(String(mid.next._id), String(c._id));
  assert.equal(mid.prev.title, "NBR A");
  assert.equal(mid.next.title, "NBR C");
});

test("the ends have no neighbour beyond them", async () => {
  const first = await Training.findOne({ title: "NBR A" }).lean();
  const last = await Training.findOne({ title: "NBR C" }).lean();
  const atStart = (await call(first._id, owner)).payload;
  const atEnd = (await call(last._id, owner)).payload;
  assert.equal(atStart.prev, null, "nothing before the first workout");
  assert.ok(atStart.next, "but there is something after it");
  assert.equal(atEnd.next, null, "nothing after the last workout");
  assert.ok(atEnd.prev, "but there is something before it");
});

test("prev and next are exact inverses, even when workouts share a date", async () => {
  const x = await mk("2030-02-01", "NBR SAME 1");
  const y = await mk("2030-02-01", "NBR SAME 2");
  const z = await mk("2030-02-01", "NBR SAME 3");
  const ordered = [x, y, z].sort((p, q) => String(p._id).localeCompare(String(q._id)));

  // step forward from the first, then back — must land where we started
  const fwd = (await call(ordered[0]._id, owner)).payload;
  assert.equal(String(fwd.next._id), String(ordered[1]._id), "same-date tie broken by _id");
  const back = (await call(fwd.next._id, owner)).payload;
  assert.equal(String(back.prev._id), String(ordered[0]._id), "stepping back returns to the start");
});

test("never crosses into another user's workouts", async () => {
  const mine = await mk("2030-03-10", "NBR MINE");
  const theirs = await new Training({
    title: "NBR THEIRS", date: new Date("2030-03-11"), user: other._id,
    category: ["Strength"], training: [[]],
  }).save();
  made.push(theirs._id);
  const { payload } = await call(mine._id, owner);
  assert.equal(payload.next, null, "the other account's workout must not be reachable");
});

test("templates are excluded from the flow", async () => {
  const before = await mk("2030-04-01", "NBR BEFORE");
  await mk("2030-04-02", "NBR TEMPLATE", { isTemplate: true });
  const after = await mk("2030-04-03", "NBR AFTER");
  const { payload } = await call(before._id, owner);
  assert.equal(String(payload.next._id), String(after._id), "steps over the template");
});

test("a template itself has no neighbours", async () => {
  const tmpl = await Training.findOne({ title: "NBR TEMPLATE" }).lean();
  const { payload } = await call(tmpl._id, owner);
  assert.equal(payload.next, null);
  assert.equal(payload.prev, undefined, "templates short-circuit before the neighbour query");
});

test("a stranger cannot read someone else's neighbours", async () => {
  const mine = await Training.findOne({ title: "NBR MINE" }).lean();
  const { statusCode } = await call(mine._id, { _id: new mongoose.Types.ObjectId() });
  assert.equal(statusCode, 403);
});
