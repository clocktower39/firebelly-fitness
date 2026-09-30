// Anchor-driven progression: one working weight per (client, program, exercise), every
// occurrence in the week a percentage of it. The failure this prevents is a 5x5 volume day
// and its 80% light day progressing independently until they're unrelated.
const test = require("node:test");
const assert = require("node:assert");
const {
  loadForSlot,
  applyAnchorToEntry,
  nextWorking,
  capWorking,
} = require("../services/anchorProgression");

const BB = { equipment: "Barbell" };

test("a percentage of the working weight lands on something the bar can actually load", () => {
  assert.equal(loadForSlot(225, 80, "weight", "barbell"), 180);   // exact
  assert.equal(loadForSlot(225, 100, "weight", "barbell"), 225);
  const top = loadForSlot(225, 105, "weight", "barbell");          // 236.25 is not loadable
  assert.ok(top >= 235 && top <= 237.5, `got ${top}`);
});

test("reps and seconds round to whole numbers, not plate increments", () => {
  assert.equal(loadForSlot(12, 80, "reps", null), 10);   // 9.6 -> 10
  assert.equal(loadForSlot(30, 50, "seconds", null), 15);
});

const entry = (weights, pct, applyTo = "top") => ({
  exercise: "aaaaaaaaaaaaaaaaaaaaaaaa", exerciseType: "Reps", isWarmup: false,
  goals: { sets: weights.length, exactReps: weights.map(() => "5"),
    weight: weights.map(String), seconds: weights.map(() => 0) },
  progression: { percentOfAnchor: pct, applyTo, unit: "weight" },
});

test("a ramp shifts as a whole so the warm-up gaps survive", () => {
  // Brett's real shape: 65/85/95/105 leading to a 120 top set, anchor moving to 121.
  const e = entry([65, 85, 95, 105, 120], 100);
  applyAnchorToEntry(e, { working: 121, unit: "weight" }, "barbell");
  const w = e.goals.weight.map(Number);
  assert.equal(w[w.length - 1], 121, "top set takes the anchor");
  assert.ok(w[0] > 65 && w[0] < 85, `lead-in should shift with it, got ${w[0]}`);
  assert.ok(w.every((v, i) => i === 0 || v >= w[i - 1]), "the ramp must stay ascending");
});

test("applyTo:all flattens every set onto the target instead", () => {
  const e = entry([180, 180, 180], 80, "all");
  applyAnchorToEntry(e, { working: 225, unit: "weight" }, "barbell");
  assert.deepEqual(e.goals.weight, ["180", "180", "180"]);
  applyAnchorToEntry(e, { working: 250, unit: "weight" }, "barbell");
  assert.deepEqual(e.goals.weight, ["200", "200", "200"], "80% of 250");
});

test("an unlinked slot is left completely alone", () => {
  const e = entry([100, 100], null);
  const changed = applyAnchorToEntry(e, { working: 300, unit: "weight" }, "barbell");
  assert.equal(changed, false);
  assert.deepEqual(e.goals.weight, ["100", "100"]);
});

test("unloaded sets in a ramp are not given phantom weight", () => {
  const e = entry([0, 0, 95, 105], 100);
  applyAnchorToEntry(e, { working: 110, unit: "weight" }, "barbell");
  assert.equal(Number(e.goals.weight[0]), 0, "a bodyweight set must stay at 0");
  assert.equal(Number(e.goals.weight[1]), 0);
});

// --- how the anchor moves ---
const anchor = (over = {}) => ({ working: 225, unit: "weight", rule: "feedback", step: 0, earnsOnDay: 3, ...over });

test('"too hard" on ANY day backs the working weight off', () => {
  const light = nextWorking(anchor(), { day: 1, met: true, effort: "hard" }, BB);
  assert.ok(light.working < 225, `the 80% day reporting hard should lower it, got ${light.working}`);
  assert.match(light.reason, /day 1/);
});

test("a day that doesn't earn raises cannot raise it, however easy it felt", () => {
  const r = nextWorking(anchor(), { day: 1, met: true, effort: "easy" }, BB);
  assert.equal(r.working, 225);
  assert.match(r.reason, /does not earn/);
});

test("the nominated day does raise it", () => {
  const r = nextWorking(anchor(), { day: 3, met: true, effort: "easy" }, BB);
  assert.ok(r.working > 225, `expected a raise, got ${r.working}`);
});

test("a weekly rule steps by exactly its own amount", () => {
  const r = nextWorking(anchor({ rule: "weekly", step: 1 }), { day: 3, met: true, effort: "neutral" }, BB);
  assert.equal(r.working, 226, "Brett's +1 lb per week");
});

test("earned holds until the client has actually earned it", () => {
  const held = nextWorking(anchor({ rule: "earned" }), { day: 3, met: true, effort: "neutral", streak: 1 }, BB);
  assert.equal(held.working, 225);
  const earned = nextWorking(anchor({ rule: "earned" }), { day: 3, met: true, effort: "neutral", streak: 2 }, BB);
  assert.ok(earned.working > 225);
});

test("hold never moves", () => {
  assert.equal(nextWorking(anchor({ rule: "hold" }), { day: 3, met: true, effort: "easy" }, BB).working, 225);
});

test("missing the reps holds rather than backing off", () => {
  const r = nextWorking(anchor(), { day: 3, met: false, effort: "neutral" }, BB);
  assert.equal(r.working, 225);
  assert.match(r.reason, /held/);
});

test("the ceiling caps the anchor itself", () => {
  assert.equal(capWorking(240, 235), 235);
  assert.equal(capWorking(230, 235), 230);
  assert.equal(capWorking(240, null), 240, "no ceiling means no cap");
  assert.equal(capWorking(240, undefined), 240);
});
