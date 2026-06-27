const mongoose = require("mongoose");

// Per-user custom name for an existing (global) exercise. E.g. a user who calls the global
// "Barbell Bench Press" their own "Barbell Chest Press". One alias per user per exercise.
const exerciseAliasSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },
    customName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

exerciseAliasSchema.index({ user: 1, exercise: 1 }, { unique: true });

module.exports = mongoose.model("ExerciseAlias", exerciseAliasSchema);
