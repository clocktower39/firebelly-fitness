# Plan: Payments foundation (pre-Stripe)

## Goal
Make the billing system "payment-ready" so that when Stripe is added later, an
automatic payment is just **another payment source feeding one shared settle path** —
no special-casing. Everything here is provider-agnostic and works today with manual
entry.

## Why first
Today "Mark paid" shoves a single full-balance payment onto the invoice. There is no
way to record a partial payment, a specific method/date, a refund, or an external
processor reference. Stripe needs all of that plumbing to exist first.

---

## 1. Payment model (`models/invoice.js` → `paymentSchema`)
Add fields (all backward-compatible):
- `type`: `"PAYMENT" | "REFUND"` (default `PAYMENT`)
- `processor`: `"MANUAL" | "STRIPE"` (default `MANUAL`) — room for more later
- `processorPaymentId`: String — the Stripe charge/PaymentIntent id; used for
  **idempotency** so a webhook firing twice doesn't double-record
- `reference`: String — check #, external txn ref
- `recordedBy`: ObjectId(User)

Invoice `status` enum gains **`PARTIAL`** (between SENT and PAID).

## 2. The keystone: `settleInvoice(invoice, userId)`  (one source of truth)
Recompute from `payments[]`:
- `amountPaid = Σ PAYMENT − Σ REFUND`
- `balanceDue = max(total − amountPaid, 0)`
- status: `PAID` when `balanceDue <= 0 && amountPaid > 0`; `PARTIAL` when
  `0 < amountPaid < total`; otherwise leave the manual status (DRAFT/SENT/PAST_DUE).
  Never override `VOID`.
- `paidAt` set when fully paid, cleared otherwise.
- credits: `applyInvoiceCredits` once fully paid (idempotent via `creditsAppliedAt`);
  `reverseInvoiceCredits` if a refund drops a previously-paid invoice below full.

Stripe's webhook handler (future) will just append a payment and call `settleInvoice`.

## 3. Endpoints (`controllers/invoiceController.js`, `routes/invoiceRoutes.js`)
- `POST /invoices/payment` — `{ invoiceId, amount, method, paidAt?, reference?, notes?,
  processor?, processorPaymentId? }`. Trainer-scoped. Dedupes on `processorPaymentId`.
  Appends a PAYMENT, calls `settleInvoice`.
- `POST /invoices/refund` — `{ invoiceId, amount, reason? }`. Appends a REFUND, settles.
- `POST /invoices/payment/remove` — `{ invoiceId, paymentId }`. Correct a mistake;
  re-settles. (Manual-only; Stripe entries shouldn't be hand-deleted.)
- Refactor `update_invoice_status` so its "PAID" path routes through `settleInvoice`
  (keep DRAFT/SENT/PAST_DUE/VOID handling).

## 4. UI
- `billingApi`: `recordPayment`, `recordRefund`, `removePayment`.
- Invoice **detail dialog**: a "Record payment" form (amount defaults to balance,
  method, date, reference, notes), a "Record refund" action for paid invoices, and a
  richer payment history (amount, method, date, refunds shown as negatives).
- `STATUS_CHIP`: add `PARTIAL` (info). List cards show "Paid $X of $Y" when partial.
- Keep a one-click **"Mark paid in full"** that calls `recordPayment` for the balance.

## 5. Adjacent pre-Stripe features (separate follow-ups, same foundation)
- **CSV export** of invoices + payments with a date range (tax track) + income reports.
- **Billing dashboard** (outstanding / paid this period / overdue).
- **Auto PAST_DUE** on due date + reminder emails (cron + existing notifications).

## Verification
- Record a partial payment → status PARTIAL, balanceDue correct, no credits yet.
- Record the remainder → status PAID, paidAt set, credits released exactly once.
- Re-post the same `processorPaymentId` → ignored (idempotent).
- Refund a paid invoice → credits reversed, status drops to PARTIAL/SENT.
- Existing "Mark paid" still works end-to-end.
