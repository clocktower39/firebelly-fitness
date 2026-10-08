const ExerciseMax = require("../models/exerciseMax");
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const Relationship = require("../models/relationship");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const exIdOf = (entry) => String(entry?.exercise?._id || entry?.exercise || "");

// Epley. Only trusted up to ~12 reps: past that the estimate inflates badly, and a 20-rep
// set says more about conditioning than about a one-rep max.
const MAX_REPS_FOR_ESTIMATE = 12;
// A max older than this is history, not a current capability: percentages built on a single
// from two years ago prescribe loads the lifter can no longer move.
const RECENT_WINDOW_DAYS = 365;
// Epley, with the r=1 case pinned. The bare formula returns weight × 1.033 for a single,
// so a logged 300 × 1 would "estimate" to 310 — a one-rep max IS the weight lifted.
const epley = (weight, reps) =>
  reps <= 1 ? Math.round(weight * 10) / 10 : Math.round(weight * (1 + reps / 30) * 10) / 10;

const ensureAccess = async (user, targetId) => {
  if (String(user._id) === String(targetId)) return true;
  if (!user?.isTrainer) return false;
  return Boolean(await Relationship.findOne({ trainer: user._id, client: targetId, accepted: true }));
};

// Walk a lifter's logged history and work out, per loaded exercise, the best evidence for a
// one-rep max. Returns the best true single AND the best estimate separately rather than
// collapsing them, because they often disagree and the trainer should see which is which.
const seedFromHistory = async (userId) => {
  const docs = await Training.find({ user: userId, isTemplate: { $ne: true } })
    .select("date training complete")
    .lean();

  const byExercise = new Map();
  // Which lifts actually NEED a max: the ones a percentage-based entry will try to resolve.
  const needsMax = new Set();
  for (const d of docs) {
    for (const circuit of d.training || []) {
      for (const e of circuit || []) {
        if (e?.isWarmup) continue;
        const id = exIdOf(e);
        if (!id) continue;
        if (e.exerciseType === "Reps with %") needsMax.add(id);
        const weights = (e.achieved?.weight || []).map(num);
        const reps = (e.achieved?.reps || []).map(num);
        for (let i = 0; i < weights.length; i++) {
          const w = weights[i];
          const r = reps[i];
          if (w <= 0 || r <= 0) continue;
          if (!byExercise.has(id)) byExercise.set(id, { sets: [] });
          byExercise.get(id).sets.push({ w, r, date: d.date });
        }
      }
    }
  }

  // Best true single and best estimate within a set of sets.
  const best = (sets) => {
    const singles = sets.filter((s) => s.r === 1);
    const estimable = sets.filter((s) => s.r > 1 && s.r <= MAX_REPS_FOR_ESTIMATE);
    return {
      single: singles.length
        ? singles.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.date > a.date) ? b : a))
        : null,
      estimate: estimable.length
        ? estimable.map((s) => ({ ...s, est: epley(s.w, s.r) })).reduce((a, b) => (b.est > a.est ? b : a))
        : null,
    };
  };
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * 86400000;

  const out = new Map();
  for (const [id, { sets }] of byExercise) {
    const recentSets = sets.filter((s) => new Date(s.date).valueOf() >= cutoff);
    const r = best(recentSets);
    const a = best(sets);
    const lastSet = sets.reduce((x, y) => (y.date > x.date ? y : x));

    // Prefer recent evidence; fall back to all-time only when the window is empty, and flag it.
    const pick = r.single || r.estimate ? r : a;
    const fromRecent = Boolean(r.single || r.estimate);

    // Take whichever is HIGHER: a logged single, or an estimate from a rep set.
    //
    // Preferring a single outright looks reasonable and is wrong, because most logged singles
    // are warm-ups inside a ramp (68 x 3, 88 x 2, 98 x 1, 135 x 5): the "tested single" is
    // 98 while the working set says ~157. Trusting the single there understates the lifter by
    // a third. A single only wins when it really is the strongest thing they did.
    const singleValue = pick.single ? pick.single.w : null;
    const estimateValue = pick.estimate ? pick.estimate.est : null;
    const useSingle = singleValue != null && (estimateValue == null || singleValue >= estimateValue);
    const suggested = useSingle ? singleValue : estimateValue;

    out.set(id, {
      bestSingle: pick.single ? { weight: pick.single.w, reps: 1, date: pick.single.date } : null,
      bestEstimate: pick.estimate
        ? { value: pick.estimate.est, fromWeight: pick.estimate.w, fromReps: pick.estimate.r, date: pick.estimate.date, formula: "epley" }
        : null,
      // All-time context, shown alongside when it disagrees with the recent number.
      allTimeBest: a.single ? { weight: a.single.w, reps: 1, date: a.single.date }
        : a.estimate ? { weight: a.estimate.est, reps: a.estimate.r, date: a.estimate.date } : null,
      lastSet: { weight: lastSet.w, reps: lastSet.r, date: lastSet.date },
      lastTrainedAt: lastSet.date,
      loggedSets: sets.length,
      suggested,
      suggestedSource: suggested == null ? null : useSingle ? "tested" : "estimated",
      suggestedFromRecent: fromRecent,
      needsMax: needsMax.has(id),
    });
  }
  // Lifts referenced by a percentage entry but never loaded still need to be offerable.
  for (const id of needsMax) {
    if (out.has(id)) continue;
    out.set(id, { bestSingle: null, bestEstimate: null, allTimeBest: null, lastSet: null,
      lastTrainedAt: null, loggedSets: 0, suggested: null, suggestedSource: null,
      suggestedFromRecent: false, needsMax: true });
  }
  return out;
};

