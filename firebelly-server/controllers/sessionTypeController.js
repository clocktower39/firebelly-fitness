const SessionType = require("../models/sessionType");
const SessionTypeEntitlement = require("../models/sessionTypeEntitlement");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");
const Invoice = require("../models/invoice");

const ensureTrainer = (user) => user && user.isTrainer;

// Session types a client has genuinely purchased (implicit grandfathering) — credits
// whose source invoice was VOIDed don't count, so a reversed purchase doesn't keep a
// client eligible for a retired rate forever.
const purchasedTypeIds = async (trainerId, clientId) => {
  const credits = await BillingLedgerEntry.find({
    trainerId,
    clientId,
    entryType: "CREDIT",
    delta: { $gt: 0 },
  })
    .select("sessionTypeId sourceInvoiceId")
    .lean();
  if (!credits.length) return [];

  const invoiceIds = [
    ...new Set(credits.filter((c) => c.sourceInvoiceId).map((c) => String(c.sourceInvoiceId))),
  ];
  let voided = new Set();
  if (invoiceIds.length) {
    const voidedInvoices = await Invoice.find({ _id: { $in: invoiceIds }, status: "VOID" }).distinct(
      "_id"
    );
    voided = new Set(voidedInvoices.map(String));
  }

  const ids = new Set();
  credits.forEach((c) => {
    if (c.sourceInvoiceId && voided.has(String(c.sourceInvoiceId))) return;
    if (c.sessionTypeId) ids.add(String(c.sessionTypeId));
  });
  return [...ids];
};

// A type with any booking or ledger reference is "used" — its price/duration are
// frozen (change via reprice/clone) and it can't be hard-deleted (archive instead).
const typeHasHistory = async (sessionTypeId) => {
  const [ledger, event] = await Promise.all([
    BillingLedgerEntry.exists({ sessionTypeId }),
    ScheduleEvent.exists({ sessionTypeId }),
  ]);
  return Boolean(ledger || event);
};

const ensureRelationship = async (trainerId, clientId) =>
  Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });

// The set of session types a client may PURCHASE from a trainer:
//   active (non-archived) types  ∪  types the client already bought (implicit
//   grandfathering)  ∪  explicit entitlements (archived types granted to them).
const getPurchasableTypes = async (trainerId, clientId) => {
  const [active, historyTypeIds, entitlements] = await Promise.all([
    SessionType.find({ trainerId, active: true, archivedAt: null }).lean(),
    purchasedTypeIds(trainerId, clientId),
    SessionTypeEntitlement.find({ trainerId, clientId }).lean(),
  ]);

  const byId = new Map(active.map((t) => [String(t._id), t]));
  const extraIds = [
    ...historyTypeIds.filter(Boolean).map(String),
    ...entitlements.map((e) => String(e.sessionTypeId)),
  ].filter((id) => !byId.has(id));

  if (extraIds.length) {
    const extra = await SessionType.find({ trainerId, _id: { $in: extraIds } }).lean();
    extra.forEach((t) => byId.set(String(t._id), t));
  }
  return Array.from(byId.values());
};

// Lightweight eligibility check for the invoice/request hot paths: only queries the
// specific submitted ids instead of building the client's whole purchasable set.
const areTypesPurchasable = async (trainerId, clientId, sessionTypeIds) => {
  const ids = [...new Set((sessionTypeIds || []).map(String))].filter(Boolean);
  if (!ids.length) return true;
  const activeIds = await SessionType.find({
    trainerId,
    _id: { $in: ids },
    active: true,
    archivedAt: null,
  }).distinct("_id");
  const allowed = new Set(activeIds.map(String));
  const remaining = ids.filter((id) => !allowed.has(id));
  if (!remaining.length) return true;
  const [history, entitled] = await Promise.all([
    purchasedTypeIds(trainerId, clientId),
    SessionTypeEntitlement.find({
      trainerId,
      clientId,
      sessionTypeId: { $in: remaining },
    }).distinct("sessionTypeId"),
  ]);
  const ok = new Set([...history.map(String), ...entitled.map(String)]);
  return remaining.every((id) => ok.has(id));
};

const DEFAULT_SESSION_TYPES = [
  { name: "60 Min Session", durationMinutes: 60, creditsRequired: 1 },
  { name: "30 Min Session", durationMinutes: 30, creditsRequired: 0.5 },
];

// Seed starter session types only for a brand-new trainer (no types at all).
// After that the trainer manages their own — we never resurrect or force-edit
// (that would fight archiving and re-priced clones).
const ensureDefaultSessionTypes = async (trainerId) => {
  const count = await SessionType.countDocuments({ trainerId });
  if (count > 0) return;
  await SessionType.insertMany(
    DEFAULT_SESSION_TYPES.map((spec) => ({
      trainerId,
      name: spec.name,
      description: "",
      durationMinutes: spec.durationMinutes,
      creditsRequired: spec.creditsRequired,
      defaultPrice: null,
      currency: "USD",
      defaultPayout: null,
      payoutCurrency: "USD",
      active: true,
      isDefault: true,
    }))
  );
};

