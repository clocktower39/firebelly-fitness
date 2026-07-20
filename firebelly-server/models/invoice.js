const mongoose = require("mongoose");

const invoiceLineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    itemType: {
      type: String,
      enum: ["SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM"],
      default: "CUSTOM",
    },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionType", default: null },
    description: { type: String, required: true },
    // For backfilled/logged past sessions: the calendar date the session actually happened.
    // Lets us detect duplicate logging and reverse a backfill batch precisely.
    sessionDate: { type: Date, default: null },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    sessionCredits: { type: Number, default: 0, min: 0 },
    taxable: { type: Boolean, default: true },
    lineTotal: { type: Number, default: 0, min: 0 },
    sessionCreditsTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["PAYMENT", "REFUND"], default: "PAYMENT" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    paidAt: { type: Date, default: Date.now },
    method: { type: String, default: "" },
    // Where the money came from. MANUAL today; STRIPE (and others) plug in here later.
    processor: { type: String, default: "MANUAL" },
    // External id (e.g. Stripe PaymentIntent/charge) — used to dedupe webhook retries.
    processorPaymentId: { type: String, default: "" },
    reference: { type: String, default: "" },
    notes: { type: String, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    billToType: { type: String, enum: ["CLIENT", "GROUP"], required: true },
    billToName: { type: String, default: "" },
    billToEmail: { type: String, default: "" },
    invoiceNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "PAST_DUE", "VOID"],
      default: "DRAFT",
    },
    currency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    // STANDARD = a normal invoice the trainer issues to a client (may be shown/emailed to them).
    // BACKFILL = a historical income record the trainer logged for their OWN books (past sessions,
    // often already paid off-platform). Never emailed/reminded and excluded from any client-facing
    // billing view — it must never read to a client as "please pay this."
    source: { type: String, enum: ["STANDARD", "BACKFILL"], default: "STANDARD", index: true },
    // Groups all invoices created in one "Log sessions" run so the whole batch can be undone.
    backfillBatchId: { type: String, default: "", index: true },
    issuedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    lineItems: { type: [invoiceLineItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    sessionCreditsTotal: { type: Number, default: 0 },
    creditsAppliedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ trainerId: 1, invoiceNumber: 1 }, { unique: true });

const Invoice = mongoose.model("Invoice", invoiceSchema);
module.exports = Invoice;
