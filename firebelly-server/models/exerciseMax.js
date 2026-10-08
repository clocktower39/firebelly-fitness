const mongoose = require("mongoose");

// One tested/estimated one-rep max per (person, lift).
//
// Until now `oneRepMax` lived ONLY on a Training entry's `goals`, which made a max a property
// of a single workout rather than of the lifter: a 16-week percentage-based program stored the
// same number 32 times, every copy free to drift, and `Workout.jsx` scrubs the field on any
// `isProgramDay` doc so a template can never carry one at all. This collection is the single
// place a lifter's max lives, so percentage work can resolve a load without stamping the
// number into every document.
//
// `value` is a bare number in the account's weight unit, exactly like every other weight in
// the app (see the user's `weightUnit` setting) — deliberately NOT carrying its own unit, so
// it can never disagree with the loads it is compared against.
const exerciseMaxSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },
    value: { type: Number, required: true, min: 0 },
    // When the max was actually established — a max from 11 months ago should not silently
    // drive today's percentages, so the UI can age-flag it.
    testedAt: { type: Date, default: null },
    // Provenance. "tested" = a real single was logged, "estimated" = derived from a rep set,
    // "entered" = typed in by hand. Two clients holding an identical max is a strong hint one
    // inherited it from a template instead of measuring it; source makes that visible.
    source: { type: String, enum: ["tested", "estimated", "entered"], default: "entered" },
    note: { type: String, default: "", maxlength: 300 },
    // Who last wrote it (a trainer may set a client's max on their behalf).
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// One row per lifter per lift.
exerciseMaxSchema.index({ userId: 1, exerciseId: 1 }, { unique: true });

module.exports = mongoose.model("ExerciseMax", exerciseMaxSchema);
