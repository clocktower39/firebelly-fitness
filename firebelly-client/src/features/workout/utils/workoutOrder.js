// Customizable ordering of the daily overview by workout type. The `workoutTypeOrder` user setting is a
// list of type names (e.g., ["Cardio", "Strength", ...]); empty = no custom order (keep the workouts in
// their existing/insertion order, the default). WORKOUT_TYPE_ORDER is the canonical order shown in the
// settings UI as a starting point.
import { WORKOUT_TYPE_ORDER } from "./workoutColors";

export { WORKOUT_TYPE_ORDER };

// Stable-sort a day's workouts by the user's preferred type order. Returns the input unchanged when no
// custom order is set, so the default matches current behavior. Types missing from the order go last.
export const sortWorkoutsByTypeOrder = (workouts, order) => {
  if (!Array.isArray(workouts) || !Array.isArray(order) || order.length === 0) return workouts;
  const rankByType = new Map(order.map((type, index) => [type, index]));
  const rankOf = (workout) =>
    rankByType.has(workout?.workoutType) ? rankByType.get(workout.workoutType) : order.length + 1;
  // Array.prototype.sort is stable in modern engines, so equal-rank (same type) workouts keep their
  // original relative order.
  return [...workouts].sort((a, b) => rankOf(a) - rankOf(b));
};
