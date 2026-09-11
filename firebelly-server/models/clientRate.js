const mongoose = require("mongoose");

// What a specific client pays for a specific session type, when it differs from the catalog.
//
// The catalog price is the list rate for NEW clients. Long-standing clients are grandfathered
// on the rate they signed up at, and before this existed the trainer had to remember each one
// and type it by hand on every invoice — which produced real mis-billings (a $45 client billed
// at $60, an $80 catalog default applied to a $60 client).
//
// Deliberately per (client, sessionType) rather than one rate per client: a client can be
// grandfathered on their 1:1 rate while still paying list price for a 2- or 3-person session.
// Absence of a row means "use the session type's defaultPrice" — never 0.
const clientRateSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionType", required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    // Why this client is off list price — shown next to the rate so it survives staff changes.
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// One rate per client per session type; upserts key off this.
clientRateSchema.index({ trainerId: 1, clientId: 1, sessionTypeId: 1 }, { unique: true });

module.exports = mongoose.model("ClientRate", clientRateSchema);