const list_session_types = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    await ensureDefaultSessionTypes(user._id);
    const types = await SessionType.find({ trainerId: user._id }).sort({ name: 1 }).lean();
    // Flag which types have bookings/purchases so the UI knows their rate is frozen
    // (edits to rate must go through "Change price").
    const [ledgerIds, eventIds] = await Promise.all([
      BillingLedgerEntry.distinct("sessionTypeId", { trainerId: user._id }),
      ScheduleEvent.distinct("sessionTypeId", { trainerId: user._id }),
    ]);
    const used = new Set([...ledgerIds, ...eventIds].filter(Boolean).map(String));
    const withFlags = types.map((t) => ({ ...t, hasHistory: used.has(String(t._id)) }));
    return res.json({ sessionTypes: withFlags });
  } catch (err) {
    return next(err);
  }
};

const create_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const {
      name,
      description,
      durationMinutes,
      creditsRequired,
      defaultPrice,
      currency,
      defaultPayout,
      payoutCurrency,
      active,
    } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    const sessionType = new SessionType({
      trainerId: user._id,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      durationMinutes: Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60,
      creditsRequired: Number.isFinite(Number(creditsRequired)) ? Number(creditsRequired) : 1,
      defaultPrice: defaultPrice === "" || defaultPrice === null
        ? null
        : Number.isFinite(Number(defaultPrice))
          ? Number(defaultPrice)
          : 0,
      currency: currency || "USD",
      defaultPayout: defaultPayout === "" || defaultPayout === null
        ? null
        : Number.isFinite(Number(defaultPayout))
          ? Number(defaultPayout)
          : 0,
      payoutCurrency: payoutCurrency || "USD",
      active: active !== undefined ? Boolean(active) : true,
    });
    const saved = await sessionType.save();
    return res.json({ sessionType: saved });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A session type with that name already exists." });
    }
    return next(err);
  }
};

const update_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { id } = req.params;
    const {
      name,
      description,
      durationMinutes,
      creditsRequired,
      defaultPrice,
      currency,
      defaultPayout,
      payoutCurrency,
      active,
    } = req.body;
    const existing = await SessionType.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    const updates = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: String(description).trim() } : {}),
      ...(durationMinutes !== undefined
        ? { durationMinutes: Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60 }
        : {}),
      ...(creditsRequired !== undefined
        ? { creditsRequired: Number.isFinite(Number(creditsRequired)) ? Number(creditsRequired) : 1 }
        : {}),
      ...(defaultPrice !== undefined
        ? {
            defaultPrice:
              defaultPrice === "" || defaultPrice === null
                ? null
                : Number.isFinite(Number(defaultPrice))
                  ? Number(defaultPrice)
                  : 0,
          }
        : {}),
      ...(currency ? { currency } : {}),
      ...(defaultPayout !== undefined
        ? {
            defaultPayout:
              defaultPayout === "" || defaultPayout === null
                ? null
                : Number.isFinite(Number(defaultPayout))
                  ? Number(defaultPayout)
                  : 0,
          }
        : {}),
      ...(payoutCurrency ? { payoutCurrency } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    };

    // Once a type has history, its rate/duration/credits are frozen — those
    // changes must go through reprice (archive + clone) to protect past purchases.
    if (await typeHasHistory(id)) {
      ["durationMinutes", "creditsRequired", "defaultPrice", "defaultPayout", "currency", "payoutCurrency"].forEach(
        (field) => delete updates[field]
      );
    }
    const updated = await SessionType.findByIdAndUpdate(id, updates, { returnDocument: "after" });
    return res.json({ sessionType: updated });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A session type with that name already exists." });
    }
    return next(err);
  }
};

const delete_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { id } = req.params;
    const existing = await SessionType.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    if (existing.isDefault) {
      return res
        .status(400)
        .json({ error: "Default session types can be archived but not deleted." });
    }
    if (await typeHasHistory(id)) {
      return res
        .status(400)
        .json({ error: "This session type has bookings or purchases — archive it instead." });
    }
    await SessionType.deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

const archive_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const existing = await SessionType.findById(req.params.id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    existing.archivedAt = existing.archivedAt || new Date();
    existing.active = false;
    await existing.save();
    return res.json({ sessionType: existing });
  } catch (err) {
    return next(err);
  }
};

