const mongoose = require("mongoose");

// Records actions taken by a delegated ("view-as") session on someone else's account — i.e. a
// trainer acting on a client, or a guardian acting on a child. The actor is the REAL person
// (actingUserId from the token), the target is the viewed account. Used for accountability +
// dispute resolution once real customer data is in play.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, default: null }, // "trainer" | "guardian"
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    status: { type: Number, default: null }, // HTTP status of the action's response
  },
  { timestamps: true }
);

auditLogSchema.index({ targetUser: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
