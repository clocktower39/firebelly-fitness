const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    exerciseTitle: { type: String, required: true, unique: true, },
    muscleGroups: {
      primary: { type: Array, required: true, default: [], },
      secondary: { type: Array, required: true, default: [], },
    },
    equipment: { type: Array, required: true, default: [], },
    description: { type: String, required: false, default: '', },
    mediaUrl: { type: String, required: false, default: '', }, // demo media: GIF / MP4 / image / YouTube URL
    // Variant-family grouping (e.g. every chest-press variant carries familyKey "Chest Press"):
    // groups the library display and lets a variant without its own demo inherit the family's
    // video. Presentation-only — each variant keeps its own id, history, and progression.
    familyKey: { type: String, default: '', index: true },
    tags: { type: Array, required: true, default: [], },

    generalVariation: { type: Array },
    attachments: { type: Array },
    anatomicalHandPosition: { type: Array },
    footSetup: { type: Array },
    handSetup: { type: Array },
    movementPattern: { type: Array },
    bodyPosition: { type: Array },
    // Progression classification (see docs/program-progression-roadmap.md).
    // movementComplexity drives weight-increment size for barbell/EZ-bar (compound +5 /
    // isolation +2.5); measurementType makes isometric holds default to Time entry.
    movementComplexity: { type: String, enum: ["", "compound", "isolation"], default: "" },
    measurementType: { type: String, enum: ["", "reps", "time", "distance"], default: "" },
    verified: { type: Boolean, default: false, required: true, },
  },
  { minimize: false }
);

const Exercise = mongoose.model("Exercise", exerciseSchema);
module.exports = Exercise;