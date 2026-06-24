const mongoose = require("mongoose");

// Grandfathering: an explicit grant letting a specific client purchase a specific
// (usually archived) session type. Note: a client can ALSO purchase a type implicitly
// if they already have purchase history for it — entitlement rows are only needed to
// grant a brand-new client access to an archived rate. See docs/billing-rework-plan.md.
const sessionTypeEntitlementSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionType", required: true, index: true },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

sessionTypeEntitlementSchema.index(
  { trainerId: 1, clientId: 1, sessionTypeId: 1 },
  { unique: true }
);

module.exports = mongoose.model("SessionTypeEntitlement", sessionTypeEntitlementSchema);
