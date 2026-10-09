// The display rules for the four exercise types. These exist because every consumer used to
// carry its own switch, and Rep Range ended up rendering correctly in two places and wrongly
// in the other two — blank on the overview, and only the bottom of the range in the log field.
import test from "node:test";
import assert from "node:assert";
import {
  EXERCISE_TYPES, isKnownType, editFieldsFor, loggedFieldsFor, setCountFor,
  describeSet, describePrescription, describeAchieved, goalAdornment,
} from "./exerciseTypes.js";

const REPS_FIELD = { achievedAttribute: "reps", goalAttribute: "exactReps" };
const WEIGHT_FIELD = { achievedAttribute: "weight", goalAttribute: "weight" };
const SECONDS_FIELD = { achievedAttribute: "seconds", goalAttribute: "seconds" };

test("every type the UI offers has a descriptor, and nothing else does", () => {
  assert.deepEqual(EXERCISE_TYPES, ["Rep Range", "Reps", "Reps with %", "Time"]);
  EXERCISE_TYPES.forEach((t) => {
    assert.ok(isKnownType(t), `${t} must be known`);
    assert.ok(editFieldsFor(t)?.repeating?.length, `${t} needs edit fields`);
    assert.ok(loggedFieldsFor(t)?.length, `${t} needs logged fields`);
  });
  // 9 legacy entries carried no type at all and rendered as literally "Type Error".
  assert.equal(isKnownType(undefined), false);
  assert.equal(editFieldsFor("Nonsense"), null);
  assert.equal(describePrescription("Nonsense", {}), null);
});

test("a rep range shows the whole span, not just the floor", () => {
  assert.equal(describeSet("Rep Range", { minReps: [8], maxReps: [12], exactReps: [8] }), "8-12");
});

test("a climbed target is shown alongside the span", () => {
  // Double progression walks exactReps up through the range; the target cannot live in a
  // tooltip because `title` never fires on a touch screen.
  assert.equal(describeSet("Rep Range", { minReps: [8], maxReps: [12], exactReps: [12] }), "12 of 8-12");
  assert.equal(describeSet("Rep Range", { minReps: [8], maxReps: [12], exactReps: [9] }), "9 of 8-12");
});

test("a rep range whose ends are equal is not shown as a span", () => {
  assert.equal(describeSet("Rep Range", { minReps: [10], maxReps: [10], exactReps: [10] }), "10");
});

test("legacy rep ranges with no target or no ceiling still describe something", () => {
  // 4 live entries store exactReps 0 alongside a real range; they used to render "/0".
  assert.equal(describeSet("Rep Range", { minReps: [2], maxReps: [5], exactReps: [0] }), "2-5");
  assert.equal(describeSet("Rep Range", { minReps: [8], maxReps: [0], exactReps: [8] }), "8");
  assert.equal(describeSet("Rep Range", { minReps: [0], maxReps: [0], exactReps: [0] }), "");
});

test("the prescription summary reads the same for every consumer", () => {
  const p = describePrescription("Rep Range", { sets: 3, minReps: [8, 8, 8], maxReps: [12, 12, 12], exactReps: [8, 8, 8] });
  assert.equal(p.text, "3 sets: 8-12, 8-12, 8-12 reps");
  assert.equal(describePrescription("Reps", { sets: 3, exactReps: [5, 5, 5] }).text, "3 sets: 5, 5, 5 reps");
  assert.equal(describePrescription("Time", { sets: 4, seconds: [25, 25, 25, 25] }).text, "4 sets: 25, 25, 25, 25 seconds");
});

test("a percentage prescription reports its 1RM separately from the text", () => {
  // Separately, because the caller formats weights in the viewer's own unit.
  const p = describePrescription("Reps with %", { sets: 5, percent: [55, 55, 55, 55, 55], exactReps: [3, 3, 3, 3, 3], oneRepMax: 115 });
  assert.equal(p.text, "5 sets: 3, 3, 3, 3, 3 reps");
  assert.equal(p.oneRepMax, 115);
  // Max Callback leaves this at 0 on the document and resolves it on read; an unresolved
  // entry must report null rather than a bogus 0 lb max.
  assert.equal(describePrescription("Reps with %", { sets: 1, percent: [55], exactReps: [3], oneRepMax: 0 }).oneRepMax, null);
});

test("set count prefers goals.sets but survives legacy entries without it", () => {
  assert.equal(setCountFor("Reps", { sets: 4, exactReps: [5, 5, 5, 5] }), 4);
  assert.equal(setCountFor("Reps", { exactReps: [5, 5, 5] }), 3, "falls back to the array");
  assert.equal(setCountFor("Rep Range", { minReps: [8, 8] }), 2);
  assert.equal(setCountFor("Time", { seconds: [20, 20, 20] }), 3);
  assert.equal(setCountFor("Reps", {}), 0);
});

