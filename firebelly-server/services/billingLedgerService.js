const BillingLedgerEntry = require("../models/billingLedgerEntry");
const ScheduleEvent = require("../models/scheduleEvent");
const SessionType = require("../models/sessionType");
const User = require("../models/user");
const { createNotification } = require("./notificationService");

// When a session debit leaves the client with exactly one session remaining (aggregate
// balance, matching the app's "remainingSessions"), alert both the client and the trainer.
// Best-effort. Fires once per transition to 1 (a later debit to 0 won't re-fire).
const notifyIfLowSessions = async (trainerId, clientId) => {
  try {
    if (!trainerId || !clientId) return;
    const agg = await BillingLedgerEntry.aggregate([
      { $match: { trainerId, clientId } },
      { $group: { _id: null, balance: { $sum: "$delta" } } },
    ]);
    if ((agg[0]?.balance || 0) !== 1) return;
    const client = await User.findById(clientId).select("firstName lastName").lean();
    const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "Your client";
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
  } catch (err) {
    console.error("low-sessions notify failed:", err.message);
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
  await notifyIfLowSessions(event.trainerId, event.clientId);
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
