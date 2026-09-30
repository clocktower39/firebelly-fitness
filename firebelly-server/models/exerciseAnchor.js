const mongoose = require("mongoose");

// One working weight per (client, program, exercise). This is the number that PROGRESSES;
// every occurrence of that exercise in the client's week renders as a percentage of it.
//
// Why a separate collection rather than a field on Training: the same lift can appear on
// several days at different loads (a 5x5 volume day, an 80% light day, a 1x5 intensity day),
// and those must move together. Storing the number once means progression updates one row
// and then re-renders every occurrence, instead of each day drifting independently — which
// is exactly how a 5x5 at 225 and its 80% day ended up unrelated.
//
// Loads are still resolved ON WRITE into each workout's goals.weight, so the client's log
// screen, offline cache and history all keep working unchanged.
const exerciseAnchorSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true, index: true },
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },

    // The driving number, in the unit below. 100% of this is what the anchor slot lifts.
    working: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ["weight", "reps", "seconds"], default: "weight" },

    // How `working` is allowed to move:
    //   feedback — the client's reported effort decides (today's behaviour)
    //   weekly   — +`step` every week regardless, still capped by `ceiling`
    //   earned   — only after ACSM 2-for-2 at the current number
    //   hold     — frozen; the per-exercise version of holdProgression
    rule: { type: String, enum: ["feedback", "weekly", "earned", "hold"], default: "feedback" },
    step: { type: Number, default: 0 },

    // The number the trainer wants the client to reach and then hold. Nothing may push
    // `working` past it. null = uncapped.
    ceiling: { type: Number, default: null },

    // Which occurrence earns a RAISE. Any occurrence can lower the anchor (if the 80% day
    // felt brutal, the working weight is wrong regardless of which day that was), but only
    // this one can move it up — otherwise a light day's "easy" would drive the heavy day.
    earnsOnDay: { type: Number, default: null },

    lastMovedAt: { type: Date, default: null },
    lastMovedReason: { type: String, default: "" },
  },
  { timestamps: true }
);

exerciseAnchorSchema.index(
  { clientId: 1, programId: 1, exerciseId: 1 },
  { unique: true }
);

module.exports = mongoose.model("ExerciseAnchor", exerciseAnchorSchema);
