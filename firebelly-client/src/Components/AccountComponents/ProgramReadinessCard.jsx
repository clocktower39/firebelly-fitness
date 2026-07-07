import React from "react";
import { Box, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { computeProgramReadiness } from "../../utils/programReadiness";

const barColor = (v) => (v >= 75 ? "success" : v >= 40 ? "warning" : "error");

const Bar = ({ label, value }) => (
  <Box>
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption">{value}%</Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={value}
      color={barColor(value)}
      sx={{ height: 8, borderRadius: 4 }}
    />
  </Box>
);

// Shows how ready a client's inputs are for program generation (Phase 1: display only).
export default function ProgramReadinessCard({ user, goals, latestWeight, showAssumptions = true }) {
  const r = computeProgramReadiness(user, goals, { latestWeight });
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" gutterBottom>Program readiness</Typography>
      <Stack spacing={1.5}>
        <Bar label="Profile completeness" value={r.profileCompletenessScore} />
        <Bar label="Goal clarity" value={r.goalClarityScore} />

        {r.missingRequiredFields.length > 0 ? (
          <Box>
            <Typography variant="caption" color="text.secondary">Still needed</Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
              {r.missingRequiredFields.map((m) => (
                <Chip key={m} label={m} size="small" color="warning" variant="outlined" />
              ))}
            </Stack>
          </Box>
        ) : (
          <Typography variant="body2" color="success.main">All required inputs are set ✓</Typography>
        )}

        {showAssumptions && r.assumptions.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">If a program were generated now, it would assume:</Typography>
            {r.assumptions.map((a) => (
              <Typography key={a} variant="body2" sx={{ ml: 0.5 }}>• {a}</Typography>
            ))}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
