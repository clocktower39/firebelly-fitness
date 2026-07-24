const mongoose = require("mongoose");
const dayjs = require("dayjs");
const dayjsUtc = require("dayjs/plugin/utc");
const dayjsTimezone = require("dayjs/plugin/timezone");
dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);
const Invoice = require("../models/invoice");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");
const GroupMembership = require("../models/groupMembership");
const Group = require("../models/group");
const User = require("../models/user");
const Product = require("../models/product");
const SessionType = require("../models/sessionType");
const ReconcileBatch = require("../models/reconcileBatch");
const { areTypesPurchasable } = require("./sessionTypeController");
const {
  classifyRows,
  alreadySettledDates,
  instantInTz,
} = require("../services/sessionReconcile");
const { createNotification } = require("../services/notificationService");
const { sendEmail } = require("../services/emailService");
const { buildInvoicePdf } = require("../services/invoicePdf");
const { sendInvoiceReminder } = require("../services/invoiceEmail");

const ACTIVE_STATUS = "ACTIVE";
const TRAINER_ROLES = new Set(["TRAINER", "COACH", "ADMIN"]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const ensureGroupAccess = async (groupId, userId) => {
  if (!groupId || !userId) return null;
  return GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });
};

const ensureGroupWrite = async (groupId, userId) => {
  if (!groupId || !userId) return null;
  const membership = await GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });
  if (!membership) return null;
  if (!TRAINER_ROLES.has(membership.role)) return null;
  return membership;
};

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const buildInvoiceNumber = () =>
  `INV-${dayjs().format("YYYYMMDD")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

// Day boundaries interpreted in an IANA timezone (reports must use the TRAINER'S day, not the
// server's/UTC — an 8pm Dec 31 Phoenix payment is 3am Jan 1 UTC and must stay in the old year).
// Falls back to server-local parsing if the tz string is missing/bad.
const tzDayStart = (dateStr, tz) => {
  try {
    return dayjs.tz(String(dateStr), tz).startOf("day").toDate();
  } catch (e) {
    return dayjs(String(dateStr)).startOf("day").toDate();
  }
};
const tzDayEnd = (dateStr, tz) => {
  try {
    return dayjs.tz(String(dateStr), tz).endOf("day").toDate();
  } catch (e) {
    return dayjs(String(dateStr)).endOf("day").toDate();
  }
};
// Noon in the trainer's tz for a date-only string — the neutral anchor for stored payment/
// issue instants, so tz-aware reports keep them on the right calendar day.
const tzNoonFor = (dateStr, tz) => {
  try {
    return dayjs.tz(String(dateStr), tz).startOf("day").add(12, "hour").toDate();
  } catch (e) {
    return dayjs(String(dateStr)).startOf("day").add(12, "hour").toDate();
  }
};

const LINE_ITEM_TYPES = new Set(["SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM"]);

const normalizeLineItems = (lineItems = []) =>
  lineItems.map((item) => {
    const quantity = Math.max(1, normalizeNumber(item.quantity, 1));
    const unitPrice = Math.max(0, normalizeNumber(item.unitPrice, 0));
    const itemType = LINE_ITEM_TYPES.has(item.itemType) ? item.itemType : "CUSTOM";
    const rawSessionCredits = Math.max(0, normalizeNumber(item.sessionCredits, 0));
    const sessionCredits = itemType === "SESSION" ? rawSessionCredits : 0;
    const lineTotal = unitPrice * quantity;
    const sessionCreditsTotal = sessionCredits * quantity;
    return {
      productId: item.productId || null,
      itemType,
      sessionTypeId: itemType === "SESSION" ? item.sessionTypeId || null : null,
      description: String(item.description || "").trim() || "Line item",
      sessionDate: item.sessionDate ? new Date(item.sessionDate) : null,
      scheduleEventId: item.scheduleEventId || null,
      quantity,
      unitPrice,
      sessionCredits,
      taxable: item.taxable !== false,
      lineTotal,
      sessionCreditsTotal,
    };
  });

const resolveLineItems = async (lineItems = [], trainerId) => {
  const sessionTypeCache = new Map();
  const resolved = [];

  for (const rawItem of lineItems) {
    let item = { ...rawItem };

    if (item.productId) {
      const product = await Product.findById(item.productId).lean();
      if (product && String(product.trainerId) === String(trainerId)) {
        item = {
          ...item,
          itemType: product.itemType,
          description: product.name,
          unitPrice: product.price,
          taxable: product.taxable,
          sessionTypeId: product.sessionTypeId || null,
          sessionCredits:
            product.itemType === "SESSION" ? Number(product.creditsPerUnit) || 0 : 0,
        };
      }
    }

    if (item.itemType === "SESSION") {
      const sessionTypeId = item.sessionTypeId || null;
      if (sessionTypeId) {
        const cacheKey = String(sessionTypeId);
        if (!sessionTypeCache.has(cacheKey)) {
          const sessionType = await SessionType.findOne({
            _id: sessionTypeId,
            trainerId,
          }).lean();
          const credits = Number(sessionType?.creditsRequired);
          sessionTypeCache.set(
            cacheKey,
            Number.isFinite(credits) && credits > 0 ? credits : null
          );
        }
        const resolvedCredits = sessionTypeCache.get(cacheKey);
        if (!resolvedCredits) {
          item.sessionTypeId = null;
          item.sessionCredits = 0;
        } else if (!item.sessionCredits || Number(item.sessionCredits) <= 0) {
          item.sessionCredits = resolvedCredits;
        }
      }
    } else {
      item.sessionCredits = 0;
      item.sessionTypeId = null;
    }

    resolved.push(item);
  }

  return normalizeLineItems(resolved);
};

const normalizePayments = (payments = []) =>
  payments
    .map((payment) => {
      const amount = Math.max(0, normalizeNumber(payment.amount, 0));
      if (!amount) return null;
      return {
        // Preserve the payment's identity — dropping `type` silently re-labels a REFUND as a
        // PAYMENT (the schema default) and inflates collected income; dropping processor ids
        // breaks webhook-retry dedupe for payments recorded at create time.
        type: payment.type === "REFUND" ? "REFUND" : "PAYMENT",
        amount,
        currency: payment.currency || "USD",
        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
        method: String(payment.method || "").trim(),
        processor: String(payment.processor || "MANUAL").trim() || "MANUAL",
        processorPaymentId: String(payment.processorPaymentId || "").trim(),
        reference: String(payment.reference || "").trim(),
        notes: String(payment.notes || "").trim(),
      };
    })
    .filter(Boolean);

const calculateTotals = ({ lineItems, tax, discount }) => {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const sessionCreditsTotal = lineItems.reduce(
    (sum, item) => sum + (item.sessionCreditsTotal || 0),
    0
  );
  const normalizedTax = Math.max(0, normalizeNumber(tax, 0));
  const normalizedDiscount = Math.max(0, normalizeNumber(discount, 0));
  const total = subtotal + normalizedTax - normalizedDiscount;
  return {
    subtotal,
    sessionCreditsTotal,
    tax: normalizedTax,
    discount: normalizedDiscount,
    total: Number(total.toFixed(2)),
  };
};

const resolveBillTo = async ({ billToType, clientId, groupId }) => {
  let billToName = "";
  let billToEmail = "";
  if (billToType === "CLIENT" && clientId) {
    const client = await User.findById(clientId).lean();
    billToName = client ? `${client.firstName} ${client.lastName}` : "";
    billToEmail = client?.email || "";
  }
  if (billToType === "GROUP" && groupId) {
    const group = await Group.findById(groupId).lean();
    billToName = group?.name || "";
  }
  return { billToName, billToEmail };
};

const applyInvoiceCredits = async (invoice, userId) => {
  const creditEntries = [];
  const sessionTypeCache = new Map();

  const resolveCreditsPerUnit = async (item) => {
    const direct = Number(item.sessionCredits || 0);
    if (Number.isFinite(direct) && direct > 0) return direct;
    if (!item.sessionTypeId) return 0;
    const cacheKey = String(item.sessionTypeId);
    if (!sessionTypeCache.has(cacheKey)) {
      const type = await SessionType.findById(item.sessionTypeId).lean();
      const credits = Number(type?.creditsRequired || 0);
      sessionTypeCache.set(cacheKey, Number.isFinite(credits) ? credits : 0);
    }
    return sessionTypeCache.get(cacheKey) || 0;
  };

  for (const item of invoice.lineItems || []) {
    let totalCredits = Number(item.sessionCreditsTotal || 0);

    if (!totalCredits && item.itemType === "SESSION") {
      const creditsPerUnit = await resolveCreditsPerUnit(item);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (creditsPerUnit > 0) {
        totalCredits = creditsPerUnit * quantity;
      }
    }

    if (!totalCredits) continue;

    const exists = await BillingLedgerEntry.exists({
      sourceInvoiceId: invoice._id,
      sourceLineItemId: item._id,
      entryType: "CREDIT",
    });
    if (exists) continue;

    creditEntries.push({
      trainerId: invoice.trainerId,
      clientId: invoice.clientId || null,
      groupId: invoice.groupId || null,
      sessionTypeId: item.sessionTypeId || null,
      entryType: "CREDIT",
      delta: totalCredits,
      source: "INVOICE",
      sourceInvoiceId: invoice._id,
      sourceLineItemId: item._id,
      notes: `Invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
    });
  }

  if (creditEntries.length) {
    await BillingLedgerEntry.insertMany(creditEntries);
    const appliedAt = new Date();
    await Invoice.findByIdAndUpdate(invoice._id, { creditsAppliedAt: appliedAt });
    invoice.creditsAppliedAt = appliedAt; // keep the in-memory doc in sync for the response
  }
};

