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
    // Where a published program is listed — separate axis from `status` (lifecycle):
    //   private → not listed anywhere (assign to your own clients only)
    //   profile → listed on the trainer's profile/products page
    //   public  → also in the public marketplace (browsable by anyone)
    // Ordered by reach (private < profile < public). Default private so nothing goes public/listed
    // unless the trainer opts in.
    visibility: {
      type: String,
      enum: ["private", "profile", "public"],
      default: "private",
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
    // Immutable week-1 snapshot of what the generator PRODUCED (baseline for the programming-signal
    // diff captured at publish/assign). v1 = week 1 only (base design signal; later weeks are progressed).
    generationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    // Equipment needed to run the program, snapshotted at publish (shown to clients).
    equipmentNeeded: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false }
);

const Program = mongoose.model("Program", programSchema);
module.exports = Program;
