// A trainer payout larger than the price means the session loses money on every
// booking, which is never intentional — almost always a digit slipped in the wrong
// field. Both the session-type catalog and individual appointments carry a price
// and a payout, so the rule lives here and is applied at every write path.

const toAmount = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const money = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount}`;
  }
};

// Returns an error string when the payout exceeds the price, otherwise null.
// A missing price or payout is not an error — those fields are optional. Price and
// payout can be denominated in different currencies, and we hold no exchange rates,
// so a cross-currency pair is left alone rather than compared meaninglessly.
const payoutExceedsPrice = (price, payout, priceCurrency = "USD", payoutCurrency = "USD") => {
  const priceValue = toAmount(price);
  const payoutValue = toAmount(payout);
  if (priceValue === null || payoutValue === null) return null;
  if ((priceCurrency || "USD") !== (payoutCurrency || "USD")) return null;
  if (payoutValue <= priceValue) return null;
  return `Payout (${money(payoutValue, payoutCurrency)}) cannot be more than the price (${money(
    priceValue,
    priceCurrency
  )}).`;
};

// Appointments auto-correct rather than refuse. A payout above the price is always a slip —
// the price came from the session type or the client's grandfathered rate, and the payout is
// what the trainer keeps — so lowering it to match is what was meant. Returns the value to
// store plus a message to show, so the correction is never silent.
const clampPayoutToPrice = (price, payout, priceCurrency = "USD", payoutCurrency = "USD") => {
  const problem = payoutExceedsPrice(price, payout, priceCurrency, payoutCurrency);
  if (!problem) return { payout: toAmount(payout), adjusted: false, message: "" };
  const priceValue = toAmount(price);
  return {
    payout: priceValue,
    adjusted: true,
    message: `Payout lowered to ${money(priceValue, priceCurrency)} to match the session price — it was entered as ${money(toAmount(payout), payoutCurrency)}.`,
  };
};

module.exports = { payoutExceedsPrice, clampPayoutToPrice, toAmount };
