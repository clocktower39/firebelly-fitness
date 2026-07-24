import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Chip, Grid, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import {
  EmojiEvents as EmojiEventsIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { workoutApi } from "../../../../api/workoutApi";
import {
  computeTrainingLoad,
  computeWorkoutLoad,
  detectSetRecords,
  formatVolume,
} from "../../utils/trainingLoad";
import { formatWeightWithUnit } from "../../../../utils/weightUnits";

const isoDay = (value) => String(value instanceof Date ? value.toISOString() : value || "").slice(0, 10);

const formatDay = (value) => {
  const [y, m, d] = isoDay(value).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Live workout-load summary for the completion page: total volume (tonnage), hard sets, reps,
// % of plan, and a delta vs the previous instance of this workout (same program day, else same
// title). The delta is the headline context — raw tonnage means little on its own.
export default function WorkoutLoadPanel({ localTraining, workoutDoc, workoutUser, weightUnit }) {
  const currentUser = useSelector((state) => state.user);
  const [previous, setPrevious] = useState(null);
  const [records, setRecords] = useState(null);

  const load = useMemo(() => computeTrainingLoad(localTraining), [localTraining]);

  // Stable key of the exercises in the workout, so the records fetch reruns only when the
  // exercise set changes — not on every logged rep.
  const exerciseIdsKey = useMemo(() => {
    const ids = new Set();
    (localTraining || []).forEach((circuit) =>
      (Array.isArray(circuit) ? circuit : []).forEach((entry) => {
        if (!entry || entry.isWarmup) return;
        const id = String(entry.exercise?._id || entry.exercise || "");
        if (id) ids.add(id);
      })
    );
    return [...ids].sort().join(",");
  }, [localTraining]);

  const workoutId = workoutDoc?._id;
  const workoutDate = isoDay(workoutDoc?.date);
  useEffect(() => {
    setPrevious(null);
    if (!workoutId || !workoutDate || workoutDoc?.isTemplate) return undefined;

    let cancelled = false;
    const end = new Date(workoutDate);
    end.setDate(end.getDate() - 1);
    const start = new Date(workoutDate);
    start.setDate(start.getDate() - 70);
    const fmt = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ownerId = workoutUser?._id ? String(workoutUser._id) : null;
    const client = ownerId && ownerId !== String(currentUser?._id) ? ownerId : null;

    workoutApi
      .getWorkoutsByRange({
        rangeStart: fmt(start),
        rangeEnd: fmt(end),
        client,
        filters: { includeTemplates: false },
      })
      .then((res) => {
        if (cancelled || !res || res.error) return;
        const title = String(workoutDoc?.title || "").trim().toLowerCase();
        const candidates = (res.workouts || [])
          .filter((w) => w._id !== workoutId && isoDay(w.date) < workoutDate)
          .map((w) => ({ workout: w, load: computeWorkoutLoad(w) }))
          .filter((c) => c.load.volume > 0);
        const byProgramDay = workoutDoc?.programId
          ? candidates.filter(
              (c) =>
                String(c.workout.programId || "") === String(workoutDoc.programId) &&
                Number(c.workout.programDay) === Number(workoutDoc.programDay)
            )
          : [];
        const byTitle = title
          ? candidates.filter((c) => String(c.workout.title || "").trim().toLowerCase() === title)
          : [];
        const pool = byProgramDay.length ? byProgramDay : byTitle;
        if (!pool.length) return;
        const latest = pool.reduce((best, c) => (isoDay(c.workout.date) > isoDay(best.workout.date) ? c : best));
        setPrevious(latest);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [workoutId, workoutDate]);

  // Historical bests for PR badges — bests are from strictly before this workout's date,
  // so reopening an old workout still shows the records it set at the time.
  const ownerId = workoutUser?._id ? String(workoutUser._id) : null;
  useEffect(() => {
    setRecords(null);
    if (!workoutId || !workoutDate || !exerciseIdsKey || workoutDoc?.isTemplate) return undefined;

    let cancelled = false;
    workoutApi
      .getExerciseRecords({
        user: ownerId || undefined,
        exerciseIds: exerciseIdsKey.split(","),
        beforeDate: workoutDate,
        excludeWorkoutId: workoutId,
      })
      .then((res) => {
        if (!cancelled && res && !res.error) setRecords(res.records || {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [workoutId, workoutDate, exerciseIdsKey, ownerId, workoutDoc?.isTemplate]);

  const prs = useMemo(
    () => (records ? detectSetRecords(localTraining, records) : []),
    [localTraining, records]
  );

  const hasAnything = load.volume > 0 || load.hardSets > 0 || load.planned.volume > 0 || load.planned.hardSets > 0;
  if (!hasAnything) return null;

  const planPct = load.planned.volume > 0 ? Math.round((load.volume / load.planned.volume) * 100) : null;
  const setsPlanLine =
    load.planned.volume <= 0 && load.planned.hardSets > 0
      ? `${load.hardSets} of ${load.planned.hardSets} planned sets`
      : null;

  let delta = null;
  if (previous && load.volume > 0) {
    const pct = Math.round(((load.volume - previous.load.volume) / previous.load.volume) * 100);
    delta = { pct, date: formatDay(previous.workout.date) };
  }

  return (
    <Grid container size={12} component={Paper} spacing={1} sx={{ padding: "15px", marginBottom: "15px" }}>
      <Grid container size={12} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography>Workout Load</Typography>
        <Stack direction="row" spacing={0.75}>
          {load.hardSets > 0 && (
            <Chip size="small" variant="outlined" label={`${load.hardSets} hard set${load.hardSets === 1 ? "" : "s"}`} />
          )}
          {load.reps > 0 && <Chip size="small" variant="outlined" label={`${load.reps} reps`} />}
        </Stack>
      </Grid>
      {load.volume > 0 ? (
        <Grid container size={12} sx={{ alignItems: "baseline", gap: 1 }}>
          <Typography variant="h4">{formatVolume(load.volume, weightUnit)}</Typography>
          <Typography variant="caption" color="text.secondary">
            total volume
          </Typography>
        </Grid>
      ) : (
        <Grid container size={12}>
          <Typography variant="body2" color="text.secondary">
            Log your sets to see this workout's load build up.
          </Typography>
        </Grid>
      )}
      {planPct !== null && load.volume > 0 && (
        <Grid container size={12} sx={{ alignItems: "center", gap: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, planPct)}
              color={planPct >= 100 ? "success" : "primary"}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {planPct}% of planned volume
          </Typography>
        </Grid>
      )}
      {setsPlanLine && (
        <Grid container size={12}>
          <Typography variant="caption" color="text.secondary">
            {setsPlanLine}
          </Typography>
        </Grid>
      )}
      {prs.length > 0 && (
        <Grid container size={12} sx={{ gap: 0.75, alignItems: "center" }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", width: "100%" }}>
            <EmojiEventsIcon fontSize="small" sx={{ color: "#f59e0b" }} />
            <Typography variant="body2">
              New record{prs.length === 1 ? "" : "s"}!
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: "6px" }}>
            {prs.map((pr) => {
              const labels = {
                weight: `${pr.title} · ${formatWeightWithUnit(pr.value, weightUnit)}`,
                e1rm: `${pr.title} · est 1RM ${formatWeightWithUnit(pr.value, weightUnit, 0)}`,
                reps: `${pr.title} · ${pr.value} reps`,
                duration: `${pr.title} · ${pr.value}s`,
              };
              const prevLabels = {
                weight: `Heaviest set yet — previous best ${formatWeightWithUnit(pr.prev, weightUnit)}.`,
                e1rm: `Best estimated 1RM yet — previous ${formatWeightWithUnit(pr.prev, weightUnit, 0)}.`,
                reps: `Most reps in a set — previous best ${pr.prev}.`,
                duration: `Longest hold — previous best ${pr.prev}s.`,
              };
              return (
                <Tooltip key={`${pr.exerciseId}-${pr.type}`} title={prevLabels[pr.type]}>
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    icon={<EmojiEventsIcon />}
                    label={labels[pr.type]}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        </Grid>
      )}
      {delta && (
        <Grid container size={12}>
          <Tooltip title={`Compared with this workout on ${delta.date}. Volume only tells a story against your own recent sessions.`}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              {delta.pct > 2 ? (
                <TrendingUpIcon fontSize="small" color="success" />
              ) : delta.pct < -2 ? (
                <TrendingDownIcon fontSize="small" color="warning" />
              ) : (
                <TrendingFlatIcon fontSize="small" color="disabled" />
              )}
              <Typography variant="body2" color="text.secondary">
                {delta.pct > 0 ? "+" : ""}
                {delta.pct}% vs last time ({delta.date})
              </Typography>
            </Stack>
          </Tooltip>
        </Grid>
      )}
    </Grid>
  );
}
