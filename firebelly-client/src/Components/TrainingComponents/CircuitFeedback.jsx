import React from "react";
import { Grid, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

const OPTIONS = [
  { value: 0, label: "Too easy", color: "secondary" },
  { value: 1, label: "Felt right", color: "primary" },
  { value: 2, label: "Too hard", color: "error" },
];

// Per-circuit, per-exercise difficulty check-in shown while a client performs a workout.
// Every exercise defaults to "Felt right" (1) so non-response is still usable signal —
// the client only taps the exceptions (too easy / too hard) before moving to the next
// circuit. Writes into localTraining[circuitIndex][exerciseIndex].feedback.difficulty.
export default function CircuitFeedback({ circuit, circuitIndex, setLocalTraining }) {
  const rate = (exerciseIndex, value) => {
    setLocalTraining((prev) =>
      prev.map((group, gi) =>
        gi !== circuitIndex
          ? group
          : group.map((ex, ei) =>
              ei !== exerciseIndex
                ? ex
                : {
                    ...ex,
                    feedback: {
                      difficulty: value,
                      comments: ex.feedback?.comments || [],
                    },
                  }
            )
      )
    );
  };

  const rateable = circuit.filter((ex) => ex?.exercise?.exerciseTitle);
  if (!rateable.length) return null;

  return (
    <Grid container size={12} sx={{ justifyContent: "center", padding: "4px 8px 20px" }}>
      <Grid
        container
        size={12}
        component={Paper}
        variant="outlined"
        spacing={1.5}
        sx={{ p: 2, maxWidth: 620 }}
      >
        <Grid container size={12} sx={{ justifyContent: "center" }}>
          <Typography variant="subtitle2">How did this circuit feel?</Typography>
        </Grid>
        {circuit.map((ex, ei) => {
          if (!ex?.exercise?.exerciseTitle) return null;
          const value = ex.feedback?.difficulty ?? 1;
          return (
            <Grid
              container
              size={12}
              key={ex._id || ei}
              spacing={0.5}
              sx={{ alignItems: "center" }}
            >
              <Grid size={{ xs: 12, sm: 5 }}>
                <Typography variant="body2">{ex.exercise.exerciseTitle}</Typography>
              </Grid>
              <Grid
                size={{ xs: 12, sm: 7 }}
                container
                sx={{ justifyContent: { xs: "flex-start", sm: "flex-end" } }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={value}
                  onChange={(_, v) => v !== null && rate(ei, v)}
                >
                  {OPTIONS.map((o) => (
                    <ToggleButton
                      key={o.value}
                      value={o.value}
                      color={o.color}
                      sx={{ textTransform: "none", px: 1.25 }}
                    >
                      {o.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Grid>
            </Grid>
          );
        })}
      </Grid>
    </Grid>
  );
}
