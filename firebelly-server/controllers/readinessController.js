const ReadinessEntry = require("../models/readinessEntry");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const { createNotification } = require("../services/notificationService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

dayjs.extend(utc);

const FIELDS = ["sleep", "mood", "energy", "soreness", "jointPain", "note"];
const dayStart = (date) => dayjs.utc(date || undefined).startOf("day").toDate();
const sinceDate = () => dayjs.utc().subtract(60, "day").startOf("day").toDate();

// Composite readiness score 0-100 (sleep/mood/energy higher=better; soreness/jointPain inverted).
const SCORE_FACTORS = [
  { key: "sleep", invert: false },
  { key: "mood", invert: false },
  { key: "energy", invert: false },
  { key: "soreness", invert: true },
  { key: "jointPain", invert: true },
];
const scoreOf = (entry) => {
  if (!entry) return null;
  const vals = SCORE_FACTORS.map((f) => {
    const v = Number(entry[f.key]);
    if (!Number.isFinite(v) || v < 1) return null;
    return f.invert ? 6 - v : v;
  }).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 20);
};

const LOW_THRESHOLD = 50; // "Low" band
const FLAG_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Deload signal: when a client's last 3 check-ins average into the low band, notify their active
// trainers (at most once per cooldown).
const flagLowReadiness = async (userId) => {
  const recent = await ReadinessEntry.find({ user: userId }).sort({ date: -1 }).limit(3).lean();
  const scores = recent.map(scoreOf).filter((s) => s != null);
  if (scores.length < 3) return;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= LOW_THRESHOLD) return;

  const user = await User.findById(userId)
    .select("firstName lastName lastReadinessFlagAt")
    .lean();
  if (
    user?.lastReadinessFlagAt &&
    Date.now() - new Date(user.lastReadinessFlagAt).getTime() < FLAG_COOLDOWN_MS
  ) {
    return;
  }
  const clientName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "A client";
  const rels = await Relationship.find({
    client: userId,
    accepted: true,
    engagementStatus: "active",
  })
    .select("trainer")
    .lean();
  if (!rels.length) return;
  await Promise.all(
    rels.map((r) =>
      createNotification({
        userId: r.trainer,
        type: "READINESS_LOW",
        title: `${clientName}'s readiness is low`,
        body: `${clientName} has logged low readiness lately — consider a deload.`,
        link: "/clients",
      })
    )
  );
  await User.updateOne({ _id: userId }, { $set: { lastReadinessFlagAt: new Date() } });
};

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
    flagLowReadiness(res.locals.user._id).catch(() => {});
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

// A trainer's view of one client's recent readiness entries.
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

// A trainer's at-a-glance readiness summary for all their clients: { clientId: {latestScore, avgScore, latestDate, count} }.
const get_clients_readiness = async (req, res, next) => {
  try {
    const rels = await Relationship.find({ trainer: res.locals.user._id, accepted: true })
      .select("client")
      .lean();
    const clientIds = rels.map((r) => r.client);
    if (!clientIds.length) return res.send({});
    const entries = await ReadinessEntry.find({
      user: { $in: clientIds },
      date: { $gte: sinceDate() },
    })
      .sort({ date: -1 })
      .lean();
    const byClient = {};
    entries.forEach((e) => {
      const k = String(e.user);
      (byClient[k] = byClient[k] || []).push(e);
    });
    const result = {};
    Object.entries(byClient).forEach(([k, list]) => {
      const scores = list.slice(0, 7).map(scoreOf).filter((s) => s != null);
      result[k] = {
        latestScore: scoreOf(list[0]),
        latestDate: list[0]?.date || null,
        avgScore: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
        count: list.length,
      };
    });
    return res.send(result);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  upsert_readiness,
  get_my_readiness,
  get_client_readiness,
  get_clients_readiness,
};