const reverseInvoiceCredits = async (invoice, userId) => {
  const existingReversals = await BillingLedgerEntry.exists({
    sourceInvoiceId: invoice._id,
    source: "REVERSAL",
  });
  if (existingReversals) return;

  const credits = await BillingLedgerEntry.find({
    sourceInvoiceId: invoice._id,
    entryType: "CREDIT",
  }).lean();

  if (!credits.length) return;

  const reversals = credits.map((credit) => ({
    trainerId: invoice.trainerId,
    clientId: invoice.clientId || null,
    groupId: invoice.groupId || null,
    sessionTypeId: credit.sessionTypeId || null,
    entryType: "ADJUSTMENT",
    delta: -Number(credit.delta || 0),
    source: "REVERSAL",
    sourceInvoiceId: invoice._id,
    sourceLineItemId: credit.sourceLineItemId || null,
    notes: `Void invoice ${invoice.invoiceNumber}`,
    createdBy: userId,
  }));

  await BillingLedgerEntry.insertMany(reversals);
};

const removeInvoiceReversals = async (invoiceId) =>
  BillingLedgerEntry.deleteMany({ sourceInvoiceId: invoiceId, source: "REVERSAL" });

// Single source of truth: turn payments[] into amountPaid / balanceDue / status and
// release or reverse credits accordingly. Manual entry uses this today; the future
// Stripe webhook will append a payment and call this exact function.
const settleInvoice = async (invoice, userId) => {
  const paid = (invoice.payments || []).reduce((sum, p) => {
    const amt = Number(p.amount || 0);
    return sum + (p.type === "REFUND" ? -amt : amt);
  }, 0);
  const total = Number(invoice.total || 0);
  invoice.amountPaid = paid;
  invoice.balanceDue = Math.max(total - paid, 0);

  const fullyPaid = paid > 0 && invoice.balanceDue <= 0;

  if (invoice.status !== "VOID") {
    if (fullyPaid) {
      invoice.status = "PAID";
      invoice.paidAt = invoice.paidAt || new Date();
    } else if (paid > 0) {
      invoice.status = "PARTIAL";
      invoice.paidAt = null;
    } else {
      if (invoice.status === "PAID" || invoice.status === "PARTIAL") invoice.status = "SENT";
      invoice.paidAt = null;
    }
  }

  await invoice.save();

  if (fullyPaid) {
    // Releasing credits is idempotent (per-line-item + creditsAppliedAt).
    await removeInvoiceReversals(invoice._id);
    await applyInvoiceCredits(invoice, userId);
  } else if (invoice.creditsAppliedAt) {
    // Was fully paid before, now isn't (refund / removed payment): pull the credits back.
    await reverseInvoiceCredits(invoice, userId);
  }

  return invoice;
};

const create_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const {
      billToType,
      clientId,
      groupId,
      billToEmail,
      invoiceNumber,
      status,
      currency,
      issuedAt,
      dueAt,
      notes,
      terms,
      lineItems = [],
      tax,
      discount,
      payments = [],
    } = req.body;

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can create invoices." });
    }

    if (!billToType || !["CLIENT", "GROUP"].includes(billToType)) {
      return res.status(400).json({ error: "billToType must be CLIENT or GROUP." });
    }

    if (billToType === "CLIENT" && !clientId) {
      return res.status(400).json({ error: "clientId is required for client invoices." });
    }

    if (billToType === "GROUP" && !groupId) {
      return res.status(400).json({ error: "groupId is required for group invoices." });
    }

    if (billToType === "CLIENT") {
      const relationship = await ensureRelationship(userId, clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    if (billToType === "GROUP") {
      const membership = await ensureGroupWrite(groupId, userId);
      if (!membership) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const normalizedLineItems = await resolveLineItems(lineItems, userId);
    const invalidSessionItem = normalizedLineItems.find(
      (item) => item.itemType === "SESSION" && (!item.sessionTypeId || item.sessionCredits <= 0)
    );
    if (invalidSessionItem) {
      return res.status(400).json({
        error: "Session line items must include a session type with credits.",
      });
    }

    // Book-time billing: lines may claim a calendar appointment. Each claimed event
    // must be this trainer's, match the billed client, and not already be billed.
    const linkedIds = normalizedLineItems.map((item) => item.scheduleEventId).filter(Boolean);
    if (linkedIds.length) {
      const linkedEvents = await ScheduleEvent.find({ _id: { $in: linkedIds }, trainerId: userId })
        .select("clientId startDateTime")
        .lean();
      const linkedById = new Map(linkedEvents.map((event) => [String(event._id), event]));
      for (const item of normalizedLineItems) {
        if (!item.scheduleEventId) continue;
        const event = linkedById.get(String(item.scheduleEventId));
        if (!event) {
          return res.status(400).json({ error: "Linked session not found on your calendar." });
        }
        if (billToType === "CLIENT" && event.clientId && String(event.clientId) !== String(clientId)) {
          return res.status(400).json({ error: "A linked session belongs to a different client." });
        }
        if (!item.sessionDate && event.startDateTime) item.sessionDate = event.startDateTime;
      }
      try {
        await assertEventsUnclaimed({ trainerId: userId, lines: normalizedLineItems });
      } catch (guardError) {
        return res.status(409).json({ error: guardError.message });
      }
    }

    // Grandfathering guard: a client can only be sold session types they're
    // eligible for (active, previously purchased, or explicitly entitled).
    if (billToType === "CLIENT") {
      const sessionTypeIds = normalizedLineItems
        .filter((item) => item.itemType === "SESSION" && item.sessionTypeId)
        .map((item) => String(item.sessionTypeId));
      if (!(await areTypesPurchasable(userId, clientId, sessionTypeIds))) {
        return res.status(400).json({
          error:
            "This client isn't eligible to buy one of these session types (archived or not entitled).",
        });
      }
    }

    const totals = calculateTotals({ lineItems: normalizedLineItems, tax, discount });
    const normalizedPayments = normalizePayments(payments);
    // Signed like settleInvoice: refunds subtract from what's been collected.
    const amountPaid = normalizedPayments.reduce(
      (sum, payment) => sum + (payment.type === "REFUND" ? -payment.amount : payment.amount),
      0
    );
    const balanceDue = Math.max(totals.total - amountPaid, 0);

    let { billToName, billToEmail: resolvedBillToEmail } = await resolveBillTo({
      billToType,
      clientId,
      groupId,
    });
    if (billToType === "GROUP") {
      resolvedBillToEmail = String(billToEmail || "").trim();
    }

    const finalInvoiceNumber = String(invoiceNumber || "").trim() || buildInvoiceNumber();
    const resolvedStatus = status && ["DRAFT", "SENT", "PAID", "PAST_DUE", "VOID"].includes(status)
      ? status
      : "DRAFT";

    const invoice = new Invoice({
      trainerId: userId,
      clientId: billToType === "CLIENT" ? clientId : null,
      groupId: billToType === "GROUP" ? groupId : null,
      billToType,
      billToName,
      billToEmail:
        billToType === "CLIENT"
          ? resolvedBillToEmail
          : String(resolvedBillToEmail || "").trim(),
      invoiceNumber: finalInvoiceNumber,
      status: resolvedStatus,
      currency: currency || "USD",
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      dueAt: dueAt ? new Date(dueAt) : null,
      notes: String(notes || "").trim(),
      terms: String(terms || "").trim(),
      lineItems: normalizedLineItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      amountPaid,
      balanceDue,
      payments: normalizedPayments,
      sessionCreditsTotal: totals.sessionCreditsTotal,
      createdBy: userId,
      updatedBy: userId,
    });

    if (invoice.status === "PAID") {
      if (!normalizedPayments.length && totals.total > 0) {
        invoice.payments = [
          {
            amount: totals.total,
            currency: invoice.currency,
            paidAt: new Date(),
            method: "manual",
            notes: "Marked paid at creation",
          },
        ];
        invoice.amountPaid = totals.total;
        invoice.balanceDue = 0;
      } else if (invoice.balanceDue <= 0) {
        invoice.balanceDue = 0;
      }
      invoice.paidAt = new Date();
    }

    if (invoice.status === "VOID") {
      invoice.voidedAt = new Date();
    }

    const saved = await invoice.save();

    if (saved.status === "PAID") {
      await applyInvoiceCredits(saved, userId);
    }

    return res.json({ invoice: saved });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Invoice number already exists." });
    }
    return next(err);
  }
};

