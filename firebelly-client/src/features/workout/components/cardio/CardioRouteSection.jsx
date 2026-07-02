import React from "react";
import {
  Autocomplete,
  Collapse,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function CardioRouteSection({
  activeCardio,
  activeCardioConfig,
  cardioRouteOptions,
  cardioSectionsOpen,
  cardioSurfaceOptions,
  handleCardioChange,
  shoeMileageHelper,
  shoeOptions = [],
}) {
  return (
    <Grid size={12}>
      <Collapse in={cardioSectionsOpen.route} unmountOnExit>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Route & Gear</Typography>
            <Grid container spacing={2}>
              {activeCardioConfig.showRouteType && cardioRouteOptions.length > 0 && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label={activeCardioConfig.routeTypeLabel}
                    value={activeCardio.routeType}
                    onChange={handleCardioChange("routeType")}
                    fullWidth
                  >
                    {cardioRouteOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              {activeCardioConfig.showSurface && cardioSurfaceOptions.length > 0 && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label={activeCardioConfig.surfaceLabel}
                    value={activeCardio.surface}
                    onChange={handleCardioChange("surface")}
                    fullWidth
                  >
                    {cardioSurfaceOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              {activeCardioConfig.showFootwear && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Autocomplete
                    freeSolo
                    disableClearable
                    options={shoeOptions}
                    inputValue={activeCardio.shoes || ""}
                    onInputChange={(event, newValue) =>
                      handleCardioChange("shoes")({ target: { value: newValue || "" } })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={activeCardio.activity === "Hike" ? "Shoes / footwear" : "Shoes"}
                        placeholder="e.g., Nike Pegasus 41"
                        helperText={shoeMileageHelper}
                        fullWidth
                      />
                    )}
                  />
                </Grid>
              )}
              {activeCardioConfig.showElevation && (
                <>
                  <Grid size={{ xs: 8, sm: 3 }}>
                    <TextField
                      label="Elevation gain"
                      type="number"
                      value={activeCardio.elevationGain}
                      onChange={handleCardioChange("elevationGain")}
                      fullWidth
                      slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 4, sm: 2 }}>
                    <TextField
                      select
                      label="Unit"
                      value={activeCardio.elevationUnit || "ft"}
                      onChange={handleCardioChange("elevationUnit")}
                      fullWidth
                    >
                      <MenuItem value="ft">ft</MenuItem>
                      <MenuItem value="m">m</MenuItem>
                    </TextField>
                  </Grid>
                </>
              )}
              <Grid size={12}>
                <TextField
                  label="Route link"
                  placeholder={activeCardioConfig.routeLinkPlaceholder}
                  value={activeCardio.routeLink}
                  onChange={handleCardioChange("routeLink")}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      </Collapse>
    </Grid>
  );
}
