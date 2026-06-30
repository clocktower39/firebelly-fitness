const mongoose = require("mongoose");
const { CATEGORIES, TECHNIQUES } = require("../services/techniqueRegistry");
const Training = require("../models/training");
const Relationship = require("../models/relationship");

// Serve the Exercise Technique registry (categories + definitions) to the client. Pure static data;
// the client uses it to render display chips and to auto-generate the technique config form. This is
// also the AI-generation contract: an AI emits attachments as { key, params } against these defs.
const get_techniques = (req, res) => {
  res.send({ categories: CATEGORIES, techniques: TECHNIQUES });
};

// Technique usage statistics. For a real trainer, aggregates across their accepted clients' workouts
// (+ their own); otherwise the requesting user's own. Backed by the training.techniques.key index.
// A foundation for the future "technique usage statistics" analytics surface.
const get_technique_usage = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    let userIds = [meId];
    if (res.locals.user.isTrainer && !res.locals.user.delegationMode) {
      const rels = await Relationship.find({ trainer: meId, accepted: true }).select("client").lean();
      userIds = [meId, ...rels.map((r) => r.client)];
    }
    const ids = userIds.map((id) => new mongoose.Types.ObjectId(String(id)));
    const usage = await Training.aggregate([
      { $match: { user: { $in: ids } } },
      { $unwind: "$training" }, // circuits
      { $unwind: "$training" }, // exercises
      { $unwind: "$training.techniques" },
      { $group: { _id: "$training.techniques.key", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.send(usage.map((u) => ({ key: u._id, count: u.count })));
  } catch (err) {
    return next(err);
  }
};

module.exports = { get_techniques, get_technique_usage };
