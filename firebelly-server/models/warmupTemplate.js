const mongoose = require("mongoose");

// A trainer's reusable, named warm-up (a list of warm-up entries) they can insert into any workout.
// `exercises` stores the warm-up entry shape loosely (like cardio stores a freeform object): each is
// { exercise: ObjectId|null, customName, exerciseType, goals, isWarmup:true } — a library warm-up has
// an exercise ref, a custom one has customName instead.
const warmupTemplateSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    exercises: { type: Array, default: [] },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("WarmupTemplate", warmupTemplateSchema);