const request_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const {
      trainerId,
      invoiceNumber,
      currency,
      issuedAt,
      dueAt,
      notes,
      terms,
      lineItems = [],
      tax,
      discount,
    } = req.body;

    if (!trainerId || !isValidObjectId(trainerId)) {
      return res.status(400).json({ error: "trainerId is required." });
    }

    if (isTrainer && String(trainerId) === String(userId)) {
      return res.status(400).json({ error: "Trainers should create invoices directly." });
    }

    const relationship = await ensureRelationship(trainerId, userId);
    if (!relationship) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const normalizedLineItems = await resolveLineItems(lineItems, trainerId);
    const invalidSessionItem = normalizedLineItems.find(
      (item) => item.itemType === "SESSION" && (!item.sessionTypeId || item.sessionCredits <= 0)
    );
    if (invalidSessionItem) {
      return res.status(400).json({
        error: "Session line items must include a session type with credits.",
      });
    }
    if (normalizedLineItems.length === 0) {
      return res.status(400).json({ error: "At least one line item is required." });
    }

    // Grandfathering guard: a client can only request session types they're eligible
    // for (active, previously purchased, or explicitly entitled).
    const requestedSessionTypeIds = normalizedLineItems
      .filter((item) => item.itemType === "SESSION" && item.sessionTypeId)
      .map((item) => String(item.sessionTypeId));
    if (!(await areTypesPurchasable(trainerId, userId, requestedSessionTypeIds))) {
      return res
        .status(400)
        .json({ error: "You're not eligible to buy one of these session types." });
    }

    const totals = calculateTotals({ lineItems: normalizedLineItems, tax, discount });
    const finalInvoiceNumber = String(invoiceNumber || "").trim() || buildInvoiceNumber();

    const { billToName, billToEmail } = await resolveBillTo({
      billToType: "CLIENT",
      clientId: userId,
      groupId: null,
    });

    const invoice = new Invoice({
      trainerId,
      clientId: userId,
      groupId: null,
      billToType: "CLIENT",
      billToName,
      billToEmail,
      invoiceNumber: finalInvoiceNumber,
      status: "SENT",
      currency: currency || "USD",
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      dueAt: dueAt ? new Date(dueAt) : null,
      notes: String(notes || "").trim(),
      terms: String(terms || "").trim(),
      lineItems: normalizedLineItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      amountPaid: 0,
      balanceDue: totals.total,
      payments: [],
      sessionCreditsTotal: totals.sessionCreditsTotal,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await invoice.save();

    let notificationStatus = "not_sent";
    try {
      const trainer = await User.findById(trainerId).lean();
      const client = await User.findById(userId).lean();
      if (trainer?.email) {
        const lines = normalizedLineItems
          .map((item) => `${item.quantity} × ${item.description}`)
          .join("\n");
        await sendEmail({
          from: trainer.email || process.env.EMAIL_USER,
          to: trainer.email,
          subject: `New invoice request from ${client?.firstName || "Client"}`,
          text:
            `You have a new invoice request from ${client?.firstName || ""} ${
              client?.lastName || ""
            }.\n\nItems:\n${lines}\n\nTotal: ${saved.currency} ${Number(
              saved.total || 0
            ).toFixed(2)}\nInvoice #: ${saved.invoiceNumber}`,
        });
        notificationStatus = "sent";
      }
    } catch (err) {
      notificationStatus = "failed";
    }

    await createNotification({
      userId: trainerId,
      type: "PACKAGE_REQUEST",
      title: "New session package request",
      body: `${saved.billToName || "A client"} requested to buy sessions (${saved.invoiceNumber}).`,
      link: "/invoices",
    });

    return res.json({ invoice: saved, notificationStatus });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Invoice number already exists." });
    }
    return next(err);
  }
};

const list_invoices = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { trainerId, clientId, groupId, status, limit = 100 } = req.body;

    const query = {};
    if (status) query.status = status;

    if (isTrainer) {
      query.trainerId = trainerId || userId;
      if (String(query.trainerId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else {
      if (clientId && String(clientId) === String(userId)) {
        query.clientId = clientId;
      } else if (groupId) {
        const membership = await ensureGroupAccess(groupId, userId);
        if (!membership) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
        query.groupId = groupId;
      } else {
        query.clientId = userId;
      }
    }

    if (clientId && isTrainer) query.clientId = clientId;
    if (groupId && isTrainer) query.groupId = groupId;

    const invoices = await Invoice.find(query)
      .sort({ issuedAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();

    return res.json({ invoices });
  } catch (err) {
    return next(err);
  }
};

const get_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (isTrainer) {
      if (String(invoice.trainerId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else if (invoice.clientId && String(invoice.clientId) === String(userId)) {
      // allowed
    } else if (invoice.groupId) {
      const membership = await ensureGroupAccess(invoice.groupId, userId);
      if (!membership) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    return res.json({ invoice });
  } catch (err) {
    return next(err);
  }
};

const update_invoice_status = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, status, dueAt, notes, terms } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can update invoices." });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const updates = {};
    const wasVoided = invoice.status === "VOID";
    if (dueAt !== undefined) updates.dueAt = dueAt ? new Date(dueAt) : null;
    if (notes !== undefined) updates.notes = String(notes || "").trim();
    if (terms !== undefined) updates.terms = String(terms || "").trim();

    const nextStatus = status && ["DRAFT", "SENT", "PAID", "PAST_DUE", "VOID"].includes(status)
      ? status
      : null;

    if (nextStatus) updates.status = nextStatus;

    if (nextStatus === "VOID") {
      updates.voidedAt = new Date();
    }
    if (nextStatus && nextStatus !== "VOID") {
      updates.voidedAt = null;
    }

    updates.updatedBy = userId;
    Object.assign(invoice, updates);

    // "Mark paid" = record a payment for the outstanding balance, then settle (which
    // sets status/paidAt and releases credits) — same path Stripe will use.
    if (nextStatus === "PAID") {
      const remaining = Math.max(Number(invoice.total || 0) - Number(invoice.amountPaid || 0), 0);
      if (remaining > 0) {
        invoice.payments.push({
          type: "PAYMENT",
          amount: remaining,
          currency: invoice.currency,
          paidAt: new Date(),
          method: "manual",
          processor: "MANUAL",
          notes: "Marked paid",
          recordedBy: userId,
        });
      }
      const settled = await settleInvoice(invoice, userId);
      return res.json({ invoice: settled });
    }

    const saved = await invoice.save();

    if (wasVoided && nextStatus && nextStatus !== "VOID") {
      await removeInvoiceReversals(saved._id);
    }
    if (nextStatus === "VOID") {
      await reverseInvoiceCredits(saved, userId);
    }

    return res.json({ invoice: saved });
  } catch (err) {
    return next(err);
  }
};

const record_payment = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, amount, method, paidAt, notes, reference, processor, processorPaymentId } =
      req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can record payments." });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (invoice.status === "VOID") {
      return res.status(400).json({ error: "Cannot record payments for a void invoice." });
    }

    const paymentAmount = Math.max(0, normalizeNumber(amount, 0));
    if (!paymentAmount) {
      return res.status(400).json({ error: "Payment amount must be greater than 0." });
    }

    // Idempotency: a processor (e.g. Stripe) may retry a webhook — don't double-record.
    if (processorPaymentId) {
      const dup = (invoice.payments || []).some(
        (p) => p.processorPaymentId && p.processorPaymentId === String(processorPaymentId)
      );
      if (dup) return res.json({ invoice });
    }

    invoice.payments.push({
      type: "PAYMENT",
      amount: paymentAmount,
      currency: invoice.currency,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      method: String(method || "").trim(),
      processor: String(processor || "MANUAL").trim() || "MANUAL",
      processorPaymentId: String(processorPaymentId || "").trim(),
      reference: String(reference || "").trim(),
      notes: String(notes || "").trim(),
      recordedBy: userId,
    });

    invoice.updatedBy = userId;
    const saved = await settleInvoice(invoice, userId);
    return res.json({ invoice: saved });
  } catch (err) {
    return next(err);
  }
};

