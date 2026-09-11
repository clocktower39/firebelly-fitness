const mongoose = require("mongoose");
const Invoice = require("../models/invoice");
const ScheduleEvent = require("../models/scheduleEvent");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const Relationship = require("../models/relationship");
const SessionType = require("../models/sessionType");
const User = require("../models/user");

// Does each client's session-credit balance match reality?
//
// The ledger drifts silently: invoices created by "Log sessions" / Import→Reconcile are
// BACKFILL records that deliberately never grant credits, while every completed appointment
// still debits one. Sell a package that way and the balance sinks a little further each week,
// invisibly, until a booking is refused. This computes the honest number from the source
// records — sessions billed vs sessions actually taken — so the drift is visible before it
// blocks anyone.
//
// `expected` = billed − completed. `drift` = what the ledger says minus that. A healthy client
// has drift 0; anything else means credits were never granted (or granted twice).
const buildRows = async (trainerId, clientIds) => {
  const oid = (v) => new mongoose.Types.ObjectId(String(v));

  const billedAgg = await Invoice.aggregate([
    { $match: { trainerId: oid(trainerId), clientId: { $in: clientIds.map(oid) }, status: { $ne: "VOID" } } },
    { $unwind: "$lineItems" },
    // Session lines only — a merch or program line is not a session someone can book against.
    { $match: { $or: [{ "lineItems.itemType": "SESSION" }, { "lineItems.sessionDate": { $ne: null } }, { "lineItems.sessionCredits": { $gt: 0 } }] } },
    { $group: {
        _id: "$clientId",
        billed: { $sum: { $ifNull: ["$lineItems.quantity", 1] } },
        creditsGranted: { $sum: { $ifNull: ["$lineItems.sessionCreditsTotal", 0] } },
        invoices: { $addToSet: "$_id" },
        backfill: { $addToSet: { $cond: [{ $eq: ["$source", "BACKFILL"] }, "$_id", "$$REMOVE"] } },
    } },
  ]);

  const completedAgg = await ScheduleEvent.aggregate([
    { $match: { trainerId: oid(trainerId), clientId: { $in: clientIds.map(oid) }, eventType: "APPOINTMENT", status: "COMPLETED" } },
    { $group: { _id: "$clientId", completed: { $sum: 1 } } },
  ]);

  const ledgerAgg = await BillingLedgerEntry.aggregate([
    { $match: { trainerId: oid(trainerId), clientId: { $in: clientIds.map(oid) } } },
    { $group: { _id: "$clientId", balance: { $sum: "$delta" } } },
  ]);

  const billedBy = new Map(billedAgg.map((r) => [String(r._id), r]));
  const doneBy = new Map(completedAgg.map((r) => [String(r._id), r.completed]));
  const ledgerBy = new Map(ledgerAgg.map((r) => [String(r._id), r.balance]));

  return clientIds.map((id) => {
    const key = String(id);
    const b = billedBy.get(key) || { billed: 0, creditsGranted: 0, invoices: [], backfill: [] };
    const completed = doneBy.get(key) || 0;
    const ledger = ledgerBy.get(key) || 0;
    const expected = b.billed - completed;
    return {
      clientId: key,
      billed: b.billed,
      completed,
      creditsGranted: b.creditsGranted,
      ledgerBalance: ledger,
      expected,
      drift: ledger - expected,
      invoiceCount: (b.invoices || []).length,
      backfillCount: (b.backfill || []).length,
    };
  });
};

const reconciliation_report = async (req, res, next) => {
  try {
    const trainerId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can run reports." });
    }
    const rels = await Relationship.find({ trainer: trainerId, accepted: true })
      .populate({ path: "client", select: "firstName lastName" })
      .lean();
    const clients = rels.filter((r) => r?.client?._id);
    const rows = await buildRows(trainerId, clients.map((r) => r.client._id));
    const nameOf = new Map(clients.map((r) => [String(r.client._id), `${r.client.firstName} ${r.client.lastName}`]));

    const withNames = rows
      .map((r) => ({ ...r, clientName: nameOf.get(r.clientId) || "" }))
      // Only clients with any billing or session history are worth showing.
      .filter((r) => r.billed || r.completed || r.ledgerBalance)
      .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    return res.json({
      rows: withNames,
      totals: {
        clients: withNames.length,
        drifted: withNames.filter((r) => r.drift !== 0).length,
        negativeBalance: withNames.filter((r) => r.ledgerBalance < 0).length,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Every session for one client with the invoice that claims it — the "show me sessions linked
// to invoices" view. A session is matched by the hard scheduleEventId link first, then by
// calendar date against a backfill line (backfill lines often carry only a date).
const client_session_ledger = async (req, res, next) => {
  try {
    const trainerId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can run reports." });
    }
    const { clientId, from, to } = req.body;
    const rel = await Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true }).lean();
    if (!rel) return res.status(403).json({ error: "Not your client." });

    const range = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);

    const events = await ScheduleEvent.find({
      trainerId, clientId, eventType: "APPOINTMENT",
      ...(from || to ? { startDateTime: range } : {}),
    }).select("startDateTime status billingStatus priceAmount sessionTypeId").sort({ startDateTime: 1 }).lean();

    const invoices = await Invoice.find({ trainerId, clientId })
      .select("invoiceNumber status source issuedAt lineItems").lean();
    const byEvent = new Map();
    const byDate = new Map();
    invoices.forEach((inv) => (inv.lineItems || []).forEach((l) => {
      if (l.scheduleEventId) byEvent.set(String(l.scheduleEventId), inv);
      if (l.sessionDate) {
        const k = new Date(l.sessionDate).toISOString().slice(0, 10);
        if (!byDate.has(k)) byDate.set(k, inv);
      }
    }));
    const types = new Map((await SessionType.find({ trainerId }).select("name").lean()).map((t) => [String(t._id), t.name]));

    const sessions = events.map((e) => {
      const day = e.startDateTime ? new Date(e.startDateTime).toISOString().slice(0, 10) : null;
      const inv = byEvent.get(String(e._id)) || (day ? byDate.get(day) : null);
      return {
        eventId: String(e._id),
        date: e.startDateTime,
        status: e.status,
        billingStatus: e.billingStatus,
        price: e.priceAmount,
        sessionType: e.sessionTypeId ? types.get(String(e.sessionTypeId)) || null : null,
        invoiceNumber: inv?.invoiceNumber || null,
        invoiceId: inv ? String(inv._id) : null,
        invoiceSource: inv?.source || null,
        linkedBy: inv ? (byEvent.has(String(e._id)) ? "event" : "date") : null,
      };
    });

    const [summary] = await buildRows(trainerId, [clientId]);
    return res.json({
      sessions,
      summary,
      unlinked: sessions.filter((s) => !s.invoiceNumber && s.status === "COMPLETED").length,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { reconciliation_report, client_session_ledger, buildRows };