// Every lift the person has ever loaded, with whatever max is stored and whatever their
// history suggests. One call powers the whole entry page.
const maxes_for_user = async (req, res, next) => {
  try {
    const user = res.locals.user;
    const targetId = req.body?.clientId || String(user._id);
    if (!(await ensureAccess(user, targetId))) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const [stored, history] = await Promise.all([
      ExerciseMax.find({ userId: targetId }).lean(),
      seedFromHistory(targetId),
    ]);
    const storedBy = new Map(stored.map((m) => [String(m.exerciseId), m]));

    const ids = [...new Set([...storedBy.keys(), ...history.keys()])];
    const exercises = await Exercise.find({ _id: { $in: ids } })
      .select("exerciseTitle equipment familyKey")
      .lean();
    const exBy = new Map(exercises.map((e) => [String(e._id), e]));

    const rows = ids
      .map((id) => {
        const ex = exBy.get(id);
        const h = history.get(id) || null;
        const s = storedBy.get(id) || null;
        return {
          exerciseId: id,
          exerciseTitle: ex?.exerciseTitle || "(removed exercise)",
          equipment: ex?.equipment || [],
          stored: s
            ? { value: s.value, testedAt: s.testedAt, source: s.source, note: s.note, updatedAt: s.updatedAt }
            : null,
          bestSingle: h?.bestSingle || null,
          bestEstimate: h?.bestEstimate || null,
          allTimeBest: h?.allTimeBest || null,
          lastSet: h?.lastSet || null,
          lastTrainedAt: h?.lastTrainedAt || null,
          loggedSets: h?.loggedSets || 0,
          suggested: h?.suggested ?? null,
          suggestedSource: h?.suggestedSource || null,
          suggestedFromRecent: h?.suggestedFromRecent ?? false,
          needsMax: h?.needsMax ?? false,
        };
      })
      // Relevance, not raw weight. Sorting by weight buried the squat and bench under
      // hip thrusts and leg presses — a 725 x 4 hip thrust "estimates" to 820 and is useless
      // as a percentage base. Order: what a program needs, then what is on record, then what
      // they trained most recently.
      .sort((a, b) => {
        if (a.needsMax !== b.needsMax) return a.needsMax ? -1 : 1;
        if (!!a.stored !== !!b.stored) return a.stored ? -1 : 1;
        const at = a.lastTrainedAt ? new Date(a.lastTrainedAt).valueOf() : 0;
        const bt = b.lastTrainedAt ? new Date(b.lastTrainedAt).valueOf() : 0;
        if (at !== bt) return bt - at;
        return a.exerciseTitle.localeCompare(b.exerciseTitle);
      });

    return res.json({ clientId: String(targetId), rows });
  } catch (err) {
    return next(err);
  }
};

// Upsert one max. A null/"" value removes it, so the same call clears.
const set_max = async (req, res, next) => {
  try {
    const user = res.locals.user;
    const { exerciseId, value, testedAt, source, note } = req.body;
    const targetId = req.body?.clientId || String(user._id);
    if (!(await ensureAccess(user, targetId))) {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    if (!(await Exercise.exists({ _id: exerciseId }))) {
      return res.status(404).json({ error: "Exercise not found." });
    }

    if (value === null || value === "" || typeof value === "undefined") {
      await ExerciseMax.deleteOne({ userId: targetId, exerciseId });
      return res.json({ status: "cleared", exerciseId });
    }

    const doc = await ExerciseMax.findOneAndUpdate(
      { userId: targetId, exerciseId },
      {
        $set: {
          value: Number(value),
          testedAt: testedAt || null,
          source: source || "entered",
          note: note || "",
          setBy: user._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ status: "saved", max: doc });
  } catch (err) {
    return next(err);
  }
};

// The caller's own maxes, keyed by exercise — for anything that needs to resolve a percentage.
const list_my_maxes = async (req, res, next) => {
  try {
    const rows = await ExerciseMax.find({ userId: res.locals.user._id })
      .populate("exerciseId", "exerciseTitle")
      .lean();
    return res.json(
      rows.map((r) => ({
        exerciseId: String(r.exerciseId?._id || r.exerciseId),
        exerciseTitle: r.exerciseId?.exerciseTitle || "",
        value: r.value,
        testedAt: r.testedAt,
        source: r.source,
      }))
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { maxes_for_user, set_max, list_my_maxes, seedFromHistory, epley };
