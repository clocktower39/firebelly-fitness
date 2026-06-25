# Plan: Stripe integration (online payments)

> Status: **planning only — nothing here is active.** No keys, no live code, no
> webhooks until explicitly approved. This documents the design so we can build it in
> well-scoped phases when ready.

## Goal
Let a trainer's clients **pay an invoice online by card**, with the payment flowing
automatically into the existing billing system — invoice marked PAID/PARTIAL, credits
released, dashboard/reports updated — with **zero new settlement logic**.

## Why this is mostly already done
The pre-Stripe foundation was built exactly for this. Stripe becomes "just another
payment source":
- `settleInvoice(invoice, userId)` (firebelly-server/controllers/invoiceController.js)
  is the single source of truth — append a payment to `payments[]`, call it, and
  status/credits/balance all update.
- The payment subdoc already has `type` (PAYMENT/REFUND), `processor`,
  `processorPaymentId`, `reference`, `recordedBy`.
- `record_payment` already **dedupes on `processorPaymentId`** — which is exactly what
  makes Stripe webhook retries safe.
So the net-new work is: connect trainers' accounts, create a hosted payment, and
translate Stripe webhooks into `settleInvoice` calls.

---

## Key decisions (DECIDED)

| Decision | Choice | Why |
|---|---|---|
| **Account model** | **Stripe Connect, Express accounts** | Each trainer receives money into their own account; Stripe hosts onboarding + handles KYC/compliance/payouts, while we keep control of the in-app experience. Standard = more friction (trainer manages a full Stripe account); Custom = max onboarding UI + compliance liability on us. |
| **Charge type** | **Direct charges on the connected account** | Trainer is the merchant of record — their name on the client's statement, funds settle straight to them, they own refunds/disputes. Keeps Firebelly out of the money flow and the liability. Destination charges would make Firebelly the merchant (more liability) — unnecessary given the flat-fee model below. |
| **Payment surface** | **Stripe Checkout (hosted page)** | PCI-minimal (SAQ-A), fast to build, Connect + Apple/Google Pay out of the box. Embedded Payment Element later if desired. |
| **Revenue model** | **Flat monthly trainer subscription — NO per-transaction fee** | Firebelly's revenue is a flat monthly fee trainers pay to use the platform. Trainers keep **100%** of what their clients pay → **no `application_fee_amount` on Connect charges.** Adds a separate "trainer subscription" system (see below). |
| **Partial online payments** | **Pay full balance only (v1)** | Checkout charges the invoice's exact `balanceDue` — no amount box, no overpayment/race edge cases. Manual partials already work; "pay any amount online" is a trivial later add since `settleInvoice` already handles partials. |
| **Currencies** | **USD at launch; Bitcoin later via a separate processor** | See Money & currency below. Bitcoin is **not** native to Stripe-via-Connect; it slots into the same `settleInvoice` path as a separate processor, or works manually today. |

---

## Architecture overview

```
Client clicks "Pay" (link in invoice / reminder email / client billing view)
        │
        ▼
Firebelly: POST /billing/stripe/checkout { invoiceId }
        │  creates a Checkout Session on the trainer's connected account,
        │  amount = invoice.balanceDue, metadata = { invoiceId }
        ▼
Stripe-hosted Checkout page  ──pays──▶  Stripe
        │
        ▼ (webhook)
Stripe ──▶ POST /billing/stripe/webhook (signature-verified, raw body)
        │  payment_intent.succeeded / checkout.session.completed
        ▼
append PAYMENT { processor:"STRIPE", processorPaymentId:<pi_id> } → settleInvoice()
        │  (dedupe on processorPaymentId; credits released; status → PAID/PARTIAL)
        ▼
notification to trainer ("Invoice X paid") — reuses existing notification system
```

---

## Data model changes (small)

**User (trainer)** — `firebelly-server/models/user.js`:
- _Connect (client→trainer):_ `stripeAccountId` (`acct_…`), `stripeChargesEnabled`,
  `stripePayoutsEnabled` (from `account.updated`).
- _Subscription (trainer→Firebelly):_ `stripeCustomerId`, `subscriptionStatus`
  (`active`/`trialing`/`past_due`/`canceled`), `subscriptionCurrentPeriodEnd`.

(These are server-only; **do not** add to the JWT/token payload — they're not needed
client-side beyond a derived "online payments enabled" boolean we can include.)

