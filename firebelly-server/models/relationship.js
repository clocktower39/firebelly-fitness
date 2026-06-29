const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema(
  {
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedBy: { type: String, required: true },
    accepted: { type: Boolean, required: true },
    metricsApprovalRequired: { type: Boolean, default: true },
    // Per-area access the client grants this trainer in a "view-as" session (none | view | manage).
    // Defaults to full coaching access; the client can tighten it per area.
    permissions: {
      workouts: { type: String, enum: ["none", "view", "manage"], default: "manage" },
      goals: { type: String, enum: ["none", "view", "manage"], default: "manage" },
      measurements: { type: String, enum: ["none", "view", "manage"], default: "manage" },
      readiness: { type: String, enum: ["none", "view", "manage"], default: "manage" },
      schedule: { type: String, enum: ["none", "view", "manage"], default: "manage" },
    },
    engagementStatus: {
      type: String,
      enum: ["active", "paused", "inactive"],
      default: "active",
    },
    serviceTags: {
      type: [
        {
          type: String,
          enum: ["in_person", "online", "programming"],
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const Relationship = mongoose.model('Relationship', relationshipSchema);
module.exports = Relationship;
