# Billing Rework Plan

**Status:** Proposed — for review before implementation
**Key enabler:** No clients have been billed through the app yet, so there is **no production billing data to migrate** — we can change models freely.

---

## 1. Goals & principles

1. **One source of truth.** A client's prepaid balance lives in **one** place: the `BillingLedgerEntry` ledger. Kill the parallel, unused `SessionPurchase` table.
2. **Session types are versioned, priced products.** Price/duration/credits are fixed once a type has history; to change them you **archive + clone**, never edit in place.
3. **Grandfathering via entitlements, never per-client price edits.** A client can buy a type if it's `active` *or* they're entitled to it.
4. **Consume on completion** (decided): completing a session draws a credit; a charged no-show also draws one; cancel-no-charge reverses.
5. **Money in = Level 1 + 1.5 only for now.** Trainer records purchases (Level 1); clients may *request* a package and the trainer confirms (Level 1.5). **No in-app card processing (Stripe) yet** — deferred milestone.

---

## 2. The model in one line

**Session types are versioned, priced products → clients buy *credits* of a specific version of a type → booking + completion draws those credits down → archived types remain buyable only by entitled (grandfathered) clients.**

---

## 3. Data model changes

### 3.1 `SessionType` — add a lifecycle, freeze price on used types
- Keep existing fields (`name`, `durationMinutes`, `creditsRequired`, `defaultPrice`, `currency`, `defaultPayout`, `payoutCurrency`, `active`, `isDefault`).
- **Add:** `archivedAt: Date | null`, and optional `previousVersionId: ObjectId | null` (links a new version back to the one it replaced — nice for reporting/UX, not required for correctness).
- **Rule (enforced in the controller):** once a session type has *any* purchase or booking referencing it, its price/duration/credits are **immutable**. A price/duration change is performed as **archive + clone** (see UX below). Types with history are **archived, never deleted**.

### 3.2 New: `SessionTypeEntitlement` — explicit grandfather grants
Represents "this client may purchase this (possibly archived) session type."
```
{ trainerId, clientId, sessionTypeId, grantedBy, note, createdAt }
```
- **Effective entitlement = `active` type OR (client has prior purchase/credit of the type) OR (an explicit entitlement row exists).**
- The implicit "has prior purchase" rule means most grandfathering needs *no* record — a client who already bought the $60 type keeps seeing it. The explicit row is only for granting a **new** client an archived rate.

### 3.3 `BillingLedgerEntry` — keep as-is (the spine)
- Credits (purchases) and debits (completed/charged sessions), per `(trainerId, clientId, sessionTypeId)`. Already reversible. No structural change required.

### 3.4 Purchases = **Invoices** (reuse), and **delete `SessionPurchase`**
- All "money in" for session credits flows through the existing **Invoice** system (it already: applies ledger credits on PAID, supports line items, PDF, email, payment records, request-from-client).
- A "buy a 10-pack of 60-min sessions" is an invoice with one **SESSION line item** → on PAID it creates the CREDIT ledger entries. We add: **entitlement check** (can't add a session line item for a type the client isn't entitled to) and **price snapshot** (line item records the unit price at purchase time).
- **Retire `SessionPurchase` entirely** (model, controller endpoints, `SessionCounter` page) — it's an orphan that never touched the ledger.

> **Key decision to confirm:** reuse Invoices as the single credit-purchase mechanism (recommended — least new code, already has receipts/email/requests), vs. building a separate lightweight "package purchase" model. The plan assumes **reuse Invoices**, with a simplified "Sell a package" UI on top so trainers don't deal with invoice ceremony for the common case.

---

## 4. Backend changes

- **`sessionTypeController`**: enforce immutability on used types; add **archive** (set `archivedAt`, `active=false`) and **clone-to-new-version** (`previousVersionId`). Add `list` filters: `active` only vs. include archived.
- **`SessionTypeEntitlement`**: model + endpoints to grant/revoke/list entitlements (trainer-only, scoped to their clients).
- **Purchasable-types resolver**: given `(trainer, client)`, return the set of buyable types = active ∪ entitled ∪ has-history. Used by both the trainer "sell" UI and the client store.
- **`invoiceController`**: on session line items, validate against the purchasable-types resolver and snapshot unit price; otherwise unchanged.
- **Remove** `sessionController` purchase endpoints + `SessionPurchase` model + routes.
- **Booking** (`scheduleController`): unchanged — entitlement gates *purchasing*, not booking. Booking a type the client has no credits for still works and shows the existing "will owe" warning (built).

## 5. Frontend changes

- **Session Types manager:** add **Archive** and **Change price** (= archive old + clone at new price, behind one button). Show active vs. archived sections. Surface `creditsRequired`, price, payout per type.
- **Grandfathering UI:** on a client, "Allowed session types" — grant/revoke entitlement to archived types (with the implicit "already purchased" ones shown as automatic).
- **Sell a package (Level 1):** trainer picks client → session type (from purchasable set) → quantity → confirms; creates a PAID invoice → credits land. Streamlined wrapper over invoice-create.
- **Client request (Level 1.5):** keep/clean up `TrainerStore` → "Request package" → trainer gets it as a SENT/requested invoice → marks paid. Clients only see types they're entitled to.
- **Balances:** already surfaced (schedule header chip + the booking-popup "N prepaid remaining" indicator we just built). Add a per-client balance view by session type.
- **Remove** the `SessionCounter` page.

## 6. Migration
- No production billing data → **no data migration needed.** Drop `SessionPurchase` collection. Existing session types become `active` with `archivedAt=null`. Existing dev/test data can be reseeded.

## 7. Deferred (explicitly out of scope now)
- **Stripe / in-app card checkout (Level 2)** — clients paying by card, processor fees, refunds, disputes, tax, trainer payout accounts. Adds *automatic* credit creation later; requires no rework of the above.
- Subscriptions / auto-renewing packages.
- Expiring credits (the old `SessionPurchase.expiresAt` idea) — revisit if needed.

## 8. Suggested phasing
1. **Model + de-dup:** `SessionType` lifecycle, `SessionTypeEntitlement`, purchasable-types resolver; delete `SessionPurchase`.
2. **Trainer UX:** archive / change-price (clone) / sell-a-package / grant entitlement.
3. **Client UX:** request-a-package flow + entitlement-filtered store + balance views.
4. **(Later) Stripe.**

## 9. Decisions (resolved 2026-06-24)
1. **Reuse Invoices** as the single credit-purchase mechanism, with a simplified "Sell a package" UI wrapper on top (no separate lightweight purchase model; keeps one money-in system + free receipts/email/requests). ✅
2. **Credits never expire.** ✅
3. **Implicit entitlement** ("can re-buy any type you've already purchased") — no records written on archive/price-change. Explicit `SessionTypeEntitlement` rows are used **only** to grant a brand-new client an archived rate. Implicit grandfathering is non-revocable; an explicit *block* record can be added later if "force onto new rates" is ever needed. ✅
