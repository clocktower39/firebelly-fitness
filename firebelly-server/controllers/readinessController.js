const ReadinessEntry = require("../models/readinessEntry");
const Relationship = require("../models/relationship");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

dayjs.extend(utc);

const FIELDS = ["sleep", "mood", "energy", "soreness", "jointPain", "note"];
const dayStart = (date) => dayjs.utc(date || undefined).startOf("day").toDate();
const sinceDate = () => dayjs.utc().subtract(60, "day").startOf("day").toDate();

// Create or update the current user's readiness check-in for a given day (one per day).
const upsert_readiness = async (req, res, next) => {
  try {
    const date = dayStart(req.body.date);
    const set = {};
    FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) set[f] = req.body[f];
    });
    const entry = await ReadinessEntry.findOneAndUpdate(
      { user: res.locals.user._id, date },
      { $set: set, $setOnInsert: { user: res.locals.user._id, date } },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    return res.send(entry);
  } catch (err) {
    return next(err);
  }
};

// The current user's recent readiness entries (last 60 days, newest first).
const get_my_readiness = async (req, res, next) => {
  try {
    const entries = await ReadinessEntry.find({
      user: res.locals.user._id,
      date: { $gte: sinceDate() },
    })
      .sort({ date: -1 })
      .lean();
    return res.send(entries);
  } catch (err) {
    return next(err);
  }
};

// A trainer's view of one of their clients' recent readiness entries.
const get_client_readiness = async (req, res, next) => {
  try {
    const { client } = req.body;
    if (!client) return res.status(400).json({ error: "client is required." });
    const rel = await Relationship.findOne({
      trainer: res.locals.user._id,
      client,
      accepted: true,
    });
    if (!rel) return res.status(403).json({ error: "Not authorized for this client." });
    const entries = await ReadinessEntry.find({ user: client, date: { $gte: sinceDate() } })
      .sort({ date: -1 })
      .lean();
    return res.send(entries);
  } catch (err) {
    return next(err);
  }
};

module.exports = { upsert_readiness, get_my_readiness, get_client_readiness };
