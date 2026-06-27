const mongoose = require("mongoose");

// A user's favorited (pinned) exercises. One row per user/exercise.
const exerciseFavoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },
  },
  { timestamps: true }
);

exerciseFavoriteSchema.index({ user: 1, exercise: 1 }, { unique: true });

module.exports = mongoose.model("ExerciseFavorite", exerciseFavoriteSchema);
