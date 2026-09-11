const mongoose = require("mongoose");
const ClientRate = require("../models/clientRate");
const SessionType = require("../models/sessionType");
const Relationship = require("../models/relationship");

// The price a client pays for a session type: their grandfathered rate if one is set,
// otherwise the catalog's list price. Exported so invoicing and the package flow resolve
// price the same way rather than each re-implementing the fallback.
const resolveRate = async ({ trainerId, clientId, sessionTypeId }) => {
  const type = await SessionType.findOne({ _id: sessionTypeId, trainerId }).lean();
  if (!type) return null;
  const override = clientId
    ? await ClientRate.findOne({ trainerId, clientId, sessionTypeId }).lean()
    : null;
  const listPrice = Number(type.defaultPrice);
  return {
    sessionTypeId: String(sessionTypeId),
    name: type.name,
    price: override ? Number(override.price) : Number.isFinite(listPrice) ? listPrice : null,
    listPrice: Number.isFinite(listPrice) ? listPrice : null,
    currency: override?.currency || type.currency || "USD",
    isOverride: Boolean(override),
    note: override?.note || "",
  };
};

// Every active session type with this client's effective price — what the invoice and
// package dialogs load so the trainer never types a rate from memory.
const rates_for_client = async (req, res, next) => {
  try {
    const trainerId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can read client rates." });
    }
    const { clientId } = req.body;
    const types = await SessionType.find({ trainerId, archivedAt: null })
      .select("name defaultPrice currency durationMinutes creditsRequired")
      .sort({ name: 1 })
      .lean();
    const overrides = clientId
      ? await ClientRate.find({ trainerId, clientId }).lean()
      : [];
    const byType = new Map(overrides.map((o) => [String(o.sessionTypeId), o]));
    const rates = types.map((type) => {
      const o = byType.get(String(type._id));
      const listPrice = Number.isFinite(Number(type.defaultPrice)) ? Number(type.defaultPrice) : null;
      return {
        sessionTypeId: String(type._id),
        name: type.name,
        durationMinutes: type.durationMinutes ?? null,
        creditsRequired: type.creditsRequired ?? null,
        listPrice,
        price: o ? Number(o.price) : listPrice,
        currency: o?.currency || type.currency || "USD",
        isOverride: Boolean(o),
        note: o?.note || "",
      };
    });
    return res.json({ rates });
  } catch (err) {
    return next(err);
  }
};

// Set or clear one client's rate for one session type. A null/empty price CLEARS the override
// so the client falls back to list price — that is the only way to "delete" a rate.
const set_client_rate = async (req, res, next) => {
  try {
    const trainerId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can set client rates." });
    }
    const { clientId, sessionTypeId, price, note } = req.body;

    const rel = await Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true }).lean();
    if (!rel) return res.status(403).json({ error: "Not your client." });
    const type = await SessionType.findOne({ _id: sessionTypeId, trainerId }).lean();
    if (!type) return res.status(404).json({ error: "Session type not found." });

    if (price === null || price === undefined || price === "") {
      await ClientRate.deleteOne({ trainerId, clientId, sessionTypeId });
      return res.json({ cleared: true, sessionTypeId: String(sessionTypeId) });
    }
    const numeric = Number(price);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return res.status(400).json({ error: "Price must be a number of zero or more." });
    }
    const saved = await ClientRate.findOneAndUpdate(
      { trainerId, clientId, sessionTypeId },
      {
        $set: { price: numeric, note: String(note || "").trim(), updatedBy: trainerId, currency: type.currency || "USD" },
        $setOnInsert: { createdBy: trainerId },
      },
      { new: true, upsert: true }
    ).lean();
    return res.json({ rate: saved });
  } catch (err) {
    return next(err);
  }
};

// Every client who is off list price, for the rates overview.
const list_client_rates = async (req, res, next) => {
  try {
    const trainerId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can read client rates." });
    }
    const rates = await ClientRate.find({ trainerId })
      .populate({ path: "clientId", select: "firstName lastName" })
      .populate({ path: "sessionTypeId", select: "name defaultPrice" })
      .lean();
    return res.json({ rates });
  } catch (err) {
    return next(err);
  }
};

module.exports = { rates_for_client, set_client_rate, list_client_rates, resolveRate };
