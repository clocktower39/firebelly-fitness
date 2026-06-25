const User = require("../models/user");
const Group = require("../models/group");
const { sendEmail } = require("./emailService");
const { buildInvoicePdf } = require("./invoicePdf");

const fmt = (amount, currency) => {
  const v = Number(amount || 0).toFixed(2);
  if (currency === "EUR") return `${v} €`;
  if (currency === "JPY") return `¥${v}`;
  return `$${v}`;
};

// Send a payment-reminder email (with the invoice PDF) to the bill-to party. Used by
// the manual "Send reminder" action and by the auto past-due sweep (opt-in).
const sendInvoiceReminder = async (invoice) => {
  const inv = invoice.toObject ? invoice.toObject() : invoice;

  const [trainer, billTo] = await Promise.all([
    User.findById(inv.trainerId).lean(),
    inv.billToType === "CLIENT" && inv.clientId
      ? User.findById(inv.clientId).lean()
      : inv.groupId
        ? Group.findById(inv.groupId).lean()
        : null,
  ]);

  const recipient =
    (inv.billToType === "CLIENT" ? billTo?.email : inv.billToEmail) || inv.billToEmail;
  if (!recipient) return { sent: false, reason: "no-email" };

  const billToName =
    inv.billToType === "CLIENT"
      ? billTo
        ? `${billTo.firstName} ${billTo.lastName}`
        : inv.billToName
      : billTo?.name || inv.billToName;

  const pdfBuffer = await buildInvoicePdf({
    invoice: inv,
    trainer,
    billTo: { name: billToName, email: recipient },
  });

  const due = inv.dueAt
    ? new Date(inv.dueAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const mailOptions = {
    from: trainer?.email || process.env.EMAIL_USER,
    to: recipient,
    subject: `Payment reminder: invoice ${inv.invoiceNumber}`,
    text:
      `Hi ${billToName || ""},\n\n` +
      `This is a friendly reminder that invoice ${inv.invoiceNumber} has an outstanding ` +
      `balance of ${fmt(inv.balanceDue, inv.currency)}${due ? ` (due ${due})` : ""}.\n\n` +
      `The invoice is attached. Thank you!\n\n` +
      `${trainer?.firstName || ""} ${trainer?.lastName || ""}`.trim(),
    attachments: [
      { filename: `invoice-${inv.invoiceNumber}.pdf`, content: pdfBuffer },
    ],
  };

  await sendEmail(mailOptions);
  return { sent: true, recipient };
};

module.exports = { sendInvoiceReminder };