**Invoice** — `firebelly-server/models/invoice.js`:
- `stripeCheckoutSessionId: String` (optional) — to reconcile / avoid duplicate sessions.
- The actual payment id lives on the payment subdoc's `processorPaymentId` (already exists).

No change to `settleInvoice`, the ledger, or credit logic.

---

## Backend work

### Dependencies & config
- Add `stripe` (Node SDK). No other deps.
- Env (per-environment — **test keys on dev, live keys on prod**, never committed):
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (client),
    `STRIPE_PLATFORM_ACCOUNT` (implicit via secret key).
- Complete Stripe **platform profile** + enable Connect in the Stripe dashboard (one-time).

### Endpoints (`controllers/stripeController.js`, `routes/stripeRoutes.js`)
1. `POST /billing/stripe/connect` → create/refresh an **Account Link** for the logged-in
   trainer (creates the Express account on first call, stores `stripeAccountId`), returns
   the onboarding URL. Trainer-only.
2. `GET /billing/stripe/status` → returns `{ connected, chargesEnabled, payoutsEnabled }`
   for the trainer (so the UI can show "Connect" vs "Connected").
3. `POST /billing/stripe/checkout` → `{ invoiceId }`. Validates the invoice belongs to the
   trainer, is not VOID/PAID, trainer is onboarded; creates a **Checkout Session** on the
   connected account for `balanceDue`, `metadata.invoiceId`, success/cancel URLs; returns
   the session URL. (Can be called by the trainer to get a pay link, or by a future
   client-facing view.)
4. `POST /billing/stripe/webhook` → **must use the raw body** (mount a
   `express.raw({type:'application/json'})` handler for this path *before* the global JSON
   parser in app.js). Verify signature with `STRIPE_WEBHOOK_SECRET`. Handle:
   - `checkout.session.completed` / `payment_intent.succeeded` → load invoice by
     `metadata.invoiceId`, append `PAYMENT` (processor `STRIPE`, `processorPaymentId` =
     PaymentIntent id, amount from the event), call `settleInvoice`. Dedup is automatic.
   - `charge.refunded` / `refund.updated` → append `REFUND` (processorPaymentId = refund
     id), `settleInvoice` (reverses credits per existing logic).
   - `account.updated` → update the trainer's `stripeChargesEnabled/PayoutsEnabled`.
   - `charge.dispute.created` → notify the trainer (reuse notification system).

### Reusing the settle path
The webhook's payment-recording should share code with `record_payment` — extract a small
`applyExternalPayment(invoice, { type, amount, processorPaymentId, ... })` helper that both
the HTTP endpoint and the webhook call, so there is exactly one place that appends a
payment and calls `settleInvoice`. `userId` for `recordedBy` can be the trainer (from the
invoice) since there's no authenticated user in a webhook.

---

## Frontend work
- **Trainer onboarding:** in **Billing Preferences** (already exists,
  `TrainerBillingPreferences.jsx`), add a "Connect Stripe / payouts" section that calls
  `/billing/stripe/status` and shows **Connect** (→ Account Link) or **Connected ✓**.
- **Pay link / button:** on an invoice with a balance, a "Get pay link" / "Pay online"
  action that calls `/billing/stripe/checkout` and opens the Checkout URL. Include the pay
  link in the **reminder email** (`services/invoiceEmail.js`) and optionally the invoice
  email.
- **Online-payments badge:** show "Online payment available" only when the trainer is
  onboarded; otherwise fall back to today's manual flow.
- **(Later) Client billing view:** a logged-in client page listing their invoices with a
  Pay button — natural follow-up, not required for v1.

---

## Trainer subscription (Firebelly's revenue — separate system)
The flat monthly fee is a **distinct billing relationship**: Firebelly charges trainers,
on **Firebelly's own Stripe account** (NOT Connect). Independent of the client→trainer
Connect flow; can ship before or after it.
- **Stripe Billing / Subscriptions:** a Product + recurring Price; trainer subscribes via
  Checkout (mode `subscription`) or the Customer Portal for management/cancellation.
- **Data:** trainer gets `stripeCustomerId`, `subscriptionStatus`
  (`active`/`past_due`/`canceled`/`trialing`), `subscriptionCurrentPeriodEnd`.
