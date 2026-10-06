// Anchor-driven progression. One working weight per (client, program, exercise); each
// occurrence in the week renders as a percentage of it. Moving the anchor re-renders every
// occurrence, so a 5x5 volume day and its 80% light day can never drift apart.
//
// Division of labour with reactiveProgression: that module seeds exercises that have NO
// anchor (the default, unchanged). Anything with an anchor is handled here instead, so the
// two never fight over the same load.

const Training = require("../models/training");
const ExerciseAnchor = require("../models/exerciseAnchor");
const { familyOf, weightIncrement } = require("./progressionEngine");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const exIdOf = (entry) => String(entry?.exercise?._id || entry?.exercise || "");

// The load a slot should show, given the anchor.
//
// Deliberately NOT roundToLoadable: that snaps a barbell to 2.5 lb, which would turn a
// 1 lb-per-week progression into 132.5 / 135 and destroy it. This trainer programs in 1 lb
// and 0.5 lb steps (126, 127, 128... and 17.5, 32.5, 112.5), so derived loads round to the
// nearest 0.5 and the 100% slot isn't rounded at all — it IS the number the trainer typed.
const loadForSlot = (working, percent, unit) => {
  const pct = Number.isFinite(Number(percent)) ? Number(percent) : 100;
  const w = num(working);
  if (pct === 100) return w;
  const raw = (w * pct) / 100;
  if (unit === "weight") return Math.max(0, Math.round(raw * 2) / 2);
  return Math.max(0, Math.round(raw));
};

const KEY_FOR_UNIT = { weight: "weight", reps: "exactReps", seconds: "seconds" };

// Write the anchor's value into one exercise entry. `applyTo` decides whether a ramp moves
// as a whole (shifting every set by the same delta, preserving the gaps a warm-up ramp needs)
// or only its top set.
const applyAnchorToEntry = (entry, anchor) => {
  const goals = entry.goals || {};
  const key = KEY_FOR_UNIT[anchor.unit] || "weight";
  const arr = Array.isArray(goals[key]) ? goals[key] : [];
  if (!arr.length) return false;
  const pct = entry.progression?.percentOfAnchor;
  if (pct === null || pct === undefined) return false; // not linked to the anchor

  const target = loadForSlot(anchor.working, pct, anchor.unit);
  const applyTo = entry.progression?.applyTo || "top";
  const asString = typeof arr[arr.length - 1] === "string";
  const out = arr.slice();

  if (applyTo === "all") {
    for (let i = 0; i < out.length; i += 1) out[i] = asString ? String(target) : target;
  } else {
    // Move the top set to the target and shift the lead-in sets by the same delta, so
    // 65/85/95/105/120 going to 121 becomes 66/86/96/106/121 rather than flattening.
    const topIdx = out.reduce((best, v, i) => (num(v) >= num(out[best]) ? i : best), 0);
    const delta = target - num(out[topIdx]);
    if (delta === 0) return false;
    for (let i = 0; i < out.length; i += 1) {
      if (num(out[i]) <= 0) continue; // leave unloaded sets alone
      const next =
        anchor.unit === "weight"
          ? Math.max(0, Math.round((num(out[i]) + delta) * 2) / 2)
          : Math.max(0, Math.round(num(out[i]) + delta));
      out[i] = asString ? String(next) : next;
    }
    out[topIdx] = asString ? String(target) : target;
  }
  if (JSON.stringify(out) === JSON.stringify(arr)) return false;
  goals[key] = out;
  return true;
};

