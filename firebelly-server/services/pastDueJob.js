const Invoice = require("../models/invoice");
const { createNotification } = require("./notificationService");

const fmt = (amount, currency) => {
  const v = Number(amount || 0).toFixed(2);
  if (currency === "EUR") return `${v} €`;
  if (currency === "JPY") return `¥${v}`;
  return `$${v}`;
};

// Flip overdue SENT/PARTIAL invoices to PAST_DUE and notify the trainer once. Only
// SENT/PARTIAL are selected, so an invoice is notified the first time it crosses its
// due date and never again.
const runPastDueSweep = async () => {
  try {
    const now = new Date();
    const overdue = await Invoice.find({
      status: { $in: ["SENT", "PARTIAL"] },
      dueAt: { $ne: null, $lt: now },
      balanceDue: { $gt: 0 },
    });

    for (const inv of overdue) {
      inv.status = "PAST_DUE";
      await inv.save();
      await createNotification({
        userId: inv.trainerId,
        type: "INVOICE_PAST_DUE",
        title: "Invoice past due",
        body: `${inv.invoiceNumber} for ${inv.billToName || "a client"} is past due — ${fmt(
          inv.balanceDue,
          inv.currency
        )} outstanding.`,
        link: "/invoices",
      });
    }

    if (overdue.length) {
      console.log(`[pastDueSweep] marked ${overdue.length} invoice(s) past due`);
    }
    return overdue.length;
  } catch (err) {
    console.error("[pastDueSweep] failed:", err.message);
    return 0;
  }
};

// Run shortly after boot, then twice a day. setInterval is fine here because the API
// runs as a single process; the sweep is idempotent regardless.
const startPastDueJob = () => {
  setTimeout(runPastDueSweep, 30 * 1000);
  setInterval(runPastDueSweep, 12 * 60 * 60 * 1000);
};

module.exports = { runPastDueSweep, startPastDueJob };
