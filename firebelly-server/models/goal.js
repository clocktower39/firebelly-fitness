const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // NOTE: previously `title` had a GLOBAL unique index, which wrongly blocked two clients from
  // sharing a goal title. Uniqueness dropped; the legacy `title_1` index must be dropped in the DB.
  title: { type: String, required: true },
  description: { type: String },
  // Coaching-OS fields: rank goals by priority, capture the "why", and a lifecycle status.
  priority: { type: Number, default: 0 }, // ascending = higher priority; set by the reorder endpoint
  motivation: { type: String, default: "" }, // why this goal matters to the client
  status: { type: String, enum: ["active", "achieved", "paused", "dropped"], default: "active" },
  category: { type: String, enum: ["General", "Strength", "Cardio", "Skill", "Weight", ""], default: "General" },
  distanceUnit: { type: String, enum: ["Miles", "Kilometers", "Meters", "Yards", ""], default: "" },
  distanceValue: { type: Number },
  goalTime: { type: String },
  goalWeight: { type: Number },
  // Strength goal specific fields
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise" },
  targetWeight: { type: Number },
  targetReps: { type: Number },
  targetDate: { type: Date },
  achievedDate: { type: Date },
  achievementSeen: { type: Boolean, default: false },
  createdDate: { type: Date, required: true },
  comments: {
    type: [
      {
        createdDate: { type: Date, required: true },
        comment: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
  },
});

const Goal = mongoose.model("Goals", goalSchema);
module.exports = Goal;
