// v2 personalization for the draft generator: learn the trainer's preferred set/rep/% schemes from their
// finalized generated programs (ProgrammingSignal.final) and seed new drafts with them instead of the
// fixed STRATEGY defaults. Cold-start safe (below MIN_SIGNALS the generator uses defaults); guarded.
// Learns from ALL final schemes (a kept scheme is tacit acceptance), so with no edits it reproduces the
// current defaults (no drift). SCOPE: set/rep/%/rep-range only — not rest, exercise choice, or splits.

const ProgrammingSignal = require("../models/programmingSignal");

const SCHEME_TYPES = ["Reps with %", "Rep Range", "Reps", "Time"];
// The scheme fields that matter per exerciseType (matches the generator's seedGoals shapes).
const FIELDS_BY_TYPE = {
  "Reps with %": ["sets", "reps", "percent"],
  "Rep Range": ["sets", "minReps", "maxReps"],
  Reps: ["sets", "reps"],
  Time: ["sets", "seconds"],
};

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const roundTo = (x, step) => Math.round(x / step) * step;
const roundField = (field, v) => {
  if (v == null) return null;
  if (field === "percent") return roundTo(v, 2.5);
  if (field === "seconds") return roundTo(v, 5);
  return Math.round(v); // sets / reps / minReps / maxReps
};

// Aggregate the trainer's finalized schemes into per-exerciseType preferred params. Guarded: any failure
// yields empty prefs so it can never throw into the generator.
async function getTrainerSchemePreferences(trainerId) {
  const empty = { byType: {}, sampleSize: 0 };
  try {
    const signals = await ProgrammingSignal.find({ trainerId }).select("final").lean();
    if (!signals.length) return empty;
    const acc = {}; // exerciseType -> field -> [values]
    SCHEME_TYPES.forEach((t) => { acc[t] = {}; FIELDS_BY_TYPE[t].forEach((f) => { acc[t][f] = []; }); });
    signals.forEach((sig) => {
      (sig.final || []).forEach((day) => {
        (day.exercises || []).forEach((ex) => {
          const t = ex && ex.exerciseType;
          if (!acc[t]) return;
          FIELDS_BY_TYPE[t].forEach((f) => {
            const v = Number(ex[f]);
            if (Number.isFinite(v) && v > 0) acc[t][f].push(v);
          });
        });
      });
    });
    const byType = {};
    SCHEME_TYPES.forEach((t) => {
      const params = {};
      let has = false;
      FIELDS_BY_TYPE[t].forEach((f) => {
        const m = median(acc[t][f]);
        if (m != null) { params[f] = roundField(f, m); has = true; }
      });
      if (has) byType[t] = params;
    });
    // Keep rep ranges sane if both bounds were learned.
    const rr = byType["Rep Range"];
    if (rr && rr.minReps != null && rr.maxReps != null && rr.minReps > rr.maxReps) rr.maxReps = rr.minReps;
    return { byType, sampleSize: signals.length };
  } catch (err) {
    console.error("getTrainerSchemePreferences failed (non-blocking):", err.message);
    return empty;
  }
}

// kind (generator scheme kind) -> exerciseType key used above.
const EX_TYPE_FOR_KIND = { percent: "Reps with %", "rep-range": "Rep Range", reps: "Reps", time: "Time" };

// Merge STRATEGY-derived params with the trainer's learned scheme for this kind's exerciseType (per-field,
// falling back to `base` when a field wasn't learned). `useScheme` is null below the confidence threshold.
function schemeParams(kind, base, useScheme) {
  const learned = useScheme && useScheme[EX_TYPE_FOR_KIND[kind]];
  if (!learned) return base;
  const out = { ...base };
  Object.keys(learned).forEach((f) => { if (learned[f] != null) out[f] = learned[f]; });
  return out;
}

module.exports = { getTrainerSchemePreferences, schemeParams };
