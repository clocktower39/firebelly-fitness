const mongoose = require("mongoose");

// Records what the draft generator PRODUCED vs. what the trainer FINALIZED (published/assigned) for a
// generated program — the raw signal for a future phase that personalizes drafts to the trainer's style
// (see the coaching-os-learning direction). One record per program, upserted.
//
// v1 CAPTURES WEEK 1 ONLY: week 1 is the base design signal the trainer actually shapes; weeks 2..N are
// deterministically engine-progressed from it, so they carry no independent programming intent yet.
//
// This is pure background telemetry — writing it must NEVER block or break publish/assign.
const programmingSignalSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true, unique: true },
    trainingBlockId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingBlock", default: null },
    primaryGoalType: { type: String, default: "" },
    finalizedVia: { type: String, enum: ["publish", "assign"], default: "publish" },
    generatedAt: { type: Date, default: null },
    generated: { type: mongoose.Schema.Types.Mixed, default: [] }, // per-day week-1 snapshot at generation
    final: { type: mongoose.Schema.Types.Mixed, default: [] }, // per-day week-1 snapshot at finalize
    summary: { type: mongoose.Schema.Types.Mixed, default: {} }, // { kept, swapped, added, removed, schemeChanges, swaps: [] }
  },
  { timestamps: true }
);

programmingSignalSchema.index({ trainerId: 1, createdAt: -1 });

module.exports = mongoose.model("ProgrammingSignal", programmingSignalSchema);