- **Gating:** decide what an unsubscribed/lapsed trainer loses (e.g. read-only, or can't
  create invoices / accept online payments). Webhooks `customer.subscription.*` +
  `invoice.payment_failed` keep status current.
- **Pricing:** TBD and **does not affect the build** — pick the number later. Reference
  range for solo-trainer SaaS: ~$10–30/mo flat, or tiered by active client count. A free
  trial is easy via Stripe Billing.
- **Note:** this reuses none of the Connect code; it's a second, smaller Stripe surface.

## Money & currency
- **USD at launch.** Stripe amounts are in the **smallest unit** — USD → `Math.round(x*100)`.
  (If EUR/JPY are enabled later: JPY is **zero-decimal**, send the integer as-is.)
  Centralize conversion in one helper. Webhook amounts come back in minor units — convert
  back when recording the payment.
- **Bitcoin** is **not** a native Stripe-via-Connect payment method (Stripe's crypto support
  is stablecoin/USDC-oriented, not BTC settling to a connected account through Checkout).
  Because our payment subdoc is processor-agnostic, BTC is best added as a **separate
  payment source** that records into the same `settleInvoice` path:
  - Integrate a crypto processor (e.g. **BTCPay Server** (self-host, no fees), **OpenNode**,
    or **Coinbase Commerce**): on their "payment confirmed" webhook, append a payment with
    `processor:"BITCOIN"`, `processorPaymentId:<their charge id>`, then `settleInvoice`.
  - **Today, with zero new code:** a trainer who accepts BTC off-platform records a manual
    payment with method "Bitcoin" — it already flows through `settleInvoice`.
  - Treat a real Bitcoin integration as its **own phase** after Stripe USD is solid.

## Security & compliance
- **Webhook signature verification is mandatory** (raw body + `STRIPE_WEBHOOK_SECRET`).
- Card data never touches our servers (Checkout/Elements → PCI SAQ-A).
- Secret keys in env only, per-environment; rotate if leaked.
- Connect onboarding offloads KYC/AML to Stripe; the platform must accept Stripe's
  Connected Account Agreement terms in the platform profile.
- Idempotency: rely on `processorPaymentId` dedupe; also pass Stripe idempotency keys on
  session creation.

## Testing
- Stripe **test mode** + test cards (`4242…` success, `4000…0002` decline, etc.).
- **Stripe CLI** for local/dev webhooks: `stripe listen --forward-to
  https://dev.firebellyfitness.com/billing/stripe/webhook`.
- Scenarios: trainer onboarding (Express link → return → `account.updated`); checkout
  success → invoice PAID + credits released; webhook retry (same `pi_id`) → no double
  payment; refund in Stripe → REFUND recorded + credits reversed; decline → invoice
  unchanged; void invoice → checkout blocked; multi-currency (incl. JPY) amount math.

---

## Phasing
- **Phase A — Connect onboarding:** account create + Account Link + status + `account.updated`
  webhook + Billing Preferences UI. (No charges yet.) No application fee (flat-fee model).
- **Phase B — Pay an invoice:** Checkout session (direct charge, full balance) + pay link +
  `payment_intent.succeeded` webhook → `settleInvoice`. Pay link in reminder/invoice emails.
  **This is the core.**
- **Phase C — Refunds & disputes:** `charge.refunded` → REFUND; `dispute.created` → notify.
- **Phase S — Trainer subscription (Firebelly revenue):** Stripe Billing on the platform
  account + gating. Independent — can run in parallel with A/B or come later.
- **Phase D (later):** client-facing billing/pay view, embedded Payment Element, saved
  cards. **Bitcoin** via a separate crypto processor → same `settleInvoice` path.

## Decisions locked / still open
- **Locked:** Connect + Express; direct charges; Checkout; flat monthly subscription (no
  per-transaction fee); full-balance online payments v1; USD at launch.
- **Still open (don't block Phase A):**
  1. Subscription **price** + flat vs tiered + free-trial length.
  2. What an **unsubscribed/lapsed trainer** loses (gating policy).
  3. Build **subscription (Phase S)** before or after Connect (Phases A/B)?
  4. Bitcoin processor choice (BTCPay vs OpenNode vs Coinbase Commerce) — later phase.

## Not changing
The ledger, `settleInvoice`, credit release/reversal, reports/CSV export, dashboard,
past-due sweep, and reminders all stay as-is — Stripe feeds into them unchanged.