const record_refund = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, amount, reason, method, processor, processorPaymentId } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }
    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can record refunds." });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }
    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const refundAmount = Math.max(0, normalizeNumber(amount, 0));
    if (!refundAmount) {
      return res.status(400).json({ error: "Refund amount must be greater than 0." });
    }
    if (refundAmount > Number(invoice.amountPaid || 0)) {
      return res.status(400).json({ error: "Refund cannot exceed the amount paid." });
    }

    if (processorPaymentId) {
      const dup = (invoice.payments || []).some(
        (p) => p.type === "REFUND" && p.processorPaymentId === String(processorPaymentId)
      );
      if (dup) return res.json({ invoice });
    }

    invoice.payments.push({
      type: "REFUND",
      amount: refundAmount,
      currency: invoice.currency,
      paidAt: new Date(),
      method: String(method || "").trim(),
      processor: String(processor || "MANUAL").trim() || "MANUAL",
      processorPaymentId: String(processorPaymentId || "").trim(),
      notes: String(reason || "Refund").trim(),
      recordedBy: userId,
    });

    invoice.updatedBy = userId;
    const saved = await settleInvoice(invoice, userId);
    return res.json({ invoice: saved });
  } catch (err) {
    return next(err);
  }
};

const remove_payment = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, paymentId } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId) || !paymentId) {
      return res.status(400).json({ error: "invoiceId and paymentId are required." });
    }
    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can edit payments." });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }
    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const payment = invoice.payments.id(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found." });
    }
    // Processor-recorded entries (Stripe) must be corrected at the source, not here.
    if (payment.processor && payment.processor !== "MANUAL") {
      return res.status(400).json({ error: "Only manual payments can be removed here." });
    }

    payment.deleteOne();
    invoice.updatedBy = userId;
    const saved = await settleInvoice(invoice, userId);
    return res.json({ invoice: saved });
  } catch (err) {
    return next(err);
  }
};

const export_invoice_pdf = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (isTrainer) {
      if (String(invoice.trainerId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else if (invoice.clientId && String(invoice.clientId) === String(userId)) {
      // allowed
    } else if (invoice.groupId) {
      const membership = await ensureGroupAccess(invoice.groupId, userId);
      if (!membership) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const [trainer, billTo] = await Promise.all([
      User.findById(invoice.trainerId).lean(),
      invoice.billToType === "CLIENT" && invoice.clientId
        ? User.findById(invoice.clientId).lean()
        : invoice.groupId
        ? Group.findById(invoice.groupId).lean()
        : null,
    ]);

    const billToPayload =
      invoice.billToType === "CLIENT"
        ? {
            name: billTo ? `${billTo.firstName} ${billTo.lastName}` : invoice.billToName,
            email: billTo?.email || invoice.billToEmail,
          }
        : {
            name: billTo?.name || invoice.billToName,
            email: invoice.billToEmail,
          };

    const pdfBuffer = await buildInvoicePdf({
      invoice,
      trainer,
      billTo: billToPayload,
    });

    const safeNumber = String(invoice.invoiceNumber || "invoice").replace(/[^a-z0-9_-]/gi, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${safeNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
};

const email_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, recipientEmail, subject, message } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can email invoices." });
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const [trainer, billTo] = await Promise.all([
      User.findById(invoice.trainerId).lean(),
      invoice.billToType === "CLIENT" && invoice.clientId
        ? User.findById(invoice.clientId).lean()
        : invoice.groupId
        ? Group.findById(invoice.groupId).lean()
        : null,
    ]);

    const resolvedRecipient =
      String(recipientEmail || "").trim() ||
      (invoice.billToType === "CLIENT" ? billTo?.email : invoice.billToEmail);

    if (!resolvedRecipient) {
      return res.status(400).json({ error: "Recipient email is required." });
    }

    const billToPayload =
      invoice.billToType === "CLIENT"
        ? {
            name: billTo ? `${billTo.firstName} ${billTo.lastName}` : invoice.billToName,
            email: billTo?.email || invoice.billToEmail,
          }
        : {
            name: billTo?.name || invoice.billToName,
            email: invoice.billToEmail,
          };

    const pdfBuffer = await buildInvoicePdf({
      invoice,
      trainer,
      billTo: billToPayload,
    });

    const mailOptions = {
      from: trainer?.email || process.env.EMAIL_USER,
      to: resolvedRecipient,
      subject: subject || `Invoice ${invoice.invoiceNumber} from ${trainer?.firstName || ""}`,
      text:
        message ||
        `Hi ${billToPayload.name || ""},\n\nPlease find invoice ${invoice.invoiceNumber} attached.`,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    };

    await sendEmail(mailOptions);
    return res.json({ status: "sent" });
  } catch (err) {
    return next(err);
  }
};

// Income report + export rows over a date range. Powers the dashboard summary, the
// reports table, and the CSV exports (invoice-level and payment-level / cash basis).
const invoice_report = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can run reports." });
    }
    const { from, to, clientId } = req.body;
    // Range boundaries + month buckets run in the trainer's timezone so evening payments
    // near a month/year boundary land in the trainer's tax period, not UTC's.
    const trainer = await User.findById(userId).select("timezone").lean();
    const tz = trainer?.timezone || "UTC";
    const fromDate = from ? tzDayStart(from, tz) : new Date(0);
    const toDate = to ? tzDayEnd(to, tz) : new Date();
    const now = new Date();
    const monthKey = (d) => {
      try {
        return new Date(d).toLocaleDateString("en-CA", { timeZone: tz }).slice(0, 7);
      } catch (e) {
        return new Date(d).toISOString().slice(0, 7);
      }
    };

    const query = { trainerId: userId };
    if (clientId && isValidObjectId(clientId)) query.clientId = clientId;
    const invoices = await Invoice.find(query).sort({ issuedAt: 1 }).lean();

    const inRange = (d) => d && new Date(d) >= fromDate && new Date(d) <= toDate;

    const summary = {
      invoiced: 0,
      tax: 0,
      collected: 0,
      refunded: 0,
      outstanding: 0,
      overdue: 0,
      invoiceCount: 0,
    };
    const byMonth = {};
    const invoiceRows = [];
    const paymentRows = [];

    for (const inv of invoices) {
      const isVoid = inv.status === "VOID";

      if (!isVoid && inRange(inv.issuedAt)) {
        summary.invoiced += Number(inv.total || 0);
        summary.tax += Number(inv.tax || 0);
        summary.invoiceCount += 1;
        invoiceRows.push({
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          billToName: inv.billToName || "",
          issuedAt: inv.issuedAt,
          dueAt: inv.dueAt,
          paidAt: inv.paidAt,
          currency: inv.currency,
          subtotal: Number(inv.subtotal || 0),
          tax: Number(inv.tax || 0),
          discount: Number(inv.discount || 0),
          total: Number(inv.total || 0),
          amountPaid: Number(inv.amountPaid || 0),
          balanceDue: Number(inv.balanceDue || 0),
        });
      }

      if (!isVoid && inv.status !== "DRAFT") {
        const bal = Number(inv.balanceDue || 0);
        summary.outstanding += bal;
        if (bal > 0 && inv.dueAt && new Date(inv.dueAt) < now) summary.overdue += bal;
      }

      for (const p of inv.payments || []) {
        if (!inRange(p.paidAt)) continue;
        const amt = Number(p.amount || 0);
        const signed = p.type === "REFUND" ? -amt : amt;
        summary.collected += signed;
        if (p.type === "REFUND") summary.refunded += amt;
        const key = monthKey(p.paidAt);
        byMonth[key] = (byMonth[key] || 0) + signed;
        paymentRows.push({
          paidAt: p.paidAt,
          invoiceNumber: inv.invoiceNumber,
          billToName: inv.billToName || "",
          type: p.type || "PAYMENT",
          method: p.method || "",
          processor: p.processor || "MANUAL",
          reference: p.reference || "",
          amount: amt,
          currency: p.currency || inv.currency,
        });
      }
    }

    const byMonthArr = Object.keys(byMonth)
      .sort()
      .map((m) => ({ month: m, collected: byMonth[m] }));

    return res.json({ summary, byMonth: byMonthArr, invoiceRows, paymentRows });
  } catch (err) {
    return next(err);
  }
};

