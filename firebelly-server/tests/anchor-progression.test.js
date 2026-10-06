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
  assert.equal(loadForSlot(225, 80, "weight"), 180);   // exact
  assert.equal(loadForSlot(225, 100, "weight"), 225);
  const top = loadForSlot(225, 105, "weight");          // 236.25 is not loadable
  assert.ok(top >= 235 && top <= 237.5, `got ${top}`);
});

test("reps and seconds round to whole numbers, not plate increments", () => {
  assert.equal(loadForSlot(12, 80, "reps"), 10);   // 9.6 -> 10
  assert.equal(loadForSlot(30, 50, "seconds"), 15);
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
  applyAnchorToEntry(e, { working: 121, unit: "weight" });
  const w = e.goals.weight.map(Number);
  assert.equal(w[w.length - 1], 121, "top set takes the anchor");
  assert.ok(w[0] > 65 && w[0] < 85, `lead-in should shift with it, got ${w[0]}`);
  assert.ok(w.every((v, i) => i === 0 || v >= w[i - 1]), "the ramp must stay ascending");
});

test("applyTo:all flattens every set onto the target instead", () => {
  const e = entry([180, 180, 180], 80, "all");
  applyAnchorToEntry(e, { working: 225, unit: "weight" });
  assert.deepEqual(e.goals.weight, ["180", "180", "180"]);
  applyAnchorToEntry(e, { working: 250, unit: "weight" });
  assert.deepEqual(e.goals.weight, ["200", "200", "200"], "80% of 250");
});

test("an unlinked slot is left completely alone", () => {
  const e = entry([100, 100], null);
  const changed = applyAnchorToEntry(e, { working: 300, unit: "weight" });
  assert.equal(changed, false);
  assert.deepEqual(e.goals.weight, ["100", "100"]);
});

