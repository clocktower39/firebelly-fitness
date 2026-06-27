const BillingLedgerEntry = require("../models/billingLedgerEntry");
const ScheduleEvent = require("../models/scheduleEvent");
const SessionType = require("../models/sessionType");
const User = require("../models/user");
const { createNotification } = require("./notificationService");

// After a session debit, alert the client + trainer on the aggregate balance (the app's
// "remainingSessions"): "1 session left" when it lands on exactly 1, or "out of sessions"
// when this debit crosses from positive to <= 0 (covers running out, incl. multi-credit
// jumps over 1). Best-effort; fires once per crossing.
const notifySessionBalance = async (trainerId, clientId, debitDelta) => {
  try {
    if (!trainerId || !clientId) return;
    const agg = await BillingLedgerEntry.aggregate([
      { $match: { trainerId, clientId } },
      { $group: { _id: null, balance: { $sum: "$delta" } } },
    ]);
    const post = agg[0]?.balance || 0;
    const pre = post - (Number(debitDelta) || 0); // balance before this debit

    let kind = null;
    if (post === 1) kind = "LOW";
    else if (pre > 0 && post <= 0) kind = "OUT";
    if (!kind) return;

    const client = await User.findById(clientId).select("firstName lastName").lean();
    const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "Your client";

    if (kind === "LOW") {
      await createNotification({
        userId: clientId,
        type: "SESSIONS_LOW",
        title: "1 session left",
        body: "You have 1 training session remaining — book or purchase more to keep going.",
        link: "/sessions",
      });
      await createNotification({
        userId: trainerId,
        type: "SESSIONS_LOW",
        title: `${clientName} has 1 session left`,
        body: `${clientName} is down to their last training session.`,
        link: "/clients",
      });
    } else {
      await createNotification({
        userId: clientId,
        type: "SESSIONS_OUT",
        title: "You're out of sessions",
        body: "You've used your last training session — purchase more to keep training.",
        link: "/sessions",
      });
      await createNotification({
        userId: trainerId,
        type: "SESSIONS_OUT",
        title: `${clientName} is out of sessions`,
        body: `${clientName} has used their last training session.`,
        link: "/clients",
      });
    }
  } catch (err) {
    console.error("session-balance notify failed:", err.message);
  }
};

const getEventLedgerNet = async (eventId) => {
  if (!eventId) return 0;
  const summary = await BillingLedgerEntry.aggregate([
    { $match: { eventId } },
    { $group: { _id: null, net: { $sum: "$delta" } } },
  ]);
  return summary[0]?.net || 0;
};

const resolveEventCredits = async (event) => {
  if (!event?.sessionTypeId) return 1;
  const type = await SessionType.findById(event.sessionTypeId).lean();
  if (!type) return 1;
  const credits = Number(type.creditsRequired);
  return Number.isFinite(credits) && credits > 0 ? credits : 1;
};

const createEventDebitEntry = async ({ event, userId, source }) => {
  if (!event || !event.clientId) return null;
  const net = await getEventLedgerNet(event._id);
  if (net < 0) return null;
  const credits = await resolveEventCredits(event);

  const entry = new BillingLedgerEntry({
    trainerId: event.trainerId,
    clientId: event.clientId,
    sessionTypeId: event.sessionTypeId || null,
    entryType: "DEBIT",
    delta: -credits,
    source,
    eventId: event._id,
    notes: `Session ${source === "CANCELLATION_CHARGED" ? "cancellation charged" : "completed"}`,
    createdBy: userId,
  });
  const saved = await entry.save();
  await ScheduleEvent.findByIdAndUpdate(event._id, { billingLedgerEntryId: saved._id });
  await notifySessionBalance(event.trainerId, event.clientId, saved.delta);
  return saved;
};

const reverseEventDebitEntry = async ({ event, userId }) => {
  if (!event || !event.clientId) return null;
  const net = await getEventLedgerNet(event._id);
  if (net >= 0) return null;

  const reversal = new BillingLedgerEntry({
    trainerId: event.trainerId,
    clientId: event.clientId,
    sessionTypeId: event.sessionTypeId || null,
    entryType: "ADJUSTMENT",
    delta: Math.abs(net),
    source: "REVERSAL",
    eventId: event._id,
    notes: "Reversed session debit",
    createdBy: userId,
  });

  return reversal.save();
};

module.exports = {
  createEventDebitEntry,
  reverseEventDebitEntry,
};
