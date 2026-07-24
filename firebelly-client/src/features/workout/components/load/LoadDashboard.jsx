import React from "react";
import { useSelector } from "react-redux";
import { Alert, Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useTrainingLoadSummary from "../../hooks/useTrainingLoadSummary";
import { compactVolume, formatVolume } from "../../utils/trainingLoad";
import { normalizeWeightUnit } from "../../../../utils/weightUnits";

// Progress > Training Load: weekly strength volume vs the client's own recent weeks.
// Verdicts are descriptive pace notes (Strava-style), never injury-risk claims, and only
// appear once there's ~3 weeks of history to compare against.
export default function LoadDashboard({ client = null }) {
  const user = useSelector((state) => state.user);
  const weightUnit = normalizeWeightUnit(user?.workoutWeightUnit);
  const { loading, summary, error } = useTrainingLoadSummary({ client, weeks: 12 });

  if (loading) {
    return (
      <Grid container size={12} sx={{ justifyContent: "center", padding: "25px" }}>
        <Typography variant="body2" color="text.secondary">
          Loading training load…
        </Typography>
      </Grid>
    );
  }

  if (error || !summary || summary.totalWorkouts === 0) {
    return (
      <Grid container size={12} sx={{ padding: "10px" }}>
        <Alert severity="info" sx={{ width: "100%" }}>
          No strength workouts with logged sets in the last 12 weeks yet. Once workouts are
          logged, weekly volume shows up here.
        </Alert>
      </Grid>
    );
  }

  const { weekly, thisWeek, lastWeek, typicalVolume, typicalWeeksUsed, bestWeek, pace } = summary;
  const vol = (v) => formatVolume(v, weightUnit);

  const weeklyData = weekly.map((week) => ({ ...week }));
  const dayData = thisWeek.days.map((day) => ({ ...day }));

  const tooltipFormatter = (value, name, item) => {
    if (name === "volume") {
      const sets = item?.payload?.hardSets;
      return [`${vol(value)}${sets ? ` · ${sets} sets` : ""}`, "Volume"];
    }
    return [value, name];
  };

  return (
    <Grid container size={12} spacing={2}>
      <Grid container size={12}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px" }}>
          <Chip
            color="primary"
            label={`This week: ${vol(thisWeek.volume)} · ${thisWeek.hardSets} sets · ${thisWeek.workouts} workout${thisWeek.workouts === 1 ? "" : "s"}`}
          />
          {lastWeek && lastWeek.volume > 0 && (
            <Chip variant="outlined" label={`Last week: ${vol(lastWeek.volume)}`} />
          )}
          {typicalWeeksUsed > 0 && (
            <Chip variant="outlined" label={`Typical week: ${vol(typicalVolume)}`} />
          )}
          {bestWeek && bestWeek.volume > 0 && (
            <Chip variant="outlined" color="success" label={`Best week: ${vol(bestWeek.volume)}`} />
          )}
        </Stack>
      </Grid>

      <Grid container size={12}>
        {pace ? (
          <Typography variant="body2" color="text.secondary">
            {pace.sentence}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Keep logging — weekly comparisons unlock after a few weeks of history.
          </Typography>
        )}
      </Grid>

      <Grid container size={12} component={Paper} sx={{ padding: "15px" }}>
        <Grid container size={12} sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle1">Weekly volume</Typography>
          <Typography variant="caption" color="text.secondary">
            last 12 weeks
          </Typography>
        </Grid>
        <Box sx={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={12} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => compactVolume(value, weightUnit)}
                width={44}
              />
              <Tooltip formatter={tooltipFormatter} labelFormatter={(label) => `Week of ${label}`} />
              {typicalWeeksUsed > 0 && typicalVolume > 0 && (
                <ReferenceLine
                  y={typicalVolume}
                  stroke="#9e9e9e"
                  strokeDasharray="4 4"
                  label={{ value: "4-wk avg", fontSize: 10, position: "insideTopRight", fill: "#9e9e9e" }}
                />
              )}
              <Bar dataKey="volume" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Grid>

      <Grid container size={12} component={Paper} sx={{ padding: "15px" }}>
        <Grid container size={12}>
          <Typography variant="subtitle1">This week by day</Typography>
        </Grid>
        <Box sx={{ width: "100%", height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => compactVolume(value, weightUnit)}
                width={44}
              />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="volume" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Grid>

      <Grid container size={12}>
        <Typography variant="caption" color="text.secondary">
          Volume = weight × reps across working sets (warm-ups excluded). It's most meaningful
          against your own recent weeks — different workouts aren't directly comparable.
        </Typography>
      </Grid>
    </Grid>
  );
}