// Undo an archive: reactivate a type (unless an active type of the same name now
// exists — e.g. created by a reprice — which would break the unique-name rule).
const unarchive_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const existing = await SessionType.findById(req.params.id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    const clash = await SessionType.findOne({
      trainerId: user._id,
      name: existing.name,
      active: true,
      archivedAt: null,
      _id: { $ne: existing._id },
    });
    if (clash) {
      return res.status(400).json({
        error: `An active session type named "${existing.name}" already exists. Archive it first.`,
      });
    }
    existing.archivedAt = null;
    existing.active = true;
    await existing.save();
    return res.json({ sessionType: existing });
  } catch (err) {
    return next(err);
  }
};

// Change a type's rate: archive the current version and create a clone at the new
// rate (same name/identity). Clients with history/entitlement keep the old rate.
const reprice_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const existing = await SessionType.findById(req.params.id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    // Reprice changes the RATE only (price/payout). Duration and credits define the
    // type's identity and carry over unchanged, so a re-priced clone is the "same"
    // session just at a new rate — no ambiguous duplicates in the buy dropdowns.
    const { defaultPrice, defaultPayout, currency, payoutCurrency } = req.body;
    const num = (v, fallback) =>
      v === "" || v === null ? null : Number.isFinite(Number(v)) ? Number(v) : fallback;

    const clone = new SessionType({
      trainerId: user._id,
      name: existing.name,
      description: existing.description,
      durationMinutes: existing.durationMinutes,
      creditsRequired: existing.creditsRequired,
      defaultPrice: defaultPrice !== undefined ? num(defaultPrice, existing.defaultPrice) : existing.defaultPrice,
      currency: currency || existing.currency,
      defaultPayout: defaultPayout !== undefined ? num(defaultPayout, existing.defaultPayout) : existing.defaultPayout,
      payoutCurrency: payoutCurrency || existing.payoutCurrency,
      active: true,
      isDefault: false,
      previousVersionId: existing._id,
    });

    // Archive the old version FIRST so the "unique name among active" index holds.
    existing.archivedAt = existing.archivedAt || new Date();
    existing.active = false;
    await existing.save();
    const saved = await clone.save();
    return res.json({ sessionType: saved, archivedId: existing._id });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A session type with that name already exists." });
    }
    return next(err);
  }
};

// What a given client can buy from the authenticated trainer (or, for a client,
// what they can buy from the given trainer).
const list_purchasable_types = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { trainerId, clientId } = req.body;
    const effectiveTrainerId = trainerId || userId;

    const isTrainer = String(effectiveTrainerId) === String(userId);
    const isClient = String(clientId) === String(userId);
    if (!isTrainer && !isClient) {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    if (!clientId) {
      return res.status(400).json({ error: "clientId is required." });
    }
    const relationship = await ensureRelationship(effectiveTrainerId, clientId);
    if (!relationship) {
      return res.status(403).json({ error: "No accepted relationship." });
    }

    const types = await getPurchasableTypes(effectiveTrainerId, clientId);
    return res.json({ sessionTypes: types });
  } catch (err) {
    return next(err);
  }
};

const grant_entitlement = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { clientId, sessionTypeId, note } = req.body;
    if (!clientId || !sessionTypeId) {
      return res.status(400).json({ error: "clientId and sessionTypeId are required." });
    }
    const relationship = await ensureRelationship(user._id, clientId);
    if (!relationship) {
      return res.status(403).json({ error: "No accepted relationship with this client." });
    }
    const sessionType = await SessionType.findOne({ _id: sessionTypeId, trainerId: user._id });
    if (!sessionType) {
      return res.status(404).json({ error: "Session type not found." });
    }
    const entitlement = await SessionTypeEntitlement.findOneAndUpdate(
      { trainerId: user._id, clientId, sessionTypeId },
      { $set: { grantedBy: user._id, note: note || "" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ entitlement });
  } catch (err) {
    return next(err);
  }
};

const revoke_entitlement = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { clientId, sessionTypeId } = req.body;
    await SessionTypeEntitlement.deleteOne({ trainerId: user._id, clientId, sessionTypeId });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

const list_entitlements = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { clientId } = req.body;
    const query = { trainerId: user._id };
    if (clientId) query.clientId = clientId;
    const entitlements = await SessionTypeEntitlement.find(query)
      .populate("sessionTypeId", "name durationMinutes defaultPrice archivedAt")
      .lean();
    return res.json({ entitlements });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  ensureDefaultSessionTypes,
  getPurchasableTypes,
  areTypesPurchasable,
  list_session_types,
  create_session_type,
  update_session_type,
  delete_session_type,
  archive_session_type,
  unarchive_session_type,
  reprice_session_type,
  list_purchasable_types,
  grant_entitlement,
  revoke_entitlement,
  list_entitlements,
};
