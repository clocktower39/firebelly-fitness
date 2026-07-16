const buildProgramWeeks = (weeksCount, daysPerWeek, existingWeeks = []) => {
  const weeks = [];
  for (let weekIndex = 0; weekIndex < weeksCount; weekIndex += 1) {
    const days = [];
    for (let dayIndex = 0; dayIndex < daysPerWeek; dayIndex += 1) {
      const existingDay = existingWeeks?.[weekIndex]?.[dayIndex];
      days.push({
        dayIndex: dayIndex + 1,
        workoutId: existingDay?.workoutId || null,
        notes: existingDay?.notes || "",
      });
    }
    weeks.push(days);
  }
  return weeks;
};

// Total microcycles (weeks) across all mesocycle blocks.
const mesocycleWeeks = (mesocycles = []) =>
  (mesocycles || []).reduce((sum, m) => sum + (Math.max(1, Number(m?.weeks) || 0)), 0);

// Per-week metadata derived from the mesocycle blocks: which block each week belongs to,
// and whether it is that block's deload week. Used by the builder UI + progression.
const expandMesocycles = (mesocycles = []) => {
  const plan = [];
  let week = 0;
  (mesocycles || []).forEach((m, mi) => {
    const count = Math.max(1, Number(m?.weeks) || 0);
    for (let w = 0; w < count; w += 1) {
      week += 1;
      plan.push({
        week,
        mesocycleIndex: mi,
        type: m?.type || "HYPERTROPHY",
        name: m?.name || "",
        weekInBlock: w + 1,
        blockWeeks: count,
        isDeload: Boolean(m?.deloadLastWeek) && w === count - 1,
      });
    }
  });
  return plan;
};

const validatePublish = (program, { requireWorkout = true } = {}) => {
  const errors = [];
  if (!program.title || !program.title.trim()) {
    errors.push("Title is required to publish.");
  }
  if (!program.weeksCount || program.weeksCount < 1) {
    errors.push("Weeks count must be at least 1.");
  }
  if (!program.daysPerWeek || program.daysPerWeek < 1) {
    errors.push("Days per week must be at least 1.");
  }
  if (requireWorkout) {
    const hasWorkout = program.weeks?.some((week) =>
      week?.some((day) => Boolean(day?.workoutId))
    );
    if (!hasWorkout) {
      errors.push("Assign at least one workout before publishing.");
    }
  }
  return errors;
};

// Program visibility (reach), ordered private < profile < public.
const PROGRAM_VISIBILITIES = ["private", "profile", "public"];
const VISIBILITY_RANK = { private: 0, profile: 1, public: 2 };
// Normalize a possibly-missing value; a published program with no visibility set is treated as
// "profile" (its Product was already live before this feature) — the migration makes it explicit.
const normalizeVisibility = (visibility, { published = false } = {}) => {
  if (PROGRAM_VISIBILITIES.includes(visibility)) return visibility;
  return published ? "profile" : "private";
};
// Listed = shows anywhere (trainer profile or public marketplace).
const isListedVisibility = (visibility) => (VISIBILITY_RANK[visibility] || 0) >= 1;

module.exports = {
  buildProgramWeeks,
  mesocycleWeeks,
  expandMesocycles,
  validatePublish,
  PROGRAM_VISIBILITIES,
  VISIBILITY_RANK,
  normalizeVisibility,
  isListedVisibility,
};
