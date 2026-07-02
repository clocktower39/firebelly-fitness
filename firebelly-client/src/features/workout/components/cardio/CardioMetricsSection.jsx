import React from "react";
import {
  Box,
  Collapse,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CARDIO_HR_ZONE_OPTIONS,
  getDerivedMetricErrorText,
  renderAutoAdornment,
} from "../../utils/workoutUtils";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CardioMetricsSection({
  activeCardio,
  activeCardioConfig,
  cardioAuto,
  cardioSectionsOpen,
  cardioViewMode,
  handleCardioChange,
  handleCardioDerivedChange,
  secondaryCardioMetric,
  secondaryCardioMetricAutoKey,
  secondaryCardioMetricField,
  secondaryCardioMetricHelperText,
  secondaryCardioMetricLabel,
  secondaryCardioMetricPlaceholder,
  secondaryMetricHasError,
}) {
  return (
    <Grid size={12}>
      <Collapse in={cardioSectionsOpen.metrics} unmountOnExit>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Metrics</Typography>
            <Grid container spacing={2}>
              {secondaryCardioMetric && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label={secondaryCardioMetricLabel}
                    placeholder={secondaryCardioMetricPlaceholder}
                    type={secondaryCardioMetric === "speed" ? "number" : "text"}
                    value={activeCardio[secondaryCardioMetricField]}
                    onChange={handleCardioDerivedChange(secondaryCardioMetricField)}
                    fullWidth
                    slotProps={{
                      htmlInput:
                        secondaryCardioMetric === "speed"
                          ? { min: 0, step: "0.1", inputMode: "decimal" }
                          : undefined,
                      input: {
                        endAdornment: renderAutoAdornment(
                          cardioAuto?.[cardioViewMode]?.[secondaryCardioMetricAutoKey]
                        ),
                      },
                    }}
                    error={secondaryMetricHasError}
                    helperText={
                      secondaryMetricHasError
                        ? getDerivedMetricErrorText(secondaryCardioMetric)
                        : secondaryCardioMetricHelperText
                    }
                  />
                </Grid>
              )}
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  RPE — effort (1 easy → 10 max)
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={Number(activeCardio.rpe) || null}
                    onChange={(event, value) =>
                      handleCardioChange("rpe")({
                        target: { value: value == null ? "" : String(value) },
                      })
                    }
                    sx={{ flexWrap: "wrap" }}
                  >
                    {RPE_VALUES.map((n) => (
                      <ToggleButton key={n} value={n} sx={{ px: 1.25 }}>
                        {n}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              </Grid>
              <Grid size={{ xs: 8, sm: 3 }}>
                <TextField
                  select
                  label="HR zone"
                  value={activeCardio.hrZone}
                  onChange={handleCardioChange("hrZone")}
                  fullWidth
                >
                  {CARDIO_HR_ZONE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 8, sm: 3 }}>
                <TextField
                  label="Avg heart rate"
                  type="number"
                  value={activeCardio.avgHeartRate}
                  onChange={handleCardioChange("avgHeartRate")}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                />
              </Grid>
              {activeCardioConfig.showCadence && (
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label={activeCardioConfig.cadenceLabel}
                    type="number"
                    value={activeCardio.cadence}
                    onChange={handleCardioChange("cadence")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: "1", inputMode: "numeric" } }}
                  />
                </Grid>
              )}
              {activeCardioConfig.showStride && (
                <>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <TextField
                      label="Stride length"
                      type="number"
                      value={activeCardio.strideLength}
                      onChange={handleCardioChange("strideLength")}
                      fullWidth
                      slotProps={{ htmlInput: { min: 0, step: "0.1", inputMode: "decimal" } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <TextField
                      select
                      label="Stride unit"
                      value={activeCardio.strideUnit}
                      onChange={handleCardioChange("strideUnit")}
                      fullWidth
                    >
                      <MenuItem value="in">in</MenuItem>
                      <MenuItem value="cm">cm</MenuItem>
                      <MenuItem value="m">m</MenuItem>
                    </TextField>
                  </Grid>
                </>
              )}
            </Grid>
          </Stack>
        </Paper>
      </Collapse>
    </Grid>
  );
}
