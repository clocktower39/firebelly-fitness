// The guard has to hold when a trainer edits only ONE of the two fields — dropping
// the price under an existing payout is just as wrong as raising the payout above it.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const {
  create_schedule_event,
  update_schedule_event,
} = require("../controllers/scheduleController");

const call = async (fn, body, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = { locals: { user }, status(c) { statusCode = c; return this; }, json(v) { payload = v; return this; } };
  await fn({ body }, res, (e) => { err = e; });
  if (err) throw err;
  return { statusCode, payload };
};

let trainer, client, relationship;
const made = [];

const at = (hour) => new Date(Date.UTC(2031, 0, 8, hour, 0, 0, 0));

const book = (over = {}) => ({
  eventType: "APPOINTMENT",
  clientId: client._id,
  startDateTime: at(17),
  endDateTime: at(18),
  status: "BOOKED",
  ...over,
});

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  const stamp = Date.now();
  trainer = await User.create({ firstName: "Payout", lastName: "Trainer", email: `payout-trainer-${stamp}@test.local`, password: "x" });
  client = await User.create({ firstName: "Payout", lastName: "Client", email: `payout-client-${stamp}@test.local`, password: "x" });
  relationship = await Relationship.create({ trainer: trainer._id, client: client._id, accepted: true, requestedBy: trainer._id });
});

test.after(async () => {
  await ScheduleEvent.deleteMany({ _id: { $in: made } });
  await Relationship.deleteOne({ _id: relationship._id });
  await User.deleteMany({ _id: { $in: [trainer._id, client._id] } });
  await mongoose.disconnect();
});

test("booking with a payout above the price is refused", async () => {
  const { statusCode, payload } = await call(
    create_schedule_event,
    book({ priceAmount: 60, payoutAmount: 80 }),
    trainer
  );
  assert.equal(statusCode, 400);
  assert.match(payload.error, /cannot be more than the price/);
  assert.equal(await ScheduleEvent.countDocuments({ trainerId: trainer._id }), 0, "nothing should be saved");
});

test("booking with a payout at or below the price is allowed", async () => {
  const { statusCode, payload } = await call(
    create_schedule_event,
    book({ priceAmount: 60, payoutAmount: 45 }),
    trainer
  );
  assert.equal(statusCode, 200);
  made.push(payload.event._id);
  assert.equal(payload.event.payoutAmount, 45);
});

test("raising only the payout above the stored price is refused", async () => {
  const existing = made[0];
  const { statusCode, payload } = await call(
    update_schedule_event,
    { _id: existing, updates: { payoutAmount: 90 } },
    trainer
  );
  assert.equal(statusCode, 400);
  assert.match(payload.error, /cannot be more than the price/);
  const after = await ScheduleEvent.findById(existing).lean();
  assert.equal(after.payoutAmount, 45, "the stored payout must be untouched");
});

test("dropping only the price below the stored payout is refused", async () => {
  const existing = made[0];
  const { statusCode, payload } = await call(
    update_schedule_event,
    { _id: existing, updates: { priceAmount: 20 } },
    trainer
  );
  assert.equal(statusCode, 400);
  assert.match(payload.error, /cannot be more than the price/);
  const after = await ScheduleEvent.findById(existing).lean();
  assert.equal(after.priceAmount, 60, "the stored price must be untouched");
});

test("moving both together stays allowed", async () => {
  const existing = made[0];
  const { statusCode } = await call(
    update_schedule_event,
    { _id: existing, updates: { priceAmount: 100, payoutAmount: 90 } },
    trainer
  );
  assert.equal(statusCode, 200);
  const after = await ScheduleEvent.findById(existing).lean();
  assert.equal(after.priceAmount, 100);
  assert.equal(after.payoutAmount, 90);
});

test("clearing the payout is still allowed", async () => {
  const existing = made[0];
  const { statusCode } = await call(
    update_schedule_event,
    { _id: existing, updates: { payoutAmount: "" } },
    trainer
  );
  assert.equal(statusCode, 200);
  const after = await ScheduleEvent.findById(existing).lean();
  assert.equal(after.payoutAmount, null);
});