// What the logged-in trainer is owed for the sessions they ran: sums payoutAmount over their
// COMPLETED appointments in a date range. Payouts are set per session-type/appointment; this
// surfaces the total that was stored but never reported (payroll / year-end contractor total).
const payout_report = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can run reports." });
    }
    const { from, to } = req.body;
    // Same tz rule as invoice_report: a "day" is the trainer's day, not the server's.
    const trainer = await User.findById(userId).select("timezone").lean();
    const tz = trainer?.timezone || "UTC";
    const start = from ? tzDayStart(from, tz) : new Date(0);
    const end = to ? tzDayEnd(to, tz) : new Date(8640000000000000);

    const events = await ScheduleEvent.find({
      trainerId: userId,
      eventType: "APPOINTMENT",
      status: "COMPLETED",
      startDateTime: { $gte: start, $lte: end },
      payoutAmount: { $ne: null, $gt: 0 },
    })
      .select("startDateTime clientId sessionTypeId payoutAmount payoutCurrency customClientName")
      .sort({ startDateTime: 1 })
      .lean();

    const clientIds = [...new Set(events.map((e) => e.clientId).filter(Boolean).map(String))];
    const typeIds = [...new Set(events.map((e) => e.sessionTypeId).filter(Boolean).map(String))];
    const [clients, types] = await Promise.all([
      User.find({ _id: { $in: clientIds } }).select("firstName lastName").lean(),
      SessionType.find({ _id: { $in: typeIds } }).select("name").lean(),
    ]);
    const clientName = new Map(
      clients.map((c) => [String(c._id), `${c.firstName || ""} ${c.lastName || ""}`.trim()])
    );
    const typeName = new Map(types.map((t) => [String(t._id), t.name]));

    let totalPayout = 0;
    let currency = "USD";
    const payoutRows = events.map((e) => {
      totalPayout += Number(e.payoutAmount || 0);
      currency = e.payoutCurrency || currency;
      return {
        date: e.startDateTime,
        client: clientName.get(String(e.clientId)) || e.customClientName || "—",
        sessionType: typeName.get(String(e.sessionTypeId)) || "Session",
        payout: Number(e.payoutAmount || 0),
        currency: e.payoutCurrency || "USD",
      };
    });

    return res.json({
      summary: {
        totalPayout: Number(totalPayout.toFixed(2)),
        sessionCount: events.length,
        currency,
      },
      payoutRows,
    });
  } catch (err) {
    return next(err);
  }
};

// Trainer-initiated payment reminder (always allowed — it's the trainer's own action).
const send_reminder = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can send reminders." });
    }
    const { invoiceId } = req.body;
    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }
    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }
    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    const result = await sendInvoiceReminder(invoice);
    if (!result.sent) {
      return res.status(400).json({ error: "No email on file for this client." });
    }
    return res.json({ status: "ok", recipient: result.recipient });
  } catch (err) {
    return next(err);
  }
};

// Hard double-billing guard: refuse to save an invoice claiming an appointment that any
// other non-void invoice already claims via lineItems.scheduleEventId. This is the write-
// time backstop behind the advisory checks (dialog dup-warning, reconcile re-validation).
// A physical partial-unique index can NOT enforce this: invoices mixing linked + unlinked
// lines (e.g. a block with prepaid future sessions) collide on the null index keys —
// verified empirically against MongoDB. Every path that writes links must call this:
// createBackfillInvoice (backfill + reconcile) and create_invoice (book-time billing).
const assertEventsUnclaimed = async ({ trainerId, lines }) => {
  const ids = (lines || []).map((l) => l.scheduleEventId).filter(Boolean);
  if (!ids.length) return;
  const clash = await Invoice.findOne({
    trainerId,
    status: { $ne: "VOID" },
    "lineItems.scheduleEventId": { $in: ids },
  })
    .select("invoiceNumber")
    .lean();
  if (clash) {
    throw new Error(
      `A session in this batch is already billed on invoice ${clash.invoiceNumber} — it can't be billed twice.`
    );
  }
};

