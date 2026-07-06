import React from "react";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";

const EXP = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const ACT = { sedentary: "Sedentary", light: "Lightly active", moderate: "Moderately active", very_active: "Very active" };
const STRESS = { low: "Low", moderate: "Moderate", high: "High" };

const chipRow = (label, items) =>
  Array.isArray(items) && items.length ? (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
        {items.map((it) => <Chip key={it} label={it} size="small" />)}
      </Stack>
    </Box>
  ) : null;

const line = (label, value) =>
  value ? (
    <Typography variant="body2">
      <Box component="span" sx={{ color: "text.secondary" }}>{label}: </Box>
      {value}
    </Typography>
  ) : null;

// Read-only client Training Profile for the trainer's client view.
export default function TrainingProfileView({ client }) {
  const tp = client?.trainingProfile || {};
  const hasAny =
    client?.trainingExperience ||
    client?.activityLevel ||
    (client?.injuries || []).length ||
    (client?.mobilityRestrictions || []).length ||
    (client?.equipmentAccess || []).length ||
    tp.sleepHours != null ||
    tp.stressLevel ||
    tp.preferredStyle ||
    tp.aestheticFocus ||
    tp.notes;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" gutterBottom>Training Profile</Typography>
      {!hasAny ? (
        <Typography variant="body2" color="text.secondary">
          This client hasn&apos;t filled out their Training Profile yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
            {line("Experience", EXP[client.trainingExperience])}
            {line("Activity", ACT[client.activityLevel])}
          </Stack>
          {chipRow("Injuries", client.injuries)}
          {chipRow("Mobility restrictions", client.mobilityRestrictions)}
          {chipRow("Equipment access", client.equipmentAccess)}
          {(tp.sleepHours != null || tp.stressLevel || tp.preferredStyle || tp.aestheticFocus || tp.notes) && (
            <>
              <Divider />
              {line("Sleep", tp.sleepHours != null ? `${tp.sleepHours} h/night` : "")}
              {line("Stress", STRESS[tp.stressLevel])}
              {line("Preferred style", tp.preferredStyle)}
              {line("Aesthetic focus", tp.aestheticFocus)}
              {line("Notes", tp.notes)}
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
}
