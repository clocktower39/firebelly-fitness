import React, { useState } from "react";
import {
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useCardioSummary from "../../hooks/cardio/useCardioSummary";

const StatTile = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h5">{value}</Typography>
  </Paper>
);

const fmtDate = (date) =>
  date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

export default function CardioDashboard({ client = null }) {
  const { loading, summary, error } = useCardioSummary({ client, weeks: 12 });
  const [paceActivity, setPaceActivity] = useState(null);

  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        Loading cardio…
      </Typography>
    );
  }

  if (error || !summary || summary.totalSessions === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {error ? "Couldn't load cardio data." : "No cardio logged in the last 12 weeks yet."}
        </Typography>
      </Paper>
    );
  }

  const { displayUnit, thisWeek, weekly, prs } = summary;
  const paceActivities = Object.keys(summary.paceByActivity);
  const activePace =
    paceActivity && paceActivities.includes(paceActivity) ? paceActivity : paceActivities[0];
  const paceSeries = activePace ? summary.paceByActivity[activePace] : [];

  return (
    <Stack spacing={2.5} sx={{ width: "100%" }}>
      <Grid container spacing={2}>
        <Grid size={4}>
          <StatTile label="This week" value={`${thisWeek.distance} ${displayUnit}`} />
        </Grid>
        <Grid size={4}>
          <StatTile label="Time" value={summary.formatDuration(thisWeek.minutes * 60) || "0:00"} />
        </Grid>
        <Grid size={4}>
          <StatTile label="Sessions" value={thisWeek.count} />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Weekly distance ({displayUnit})
        </Typography>
        <Box sx={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
              <YAxis tick={{ fontSize: 10 }} width={32} />
              <Tooltip
                formatter={(value) => [`${value} ${displayUnit}`, "Distance"]}
                labelFormatter={(label) => `Week of ${label}`}
              />
              <Bar dataKey="distance" name="Distance" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

      {paceActivities.length > 0 && paceSeries.length >= 2 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1 }}
          >
            <Typography variant="subtitle1">Pace trend (min/{displayUnit})</Typography>
            {paceActivities.length > 1 && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={activePace}
                onChange={(event, value) => value && setPaceActivity(value)}
              >
                {paceActivities.map((activity) => (
                  <ToggleButton key={activity} value={activity} sx={{ px: 1.25 }}>
                    {activity}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Stack>
          <Box sx={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                <YAxis
                  reversed
                  tick={{ fontSize: 10 }}
                  width={32}
                  domain={["auto", "auto"]}
                  allowDecimals
                />
                <Tooltip
                  formatter={(value, name, item) => [item?.payload?.paceLabel || value, "Pace"]}
                  labelFormatter={(label) => label}
                />
                <Line
                  type="monotone"
                  dataKey="paceMinutes"
                  name="Pace"
                  stroke="#2563eb"
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Lower is faster (axis flipped so improvement trends up).
          </Typography>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Personal records
        </Typography>
        <Stack spacing={1.5}>
          {summary.activities.map((activity) => {
            const longest = prs.longest[activity];
            const fastest = prs.fastest[activity];
            if (!longest && !fastest) return null;
            return (
              <Box key={activity}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activity}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px", mt: 0.5 }}>
                  {longest && (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      label={`Longest: ${longest.distance} ${longest.unit} · ${fmtDate(longest.date)}`}
                    />
                  )}
                  {fastest && (
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`Fastest: ${fastest.paceLabel} · ${fmtDate(fastest.date)}`}
                    />
                  )}
                </Stack>
              </Box>
            );
          })}
          {prs.bestWeek && (
            <Chip
              size="small"
              variant="outlined"
              sx={{ alignSelf: "flex-start" }}
              label={`Best week: ${prs.bestWeek.distance} ${prs.bestWeek.unit} · week of ${fmtDate(
                prs.bestWeek.weekStart
              )}`}
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