// Build + save ONE income-only BACKFILL invoice from dated line specs. Shared by
// bulk_log_sessions (Log Sessions dialog) and reconcile_commit (Import→Reconcile→Commit):
// same guardrails (source:BACKFILL + batch id, CUSTOM lines that never touch the credit
// ledger), same tz-noon anchoring for date-only instants, same invoice-number retry.
// `lines`: [{description, sessionDate:"YYYY-MM-DD", scheduleEventId|null, unitPrice}];
// `issuedAt`/`payment.paidAt`: "YYYY-MM-DD" strings.
const createBackfillInvoice = async ({
  userId,
  clientId,
  billToName,
  billToEmail,
  currency = "USD",
  notes = "",
  batchId,
  tz,
  lines,
  issuedAt,
  payment,
}) => {
  await assertEventsUnclaimed({ trainerId: userId, lines });
  const lineItems = normalizeLineItems(
    lines.map((l) => ({
      itemType: "CUSTOM", // income only — never touches the session-credit ledger
      description: l.description,
      sessionDate: dayjs(l.sessionDate).toDate(),
      scheduleEventId: l.scheduleEventId || null,
      quantity: 1,
      unitPrice: l.unitPrice,
      taxable: false,
    }))
  );
  const totals = calculateTotals({ lineItems, tax: 0, discount: 0 });
  const payments = payment
    ? normalizePayments([{ ...payment, paidAt: tzNoonFor(payment.paidAt, tz) }])
    : [];
  const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
  const status = totals.total > 0 && amountPaid >= totals.total ? "PAID" : "SENT";
  const inv = new Invoice({
    trainerId: userId,
    clientId,
    billToType: "CLIENT",
    billToName,
    billToEmail,
    invoiceNumber: buildInvoiceNumber(),
    status,
    currency,
    source: "BACKFILL",
    backfillBatchId: batchId,
    issuedAt: tzNoonFor(issuedAt, tz),
    dueAt: null,
    notes: String(notes || "").trim(),
    lineItems,
    subtotal: totals.subtotal,
    tax: 0,
    discount: 0,
    total: totals.total,
    amountPaid,
    balanceDue: Math.max(totals.total - amountPaid, 0),
    payments,
    sessionCreditsTotal: 0,
    createdBy: userId,
    updatedBy: userId,
  });
  if (status === "PAID") inv.paidAt = tzNoonFor(payment?.paidAt || issuedAt, tz);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await inv.save();
    } catch (e) {
      if (e?.code === 11000) {
        inv.invoiceNumber = buildInvoiceNumber();
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique invoice number.");
};

// Bulk-record past ("backdated") training sessions for a client as INCOME, so year-end invoice/income
// reporting is complete. Each session is a plain income line item (using a session type's name + price)
// — it deliberately does NOT touch the prepaid session-credit ledger, because these sessions are
// already done (crediting them would inflate the client's balance). paymentMode:
//   "batch"      → one invoice dated to paymentDate, all session dates as line items, one payment.
//   "perSession" → one paid invoice per session, dated + paid on that session's day.
//   (paid:false) → one unpaid invoice (owed), all sessions as line items.
const bulk_log_sessions = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can log sessions." });
    }
    const {
      clientId,
      sessionTypeId = null,
      unitPrice,
      description,
      dates = [],
      paid = true,
      paymentMode = "batch",
      paymentDate,
      method,
      notes,
    } = req.body;

    if (!clientId) return res.status(400).json({ error: "clientId is required." });
    const uniqueDates = [
      ...new Set((Array.isArray(dates) ? dates : []).map((d) => dayjs(d).format("YYYY-MM-DD")).filter((d) => d !== "Invalid Date")),
    ].sort();
    if (!uniqueDates.length) return res.status(400).json({ error: "At least one session date is required." });

    const relationship = await ensureRelationship(userId, clientId);
    if (!relationship) return res.status(403).json({ error: "Unauthorized access." });

    let price = Number(unitPrice);
    let label = String(description || "").trim() || "Training session";
    let currency = "USD";
    if (sessionTypeId) {
      const st = await SessionType.findOne({ _id: sessionTypeId, trainerId: userId }).lean();
      if (!st) return res.status(400).json({ error: "Session type not found." });
      if (!Number.isFinite(price)) price = Number(st.defaultPrice) || 0;
      if (!description) label = st.name || label;
      currency = st.currency || "USD";
    }
    if (!Number.isFinite(price) || price < 0) price = 0;

    const { billToName, billToEmail } = await resolveBillTo({ billToType: "CLIENT", clientId });
    // One id per run so the whole batch can be reversed in a single click (undo).
    const batchId = new mongoose.Types.ObjectId().toString();

    // Hard-link each logged session to its calendar appointment when one clearly exists.
    // Match on the appointment's date in the TRAINER'S timezone (a 12pm-Phoenix session is
    // stored at 19:00 UTC — comparing in the trainer tz keeps the calendar date correct).
    const trainer = await User.findById(userId).select("timezone").lean();
    const tz = trainer?.timezone || "UTC";
    const apptDate = (dt) => {
      try {
        return new Date(dt).toLocaleDateString("en-CA", { timeZone: tz });
      } catch (e) {
        return dayjs(dt).format("YYYY-MM-DD");
      }
    };
    const spanStart = dayjs(uniqueDates[0]).subtract(1, "day").toDate();
    const spanEnd = dayjs(uniqueDates[uniqueDates.length - 1]).add(2, "day").toDate();
    const appts = await ScheduleEvent.find({
      trainerId: userId,
      clientId,
      eventType: "APPOINTMENT",
      startDateTime: { $gte: spanStart, $lt: spanEnd },
    })
      .select("startDateTime")
      .lean();
    const eventsByDate = {};
    for (const a of appts) {
      const k = apptDate(a.startDateTime);
      (eventsByDate[k] = eventsByDate[k] || []).push(a._id);
    }
    // Only link when exactly one appointment sits on that date — never guess if ambiguous.
    const eventIdForDate = (d) => (eventsByDate[d]?.length === 1 ? eventsByDate[d][0] : null);

    const mkLines = (dateList) =>
      dateList.map((d) => ({
        description: `${label} — ${dayjs(d).format("MMM D, YYYY")}`,
        sessionDate: d,
        scheduleEventId: eventIdForDate(d),
        unitPrice: price,
      }));

    const buildInvoice = ({ dateList, issuedAt, payment }) =>
      createBackfillInvoice({
        userId,
        clientId,
        billToName,
        billToEmail,
        currency,
        notes,
        batchId,
        tz,
        lines: mkLines(dateList),
        issuedAt,
        payment,
      });

    const created = [];
    if (!paid) {
      created.push(await buildInvoice({ dateList: uniqueDates, issuedAt: uniqueDates[0], payment: null }));
    } else if (paymentMode === "perSession") {
      for (const d of uniqueDates) {
        created.push(await buildInvoice({ dateList: [d], issuedAt: d, payment: { amount: price, paidAt: d, method } }));
      }
    } else {
      // Default to the FIRST session date: blocks are prepaid at/near the start (and this
      // matches the unpaid path). Defaulting to the last date pushed income later than reality.
      const pdate = paymentDate ? dayjs(paymentDate).format("YYYY-MM-DD") : uniqueDates[0];
      created.push(
        await buildInvoice({
          dateList: uniqueDates,
          issuedAt: pdate,
          payment: { amount: price * uniqueDates.length, paidAt: pdate, method },
        })
      );
    }

    return res.json({
      ok: true,
      batchId,
      sessionsLogged: uniqueDates.length,
      totalAmount: Number((price * uniqueDates.length).toFixed(2)),
      invoiceCount: created.length,
      invoices: created.map((i) => ({
        _id: i._id,
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        total: i.total,
        issuedAt: i.issuedAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

// Pre-check: of the dates the trainer is about to log for this client, which were
// ALREADY logged in a prior backfill run? Powers the duplicate warning in the dialog.
const check_logged_dates = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can log sessions." });
    }
    const { clientId, dates = [] } = req.body;
    if (!clientId) return res.status(400).json({ error: "clientId is required." });

    const relationship = await ensureRelationship(userId, clientId);
    if (!relationship) return res.status(403).json({ error: "Unauthorized access." });

    const wanted = [
      ...new Set(
        (Array.isArray(dates) ? dates : [])
          .map((d) => dayjs(d).format("YYYY-MM-DD"))
          .filter((d) => d !== "Invalid Date")
      ),
    ];
    if (!wanted.length) return res.json({ duplicates: [], alreadyLogged: [], alreadyInvoiced: [] });

    // Settled = logged by a prior backfill OR the date's appointment already carries ANY
    // non-void invoice (STANDARD too) via the scheduleEventId link — either way, logging
    // it again would double-count the session.
    const { logged, invoiced } = await alreadySettledDates({
      trainerId: userId,
      clientId,
      dates: wanted,
    });

    return res.json({
      duplicates: [...new Set([...logged, ...invoiced])].sort(),
      alreadyLogged: logged.sort(),
      alreadyInvoiced: invoiced.sort(),
    });
  } catch (err) {
    return next(err);
  }
};

// Undo an entire "Log sessions" run. Strictly scoped: only BACKFILL invoices this
// trainer created under this batch id are deleted — never a client-issued invoice.
const undo_logged_sessions = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can undo logged sessions." });
    }
    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ error: "batchId is required." });

    const result = await Invoice.deleteMany({
      trainerId: userId,
      source: "BACKFILL",
      backfillBatchId: String(batchId),
    });

    return res.json({ ok: true, deleted: result.deletedCount || 0 });
  } catch (err) {
    return next(err);
  }
};

