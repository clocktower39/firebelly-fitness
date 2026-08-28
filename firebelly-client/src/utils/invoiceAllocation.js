// Which sessions on an invoice a payment has actually settled.
//
// The server stores an invoice's line items OLDEST SESSION FIRST, and a payment is applied
// straight down that list, so "who is paid up to when" is positional rather than something we
// track per line. A $240 payment against six $60 sessions covers the four earliest and leaves
// the two most recent owing — which is how a trainer chasing a late-paying client thinks about
// it, and what "pay off the oldest first" means in practice.
//
// A line is PARTIAL when the money ran out mid-line (a package or a multi-quantity line).

export const allocatePayment = (lineItems = [], amountPaid = 0) => {
  let remaining = Math.max(0, Number(amountPaid) || 0);
  return (lineItems || []).map((item) => {
    const lineTotal = Number(item.lineTotal || 0);
    if (remaining <= 0) return { ...item, paidState: "unpaid", paidAmount: 0 };
    if (remaining >= lineTotal) {
      remaining -= lineTotal;
      return { ...item, paidState: "paid", paidAmount: lineTotal };
    }
    const paidAmount = remaining;
    remaining = 0;
    return { ...item, paidState: "partial", paidAmount };
  });
};

// The session date the client is paid up to — the newest fully covered session.
export const paidThrough = (lineItems = [], amountPaid = 0) => {
  const covered = allocatePayment(lineItems, amountPaid).filter(
    (l) => l.paidState === "paid" && l.sessionDate
  );
  if (!covered.length) return null;
  return covered.reduce(
    (latest, l) => (new Date(l.sessionDate) > new Date(latest) ? l.sessionDate : latest),
    covered[0].sessionDate
  );
};

export default allocatePayment;
