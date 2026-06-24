// Single source of truth for rendering money amounts in the trainer's currency.
export function formatPrice(amount, currency = "USD") {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  const value = Number(amount).toFixed(2);
  switch (currency) {
    case "EUR":
      return `${value} €`;
    case "JPY":
      return `¥${value}`;
    case "USD":
    default:
      return `$${value}`;
  }
}
