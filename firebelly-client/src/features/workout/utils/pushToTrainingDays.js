// "Push to later training days": move each selected day forward N sessions along the client's
// own training schedule, instead of by a fixed number of calendar days.
//
// Missing one session (steps=1) on a Wed/Fri/Sun schedule sends Wed→Fri, Fri→Sun, Sun→next Wed;
// missing two (steps=2) sends Wed→Sun, Fri→next Wed. Advancing every day by the SAME number of
// sessions keeps the plan's shape — gaps between workouts survive and nothing lands earlier
// than it started. The trailing cursor guard stops two source days from colliding onto one
// date when their sequences would otherwise converge (e.g. a stray Thursday workout).
//
// Pure UTC date math (no dayjs) so the mapping is dependency-free and directly testable; the
// app's dates are UTC day-keys throughout, and UTC has no DST to skew a day-add.
const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcMs = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
};

const toKey = (ms) => new Date(ms).toISOString().slice(0, 10);

// dayKeys: "YYYY-MM-DD" strings, oldest first (one per day that has selected workouts)
// trainingDays: weekday numbers the client trains on (0=Sun … 6=Sat)
// returns: { [dayKey]: "YYYY-MM-DD" }
export const computePushTargets = ({ dayKeys = [], trainingDays = [], steps = 1 } = {}) => {
  if (!dayKeys.length || !trainingDays.length || !steps) return {};
  const daySet = new Set(trainingDays.map(Number));
  const nextTrainingDay = (ms) => {
    let next = ms + DAY_MS;
    while (!daySet.has(new Date(next).getUTCDay())) next += DAY_MS;
    return next;
  };

  const targets = {};
  let cursor = null;
  dayKeys.forEach((key) => {
    let candidate = toUtcMs(key);
    for (let i = 0; i < steps; i += 1) candidate = nextTrainingDay(candidate);
    if (cursor !== null && candidate <= cursor) candidate = nextTrainingDay(cursor);
    targets[key] = toKey(candidate);
    cursor = candidate;
  });
  return targets;
};
