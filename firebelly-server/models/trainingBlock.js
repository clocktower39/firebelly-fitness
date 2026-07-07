const mongoose = require("mongoose");

// A time-boxed "Training Block" — a focus period that groups several goals for one program.
const trainingBlockSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, default: "" },
  weeks: { type: Number, default: 12 },
  startDate: { type: Date },
  targetDate: { type: Date },
  // Days-per-week split by workout type, e.g. { Strength: 3, Cardio: 1 } — planning input for Phase 2.
  workoutSplit: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
  // Optional link once a program is generated for this block (Phase 2).
  program: { type: mongoose.Schema.Types.ObjectId, ref: "Program", default: null },
  createdDate: { type: Date, required: true },
});

const TrainingBlock = mongoose.model("TrainingBlock", trainingBlockSchema);
module.exports = TrainingBlock;
