const mongoose = require("mongoose");

const programDaySchema = new mongoose.Schema(
  {
    dayIndex: { type: Number, required: true },
    workoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Training", default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

// A mesocycle = a training block of N microcycles (weeks) with a focus and an optional
// deload on its last week. The ordered list of mesocycles is the macrocycle; weeksCount
// derives from their sum. Empty = a legacy flat program (one implicit block).
const mesocycleSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    type: {
      type: String,
      enum: ["BASE", "HYPERTROPHY", "STRENGTH", "POWER", "PEAK", "DELOAD"],
      default: "HYPERTROPHY",
    },
    weeks: { type: Number, default: 4, min: 1, max: 12 },
    deloadLastWeek: { type: Boolean, default: false },
  },
  { _id: false }
);

const programSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    weeksCount: { type: Number, required: true, min: 1, max: 52 },
    daysPerWeek: { type: Number, required: true, min: 1, max: 7 },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED"],
      default: "DRAFT",
    },
    publishedAt: { type: Date, default: null },
    price: { type: Number, default: null },
    coverImage: { type: String, default: null },
    tags: { type: [String], default: [] },
    category: { type: String, default: null },
    weeks: { type: [[programDaySchema]], default: [] },
    mesocycles: { type: [mesocycleSchema], default: [] },
    // Phase 2: draft generated from a Training Block + the assumptions the generator made (coach must review).
    generatedFromBlock: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingBlock", default: null },
    generationAssumptions: { type: [String], default: [] },
    // Equipment needed to run the program, snapshotted at publish (shown to clients).
    equipmentNeeded: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false }
);

const Program = mongoose.model("Program", programSchema);
module.exports = Program;
