import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
} from "@mui/material";
import {
  CARDIO_ACTIVITY_OPTIONS,
  computeDurationFromCardio,
  getDerivedMetricErrorText,
  getDurationHelperText,
  hasCardioValue,
  renderAutoAdornment,
  sanitizeCardioForActivity,
} from "../../utils/workoutUtils";

// Fields whose values can be cleared when the activity changes (label used in the confirm dialog).
const ACTIVITY_CLEAR_LABELS = [
  ["style", "session type"],
  ["avgPace", "pace"],
  ["avgSpeed", "speed"],
  ["routeType", "route"],
  ["surface", "surface"],
  ["shoes", "shoes"],
  ["cadence", "cadence"],
  ["strideLength", "stride"],
  ["elevationGain", "elevation gain"],
];

export default function CardioBasicFields({
  activeCardio,
  cardioAuto,
  cardioDistanceUnitOptions,
  cardioStyleOptions,
  cardioViewMode,
  durationHasError,
  handleCardioActivityChange,
  handleCardioChange,
  handleCardioDerivedChange,
  handleCardioDistanceUnitChange,
  primaryCardioMetric,
  primaryCardioMetricAutoKey,
  primaryCardioMetricField,
  primaryCardioMetricHelperText,
  primaryCardioMetricLabel,
  primaryCardioMetricPlaceholder,
  primaryMetricHasError,
}) {
  const [pendingActivity, setPendingActivity] = useState(null);

  const computeClearedFields = (nextActivity) => {
    const next = sanitizeCardioForActivity(activeCardio, nextActivity);
    return ACTIVITY_CLEAR_LABELS.filter(
      ([field]) => hasCardioValue(activeCardio?.[field]) && !hasCardioValue(next?.[field])
    ).map(([, label]) => label);
  };

  // Confirm before an activity switch discards details, instead of silently clearing them.
  const handleActivitySelect = (event) => {
    const nextActivity = event.target.value;
    const cleared = computeClearedFields(nextActivity);
    if (cleared.length > 0) {
      setPendingActivity({ activity: nextActivity, cleared });
    } else {
      handleCardioActivityChange(event);
    }
  };

  const confirmActivityChange = () => {
    if (pendingActivity) {
      handleCardioActivityChange({ target: { value: pendingActivity.activity } });
    }
    setPendingActivity(null);
  };

  // "Enter any two, compute the third": offer to fill duration from distance + pace/speed.
  const canCalcDuration =
    !activeCardio.duration &&
    !!activeCardio.distance &&
    (!!activeCardio.avgPace || !!activeCardio.avgSpeed);
  const handleCalcDuration = () => {
    const computed = computeDurationFromCardio(activeCardio);
    if (computed) handleCardioChange("duration")({ target: { value: computed } });
  };

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField
          select
          label="Activity"
          value={activeCardio.activity}
          onChange={handleActivitySelect}
          helperText="Changing activity clears details that do not apply."
          fullWidth
        >
          {CARDIO_ACTIVITY_OPTIONS.map((activity) => (
            <MenuItem key={activity} value={activity}>
              {activity}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField
          select
          label="Session type"
          value={activeCardio.style}
          onChange={handleCardioChange("style")}
          helperText="Choose a preset or pick a custom type."
          fullWidth
        >
          {cardioStyleOptions.map((style) => (
            <MenuItem key={style} value={style}>
              {style}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 8, sm: 2 }}>
        <TextField
          label="Distance"
          type="number"
          value={activeCardio.distance}
          onChange={handleCardioChange("distance")}
          fullWidth
          slotProps={{ htmlInput: { min: 0, step: "0.01", inputMode: "decimal" } }}
        />
      </Grid>
      <Grid size={{ xs: 4, sm: 2 }}>
        <TextField
          select
          label="Unit"
          value={activeCardio.distanceUnit}
          onChange={handleCardioDistanceUnitChange}
          fullWidth
        >
          {cardioDistanceUnitOptions.map((unit) => (
            <MenuItem key={unit} value={unit}>
              {unit}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <TextField
          label="Duration"
          placeholder="45:00"
          value={activeCardio.duration}
          onChange={handleCardioChange("duration")}
          error={durationHasError}
          helperText={durationHasError ? "Use mm:ss or hh:mm:ss." : getDurationHelperText()}
          fullWidth
          slotProps={
            canCalcDuration
              ? {
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={handleCalcDuration} sx={{ minWidth: 0 }}>
                          Calc
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }
              : undefined
          }
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <TextField
          label={primaryCardioMetricLabel}
          placeholder={primaryCardioMetricPlaceholder}
          type={primaryCardioMetric === "speed" ? "number" : "text"}
          value={activeCardio[primaryCardioMetricField]}
          onChange={handleCardioDerivedChange(primaryCardioMetricField)}
          fullWidth
          slotProps={{
            htmlInput:
              primaryCardioMetric === "speed"
                ? { min: 0, step: "0.1", inputMode: "decimal" }
                : undefined,
            input: {
              endAdornment: renderAutoAdornment(
                cardioAuto?.[cardioViewMode]?.[primaryCardioMetricAutoKey]
              ),
            },
          }}
          error={primaryMetricHasError}
          helperText={
            primaryMetricHasError
              ? getDerivedMetricErrorText(primaryCardioMetric)
              : primaryCardioMetricHelperText
          }
        />
      </Grid>

      <Dialog open={Boolean(pendingActivity)} onClose={() => setPendingActivity(null)}>
        <DialogTitle>Switch to {pendingActivity?.activity}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will clear details that don&apos;t apply to {pendingActivity?.activity}:{" "}
            {pendingActivity?.cleared.join(", ")}.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingActivity(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={confirmActivityChange}>
            Switch &amp; clear
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
