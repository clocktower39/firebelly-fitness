const SessionType = require("../models/sessionType");
const SessionTypeEntitlement = require("../models/sessionTypeEntitlement");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const Relationship = require("../models/relationship");

const ensureTrainer = (user) => user && user.isTrainer;

const ensureRelationship = async (trainerId, clientId) =>
  Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });

// The set of session types a client may PURCHASE from a trainer:
//   active (non-archived) types  ∪  types the client already bought (implicit
//   grandfathering)  ∪  explicit entitlements (archived types granted to them).
const getPurchasableTypes = async (trainerId, clientId) => {
  const [active, historyTypeIds, entitlements] = await Promise.all([
    SessionType.find({ trainerId, active: true, archivedAt: null }).lean(),
    BillingLedgerEntry.distinct("sessionTypeId", { trainerId, clientId, delta: { $gt: 0 } }),
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

const DEFAULT_SESSION_TYPES = [
  { name: "60 Min Session", durationMinutes: 60, creditsRequired: 1 },
  { name: "30 Min Session", durationMinutes: 30, creditsRequired: 0.5 },
];

const ensureDefaultSessionTypes = async (trainerId) => {
  const names = DEFAULT_SESSION_TYPES.map((type) => type.name);
  const existing = await SessionType.find({ trainerId, name: { $in: names } }).lean();
  const existingMap = new Map(existing.map((type) => [type.name, type]));

  const creates = [];
  const updates = [];

  DEFAULT_SESSION_TYPES.forEach((spec) => {
    const found = existingMap.get(spec.name);
    if (!found) {
      creates.push(
        new SessionType({
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
        }).save()
      );
    } else if (
      found.isDefault !== true ||
      Number(found.durationMinutes) !== Number(spec.durationMinutes) ||
      Number(found.creditsRequired) !== Number(spec.creditsRequired)
    ) {
      updates.push(
        SessionType.updateOne(
          { _id: found._id },
          {
            $set: {
              isDefault: true,
              durationMinutes: spec.durationMinutes,
              creditsRequired: spec.creditsRequired,
            },
          }
        )
      );
    }
  });

  if (creates.length || updates.length) {
    await Promise.all([...creates, ...updates]);
  }
};

const list_session_types = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    await ensureDefaultSessionTypes(user._id);
    const types = await SessionType.find({ trainerId: user._id }).sort({ name: 1 }).lean();
    return res.json({ sessionTypes: types });
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

    if (existing.isDefault) {
      const spec = DEFAULT_SESSION_TYPES.find((entry) => entry.name === existing.name);
      updates.name = existing.name;
      if (spec) {
        updates.durationMinutes = spec.durationMinutes;
        updates.creditsRequired = spec.creditsRequired;
      }
    }
    const updated = await SessionType.findByIdAndUpdate(id, updates, { returnDocument: "after" });
    return res.json({ sessionType: updated });
  } catch (err) {
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
      return res.status(400).json({ error: "Default session types cannot be deleted." });
    }
    await SessionType.deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
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
  list_session_types,
  create_session_type,
  update_session_type,
  delete_session_type,
  list_purchasable_types,
  grant_entitlement,
  revoke_entitlement,
  list_entitlements,
};
