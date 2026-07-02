import { useMemo } from "react";
import { useSelector } from "react-redux";
import { normalizeCardio } from "../../utils/workoutUtils";

const EMPTY_WORKOUTS = [];

// Finds the athlete's most recent PRIOR cardio session of the current activity, so the editor can
// offer a one-tap "Repeat last …" prefill. Reads whatever workouts are loaded in Redux for the account.
export default function useCardioLastSession({ activeCardio, training, user }) {
  const workouts = useSelector((state) => {
    const accountId = training?.user?._id || user?._id;
    return state.workouts?.[accountId]?.workouts || EMPTY_WORKOUTS;
  });

  return useMemo(() => {
    const activity = activeCardio?.activity;
    const currentId = training?._id;

    const candidates = workouts
      .filter((workout) => workout && workout._id !== currentId)
      .map((workout) => {
        const cardio = normalizeCardio(workout?.cardio);
        const isCardio =
          (workout?.workoutType || (cardio?.plan || cardio?.actual ? "Cardio" : "")) === "Cardio";
        if (!isCardio) return null;
        // Prefer a logged result; fall back to the plan.
        const hasActual = cardio?.actual?.distance || cardio?.actual?.duration;
        const entry = hasActual ? cardio.actual : cardio.plan;
        if (!entry || (!entry.distance && !entry.duration)) return null;
        if (activity && entry.activity !== activity) return null;
        return {
          entry,
          date: workout.date || workout.timestamp || workout.createdAt || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const last = candidates[0];
    if (!last) return { lastCardio: null, lastSessionLabel: "" };

    const dateLabel = last.date
      ? new Date(last.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
    return {
      lastCardio: last.entry,
      lastSessionLabel: `Repeat last ${activity || "session"}${dateLabel ? ` · ${dateLabel}` : ""}`,
    };
  }, [workouts, activeCardio?.activity, training?._id]);
}
