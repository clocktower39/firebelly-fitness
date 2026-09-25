import { useEffect, useState } from "react";
import { workoutApi } from "../../../../api/workoutApi";
import { summarizeCardio } from "../../utils/cardioStats";

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Fetches the last `weeks` of workouts for the account and returns a cardio summary (see cardioStats).
export default function useCardioSummary({ client = null, weeks = 12 } = {}) {
  const [state, setState] = useState({ loading: true, summary: null, error: false });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, summary: null, error: false });
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - weeks * 7);

    workoutApi
      .getWorkoutsByRange({
        rangeStart: fmtDate(start),
        rangeEnd: fmtDate(now),
        client,
        // Performed work only. extractCardioRecords falls back to the PLANNED distance/duration
        // when nothing was logged, so without this a run that never happened charted as if it
        // had — at exactly its prescribed pace.
        filters: { includeTemplates: false, includeIncomplete: false },
      })
      .then((res) => {
        if (cancelled) return;
        if (!res || res.error) {
          setState({ loading: false, summary: null, error: true });
          return;
        }
        setState({
          loading: false,
          summary: summarizeCardio(res.workouts || [], { now, weeks }),
          error: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, summary: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [client, weeks]);

  return state;
}
