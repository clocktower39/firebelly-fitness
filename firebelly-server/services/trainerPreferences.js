// v1 personalization for the draft generator: aggregate a trainer's past programming decisions (from
// ProgrammingSignal) into a per-exercise preference score, so exercise selection leans toward the lifts
// they actually choose and away from ones they reject. Feeds the coaching-os-learning direction.
//
// COLD-START SAFE: below MIN_SIGNALS this returns empty prefs (a strict no-op) and the generator behaves
// exactly like its rules-based default. SCOPE v1: exercise choices only (not schemes, not splits).

const ProgrammingSignal = require("../models/programmingSignal");

// Personalize only once we have at least this many finalized generated programs for the trainer.
const MIN_SIGNALS = 3;

// Per-decision weights: what the trainer added/swapped-to > what they kept > (negative) what they removed.
const ADDED = 2;
const KEPT = 1;
const REMOVED = -2;

// Read the trainer's history → { score: Map<exerciseId, number>, sampleSize }. Compares each signal's
// generated vs final week-1 snapshots per day (both carry exerciseId). Guarded: any failure yields empty
// prefs so it can never throw into the generator.
async function getTrainerExercisePreferences(trainerId) {
  const empty = { score: new Map(), sampleSize: 0 };
  try {
    const signals = await ProgrammingSignal.find({ trainerId }).select("generated final").lean();
    if (!signals.length) return empty;
    const score = new Map();
    const bump = (id, delta) => {
      if (!id) return;
      const key = String(id);
      score.set(key, (score.get(key) || 0) + delta);
    };
    signals.forEach((sig) => {
      const genByDay = new Map((sig.generated || []).map((d) => [d.dayIndex, d]));
      const finByDay = new Map((sig.final || []).map((d) => [d.dayIndex, d]));
      const dayIndexes = new Set([...genByDay.keys(), ...finByDay.keys()]);
      dayIndexes.forEach((di) => {
        const genIds = new Set(((genByDay.get(di) || {}).exercises || []).map((e) => e.exerciseId).filter(Boolean));
        const finIds = new Set(((finByDay.get(di) || {}).exercises || []).map((e) => e.exerciseId).filter(Boolean));
        genIds.forEach((id) => bump(id, finIds.has(id) ? KEPT : REMOVED));
        finIds.forEach((id) => { if (!genIds.has(id)) bump(id, ADDED); });
      });
    });
    return { score, sampleSize: signals.length };
  } catch (err) {
    console.error("getTrainerExercisePreferences failed (non-blocking):", err.message);
    return empty;
  }
}

module.exports = { getTrainerExercisePreferences, MIN_SIGNALS };
