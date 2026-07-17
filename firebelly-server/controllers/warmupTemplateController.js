const mongoose = require("mongoose");
const WarmupTemplate = require("../models/warmupTemplate");

// Keep only the fields that define a warm-up entry, and force isWarmup. A library warm-up keeps its
// exercise id; a custom one keeps its customName. Drops entries that have neither.
const sanitizeWarmupExercises = (exercises) =>
  (Array.isArray(exercises) ? exercises : [])
    .map((e) => {
      const rawId = e?.exercise?._id || e?.exercise || null;
      let exercise = null;
      if (rawId && mongoose.Types.ObjectId.isValid(String(rawId))) exercise = String(rawId);
      return {
        exercise,
        customName: (e?.customName || "").toString().slice(0, 120),
        exerciseType: e?.exerciseType || "Reps",
        isWarmup: true,
        goals: e?.goals && typeof e.goals === "object" ? e.goals : {},
      };
    })
    .filter((e) => e.exercise || e.customName);

const create_warmup_template = async (req, res, next) => {
  try {
    const { name, exercises } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    const clean = sanitizeWarmupExercises(exercises);
    if (!clean.length) return res.status(400).json({ error: "Add at least one warm-up exercise." });
    const tpl = await WarmupTemplate.create({
      trainerId: res.locals.user._id,
      name: name.trim().slice(0, 80),
      exercises: clean,
    });
    return res.json(tpl);
  } catch (err) {
    return next(err);
  }
};

const list_warmup_templates = async (req, res, next) => {
  try {
    const list = await WarmupTemplate.find({ trainerId: res.locals.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json(list);
  } catch (err) {
    return next(err);
  }
};

const delete_warmup_template = async (req, res, next) => {
  try {
    const tpl = await WarmupTemplate.findOne({ _id: req.params.id, trainerId: res.locals.user._id });
    if (!tpl) return res.status(404).json({ error: "Warm-up template not found." });
    await WarmupTemplate.deleteOne({ _id: tpl._id });
    return res.json({ status: "deleted", _id: tpl._id });
  } catch (err) {
    return next(err);
  }
};

module.exports = { create_warmup_template, list_warmup_templates, delete_warmup_template };
