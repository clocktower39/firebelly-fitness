import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useTrainingLoadSummary from "../../hooks/useTrainingLoadSummary";
import { compactVolume, formatVolume } from "../../utils/trainingLoad";
import { normalizeWeightUnit } from "../../../../utils/weightUnits";

// Compact weekly training-load summary for the Home screen; links into Progress > Training Load.
// Renders nothing until there's strength data, so it stays out of the way for non-lifters.
export default function LoadSummaryCard({ client = null }) {
  const user = useSelector((state) => state.user);
  const weightUnit = normalizeWeightUnit(user?.workoutWeightUnit);
  const { loading, summary } = useTrainingLoadSummary({ client, weeks: 8 });
  if (loading || !summary || summary.totalWorkouts === 0) return null;

  const { thisWeek, lastWeek, pace } = summary;
  const to = `/progress?${client ? `client=${client}&` : ""}tab=load`;

  let deltaChip = null;
  if (lastWeek && lastWeek.volume > 0) {
    const pct = Math.round(((thisWeek.volume - lastWeek.volume) / lastWeek.volume) * 100);
    deltaChip = `${pct > 0 ? "+" : ""}${pct}% vs last week`;
  }

  return (
    <Grid container size={12} sx={{ marginTop: "10px" }}>
      <Paper elevation={5} sx={{ width: "100%", padding: "5px", margin: "5px" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="h6" color="text.primary">
            Training Load
          </Typography>
          <Button component={Link} to={to} size="small" variant="outlined">
            View Load
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          This week: {formatVolume(thisWeek.volume, weightUnit)} · {thisWeek.hardSets} sets ·{" "}
          {thisWeek.workouts} workout{thisWeek.workouts === 1 ? "" : "s"}
        </Typography>
        <Box sx={{ width: "100%", height: 72, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={thisWeek.days} margin={{ top: 4, right: 6, left: -30, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis
                tick={{ fontSize: 9 }}
                tickFormatter={(value) => compactVolume(value, weightUnit)}
                width={34}
              />
              <Tooltip formatter={(value) => [formatVolume(value, weightUnit), "Volume"]} />
              <Bar dataKey="volume" fill="#f97316" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "6px", mt: 0.5, alignItems: "center" }}>
          {deltaChip && <Chip size="small" variant="outlined" label={deltaChip} />}
          {pace && (
            <Typography variant="caption" color="text.secondary">
              {pace.sentence}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Grid>
  );
}
