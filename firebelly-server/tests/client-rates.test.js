// Per-client session rates: a grandfathered client's price beats the catalog list price,
// and absence of a rate must fall back to list price — never to zero.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const ClientRate = require("../models/clientRate");
const SessionType = require("../models/sessionType");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const { rates_for_client, set_client_rate, resolveRate } = require("../controllers/clientRateController");

const call = async (fn, body, user) => {
  let payload = null, statusCode = 200, err = null;
  const res = { locals: { user }, status(c) { statusCode = c; return this; }, json(v) { payload = v; return this; } };
  await fn({ body }, res, (e) => { err = e; });
  if (err) throw err;
  return { statusCode, payload };
};

let trainer, client, other, type, type2, made = [];

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  trainer = await User.findOne({ email: "trainer@example.com" }).lean();
  trainer = { ...trainer, isTrainer: true };
  const clients = await User.find({ email: { $ne: "trainer@example.com" } }).limit(2).lean();
  [client, other] = clients;
  type = await SessionType.create({ trainerId: trainer._id, name: "ITRATE 60 Min", defaultPrice: 80, currency: "USD", durationMinutes: 60, creditsRequired: 1 });
  type2 = await SessionType.create({ trainerId: trainer._id, name: "ITRATE 2 Person", defaultPrice: 120, currency: "USD", durationMinutes: 60, creditsRequired: 1 });
  made.push(type._id, type2._id);
  await Relationship.findOneAndUpdate(
    { trainer: trainer._id, client: client._id },
    { $set: { accepted: true } }, { upsert: true, new: true }
  );
});
test.after(async () => {
  await ClientRate.deleteMany({ trainerId: trainer._id });
  await SessionType.deleteMany({ _id: { $in: made } });
  await mongoose.disconnect();
});

test("with no override, the client pays the catalog list price", async () => {
  const { payload } = await call(rates_for_client, { clientId: String(client._id) }, trainer);
  const row = payload.rates.find((r) => r.name === "ITRATE 60 Min");
  assert.equal(row.price, 80);
  assert.equal(row.listPrice, 80);
  assert.equal(row.isOverride, false);
});

test("a grandfathered rate overrides the catalog", async () => {
  const set = await call(set_client_rate, { clientId: String(client._id), sessionTypeId: String(type._id), price: 45, note: "grandfathered" }, trainer);
  assert.equal(set.statusCode, 200);
  const { payload } = await call(rates_for_client, { clientId: String(client._id) }, trainer);
  const row = payload.rates.find((r) => r.name === "ITRATE 60 Min");
  assert.equal(row.price, 45);
  assert.equal(row.listPrice, 80, "list price still visible for comparison");
  assert.equal(row.isOverride, true);
  assert.equal(row.note, "grandfathered");
});

test("the override is scoped to ONE session type — others stay at list price", async () => {
  const { payload } = await call(rates_for_client, { clientId: String(client._id) }, trainer);
  const two = payload.rates.find((r) => r.name === "ITRATE 2 Person");
  assert.equal(two.price, 120, "a 1:1 discount must not drag down a multi-person session");
  assert.equal(two.isOverride, false);
});

test("the override is scoped to ONE client", async () => {
  const { payload } = await call(rates_for_client, { clientId: String(other._id) }, trainer);
  const row = payload.rates.find((r) => r.name === "ITRATE 60 Min");
  assert.equal(row.price, 80);
  assert.equal(row.isOverride, false);
});

test("resolveRate agrees with the list endpoint", async () => {
  const r = await resolveRate({ trainerId: trainer._id, clientId: client._id, sessionTypeId: type._id });
  assert.equal(r.price, 45);
  assert.equal(r.isOverride, true);
  const none = await resolveRate({ trainerId: trainer._id, clientId: other._id, sessionTypeId: type._id });
  assert.equal(none.price, 80);
  assert.equal(none.isOverride, false);
});

test("clearing a rate returns the client to list price", async () => {
  const cleared = await call(set_client_rate, { clientId: String(client._id), sessionTypeId: String(type._id), price: null }, trainer);
  assert.equal(cleared.payload.cleared, true);
  const r = await resolveRate({ trainerId: trainer._id, clientId: client._id, sessionTypeId: type._id });
  assert.equal(r.price, 80, "falls back to list, NOT to zero");
  assert.equal(r.isOverride, false);
});

test("a free rate of 0 is honoured and is not treated as 'no rate'", async () => {
  await call(set_client_rate, { clientId: String(client._id), sessionTypeId: String(type._id), price: 0, note: "comped" }, trainer);
  const r = await resolveRate({ trainerId: trainer._id, clientId: client._id, sessionTypeId: type._id });
  assert.equal(r.price, 0);
  assert.equal(r.isOverride, true);
});

test("re-setting a rate updates rather than duplicating", async () => {
  await call(set_client_rate, { clientId: String(client._id), sessionTypeId: String(type._id), price: 55 }, trainer);
  const rows = await ClientRate.find({ trainerId: trainer._id, clientId: client._id, sessionTypeId: type._id }).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, 55);
});

test("refuses a negative price and a non-client", async () => {
  const neg = await call(set_client_rate, { clientId: String(client._id), sessionTypeId: String(type._id), price: -5 }, trainer);
  assert.equal(neg.statusCode, 400);
  // A genuinely unrelated id — the seeded dev "clients" are all accepted by this trainer.
  const strangerId = String(new mongoose.Types.ObjectId());
  const stranger = await call(set_client_rate, { clientId: strangerId, sessionTypeId: String(type._id), price: 50 }, trainer);
  assert.equal(stranger.statusCode, 403, "must not price someone who is not their client");
});

test("non-trainers are refused", async () => {
  const { statusCode } = await call(rates_for_client, { clientId: String(client._id) }, { ...trainer, isTrainer: false });
  assert.equal(statusCode, 403);
});
