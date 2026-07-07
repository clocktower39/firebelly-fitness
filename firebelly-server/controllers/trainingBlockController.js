const TrainingBlock = require("../models/trainingBlock");
const Relationship = require("../models/relationship");
const { pick } = require("../utils/object");

const BLOCK_FIELDS = ["title", "weeks", "startDate", "targetDate", "status", "workoutSplit"];

const create_training_block = async (req, res, next) => {
  try {
    const block = new TrainingBlock({
      ...pick(req.body, BLOCK_FIELDS),
      user: res.locals.user._id,
      createdDate: new Date(),
    });
    const saved = await block.save();
    return res.send(saved);
  } catch (err) {
    return next(err);
  }
};

const list_my_training_blocks = async (req, res, next) => {
  try {
    const blocks = await TrainingBlock.find({ user: res.locals.user._id }).sort({ createdDate: -1 });
    return res.send(blocks);
  } catch (err) {
    return next(err);
  }
};

const update_training_block = async (req, res, next) => {
  try {
    const block = await TrainingBlock.findOneAndUpdate(
      { _id: req.body._id, user: res.locals.user._id },
      { $set: pick(req.body, BLOCK_FIELDS) },
      { returnDocument: "after" }
    );
    if (!block) return res.status(404).send({ error: "Training block not found" });
    return res.send(block);
  } catch (err) {
    return next(err);
  }
};

// Trainer reads a specific client's training blocks (relationship-gated). Non-delegated trainer call.
const list_client_training_blocks = async (req, res, next) => {
  try {
    const client = req.body.client;
    const rel = await Relationship.findOne({ trainer: res.locals.user._id, client, accepted: true });
    if (!rel) return res.status(403).send({ error: "No accepted relationship with this client." });
    const blocks = await TrainingBlock.find({ user: client }).sort({ createdDate: -1 });
    return res.send(blocks);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_training_block,
  list_my_training_blocks,
  list_client_training_blocks,
  update_training_block,
};