// Push an anchor's current value into every future, incomplete occurrence of its exercise in
// the client's program. Returns the ids of the workouts that changed.
//
// Reads .lean() and writes through the raw collection ON PURPOSE. A free-text warm-up row is
// allowed to carry no library exercise (models/training says so), but the sub-schema types
// that field as an ObjectId — so hydrating such a doc and calling .save() throws
// "Cast to ObjectId failed for value \"\"" on a row this function never touched. 36 workouts
// in production have one. Casting on updateOne would fail the same way, so the write has to
// bypass mongoose casting; reading lean keeps ObjectIds intact so the round-trip is faithful.
const resolveAnchorToFutureWorkouts = async (anchor, { from = new Date(), exerciseMeta = {} } = {}) => {
  const docs = await Training.find({
    user: anchor.clientId,
    programId: anchor.programId,
    isTemplate: { $ne: true },
    complete: { $ne: true },
    holdProgression: { $ne: true },
    date: { $gte: from },
  }).lean();
  const touched = [];
  for (const doc of docs) {
    let changed = false;
    (doc.training || []).forEach((circuit) =>
      (circuit || []).forEach((entry) => {
        if (entry.isWarmup) return;
        if (exIdOf(entry) !== String(anchor.exerciseId)) return;
        if (applyAnchorToEntry(entry, anchor)) changed = true;
      })
    );
    if (changed) {
      await Training.collection.updateOne({ _id: doc._id }, { $set: { training: doc.training } });
      touched.push(doc._id);
    }
  }
  return touched;
};

// Decide the anchor's next value from one completed occurrence.
//   - "too hard" on ANY day holds or backs the number off, because if the light day felt
//     brutal the working weight is wrong no matter which day reported it
//   - only `earnsOnDay` can raise it, so an easy light day can't drive the heavy day
// `achievedTop` is what they actually lifted on the completed occurrence, and `slotPercent`
// is that occurrence's share of the anchor. The anchor TRACKS reality on its earning day:
// dividing the achieved load by the slot's percentage gives the working weight it implies,
// and the rule then decides whether to add to it. Without this the anchor only ever
// incremented its own stored number, so a brand-new anchor (0, because program days carry no
// loads) would read 5 lb after a session at 185 instead of adopting it.
const nextWorking = (
  anchor,
  { day, met, effort, streak = 1, achievedTop = 0, slotPercent = 100 },
  exerciseMeta = {}
) => {
  const family = familyOf(exerciseMeta.equipment);
  const stored = num(anchor.working);
  const pct = Number(slotPercent) > 0 ? Number(slotPercent) : 100;
  const earnsDay = anchor.earnsOnDay == null || Number(anchor.earnsOnDay) === Number(day);
  // Only the earning day re-anchors: an 80% light day finishing at 160 must not redefine the
  // working weight, it just reports how 80% felt.
  const implied = earnsDay && num(achievedTop) > 0
    ? Math.round((num(achievedTop) * 100) / pct * 2) / 2
    : stored;
  const current = implied;
  const inc =
    anchor.unit === "weight"
      ? weightIncrement(family, exerciseMeta.movementComplexity, current)
      : 1;

  if (effort === "hard" || met === false) {
    const back = Math.max(0, current - inc);
    return effort === "hard"
      ? { working: back, reason: `backed off after a "too hard" report on day ${day}` }
      : { working: current, reason: `held — reps missed on day ${day}` };
  }
  if (anchor.rule === "hold") return { working: stored, reason: "held (rule: hold)" };
  if (!earnsDay) return { working: stored, reason: `day ${day} does not earn raises` };

  if (anchor.rule === "weekly") {
    const bump = num(anchor.step) || inc;
    return { working: current + bump, reason: `weekly step +${bump}` };
  }
  if (anchor.rule === "earned" && !(effort === "easy" || streak >= 2)) {
    return { working: current, reason: "held — hasn't earned it yet (needs 2-for-2 or an easy report)" };
  }
  const up = current + inc;
  return { working: up, reason: anchor.rule === "weekly" ? "weekly step" : `earned +${inc}` };
};

// Clamp the anchor itself, so nothing downstream ever sees an over-ceiling number.
const capWorking = (value, ceiling) => {
  if (ceiling === null || ceiling === undefined || ceiling === "") return value;
  const cap = Number(ceiling);
  if (!Number.isFinite(cap) || cap < 0) return value;
  return Math.min(value, cap);
};

module.exports = {
  loadForSlot,
  applyAnchorToEntry,
  resolveAnchorToFutureWorkouts,
  nextWorking,
  capWorking,
  ExerciseAnchor,
};