// Which COMPLETED sessions in a range have no money story yet? A session counts as settled
// when (a) any non-void invoice claims it via the scheduleEventId link, (b) it was paid with
// prepaid credits (billingStatus CHARGED), or (c) a BACKFILL line covers its calendar date
// for that client (catches unlinked backfill lines, e.g. ambiguous dates). Everything else
// completed is unbilled — the weekly sweep that keeps the books from drifting again.
const unbilled_sessions = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can run reports." });
    }
    const { from, to } = req.body;
    const trainer = await User.findById(userId).select("timezone").lean();
    const tz = trainer?.timezone || "UTC";
    const start = from ? tzDayStart(from, tz) : new Date(0);
    const end = to ? tzDayEnd(to, tz) : new Date();

    const events = await ScheduleEvent.find({
      trainerId: userId,
      eventType: "APPOINTMENT",
      status: "COMPLETED",
      clientId: { $ne: null },
      startDateTime: { $gte: start, $lte: end },
    })
      .select("clientId startDateTime priceAmount priceCurrency sessionTypeId billingStatus")
      .sort({ startDateTime: 1 })
      .lean();
    if (!events.length) {
      return res.json({ tz, groups: [], totals: { sessions: 0, value: 0 } });
    }

    const dayKey = (dt) => {
      try {
        return new Date(dt).toLocaleDateString("en-CA", { timeZone: tz });
      } catch (e) {
        return dayjs(dt).format("YYYY-MM-DD");
      }
    };

    const eventIds = events.map((e) => e._id);
    const linkedSet = new Set();
    const linkedInvoices = await Invoice.find(
      { trainerId: userId, "lineItems.scheduleEventId": { $in: eventIds }, status: { $ne: "VOID" } },
      { "lineItems.scheduleEventId": 1 }
    ).lean();
    for (const inv of linkedInvoices) {
      for (const li of inv.lineItems || []) {
        if (li.scheduleEventId) linkedSet.add(String(li.scheduleEventId));
      }
    }

    const clientIds = [...new Set(events.map((e) => String(e.clientId)))];
    const backfills = await Invoice.find(
      { trainerId: userId, clientId: { $in: clientIds }, source: "BACKFILL", status: { $ne: "VOID" } },
      { clientId: 1, "lineItems.sessionDate": 1 }
    ).lean();
    const coveredByClient = new Map();
    for (const inv of backfills) {
      const key = String(inv.clientId);
      if (!coveredByClient.has(key)) coveredByClient.set(key, new Set());
      for (const li of inv.lineItems || []) {
        if (li.sessionDate) coveredByClient.get(key).add(dayjs(li.sessionDate).format("YYYY-MM-DD"));
      }
    }

    const unbilled = events.filter(
      (e) =>
        e.billingStatus !== "CHARGED" &&
        !linkedSet.has(String(e._id)) &&
        !coveredByClient.get(String(e.clientId))?.has(dayKey(e.startDateTime))
    );

    const clients = await User.find({ _id: { $in: clientIds } })
      .select("firstName lastName")
      .lean();
    const nameOf = new Map(
      clients.map((c) => [String(c._id), `${c.firstName || ""} ${c.lastName || ""}`.trim()])
    );

    const byClient = new Map();
    for (const e of unbilled) {
      const key = String(e.clientId);
      if (!byClient.has(key)) {
        byClient.set(key, { clientId: key, clientName: nameOf.get(key) || "Client", sessions: [] });
      }
      byClient.get(key).sessions.push({
        eventId: e._id,
        date: dayKey(e.startDateTime),
        startDateTime: e.startDateTime,
        priceAmount: e.priceAmount,
        priceCurrency: e.priceCurrency || "USD",
        sessionTypeId: e.sessionTypeId,
      });
    }
    const groups = [...byClient.values()]
      .map((g) => ({
        ...g,
        count: g.sessions.length,
        dates: [...new Set(g.sessions.map((s) => s.date))].sort(),
        value: Number(
          g.sessions.reduce((s, x) => s + (Number.isFinite(Number(x.priceAmount)) ? Number(x.priceAmount) : 0), 0).toFixed(2)
        ),
      }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      tz,
      groups,
      totals: {
        sessions: unbilled.length,
        value: Number(groups.reduce((s, g) => s + g.value, 0).toFixed(2)),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------------------
// Import → Reconcile → Commit: the self-serve bridge between "a session happened" (rows
// pasted from a spreadsheet) and BOTH systems — the calendar (create missing / complete
// booked appointments) and income (BACKFILL invoices), in one undoable batch.
// ---------------------------------------------------------------------------------------

// Read-only: classify each row against the calendar + invoices and return the plan the
// trainer reviews (create / complete / use existing / ambiguous; log / skip income).
const reconcile_preview = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can reconcile sessions." });
    }
    const { clientId, rows = [], options = {} } = req.body;
    if (!clientId) return res.status(400).json({ error: "clientId is required." });
    const relationship = await ensureRelationship(userId, clientId);
    if (!relationship) return res.status(403).json({ error: "Unauthorized access." });

    const plan = await classifyRows({ trainerId: userId, clientId, rows, options });

    const counts = { create: 0, complete: 0, useExisting: 0, none: 0, ambiguous: 0, log: 0, skip: 0 };
    let incomeTotal = 0;
    for (const r of plan.rows) {
      if (r.calendarAction === "CREATE") counts.create += 1;
      else if (r.calendarAction === "COMPLETE") counts.complete += 1;
      else if (r.calendarAction === "USE_EXISTING") counts.useExisting += 1;
      else if (r.calendarAction === "AMBIGUOUS") counts.ambiguous += 1;
      else counts.none += 1;
      if (r.incomeAction === "LOG") {
        counts.log += 1;
        incomeTotal += Number(r.price || 0);
      } else {
        counts.skip += 1;
      }
    }

    return res.json({
      tz: plan.tz,
      usualTime: plan.usualTime,
      usualSample: plan.usualSample,
      today: plan.today,
      rows: plan.rows,
      summary: { ...counts, incomeTotal: Number(incomeTotal.toFixed(2)) },
    });
  } catch (err) {
    return next(err);
  }
};

