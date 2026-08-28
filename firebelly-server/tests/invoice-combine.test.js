// Combining a client's open invoices into one, modelled on the real case: a run of unpaid
// sessions settled in a single payment, with the earliest sessions covered first.
const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Invoice = require("../models/invoice");
const User = require("../models/user");
const { combine_invoices } = require("../controllers/invoiceController");

const money = (n) => Number(Number(n).toFixed(2));
const call = async (body, userId) => {
  let payload = null, statusCode = 200, nextErr = null;
  const res = {
    locals: { user: { _id: userId } },
    status(c) { statusCode = c; return this; },
    json(v) { payload = v; return this; },
  };
  await combine_invoices({ body }, res, (e) => { nextErr = e; });
  if (nextErr) throw nextErr;
  return { statusCode, payload };
};

const line = (desc, date, price, extra = {}) => ({
  itemType: "CUSTOM", description: desc, sessionDate: date ? new Date(date) : null,
  quantity: 1, unitPrice: price, lineTotal: price, sessionCredits: 0, sessionCreditsTotal: 0, ...extra,
});

let trainer, client, made = [];
const mkInvoice = async (over = {}) => {
  const lineItems = over.lineItems || [line("Session", "2026-01-01", 60)];
  const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const amountPaid = over.amountPaid || 0;
  const doc = await Invoice.create({
    trainerId: trainer._id, clientId: client._id, billToType: "CLIENT",
    billToName: "Test Client", invoiceNumber: `T-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
    status: "SENT", currency: "USD", source: "STANDARD", issuedAt: new Date(),
    subtotal, tax: 0, discount: 0, total: subtotal, amountPaid, balanceDue: subtotal - amountPaid,
    createdBy: trainer._id, ...over, lineItems,
  });
  made.push(doc._id);
  return doc;
};

test.before(async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  trainer = await User.findOne({ email: "trainer@example.com" }).lean();
  client = await User.findOne({ email: { $ne: "trainer@example.com" } }).lean();
});
test.after(async () => {
  await Invoice.deleteMany({ _id: { $in: made } });
  await Invoice.deleteMany({ trainerId: trainer._id, notes: /Combines T-/ });
  await mongoose.disconnect();
});

test("Amy's case: three open invoices become one, sessions ordered oldest first", async () => {
  const a = await mkInvoice({ source: "BACKFILL", lineItems: [
    line("60 Min Session — Jun 22", "2026-06-22", 60), line("60 Min Session — Jun 23", "2026-06-23", 60),
    line("60 Min Session — Jul 7", "2026-07-07", 60), line("60 Min Session — Jul 21", "2026-07-21", 60),
  ]});
  const b = await mkInvoice({ lineItems: [line("60 Min Training Session", "2026-08-11", 60, { itemType: "SESSION", sessionCredits: 1, sessionCreditsTotal: 1 })] });
  const c = await mkInvoice({ lineItems: [line("60 Min Training Session", "2026-08-13", 60, { itemType: "SESSION", sessionCredits: 1, sessionCreditsTotal: 1 })] });

  const { statusCode, payload } = await call({ invoiceIds: [b._id, a._id, c._id].map(String) }, trainer._id);
  assert.equal(statusCode, 200);
  const inv = payload.invoice;
  made.push(inv._id);

  assert.equal(money(inv.total), 360, "six $60 sessions");
  assert.equal(inv.lineItems.length, 6);
  assert.deepEqual(
    inv.lineItems.map((l) => new Date(l.sessionDate).toISOString().slice(0, 10)),
    ["2026-06-22", "2026-06-23", "2026-07-07", "2026-07-21", "2026-08-11", "2026-08-13"],
    "oldest session first, regardless of the order the invoices were picked in"
  );
  assert.equal(inv.status, "SENT");
  assert.equal(inv.source, "STANDARD", "mixing backfill + standard yields the client-facing one");
  assert.equal(inv.sessionCreditsTotal, 2, "session credits carry across");

  const sources = await Invoice.find({ _id: { $in: [a._id, b._id, c._id] } }).lean();
  assert.ok(sources.every((s) => s.status === "VOID"), "sources are voided, not deleted");
  assert.ok(sources.every((s) => String(s.combinedIntoId) === String(inv._id)), "sources link forward");
  assert.deepEqual(inv.combinedFromIds.map(String).sort(), [a._id, b._id, c._id].map(String).sort());
});

test("a $240 payment settles the four oldest sessions and leaves the two newest owing", async () => {
  const a = await mkInvoice({ lineItems: [
    line("Jun 22", "2026-06-22", 60), line("Jun 23", "2026-06-23", 60),
    line("Jul 7", "2026-07-07", 60), line("Jul 21", "2026-07-21", 60),
  ]});
  const b = await mkInvoice({ lineItems: [line("Aug 11", "2026-08-11", 60)] });
  const c = await mkInvoice({ lineItems: [line("Aug 13", "2026-08-13", 60)] });
  const { payload } = await call({ invoiceIds: [a._id, b._id, c._id].map(String) }, trainer._id);
  const inv = payload.invoice; made.push(inv._id);

  // Payment applies down the (oldest-first) list.
  const paid = 240;
  let running = 0;
  const covered = inv.lineItems.filter((l) => (running += l.lineTotal) <= paid);
  assert.equal(covered.length, 4);
  assert.deepEqual(covered.map((l) => l.description), ["Jun 22", "Jun 23", "Jul 7", "Jul 21"]);
  assert.equal(money(inv.total - paid), 120, "Aug 11 + Aug 13 still owed");
});

test("existing payments carry over so nothing is collected twice", async () => {
  const a = await mkInvoice({
    status: "PARTIAL", amountPaid: 25,
    payments: [{ type: "PAYMENT", amount: 25, paidAt: new Date("2026-05-01"), method: "Cash" }],
    lineItems: [line("Session A", "2026-05-01", 60)],
  });
  const b = await mkInvoice({ lineItems: [line("Session B", "2026-05-02", 60)] });
  const { payload } = await call({ invoiceIds: [a._id, b._id].map(String) }, trainer._id);
  const inv = payload.invoice; made.push(inv._id);
  assert.equal(money(inv.amountPaid), 25);
  assert.equal(money(inv.balanceDue), 95);
  assert.equal(inv.status, "PARTIAL");
  assert.equal(inv.payments.length, 1);
});

test("refuses invoices belonging to different clients", async () => {
  const other = await User.findOne({ email: { $nin: ["trainer@example.com", client.email] } }).lean();
  const a = await mkInvoice();
  const b = await mkInvoice({ clientId: other._id });
  const { statusCode, payload } = await call({ invoiceIds: [a._id, b._id].map(String) }, trainer._id);
  assert.equal(statusCode, 400);
  assert.match(payload.error, /same client/i);
  assert.equal((await Invoice.findById(a._id)).status, "SENT", "nothing changed on a rejected combine");
});

test("refuses paid or voided invoices", async () => {
  const a = await mkInvoice();
  const b = await mkInvoice({ status: "PAID", amountPaid: 60, balanceDue: 0 });
  const { statusCode, payload } = await call({ invoiceIds: [a._id, b._id].map(String) }, trainer._id);
  assert.equal(statusCode, 400);
  assert.match(payload.error, /Only open invoices/i);
  assert.equal((await Invoice.findById(a._id)).status, "SENT");
});

test("refuses mismatched currencies and a single invoice", async () => {
  const a = await mkInvoice();
  const b = await mkInvoice({ currency: "EUR" });
  const mixed = await call({ invoiceIds: [a._id, b._id].map(String) }, trainer._id);
  assert.equal(mixed.statusCode, 400);
  assert.match(mixed.payload.error, /same currency/i);
  const single = await call({ invoiceIds: [String(a._id)] }, trainer._id);
  assert.equal(single.statusCode, 400);
  assert.match(single.payload.error, /at least two/i);
});

test("refuses another trainer's invoices", async () => {
  const a = await mkInvoice();
  const b = await mkInvoice({ trainerId: new mongoose.Types.ObjectId() });
  const { statusCode, payload } = await call({ invoiceIds: [a._id, b._id].map(String) }, trainer._id);
  assert.equal(statusCode, 404);
  assert.match(payload.error, /could not be found/i);
  assert.equal((await Invoice.findById(a._id)).status, "SENT");
});

test("lines without a session date sort last, behind every dated session", async () => {
  const a = await mkInvoice({ lineItems: [line("Package of 5", null, 250)] });
  const b = await mkInvoice({ lineItems: [line("Aug 13", "2026-08-13", 60)] });
  const { payload } = await call({ invoiceIds: [a._id, b._id].map(String) }, trainer._id);
  const inv = payload.invoice; made.push(inv._id);
  assert.deepEqual(inv.lineItems.map((l) => l.description), ["Aug 13", "Package of 5"]);
});
