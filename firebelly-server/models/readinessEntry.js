const mongoose = require("mongoose");

// A client's daily readiness / fatigue check-in. One entry per user per day.
// Scales are 1-5. sleep/mood/energy: higher = better. soreness/jointPain: higher = worse
// (the readiness score inverts those). All optional so a fast partial check-in still saves.
const readinessEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true }, // UTC midnight of the entry's local day
    sleep: { type: Number, min: 1, max: 5 },
    mood: { type: Number, min: 1, max: 5 },
    energy: { type: Number, min: 1, max: 5 },
    soreness: { type: Number, min: 1, max: 5 },
    jointPain: { type: Number, min: 1, max: 5 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

readinessEntrySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("ReadinessEntry", readinessEntrySchema);
