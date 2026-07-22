const mongoose = require("mongoose");

// One record per Import→Reconcile→Commit run: the applied plan plus every before-state
// needed to undo it (the DB-resident, self-serve version of the backfill rollback files).
// Calendar mutations AND the income invoices of one run share this batch, so a single
// undo reverts both sides together.
const reconcileBatchSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Client-supplied key so a retried commit (double-click, network retry) can never apply twice.
    idempotencyKey: { type: String, required: true },
    status: { type: String, enum: ["COMMITTED", "UNDONE"], default: "COMMITTED" },
    timezone: { type: String, default: "UTC" },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    // The applied per-row plan (incl. conflicts/skips) — audit trail of what was decided.
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Undo data:
    createdEventIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    completedEvents: {
      type: [
        new mongoose.Schema(
          {
            eventId: { type: mongoose.Schema.Types.ObjectId, required: true },
            prevStatus: { type: String, required: true },
            prevBillingStatus: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    invoiceIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // Ties to Invoice.backfillBatchId for the run's invoices.
    invoiceBatchId: { type: String, default: "" },
    summary: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Set when the commit loop died partway — the batch still holds everything applied so
    // far, so undo can revert the partial run.
    error: { type: String, default: "" },
    undoneAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reconcileBatchSchema.index({ trainerId: 1, idempotencyKey: 1 }, { unique: true });

const ReconcileBatch = mongoose.model("ReconcileBatch", reconcileBatchSchema);
module.exports = ReconcileBatch;
