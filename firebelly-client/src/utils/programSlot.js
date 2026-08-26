// "Week 2 · Day 5" labelling for a workout that belongs to a program.
//
// Assigned copies stamp programWeek/programDay, but programs assigned before those fields
// existed only carry the position in their title, in whichever shape the generator used at
// the time — "Strength Training: Week 1 Day 1", "Week 3: Day 2", "Larry Wk2 D2 — Lower",
// "Super-set Bodybuiling • Day 1" — so fall back to parsing it. The day-ordinal pattern
// mirrors the server's dayKeyOf in services/reactiveProgression.js.

const WEEK_AND_DAY = /\b(?:week|wk)\s*(\d+)\s*[:·•,\-–—]?\s*d(?:ay)?\s*(\d+)\b/i;
const WEEK_ONLY = /\b(?:week|wk)\s*(\d+)\b/i;
const DAY_ONLY = /\bd(?:ay)?\s*(\d+)\b/i;

const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseTitle = (title) => {
  const text = String(title || "");
  const both = text.match(WEEK_AND_DAY);
  if (both) return { week: positive(both[1]), day: positive(both[2]) };
  return {
    week: positive(text.match(WEEK_ONLY)?.[1]),
    day: positive(text.match(DAY_ONLY)?.[1]),
  };
};

/**
 * Where a workout sits in its program.
 * @returns {{ week: number|null, day: number|null, label: string }|null}
 *   null when the workout carries no usable position.
 */
export const programSlot = (workout) => {
  if (!workout) return null;

  const fromTitle = parseTitle(workout.title);
  const week = positive(workout.programWeek) ?? fromTitle.week;
  const day = positive(workout.programDay) ?? fromTitle.day;

  // A bare day ordinal only means something inside a program — otherwise a one-off called
  // "Day 1 of the taper" would pick up a position it doesn't have.
  if (!workout.programId && week === null) return null;
  if (week === null && day === null) return null;

  const parts = [];
  if (week !== null) parts.push(`Week ${week}`);
  if (day !== null) parts.push(`Day ${day}`);

  return { week, day, label: parts.join(" · ") };
};

export default programSlot;
