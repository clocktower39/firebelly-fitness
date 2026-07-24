import { fromStoredLbs, displayWeightUnit } from "../../../utils/weightUnits";

// Training-load math for strength workouts. Volume load (tonnage) = Σ weight × reps
// across working sets — warm-ups excluded, matching the progression engine's exemption.
// Tonnage is only ever compared against the same client's own recent history (a leg-press
// week and a pull-up week aren't comparable), so every consumer frames it as a delta.

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Achieved load for one exercise entry. A "hard set" is any set with logged reps or seconds.
export const entryAchievedLoad = (entry) => {
  const reps = Array.isArray(entry?.achieved?.reps) ? entry.achieved.reps : [];
  const weights = Array.isArray(entry?.achieved?.weight) ? entry.achieved.weight : [];
  const seconds = Array.isArray(entry?.achieved?.seconds) ? entry.achieved.seconds : [];
  const totals = { volume: 0, reps: 0, hardSets: 0, workSeconds: 0 };
  const setCount = Math.max(reps.length, seconds.length);
  for (let i = 0; i < setCount; i += 1) {
    const r = num(reps[i]);
    const s = num(seconds[i]);
    totals.volume += r * num(weights[i]);
    totals.reps += r;
    totals.workSeconds += s;
    if (r > 0 || s > 0) totals.hardSets += 1;
  }
  return totals;
};

// Planned load from goals; reps preference mirrors how targets display (exact, else range top,
// else range bottom).
export const entryPlannedLoad = (entry) => {
  const goals = entry?.goals || {};
  const setCount = Math.max(
    num(goals.sets),
    Array.isArray(goals.exactReps) ? goals.exactReps.length : 0
  );
  const totals = { volume: 0, reps: 0, hardSets: 0 };
  for (let i = 0; i < setCount; i += 1) {
    const r = num(goals.exactReps?.[i]) || num(goals.maxReps?.[i]) || num(goals.minReps?.[i]);
    const s = num(goals.seconds?.[i]);
    totals.volume += r * num(goals.weight?.[i]);
    totals.reps += r;
    if (r > 0 || s > 0) totals.hardSets += 1;
  }
  return totals;
};

// Load across a whole training grid (array of circuits), warm-ups excluded.
export const computeTrainingLoad = (training = []) => {
  const totals = {
    volume: 0,
    reps: 0,
    hardSets: 0,
    workSeconds: 0,
    exerciseCount: 0,
    planned: { volume: 0, reps: 0, hardSets: 0 },
  };
  (training || []).forEach((circuit) =>
    (Array.isArray(circuit) ? circuit : []).forEach((entry) => {
      if (!entry || entry.isWarmup) return;
      const achieved = entryAchievedLoad(entry);
      const planned = entryPlannedLoad(entry);
      totals.volume += achieved.volume;
      totals.reps += achieved.reps;
      totals.hardSets += achieved.hardSets;
      totals.workSeconds += achieved.workSeconds;
      totals.planned.volume += planned.volume;
      totals.planned.reps += planned.reps;
      totals.planned.hardSets += planned.hardSets;
      if (achieved.hardSets > 0 || planned.hardSets > 0) totals.exerciseCount += 1;
    })
  );
  return totals;
};

// Load for a workout doc. A workout marked complete with nothing logged is assumed done as
// planned — clients sometimes tick Complete without filling achieved values.
export const computeWorkoutLoad = (workout) => {
  const totals = computeTrainingLoad(workout?.training);
  const usedPlanned =
    Boolean(workout?.complete) && totals.volume === 0 && totals.hardSets === 0 &&
    (totals.planned.volume > 0 || totals.planned.hardSets > 0);
  if (!usedPlanned) return { ...totals, usedPlanned };
  return {
    ...totals,
    volume: totals.planned.volume,
    reps: totals.planned.reps,
    hardSets: totals.planned.hardSets,
    usedPlanned,
  };
};