test("the goal chip fills one number even when it shows a span", () => {
  const a = goalAdornment("Rep Range", { minReps: [8], maxReps: [12], exactReps: [8] }, REPS_FIELD, 0);
  assert.equal(a.text, "8-12");
  assert.equal(a.fillValue, 8, "tapping a range inserts today's target, not the text");
  assert.equal(a.isRange, true);

  const climbed = goalAdornment("Rep Range", { minReps: [8], maxReps: [12], exactReps: [12] }, REPS_FIELD, 0);
  assert.equal(climbed.text, "12 of 8-12");
  assert.equal(climbed.fillValue, 12);
});

test("a rep range with no target falls back to the floor rather than filling a zero", () => {
  const a = goalAdornment("Rep Range", { minReps: [2], maxReps: [5], exactReps: [0] }, REPS_FIELD, 0);
  assert.equal(a.text, "2-5");
  assert.equal(a.fillValue, 2, "used to fill in 0");
});

test("a percentage weight field resolves its load from the 1RM", () => {
  const a = goalAdornment("Reps with %", { oneRepMax: 115, percent: [55] }, WEIGHT_FIELD, 0);
  assert.equal(a.text, "63.25");
  assert.equal(a.fillValue, 63.25);
});

test("nothing prescribed means no chip at all", () => {
  // A bodyweight exercise's weight, or one of the 26 Time entries with no seconds set: these
  // rendered a tappable "/0" whose only effect was to fill in a zero.
  assert.equal(goalAdornment("Reps", { weight: [0], exactReps: [10] }, WEIGHT_FIELD, 0).text, "");
  assert.equal(goalAdornment("Time", { seconds: [0] }, SECONDS_FIELD, 0).text, "");
  assert.equal(goalAdornment("Reps with %", { oneRepMax: 0, percent: [55] }, WEIGHT_FIELD, 0).text, "",
    "a percentage with no max resolves to nothing, not to 0");
});

test("achieved values describe what was logged, per set actually recorded", () => {
  assert.equal(describeAchieved("Reps", { reps: [9, 8, 7] }).text, "3 sets: 9, 8, 7 reps");
  assert.equal(describeAchieved("Time", { seconds: [20, 20] }).text, "2 sets: 20, 20 seconds");
  assert.equal(describeAchieved("Rep Range", { reps: [12, 11] }).text, "2 sets: 12, 11 reps");
});

test("each set is described independently, so mixed schemes survive", () => {
  // A descending scheme (12/10/8) must not be flattened to one number repeated.
  const goals = { sets: 3, minReps: [8, 6, 4], maxReps: [12, 10, 8], exactReps: [8, 6, 4] };
  assert.equal(describePrescription("Rep Range", goals).text, "3 sets: 8-12, 6-10, 4-8 reps");
  assert.equal(describeSet("Rep Range", goals, 1), "6-10");
});

test("a set count with no target behind it says only what is known", () => {
  // 452 live entries prescribe sets with all-zero targets. "3 sets: 0, 0, 0 reps" presented an
  // absent prescription as a real one.
  const p = describePrescription("Reps", { sets: 3, exactReps: [0, 0, 0] });
  assert.equal(p.text, "3 sets");
  assert.equal(p.values.length, 0);
  assert.equal(describePrescription("Time", { sets: 1, seconds: [0] }).text, "1 set");
});

test("nothing logged describes nothing, rather than a row of zeros", () => {
  assert.equal(describeAchieved("Reps", { reps: [0, 0, 0] }).text, "");
  assert.equal(describeAchieved("Reps", { reps: [] }).text, "");
  assert.equal(describeAchieved("Reps", { reps: [9, 0, 0] }).text, "3 sets: 9, 0, 0 reps",
    "a partially logged set still shows the whole row");
});

test("set counts read grammatically, and no sets means no prescription", () => {
  assert.equal(describePrescription("Reps", { sets: 1, exactReps: [5] }).text, "1 set: 5 reps");
  assert.equal(describePrescription("Reps", { sets: 2, exactReps: [5, 5] }).text, "2 sets: 5, 5 reps");
  assert.equal(describeAchieved("Reps", { reps: [9] }).text, "1 set: 9 reps");
  // 5 live entries declare 0 sets; there is nothing to describe.
  assert.equal(describePrescription("Reps", { sets: 0, exactReps: [] }).text, "");
});
