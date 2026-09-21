// A payout above the price means the session loses money. Easy to do by typing the
// rate into the wrong box, and nothing caught it before.
const test = require("node:test");
const assert = require("node:assert");
const { payoutExceedsPrice } = require("../utils/payoutGuard");

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
