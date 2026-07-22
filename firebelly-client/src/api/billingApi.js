import { apiFetch, authFetch } from "./client";

export const billingApi = {
  getSummary: (payload) =>
    apiFetch("/billing/summary", {
      method: "POST",
      body: payload,
    }),

  listInvoices: (payload) =>
    apiFetch("/invoices/list", {
      method: "POST",
      body: payload,
    }),

  createInvoice: (payload) =>
    apiFetch("/invoices", {
      method: "POST",
      body: payload,
    }),

  // Bulk-record past sessions for a client as income (backdating). See server bulk_log_sessions.
  logSessions: (payload) =>
    apiFetch("/invoices/logSessions", {
      method: "POST",
      body: payload,
    }),

  // Pre-check which of these dates were already logged for this client (duplicate warning).
  checkLoggedDates: ({ clientId, dates }) =>
    apiFetch("/invoices/logSessions/check", {
      method: "POST",
      body: { clientId, dates },
    }),

  // Reverse an entire Log-sessions run by its batch id.
  undoLoggedSessions: ({ batchId }) =>
    apiFetch("/invoices/logSessions/undo", {
      method: "POST",
      body: { batchId },
    }),

  // Import→Reconcile→Commit: classify pasted session rows against the calendar + invoices
  // (read-only preview), apply a reviewed plan, or revert an entire committed run.
  reconcilePreview: ({ clientId, rows, options }) =>
    apiFetch("/invoices/reconcile/preview", {
      method: "POST",
      body: { clientId, rows, options },
    }),

  reconcileCommit: ({ clientId, rows, options, idempotencyKey }) =>
    apiFetch("/invoices/reconcile/commit", {
      method: "POST",
      body: { clientId, rows, options, idempotencyKey },
    }),

  reconcileUndo: ({ batchId }) =>
    apiFetch("/invoices/reconcile/undo", {
      method: "POST",
      body: { batchId },
    }),

  // Completed sessions in a range with no money story yet (no linked invoice, not credit-
  // charged, no backfill covering the date) — grouped per client. The weekly sweep.
  unbilledSessions: ({ from, to } = {}) =>
    apiFetch("/invoices/unbilledSessions", {
      method: "POST",
      body: { from, to },
    }),

  updateInvoiceStatus: ({ invoiceId, status }) =>
    apiFetch("/invoices/status", {
      method: "POST",
      body: { invoiceId, status },
    }),

  recordPayment: (payload) =>
    apiFetch("/invoices/payment", {
      method: "POST",
      body: payload,
    }),

  recordRefund: (payload) =>
    apiFetch("/invoices/refund", {
      method: "POST",
      body: payload,
    }),

  removePayment: ({ invoiceId, paymentId }) =>
    apiFetch("/invoices/payment/remove", {
      method: "POST",
      body: { invoiceId, paymentId },
    }),

  invoiceReport: ({ from, to, clientId } = {}) =>
    apiFetch("/invoices/report", {
      method: "POST",
      body: { from, to, clientId },
    }),

  // Trainer's own payout total (sessions they ran) for a date range — payroll / year-end.
  payoutReport: ({ from, to } = {}) =>
    apiFetch("/invoices/payoutReport", {
      method: "POST",
      body: { from, to },
    }),

  sendReminder: ({ invoiceId }) =>
    apiFetch("/invoices/remind", {
      method: "POST",
      body: { invoiceId },
    }),

  downloadInvoicePdf: ({ invoiceId }) =>
    authFetch("/invoices/pdf", {
      method: "POST",
      body: JSON.stringify({ invoiceId }),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    }),

  sendInvoiceEmail: ({ invoiceId, recipientEmail, message }) =>
    apiFetch("/invoices/email", {
      method: "POST",
      body: { invoiceId, recipientEmail, message },
    }),

  listProducts: ({ trainerId, activeOnly = true }) =>
    apiFetch(
      `/products?trainerId=${encodeURIComponent(trainerId)}&activeOnly=${String(activeOnly)}`
    ),

  createProduct: (payload) =>
    apiFetch("/products", {
      method: "POST",
      body: payload,
    }),

  updateProduct: (productId, payload) =>
    apiFetch(`/products/${encodeURIComponent(productId)}`, {
      method: "PUT",
      body: payload,
    }),

  deleteProduct: (productId) =>
    apiFetch(`/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    }),

  requestInvoice: ({ trainerId, lineItems }) =>
    apiFetch("/invoices/request", {
      method: "POST",
      body: { trainerId, lineItems },
    }),
};

