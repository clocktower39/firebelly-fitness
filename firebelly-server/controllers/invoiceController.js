const mongoose = require("mongoose");
const dayjs = require("dayjs");
const Invoice = require("../models/invoice");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const Relationship = require("../models/relationship");
const GroupMembership = require("../models/groupMembership");
const Group = require("../models/group");
const User = require("../models/user");
const Product = require("../models/product");
const SessionType = require("../models/sessionType");
const { areTypesPurchasable } = require("./sessionTypeController");
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
        amount,
        currency: payment.currency || "USD",
        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
        method: String(payment.method || "").trim(),
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
    const amountPaid = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
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
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);
    const now = new Date();

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
        const key = new Date(p.paidAt).toISOString().slice(0, 7);
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
    const mkLine = (dateStr) => ({
      itemType: "CUSTOM", // income only — never touches the session-credit ledger
      description: `${label} — ${dayjs(dateStr).format("MMM D, YYYY")}`,
      sessionDate: dayjs(dateStr).toDate(),
      quantity: 1,
      unitPrice: price,
      taxable: false,
    });

    const buildInvoice = async ({ dateList, issuedAt, payment: pay }) => {
      const lineItems = normalizeLineItems(dateList.map(mkLine));
      const totals = calculateTotals({ lineItems, tax: 0, discount: 0 });
      const payments = pay ? normalizePayments([pay]) : [];
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
        issuedAt: new Date(issuedAt),
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
      if (status === "PAID") inv.paidAt = new Date(pay?.paidAt || issuedAt);
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

    const created = [];
    if (!paid) {
      created.push(await buildInvoice({ dateList: uniqueDates, issuedAt: uniqueDates[0], payment: null }));
    } else if (paymentMode === "perSession") {
      for (const d of uniqueDates) {
        created.push(await buildInvoice({ dateList: [d], issuedAt: d, payment: { amount: price, paidAt: d, method } }));
      }
    } else {
      const pdate = paymentDate ? dayjs(paymentDate).format("YYYY-MM-DD") : uniqueDates[uniqueDates.length - 1];
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

    const wanted = new Set(
      (Array.isArray(dates) ? dates : [])
        .map((d) => dayjs(d).format("YYYY-MM-DD"))
        .filter((d) => d !== "Invalid Date")
    );
    if (!wanted.size) return res.json({ duplicates: [] });

    const existing = await Invoice.find(
      { trainerId: userId, clientId, source: "BACKFILL" },
      { "lineItems.sessionDate": 1 }
    ).lean();

    const already = new Set();
    for (const inv of existing) {
      for (const li of inv.lineItems || []) {
        if (!li.sessionDate) continue;
        const key = dayjs(li.sessionDate).format("YYYY-MM-DD");
        if (wanted.has(key)) already.add(key);
      }
    }

    return res.json({ duplicates: [...already].sort() });
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

module.exports = {
  create_invoice,
  bulk_log_sessions,
  check_logged_dates,
  undo_logged_sessions,
  request_invoice,
  list_invoices,
  get_invoice,
  update_invoice_status,
  record_payment,
  record_refund,
  remove_payment,
  invoice_report,
  send_reminder,
  export_invoice_pdf,
  email_invoice,
};
