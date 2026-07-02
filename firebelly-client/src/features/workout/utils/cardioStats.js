import {
  normalizeCardio,
  parseDurationToSeconds,
  formatSecondsToDuration,
} from "./workoutUtils";

const MILES_PER_KM = 0.621371;

const toMiles = (distance, unit) => {
  const d = Number(distance) || 0;
  switch (unit) {
    case "km":
      return d * MILES_PER_KM;
    case "m":
      return d / 1609.34;
    case "yd":
      return d / 1760;
    case "mi":
    default:
      return d;
  }
};

const milesToUnit = (miles, unit) => (unit === "km" ? miles / MILES_PER_KM : miles);

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayFromMonday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dayFromMonday);
  return d;
};

const round2 = (n) => Number((n || 0).toFixed(2));

// Pace formatted as m:ss per display unit, from canonical seconds-per-mile.
export const formatPacePerUnit = (secPerMile, unit) => {
  if (!secPerMile || !Number.isFinite(secPerMile)) return "";
  const perUnit = unit === "km" ? secPerMile * MILES_PER_KM : secPerMile;
  const m = Math.floor(perUnit / 60);
  const s = Math.round(perUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}/${unit}`;
};

// Pull normalized cardio records (logged results preferred, else plan) from workout docs.
export const extractCardioRecords = (workouts = []) => {
  const records = [];
  (workouts || []).forEach((workout) => {
    const cardio = normalizeCardio(workout?.cardio);
    const isCardio =
      (workout?.workoutType || (cardio?.plan || cardio?.actual ? "Cardio" : "")) === "Cardio";
    if (!isCardio) return;
    const hasActual = cardio?.actual?.distance || cardio?.actual?.duration;
    const entry = hasActual ? cardio.actual : cardio.plan;
    if (!entry) return;
    const distance = Number(entry.distance) || 0;
    const durationSeconds = parseDurationToSeconds(entry.duration || "") || 0;
    if (!distance && !durationSeconds) return;
    const rawDate = workout?.date || workout?.timestamp || workout?.createdAt || null;
    const date = rawDate ? new Date(rawDate) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    const miles = distance ? toMiles(distance, entry.distanceUnit || "mi") : 0;
    records.push({
      date,
      activity: entry.activity || "Cardio",
      distanceUnit: entry.distanceUnit || "mi",
      miles,
      durationSeconds,
      paceSecPerMile: miles > 0 && durationSeconds > 0 ? durationSeconds / miles : null,
      style: entry.style || "",
    });
  });
  return records.sort((a, b) => a.date - b.date);
};

const weeklyBuckets = (records, now, weeks) => {
  const thisWeekStart = startOfWeek(now);
  const list = [];
  const index = new Map();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const ws = new Date(thisWeekStart);
    ws.setDate(ws.getDate() - i * 7);
    const bucket = { weekStart: ws, miles: 0, seconds: 0, count: 0 };
    list.push(bucket);
    index.set(ws.getTime(), bucket);
  }
  records.forEach((r) => {
    const bucket = index.get(startOfWeek(r.date).getTime());
    if (!bucket) return;
    bucket.miles += r.miles;
    bucket.seconds += r.durationSeconds;
    bucket.count += 1;
  });
  return list;
};

// Full cardio summary for the trends view / home card.
export const summarizeCardio = (workouts, { now = new Date(), weeks = 12, unit } = {}) => {
  const records = extractCardioRecords(workouts);

  const unitCounts = records.reduce((acc, r) => {
    const u = r.distanceUnit === "km" ? "km" : "mi";
    acc[u] = (acc[u] || 0) + 1;
    return acc;
  }, {});
  const displayUnit = unit || ((unitCounts.km || 0) > (unitCounts.mi || 0) ? "km" : "mi");

  const weekly = weeklyBuckets(records, now, weeks).map((b) => ({
    weekStart: b.weekStart,
    label: b.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    distance: round2(milesToUnit(b.miles, displayUnit)),
    minutes: Math.round(b.seconds / 60),
    count: b.count,
  }));
  const thisWeek = weekly[weekly.length - 1] || { distance: 0, minutes: 0, count: 0 };

  const activities = [...new Set(records.map((r) => r.activity))];

  const paceByActivity = {};
  activities.forEach((activity) => {
    const series = records
      .filter((r) => r.activity === activity && r.paceSecPerMile)
      .map((r) => ({
        date: r.date,
        label: r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        paceSecPerMile: r.paceSecPerMile,
        paceMinutes: round2((displayUnit === "km" ? r.paceSecPerMile * MILES_PER_KM : r.paceSecPerMile) / 60),
        paceLabel: formatPacePerUnit(r.paceSecPerMile, displayUnit),
      }));
    if (series.length) paceByActivity[activity] = series;
  });

  const prs = { longest: {}, fastest: {}, bestWeek: null };
  activities.forEach((activity) => {
    const recs = records.filter((r) => r.activity === activity);
    const longest = recs.reduce((best, r) => (r.miles > (best?.miles || 0) ? r : best), null);
    if (longest && longest.miles > 0) {
      prs.longest[activity] = {
        distance: round2(milesToUnit(longest.miles, displayUnit)),
        unit: displayUnit,
        date: longest.date,
      };
    }
    const fastest = recs
      .filter((r) => r.paceSecPerMile && r.miles >= 0.5)
      .reduce((best, r) => (r.paceSecPerMile < (best?.paceSecPerMile || Infinity) ? r : best), null);
    if (fastest) {
      prs.fastest[activity] = {
        paceLabel: formatPacePerUnit(fastest.paceSecPerMile, displayUnit),
        date: fastest.date,
        distance: round2(milesToUnit(fastest.miles, displayUnit)),
        unit: displayUnit,
      };
    }
  });
  const bestWeek = weeklyBuckets(records, now, 52).reduce(
    (best, b) => (b.miles > (best?.miles || 0) ? b : best),
    null
  );
  if (bestWeek && bestWeek.miles > 0) {
    prs.bestWeek = {
      distance: round2(milesToUnit(bestWeek.miles, displayUnit)),
      unit: displayUnit,
      weekStart: bestWeek.weekStart,
    };
  }

  return {
    displayUnit,
    totalSessions: records.length,
    thisWeek,
    weekly,
    activities,
    paceByActivity,
    prs,
    formatDuration: formatSecondsToDuration,
  };
};
