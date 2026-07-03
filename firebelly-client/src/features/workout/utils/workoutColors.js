// Per-account workout color-coding. Stored as a flat map on the `workoutColors` user setting:
//   { "type:Strength": "#e53935", "Sports:Jiu-Jitsu": "#8e24aa", "Cardio:Run": "#1e88e5", ... }
// A specific sport/style/activity color wins over the type-level color; otherwise callers fall back to
// the built-in theme default for that type.
import { SPORTS_LIST } from "./sportsUtils";
import { YOGA_STYLES } from "./yogaUtils";
import { PILATES_STYLES } from "./pilatesUtils";
import { CARDIO_ACTIVITY_OPTIONS } from "./workoutUtils";

// A curated palette (Material 600-ish) of distinct, pleasant colors for quick picking.
export const WORKOUT_COLOR_PALETTE = [
  "#e53935", // red
  "#d81b60", // pink
  "#8e24aa", // purple
  "#5e35b1", // deep purple
  "#3949ab", // indigo
  "#1e88e5", // blue
  "#039be5", // light blue
  "#00acc1", // cyan
  "#00897b", // teal
  "#43a047", // green
  "#7cb342", // light green
  "#c0ca33", // lime
  "#fdd835", // yellow
  "#ffb300", // amber
  "#fb8c00", // orange
  "#f4511e", // deep orange
  "#6d4c41", // brown
  "#757575", // grey
  "#546e7a", // blue grey
];

// The five workout types, in display order.
export const WORKOUT_TYPE_ORDER = ["Strength", "Cardio", "Sports", "Yoga", "Pilates"];

// Types that support per-sub-value overrides (a specific sport / style / activity), with their option
// lists for the picker. Strength has no sub-value.
export const SUB_VALUE_TYPES = [
  { type: "Sports", label: "Sport", options: SPORTS_LIST },
  { type: "Cardio", label: "Activity", options: CARDIO_ACTIVITY_OPTIONS },
  { type: "Yoga", label: "Style", options: YOGA_STYLES },
  { type: "Pilates", label: "Style", options: PILATES_STYLES },
];

export const typeColorKey = (type) => `type:${type}`;
export const subColorKey = (type, value) => `${type}:${value}`;

// The specific sport / style / activity for a workout (the thing a sub-value color keys off of).
export const getWorkoutColorSubValue = (workout) => {
  if (!workout) return "";
  switch (workout.workoutType) {
    case "Sports":
      return workout.sports?.sport || "";
    case "Yoga":
      return workout.yoga?.style || "";
    case "Pilates":
      return workout.pilates?.style || "";
    case "Cardio":
      return workout.cardio?.actual?.activity || workout.cardio?.plan?.activity || "";
    default:
      return "";
  }
};

// Resolve a workout's custom color, or null if the account hasn't assigned one (caller falls back to the
// built-in type default). Specific sub-value color wins over the type-level color.
export const resolveWorkoutColor = (workout, colorMap) => {
  if (!workout || !colorMap || typeof colorMap !== "object") return null;
  const type = workout.workoutType || "Strength";
  const sub = getWorkoutColorSubValue(workout);
  if (sub && colorMap[subColorKey(type, sub)]) return colorMap[subColorKey(type, sub)];
  if (colorMap[typeColorKey(type)]) return colorMap[typeColorKey(type)];
  return null;
};

// Existing sub-value overrides in the map, parsed for display (excludes the `type:` entries).
export const listSubValueColors = (colorMap) => {
  if (!colorMap || typeof colorMap !== "object") return [];
  return Object.keys(colorMap)
    .filter((key) => key && !key.startsWith("type:") && key.includes(":"))
    .map((key) => {
      const idx = key.indexOf(":");
      return { key, type: key.slice(0, idx), value: key.slice(idx + 1), color: colorMap[key] };
    });
};
