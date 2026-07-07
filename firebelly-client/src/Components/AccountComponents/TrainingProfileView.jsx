import React from "react";
import { useSelector } from "react-redux";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import ProgramReadinessCard from "./ProgramReadinessCard";

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
  const goals = useSelector((state) => state.goals);
  const latestMetric = useSelector((state) => state.metrics.latestByUser[client?._id]);
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
    tp.notes ||
    tp.confidenceScore != null ||
    tp.willingnessToTrainDaysPerWeek != null ||
    tp.willingnessToChangeNutrition != null ||
    tp.willingnessToDoDislikedExercises != null ||
    tp.biggestObstacle ||
    tp.whatTheyAreNotWillingToChange;

  return (
    <>
    <ProgramReadinessCard user={client} goals={goals} latestWeight={latestMetric?.weight} />
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
          {(tp.confidenceScore != null || tp.willingnessToTrainDaysPerWeek != null ||
            tp.willingnessToChangeNutrition != null || tp.willingnessToDoDislikedExercises != null ||
            tp.biggestObstacle || tp.whatTheyAreNotWillingToChange) && (
            <>
              <Divider />
              {line("Confidence", tp.confidenceScore != null ? `${tp.confidenceScore}/10` : "")}
              {line("Willing to train", tp.willingnessToTrainDaysPerWeek != null ? `${tp.willingnessToTrainDaysPerWeek} days/wk` : "")}
              {line("Nutrition-change willingness", tp.willingnessToChangeNutrition != null ? `${tp.willingnessToChangeNutrition}/10` : "")}
              {line("Disliked-exercise willingness", tp.willingnessToDoDislikedExercises != null ? `${tp.willingnessToDoDislikedExercises}/10` : "")}
              {line("Biggest obstacle", tp.biggestObstacle)}
              {line("Won't change", tp.whatTheyAreNotWillingToChange)}
            </>
          )}
        </Stack>
      )}
    </Paper>
    </>
  );
}
