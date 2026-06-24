const mongoose = require("mongoose");

const sessionTypeSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    durationMinutes: { type: Number, default: 60, min: 1 },
    creditsRequired: { type: Number, default: 1, min: 0 },
    defaultPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    defaultPayout: { type: Number, default: 0, min: 0 },
    payoutCurrency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    active: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    // Lifecycle: archived types are hidden from general sale but stay purchasable
    // by entitled (grandfathered) clients and remain referenced by past bookings.
    archivedAt: { type: Date, default: null },
    // Links a re-priced clone back to the version it replaced (for history/UX).
    previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionType", default: null },
  },
  { timestamps: true }
);

// Names must be unique only among *active* (non-archived) types, so a re-priced
// clone can reuse the same name while the old version is archived.
sessionTypeSchema.index(
  { trainerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { archivedAt: null } }
);

const SessionType = mongoose.model("SessionType", sessionTypeSchema);
module.exports = SessionType;