// Workout dates are UTC-anchored (stored as UTC midnight); the calendar day is the ISO
// date part. Week buckets start Monday, matching cardioStats.
const workoutDayDate = (workout) => {
  const raw = workout?.date;
  if (!raw) return null;
  const key = String(raw instanceof Date ? raw.toISOString() : raw).slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayFromMonday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dayFromMonday);
  return d;
};

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const PACE_SENTENCES = {
  ahead: "Ahead of your usual pace — nice work, just make sure recovery keeps up.",
  onPace: "Right in line with your recent weeks.",
  lighter: "A lighter week so far — down weeks help you come back stronger.",
};

// Weekly load summary for the trends view / home card. Verdicts are descriptive
// (you vs your own recent weeks) and only appear once there's enough history —
// never framed as injury risk.
export const summarizeTrainingLoad = (workouts, { now = new Date(), weeks = 12 } = {}) => {
  const records = [];
  (workouts || []).forEach((workout) => {
    if (workout?.isTemplate) return;
    const date = workoutDayDate(workout);
    if (!date) return;
    const load = computeWorkoutLoad(workout);
    if (load.volume <= 0 && load.hardSets <= 0) return;
    records.push({ date, load, workout });
  });

  const thisWeekStart = startOfWeek(now);
  const weekly = [];
  const index = new Map();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = new Date(thisWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const bucket = {
      weekStart,
      label: weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      volume: 0,
      hardSets: 0,
      reps: 0,
      workouts: 0,
    };
    weekly.push(bucket);
    index.set(weekStart.getTime(), bucket);
  }

  const days = DAY_LABELS.map((label) => ({ label, volume: 0, hardSets: 0 }));
  records.forEach(({ date, load }) => {
    const bucket = index.get(startOfWeek(date).getTime());
    if (!bucket) return;
    bucket.volume += load.volume;
    bucket.hardSets += load.hardSets;
    bucket.reps += load.reps;
    bucket.workouts += 1;
    if (bucket.weekStart.getTime() === thisWeekStart.getTime()) {
      const dayIndex = (date.getDay() + 6) % 7;
      days[dayIndex].volume += load.volume;
      days[dayIndex].hardSets += load.hardSets;
    }
  });

  const thisWeek = { ...weekly[weekly.length - 1], days };
  const lastWeek = weekly.length > 1 ? weekly[weekly.length - 2] : null;

  // "Typical week" = average of the trailing up-to-4 completed weeks that had any training.
  const trailing = weekly.slice(0, -1).slice(-4).filter((week) => week.volume > 0);
  const typicalVolume = trailing.length
    ? trailing.reduce((sum, week) => sum + week.volume, 0) / trailing.length
    : 0;

  let pace = null;
  if (trailing.length >= 3 && typicalVolume > 0) {
    const elapsedDays = ((new Date(now).getDay() + 6) % 7) + 1;
    const expectedSoFar = (typicalVolume * elapsedDays) / 7;
    const ratio = expectedSoFar > 0 ? thisWeek.volume / expectedSoFar : 0;
    const verdict = ratio > 1.25 ? "ahead" : ratio < 0.75 ? "lighter" : "onPace";
    pace = { ratio, verdict, sentence: PACE_SENTENCES[verdict] };
  }

  const bestWeek = weekly.reduce(
    (best, week) => (week.volume > (best?.volume || 0) ? week : best),
    null
  );

  return {
    totalWorkouts: records.length,
    weekly,
    thisWeek,
    lastWeek,
    typicalVolume,
    typicalWeeksUsed: trailing.length,
    bestWeek,
    pace,
  };
};

// "12,450 lb" in the viewer's unit, from stored lbs.
export const formatVolume = (volumeLbs, unit = "lbs") => {
  const converted = Number(fromStoredLbs(volumeLbs, unit)) || 0;
  return `${Math.round(converted).toLocaleString()} ${displayWeightUnit(unit)}`;
};

// Chart-tick form: "12.4k".
export const compactVolume = (volumeLbs, unit = "lbs") => {
  const converted = Number(fromStoredLbs(volumeLbs, unit)) || 0;
  if (converted >= 1000) return `${(converted / 1000).toFixed(1)}k`;
  return `${Math.round(converted)}`;
};
