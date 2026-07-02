import React from "react";
import { Link } from "react-router-dom";
import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useCardioSummary from "../../hooks/cardio/useCardioSummary";

// Compact cardio summary for the Home screen; links into Progress > Cardio. Renders nothing until it
// has cardio data, so it stays out of the way for non-cardio users.
export default function CardioSummaryCard({ client = null }) {
  const { loading, summary } = useCardioSummary({ client, weeks: 8 });
  if (loading || !summary || summary.totalSessions === 0) return null;

  const { displayUnit, thisWeek, weekly, prs } = summary;
  const to = `/progress?${client ? `client=${client}&` : ""}tab=cardio`;
  const firstFastest = summary.activities.map((a) => prs.fastest[a]).find(Boolean);
  const firstLongest = summary.activities.map((a) => prs.longest[a]).find(Boolean);

  return (
    <Grid container size={12} sx={{ marginTop: "10px" }}>
      <Paper elevation={5} sx={{ width: "100%", padding: "5px", margin: "5px" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
        >
          <Typography variant="h6" color="text.primary">
            Cardio
          </Typography>
          <Button component={Link} to={to} size="small" variant="outlined">
            View Cardio
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          This week: {thisWeek.distance} {displayUnit} ·{" "}
          {summary.formatDuration(thisWeek.minutes * 60) || "0:00"} · {thisWeek.count}{" "}
          {thisWeek.count === 1 ? "session" : "sessions"}
        </Typography>
        <Box sx={{ width: "100%", height: 72, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekly} margin={{ top: 4, right: 6, left: -34, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 9 }} width={28} />
              <Tooltip
                formatter={(value) => [`${value} ${displayUnit}`, "Distance"]}
                labelFormatter={(label) => `Week of ${label}`}
              />
              <Area
                type="monotone"
                dataKey="distance"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
        {(firstFastest || firstLongest) && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "6px", mt: 0.5 }}>
            {firstFastest && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`PR pace ${firstFastest.paceLabel}`}
              />
            )}
            {firstLongest && (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={`Longest ${firstLongest.distance} ${firstLongest.unit}`}
              />
            )}
          </Stack>
        )}
      </Paper>
    </Grid>
  );
}
