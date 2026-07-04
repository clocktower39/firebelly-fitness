// Customizable ordering of the daily overview page by section/card. The `dailyOverviewOrder` user
// setting is a list of section keys; empty = keep the default order (which matches current behavior,
// including the check-in card dropping below the workout once today's check-in is done). The top
// navigation (date selector + weekly status strip) is always pinned above these and is not reorderable.
export const DAILY_OVERVIEW_SECTIONS = [
  { key: "checkin", label: "Daily Check-in" },
  { key: "metrics", label: "Body Metrics" },
  { key: "workouts", label: "Workouts" },
  { key: "cardio", label: "Cardio Summary" },
  { key: "coverage", label: "Daily Coverage", trainerOnly: true },
];

// Canonical/default order of the section keys.
export const DAILY_OVERVIEW_ORDER = DAILY_OVERVIEW_SECTIONS.map((section) => section.key);

export const DAILY_OVERVIEW_LABELS = DAILY_OVERVIEW_SECTIONS.reduce((labels, section) => {
  labels[section.key] = section.label;
  return labels;
}, {});

// Resolve the effective section order from a saved list: keep the saved order (dropping any unknown
// keys), then append any canonical sections the saved list is missing so every section still renders.
export const resolveDailyOverviewOrder = (saved) => {
  if (!Array.isArray(saved) || saved.length === 0) return [...DAILY_OVERVIEW_ORDER];
  const base = saved.filter((key) => DAILY_OVERVIEW_ORDER.includes(key));
  const missing = DAILY_OVERVIEW_ORDER.filter((key) => !base.includes(key));
  return [...base, ...missing];
};
