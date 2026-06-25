const express = require("express");
const invoiceController = require("../controllers/invoiceController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");

const router = express.Router();

const objectId = Joi.string().hex().length(24);
const currency = Joi.string().valid("USD", "EUR", "JPY");
const invoiceStatus = Joi.string().valid("DRAFT", "SENT", "PAID", "PAST_DUE", "VOID");
const billToType = Joi.string().valid("CLIENT", "GROUP");
const itemType = Joi.string().valid("SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM");

const lineItem = Joi.object({
  productId: objectId.allow(null).optional(),
  itemType: itemType.optional(),
  sessionTypeId: objectId.allow(null).optional(),
  description: Joi.string().trim().min(1).max(500).optional(),
  quantity: Joi.number().min(1).optional(),
  unitPrice: Joi.number().min(0).optional(),
  sessionCredits: Joi.number().min(0).optional(),
  taxable: Joi.boolean().optional(),
});

const payment = Joi.object({
  amount: Joi.number().greater(0).required(),
  currency: currency.optional(),
  paidAt: Joi.date().optional(),
  method: Joi.string().trim().allow("").max(120).optional(),
  notes: Joi.string().trim().allow("").max(1000).optional(),
});

const invoiceTextFields = {
  invoiceNumber: Joi.string().trim().allow(null, "").max(80).optional(),
  notes: Joi.string().trim().allow("").max(2000).optional(),
  terms: Joi.string().trim().allow("").max(2000).optional(),
};

const createInvoiceValidate = {
  body: Joi.object({
    billToType: billToType.required(),
    clientId: objectId.allow(null).optional(),
    groupId: objectId.allow(null).optional(),
    billToEmail: Joi.string().trim().email().allow(null, "").optional(),
    ...invoiceTextFields,
    status: invoiceStatus.optional(),
    currency: currency.optional(),
    issuedAt: Joi.date().optional(),
    dueAt: Joi.date().allow(null).optional(),
    lineItems: Joi.array().items(lineItem).min(1).required(),
    tax: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
    payments: Joi.array().items(payment).optional(),
  })
    .when(Joi.object({ billToType: "CLIENT" }).unknown(), {
      then: Joi.object({ clientId: objectId.required(), groupId: Joi.valid(null).optional() }),
    })
    .when(Joi.object({ billToType: "GROUP" }).unknown(), {
      then: Joi.object({ groupId: objectId.required(), clientId: Joi.valid(null).optional() }),
    }),
};

const requestInvoiceValidate = {
  body: Joi.object({
    trainerId: objectId.required(),
    ...invoiceTextFields,
    currency: currency.optional(),
    issuedAt: Joi.date().optional(),
    dueAt: Joi.date().allow(null).optional(),
    lineItems: Joi.array().items(lineItem).min(1).required(),
    tax: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
  }),
};

const listInvoicesValidate = {
  body: Joi.object({
    trainerId: objectId.allow(null).optional(),
    clientId: objectId.allow(null).optional(),
    groupId: objectId.allow(null).optional(),
    status: invoiceStatus.optional(),
    limit: Joi.number().integer().min(1).max(500).optional(),
  }),
};

const invoiceIdValidate = {
  body: Joi.object({
    invoiceId: objectId.required(),
  }),
};

const updateInvoiceStatusValidate = {
  body: Joi.object({
    invoiceId: objectId.required(),
    status: invoiceStatus.optional(),
    dueAt: Joi.date().allow(null).optional(),
    notes: Joi.string().trim().allow("").max(2000).optional(),
    terms: Joi.string().trim().allow("").max(2000).optional(),
  }).or("status", "dueAt", "notes", "terms"),
};

const recordPaymentValidate = {
  body: Joi.object({
    invoiceId: objectId.required(),
    amount: Joi.number().greater(0).required(),
    paidAt: Joi.date().optional(),
    method: Joi.string().trim().allow("").max(120).optional(),
    reference: Joi.string().trim().allow("").max(200).optional(),
    processor: Joi.string().trim().allow("").max(40).optional(),
    processorPaymentId: Joi.string().trim().allow("").max(200).optional(),
    notes: Joi.string().trim().allow("").max(1000).optional(),
  }),
};

const recordRefundValidate = {
  body: Joi.object({
    invoiceId: objectId.required(),
    amount: Joi.number().greater(0).required(),
    reason: Joi.string().trim().allow("").max(1000).optional(),
    method: Joi.string().trim().allow("").max(120).optional(),
    processor: Joi.string().trim().allow("").max(40).optional(),
    processorPaymentId: Joi.string().trim().allow("").max(200).optional(),
  }),
};

const removePaymentValidate = {
  body: Joi.object({
    invoiceId: objectId.required(),
    paymentId: objectId.required(),
  }),
};

const emailInvoiceValidate = {
  body: Joi.object({
    invoiceId: objectId.required(),
    recipientEmail: Joi.string().trim().email().allow("").optional(),
    subject: Joi.string().trim().allow("").max(200).optional(),
    message: Joi.string().trim().allow("").max(5000).optional(),
  }),
};

router.post("/invoices", validate(createInvoiceValidate, {}, {}), verifyAccessToken, ensureWriteAccess, invoiceController.create_invoice);
router.post("/invoices/request", validate(requestInvoiceValidate, {}, {}), verifyAccessToken, invoiceController.request_invoice);
router.post("/invoices/list", validate(listInvoicesValidate, {}, {}), verifyAccessToken, invoiceController.list_invoices);
router.post("/invoices/detail", validate(invoiceIdValidate, {}, {}), verifyAccessToken, invoiceController.get_invoice);
router.post("/invoices/status", validate(updateInvoiceStatusValidate, {}, {}), verifyAccessToken, ensureWriteAccess, invoiceController.update_invoice_status);
router.post("/invoices/payment", validate(recordPaymentValidate, {}, {}), verifyAccessToken, ensureWriteAccess, invoiceController.record_payment);
router.post("/invoices/refund", validate(recordRefundValidate, {}, {}), verifyAccessToken, ensureWriteAccess, invoiceController.record_refund);
router.post("/invoices/payment/remove", validate(removePaymentValidate, {}, {}), verifyAccessToken, ensureWriteAccess, invoiceController.remove_payment);
router.post("/invoices/pdf", validate(invoiceIdValidate, {}, {}), verifyAccessToken, invoiceController.export_invoice_pdf);
router.post("/invoices/email", validate(emailInvoiceValidate, {}, {}), verifyAccessToken, ensureWriteAccess, invoiceController.email_invoice);

module.exports = router;
