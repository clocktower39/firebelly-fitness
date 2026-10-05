// A payout above the price means the session loses money. Easy to do by typing the
// rate into the wrong box, and nothing caught it before.
const test = require("node:test");
const assert = require("node:assert");
const { payoutExceedsPrice, clampPayoutToPrice } = require("../utils/payoutGuard");

test("rejects a payout above the price", () => {
  const problem = payoutExceedsPrice(60, 80);
  assert.ok(problem, "expected an error");
  assert.match(problem, /\$80\.00/);
  assert.match(problem, /\$60\.00/);
});

test("allows a payout equal to or below the price", () => {
  assert.equal(payoutExceedsPrice(60, 60), null);
  assert.equal(payoutExceedsPrice(60, 45), null);
  assert.equal(payoutExceedsPrice(0, 0), null);
});

test("treats numeric strings from form fields the same as numbers", () => {
  assert.ok(payoutExceedsPrice("60", "80"));
  assert.equal(payoutExceedsPrice("60", "45"), null);
});

test("leaves blank or missing values alone — both fields are optional", () => {
  assert.equal(payoutExceedsPrice(null, 80), null);
  assert.equal(payoutExceedsPrice(60, null), null);
  assert.equal(payoutExceedsPrice("", ""), null);
  assert.equal(payoutExceedsPrice(undefined, undefined), null);
});

test("does not compare across currencies — there are no exchange rates here", () => {
  assert.equal(payoutExceedsPrice(60, 80, "USD", "EUR"), null);
  assert.ok(payoutExceedsPrice(60, 80, "EUR", "EUR"));
});

test("catches a free session that still pays out", () => {
  assert.ok(payoutExceedsPrice(0, 5));
});

// --- appointments now CORRECT rather than refuse ---

test("a payout above the price is lowered to match, with a message explaining it", () => {
  const r = clampPayoutToPrice(60, 80);
  assert.equal(r.payout, 60);
  assert.equal(r.adjusted, true);
  assert.match(r.message, /\$60\.00/);
  assert.match(r.message, /\$80\.00/);
});

test("a payout at or below the price is left exactly as entered, with no message", () => {
  for (const p of [60, 45, 0]) {
    const r = clampPayoutToPrice(60, p);
    assert.equal(r.adjusted, false);
    assert.equal(r.message, "");
    assert.equal(r.payout, p);
  }
});

test("a grandfathered rate below the catalog payout pulls the payout down with it", () => {
  // Tyler pays $45 while the 60-minute type pays out $60 — booking him must not keep $60.
  const r = clampPayoutToPrice(45, 60);
  assert.equal(r.payout, 45);
  assert.ok(r.adjusted);
});

test("nothing is invented when there is no price to compare against", () => {
  assert.equal(clampPayoutToPrice(null, 80).adjusted, false, "a missing price can't justify a change");
  assert.equal(clampPayoutToPrice(null, 80).payout, 80);
  assert.equal(clampPayoutToPrice(60, null).adjusted, false);
});

test("cross-currency pairs are still left alone — there are no exchange rates here", () => {
  const r = clampPayoutToPrice(60, 80, "USD", "EUR");
  assert.equal(r.adjusted, false);
  assert.equal(r.payout, 80);
});

test("a free session cannot pay out", () => {
  const r = clampPayoutToPrice(0, 5);
  assert.equal(r.payout, 0);
  assert.ok(r.adjusted);
});