// Apply a reviewed plan. Every row is RE-validated against fresh DB state — anything that
// changed since preview becomes a reported conflict, never a silent wrong write. All
// calendar + income mutations are recorded in one ReconcileBatch so a single undo reverts
// both sides. `idempotencyKey` makes retries (double-click, network replay) apply once.
const reconcile_commit = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can reconcile sessions." });
    }
    const { clientId, rows = [], options = {}, idempotencyKey } = req.body;
    if (!clientId) return res.status(400).json({ error: "clientId is required." });
    if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey is required." });
    const relationship = await ensureRelationship(userId, clientId);
    if (!relationship) return res.status(403).json({ error: "Unauthorized access." });

    const replay = await ReconcileBatch.findOne({
      trainerId: userId,
      idempotencyKey: String(idempotencyKey),
    }).lean();
    if (replay) {
      return res.json({ ok: true, replayed: true, batchId: replay._id, summary: replay.summary });
    }

    // Fresh classification is the truth the client's chosen actions must agree with.
    const fresh = await classifyRows({ trainerId: userId, clientId, rows, options });
    const freshByDate = new Map(fresh.rows.map((r) => [r.date, r]));
    const tz = fresh.tz;

    let label = String(options.description || "").trim() || "Training session";
    let currency = "USD";
    let durationMinutes = 60;
    const sessionTypeId = options.sessionTypeId || null;
    if (sessionTypeId) {
      const st = await SessionType.findOne({ _id: sessionTypeId, trainerId: userId }).lean();
      if (!st) return res.status(400).json({ error: "Session type not found." });
      if (!options.description) label = st.name || label;
      currency = st.currency || "USD";
      durationMinutes = Number(st.durationMinutes) || 60;
    }
    const { billToName, billToEmail } = await resolveBillTo({ billToType: "CLIENT", clientId });
    const invoiceBatchId = new mongoose.Types.ObjectId().toString();
    const paymentMode = ["perSession", "batch", "unpaid"].includes(options.paymentMode)
      ? options.paymentMode
      : "perSession";

    const applied = [];
    const conflicts = [];
    const createdEventIds = [];
    const completedEvents = [];
    const invoiceIds = [];
    const incomeRows = [];
    let error = "";

    const defaultCalendar = (f) =>
      f.calendarAction === "AMBIGUOUS" || f.calendarAction === "NONE" ? "SKIP" : f.calendarAction;
    const defaultIncome = (f) => (f.incomeAction === "LOG" ? "LOG" : "SKIP");

    try {
      const seen = new Set();
      for (const raw of rows) {
        const date = dayjs(raw.date).format("YYYY-MM-DD");
        if (seen.has(date)) {
          conflicts.push({ date, reason: "DUPLICATE_ROW" });
          continue;
        }
        seen.add(date);
        const f = freshByDate.get(date);
        if (!f) {
          conflicts.push({ date, reason: "NOT_CLASSIFIED" });
          continue;
        }

        const calendarAction = raw.calendarAction || defaultCalendar(f);
        const incomeAction = raw.incomeAction || defaultIncome(f);
        const chosenEventId = raw.eventId || f.eventId || null;

        // Validate the chosen calendar action against fresh state.
        const candidateIds = new Set((f.candidates || []).map((c) => String(c.eventId)));
        let valid = false;
        if (calendarAction === "SKIP") valid = true;
        else if (calendarAction === "CREATE") valid = f.calendarAction === "CREATE";
        else if (calendarAction === "COMPLETE") {
          valid =
            (f.calendarAction === "COMPLETE" && String(f.eventId) === String(chosenEventId)) ||
            (f.calendarAction === "AMBIGUOUS" &&
              candidateIds.has(String(chosenEventId)) &&
              f.candidates.some(
                (c) =>
                  String(c.eventId) === String(chosenEventId) &&
                  (c.status === "BOOKED" || c.status === "REQUESTED")
              ));
        } else if (calendarAction === "USE_EXISTING") {
          valid =
            (f.calendarAction === "USE_EXISTING" && String(f.eventId) === String(chosenEventId)) ||
            (f.calendarAction === "AMBIGUOUS" &&
              candidateIds.has(String(chosenEventId)) &&
              f.candidates.some(
                (c) => String(c.eventId) === String(chosenEventId) && c.status === "COMPLETED"
              ));
        }
        if (!valid) {
          conflicts.push({ date, reason: "CALENDAR_STATE_CHANGED", expected: f.calendarAction });
          continue;
        }

        // Income: LOG allowed when fresh says LOG, or as a deliberate override of the
        // credits-paid skip. Already-logged / already-invoiced can never be overridden.
        if (incomeAction === "LOG" && !["LOG", "SKIP_CREDIT_CHARGED"].includes(f.incomeAction)) {
          conflicts.push({ date, reason: "ALREADY_SETTLED", detail: f.incomeAction });
          continue;
        }

        // Apply the calendar side.
        let linkEventId = null;
        if (calendarAction === "CREATE") {
          const start = instantInTz(date, f.time, tz);
          const ev = await ScheduleEvent.create({
            trainerId: userId,
            clientId,
            startDateTime: start,
            endDateTime: dayjs(start).add(durationMinutes, "minute").toDate(),
            eventType: "APPOINTMENT",
            status: "COMPLETED",
            billingStatus: "NO_CHARGE",
            billingLedgerEntryId: null,
            sessionTypeId,
            priceAmount: f.price > 0 ? f.price : null,
            priceCurrency: currency,
            availabilitySource: "MANUAL",
            notes: "Imported via session reconcile.",
          });
          createdEventIds.push(ev._id);
          linkEventId = ev._id;
        } else if (calendarAction === "COMPLETE") {
          const ev = await ScheduleEvent.findOne({ _id: chosenEventId, trainerId: userId, clientId });
          if (!ev || ev.status === "CANCELLED" || ev.status === "COMPLETED") {
            conflicts.push({ date, reason: "CALENDAR_STATE_CHANGED", expected: "COMPLETE" });
            continue;
          }
          completedEvents.push({
            eventId: ev._id,
            prevStatus: ev.status,
            prevBillingStatus: ev.billingStatus,
          });
          ev.status = "COMPLETED";
          if (ev.billingStatus === "UNBILLED") ev.billingStatus = "NO_CHARGE";
          await ev.save();
          linkEventId = ev._id;
        } else if (calendarAction === "USE_EXISTING") {
          linkEventId = chosenEventId;
        }

        if (incomeAction === "LOG") {
          incomeRows.push({
            date,
            price: f.price,
            method: f.method || String(options.method || "").trim(),
            paymentDate: f.paymentDate,
            scheduleEventId: linkEventId,
          });
        }

        applied.push({
          date,
          time: f.time,
          price: f.price,
          calendarAction,
          incomeAction,
          eventId: linkEventId,
          warnings: f.warnings,
        });
      }

      // Apply the income side.
      incomeRows.sort((a, b) => (a.date < b.date ? -1 : 1));
      const mkLine = (r) => ({
        description: `${label} — ${dayjs(r.date).format("MMM D, YYYY")}`,
        sessionDate: r.date,
        scheduleEventId: r.scheduleEventId,
        unitPrice: r.price,
      });
      const build = (args) =>
        createBackfillInvoice({
          userId,
          clientId,
          billToName,
          billToEmail,
          currency,
          notes: options.notes,
          batchId: invoiceBatchId,
          tz,
          ...args,
        });
      if (incomeRows.length) {
        if (paymentMode === "perSession") {
          for (const r of incomeRows) {
            const paidOn = r.paymentDate || r.date;
            const inv = await build({
              lines: [mkLine(r)],
              issuedAt: paidOn,
              payment: { amount: r.price, paidAt: paidOn, method: r.method },
            });
            invoiceIds.push(inv._id);
          }
        } else if (paymentMode === "unpaid") {
          const inv = await build({
            lines: incomeRows.map(mkLine),
            issuedAt: incomeRows[0].date,
            payment: null,
          });
          invoiceIds.push(inv._id);
        } else {
          // batch: one invoice per payment date; rows without one fall back to a group
          // paid on its earliest session date (blocks are prepaid at/near the start).
          const optionsPaymentDate = options.paymentDate
            ? dayjs(options.paymentDate).format("YYYY-MM-DD")
            : "";
          const groups = new Map();
          for (const r of incomeRows) {
            const key = r.paymentDate || optionsPaymentDate;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(r);
          }
          for (const [key, rs] of groups) {
            const paidOn = key || rs[0].date;
            const total = Number(rs.reduce((s, r) => s + r.price, 0).toFixed(2));
            const inv = await build({
              lines: rs.map(mkLine),
              issuedAt: paidOn,
              payment: {
                amount: total,
                paidAt: paidOn,
                method: rs.find((r) => r.method)?.method || String(options.method || "").trim(),
              },
            });
            invoiceIds.push(inv._id);
          }
        }
      }
    } catch (e) {
      // Keep everything applied so far in the batch record below — undo can revert it.
      error = e?.message || String(e);
    }

    const incomeTotal = Number(incomeRows.reduce((s, r) => s + r.price, 0).toFixed(2));
    const summary = {
      rowsApplied: applied.length,
      conflicts,
      created: createdEventIds.length,
      completed: completedEvents.length,
      invoiceCount: invoiceIds.length,
      incomeTotal,
    };
    const batch = await ReconcileBatch.create({
      trainerId: userId,
      clientId,
      idempotencyKey: String(idempotencyKey),
      timezone: tz,
      options,
      rows: applied,
      createdEventIds,
      completedEvents,
      invoiceIds,
      invoiceBatchId,
      summary,
      error,
    });

    if (error) {
      return res.status(500).json({ error, partial: true, batchId: batch._id, summary });
    }
    return res.json({ ok: true, batchId: batch._id, summary });
  } catch (err) {
    return next(err);
  }
};

// Revert an entire committed run: delete its invoices, restore completed appointments'
// prior statuses, delete the appointments it created (except any that has since gained a
// workout — deleting those would orphan real training data; they're reported instead).
const reconcile_undo = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    if (!res.locals.user?.isTrainer) {
      return res.status(403).json({ error: "Only trainers can reconcile sessions." });
    }
    const { batchId } = req.body;
    if (!batchId || !isValidObjectId(batchId)) {
      return res.status(400).json({ error: "batchId is required." });
    }

    const batch = await ReconcileBatch.findOne({ _id: batchId, trainerId: userId });
    if (!batch) return res.status(404).json({ error: "Batch not found." });
    if (batch.status === "UNDONE") return res.json({ ok: true, alreadyUndone: true });

    const invoicesDeleted = await Invoice.deleteMany({
      _id: { $in: batch.invoiceIds },
      trainerId: userId,
      source: "BACKFILL",
    });

    let statusesRestored = 0;
    for (const c of batch.completedEvents) {
      const r = await ScheduleEvent.updateOne(
        { _id: c.eventId, trainerId: userId },
        { $set: { status: c.prevStatus, billingStatus: c.prevBillingStatus } }
      );
      statusesRestored += r.modifiedCount || 0;
    }

    const createdNow = await ScheduleEvent.find({
      _id: { $in: batch.createdEventIds },
      trainerId: userId,
    })
      .select("workoutId")
      .lean();
    const keptEventIds = createdNow.filter((e) => e.workoutId).map((e) => e._id);
    const deletableIds = createdNow.filter((e) => !e.workoutId).map((e) => e._id);
    const eventsDeleted = deletableIds.length
      ? await ScheduleEvent.deleteMany({ _id: { $in: deletableIds }, trainerId: userId })
      : { deletedCount: 0 };

    batch.status = "UNDONE";
    batch.undoneAt = new Date();
    await batch.save();

    return res.json({
      ok: true,
      invoicesDeleted: invoicesDeleted.deletedCount || 0,
      statusesRestored,
      eventsDeleted: eventsDeleted.deletedCount || 0,
      keptEventIds,
    });
  } catch (err) {
    return next(err);
  }
};

// Which non-void invoice (if any) claims this appointment? Used by the scheduler's
// cancel flow to offer a one-click void of a booking-time invoice.
const invoice_for_event = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { scheduleEventId } = req.body;
    const invoice = await Invoice.findOne({
      trainerId: userId,
      status: { $ne: "VOID" },
      "lineItems.scheduleEventId": scheduleEventId,
    })
      .select("invoiceNumber status total balanceDue amountPaid currency")
      .lean();
    return res.json({ invoice: invoice || null });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  create_invoice,
  invoice_for_event,
  bulk_log_sessions,
  check_logged_dates,
  undo_logged_sessions,
  unbilled_sessions,
  reconcile_preview,
  reconcile_commit,
  reconcile_undo,
  request_invoice,
  list_invoices,
  get_invoice,
  update_invoice_status,
  record_payment,
  record_refund,
  remove_payment,
  invoice_report,
  payout_report,
  send_reminder,
  export_invoice_pdf,
  email_invoice,
};
