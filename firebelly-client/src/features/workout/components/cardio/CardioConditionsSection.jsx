import React from "react";
import { Collapse, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { CARDIO_WEATHER_OPTIONS } from "../../utils/workoutUtils";

export default function CardioConditionsSection({
  activeCardio,
  cardioSectionsOpen,
  handleCardioChange,
}) {
  return (
    <Grid size={12}>
      <Collapse in={cardioSectionsOpen.conditions} unmountOnExit>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Conditions</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  select
                  label="Weather"
                  value={activeCardio.weather}
                  onChange={handleCardioChange("weather")}
                  fullWidth
                >
                  {CARDIO_WEATHER_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 8, sm: 4 }}>
                <TextField
                  label="Temperature"
                  type="number"
                  value={activeCardio.temperature}
                  onChange={handleCardioChange("temperature")}
                  fullWidth
                  slotProps={{ htmlInput: { step: "0.1", inputMode: "decimal" } }}
                />
              </Grid>
              <Grid size={{ xs: 4, sm: 3 }}>
                <TextField
                  select
                  label="Unit"
                  value={activeCardio.temperatureUnit || "F"}
                  onChange={handleCardioChange("temperatureUnit")}
                  fullWidth
                >
                  <MenuItem value="F">°F</MenuItem>
                  <MenuItem value="C">°C</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      </Collapse>
    </Grid>
  );
}