test("unloaded sets in a ramp are not given phantom weight", () => {
  const e = entry([0, 0, 95, 105], 100);
  applyAnchorToEntry(e, { working: 110, unit: "weight" });
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

// A free-text warm-up row carries no library exercise. The model allows it, but the
// sub-schema types the field as an ObjectId, so hydrating such a doc and calling .save()
// throws on a row this code never touched — 36 production workouts have one. The resolver
// must write through without tripping over them.
const mongoose = require("mongoose");
process.env.DBURL = process.env.DBURL || "mongodb://127.0.0.1:27017/firebelly-dev";
const Training = require("../models/training");
const ExerciseAnchor = require("../models/exerciseAnchor");
const { resolveAnchorToFutureWorkouts } = require("../services/anchorProgression");
require("../models/user");
require("../models/exercise");

test("resolving an anchor survives a workout containing a blank-exercise warm-up row", async () => {
  await mongoose.connect(process.env.DBURL);
  assert.equal(mongoose.connection.name, "firebelly-dev", "tests must not touch live data");
  const clientId = new mongoose.Types.ObjectId();
  const programId = new mongoose.Types.ObjectId();
  const exerciseId = new mongoose.Types.ObjectId();
  const made = [];
  try {
    // insert through the raw collection so the blank warm-up row is stored verbatim
    const doc = {
      title: "ANCHOR blank-warmup", date: new Date(Date.now() + 7 * 864e5),
      user: clientId, programId, programWeek: 2, programDay: 1, complete: false,
      category: ["Strength"], isTemplate: false,
      training: [[
        { exercise: "", customName: "Foam roll IT band", exerciseType: "Reps", isWarmup: true,
          goals: { sets: 1, exactReps: ["0"], weight: ["0"], seconds: [0] },
          achieved: { sets: 0, reps: ["0"], weight: ["0"], seconds: [0] } },
        { exercise: exerciseId, customName: "", exerciseType: "Reps", isWarmup: false,
          goals: { sets: 3, exactReps: ["5", "5", "5"], weight: ["180", "180", "180"], seconds: [0, 0, 0] },
          achieved: { sets: 0, reps: [0, 0, 0], weight: [0, 0, 0], seconds: [0, 0, 0] },
          progression: { percentOfAnchor: 80, applyTo: "all", unit: "weight" } },
      ]],
    };
    const ins = await Training.collection.insertOne(doc);
    made.push(ins.insertedId);

    const anchor = await ExerciseAnchor.create({
      trainerId: new mongoose.Types.ObjectId(), clientId, programId, exerciseId,
      working: 250, unit: "weight", rule: "feedback", earnsOnDay: 1,
    });
    made.push(null);

    const touched = await resolveAnchorToFutureWorkouts(anchor, { from: new Date() });
    assert.equal(touched.length, 1, "the workout should have been updated, not thrown past");

    const after = await Training.collection.findOne({ _id: ins.insertedId });
    assert.deepEqual(after.training[0][1].goals.weight, ["200", "200", "200"], "80% of 250");
    assert.equal(after.training[0][0].exercise, "", "the warm-up row must survive untouched");
    await ExerciseAnchor.deleteOne({ _id: anchor._id });
  } finally {
    await Training.collection.deleteMany({ _id: { $in: made.filter(Boolean) } });
    await mongoose.disconnect();
  }
});

// --- the anchor has to TRACK reality on its earning day, not just increment itself ---

test("a brand-new anchor adopts what was actually lifted instead of inching up from zero", () => {
  // Program days carry no loads, so a fresh anchor is 0. Before this it read 5 lb after a
  // session at 185.
  const fresh = { working: 0, unit: "weight", rule: "feedback", step: 0, earnsOnDay: 1 };
  const r = nextWorking(fresh, { day: 1, met: true, effort: "easy", achievedTop: 185, slotPercent: 100 }, BB);
  assert.ok(r.working >= 185, `expected it to adopt 185 and then add, got ${r.working}`);
});

test("the earning day's load is divided by its own percentage to imply the working weight", () => {
  // If the earning day is itself an 80% slot, 160 lb there means a 200 lb working weight.
  const a = { working: 0, unit: "weight", rule: "hold", step: 0, earnsOnDay: 2 };
  const held = nextWorking(a, { day: 2, met: true, effort: "neutral", achievedTop: 160, slotPercent: 80 }, BB);
  assert.equal(held.working, 0, "a hold rule must not move the stored number at all");
  const live = { working: 0, unit: "weight", rule: "feedback", step: 0, earnsOnDay: 2 };
  const r = nextWorking(live, { day: 2, met: true, effort: "neutral", achievedTop: 160, slotPercent: 80 }, BB);
  assert.ok(r.working >= 200, `160 at 80% implies 200, got ${r.working}`);
});

test("a NON-earning day's result never redefines the working weight", () => {
  const a = { working: 225, unit: "weight", rule: "feedback", step: 0, earnsOnDay: 1 };
  // the 80% day finished at 160 and felt fine — the anchor must stay 225
  const r = nextWorking(a, { day: 3, met: true, effort: "neutral", achievedTop: 160, slotPercent: 80 }, BB);
  assert.equal(r.working, 225);
  assert.match(r.reason, /does not earn/);
});

test("a non-earning day reporting TOO HARD still backs the anchor off from its stored value", () => {
  const a = { working: 225, unit: "weight", rule: "feedback", step: 0, earnsOnDay: 1 };
  const r = nextWorking(a, { day: 3, met: true, effort: "hard", achievedTop: 160, slotPercent: 80 }, BB);
  assert.ok(r.working < 225 && r.working > 200, `expected a step down from 225, got ${r.working}`);
});

test("with no achieved load it falls back to the stored number, as before", () => {
  const a = { working: 225, unit: "weight", rule: "weekly", step: 5, earnsOnDay: 1 };
  const r = nextWorking(a, { day: 1, met: true, effort: "neutral", achievedTop: 0, slotPercent: 100 }, BB);
  assert.equal(r.working, 230);
});
