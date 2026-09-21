// Mirrors firebelly-server/utils/payoutGuard.js so the trainer sees the problem
// while typing instead of after a round-trip. The server stays authoritative.

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
// Missing values are fine (both fields are optional), and a price and payout in
// different currencies aren't compared — we hold no exchange rates.
export const payoutExceedsPrice = (
  price,
  payout,
  priceCurrency = "USD",
  payoutCurrency = "USD"
) => {
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

export default payoutExceedsPrice;
