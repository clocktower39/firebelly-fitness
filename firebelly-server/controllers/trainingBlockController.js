const TrainingBlock = require("../models/trainingBlock");
const { pick } = require("../utils/object");

const BLOCK_FIELDS = ["title", "weeks", "startDate", "targetDate", "status"];

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

module.exports = { create_training_block, list_my_training_blocks, update_training_block };
