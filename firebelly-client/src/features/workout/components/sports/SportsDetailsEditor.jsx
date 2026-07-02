import React from "react";
import { Add, RemoveCircle, Star, StarBorder } from "@mui/icons-material";
import {
  Box,
  Button,
  Collapse,
  Grid,
  IconButton,
  ListSubheader,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  SPORTS_ENVIRONMENT_OPTIONS,
  SPORTS_HR_ZONE_OPTIONS,
  SPORTS_LIST,
  SPORTS_OPTIONAL_SECTIONS,
  SPORTS_RESULT_OPTIONS,
  SPORTS_SESSION_TYPES,
  SPORTS_SURFACE_OPTIONS,
  SPORTS_WEATHER_OPTIONS,
  isCompetitiveSession,
} from "../../utils/sportsUtils";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function SportsDetailsEditor({
  sports,
  sectionsOpen,
  favoriteSports,
  onToggleFavoriteSport,
  handleChange,
  toggleSection,
  addStat,
  removeStat,
  changeStat,
}) {
  const competitive = isCompetitiveSession(sports.sessionType);
  const favList = (favoriteSports || []).filter((option) => SPORTS_LIST.includes(option));
  const otherSports = SPORTS_LIST.filter((option) => !favList.includes(option));
  const isCurrentFavorite = favList.includes(sports.sport);
  const handleToggleFavoriteSport = () => onToggleFavoriteSport(sports.sport);

  return (
    <>
      <Grid size={12}>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.25}>
              <Typography variant="h6">Sports</Typography>
              <Typography variant="body2" color="text.secondary">
                Log your sports session.
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <TextField
                    select
                    label="Sport"
                    value={sports.sport}
                    onChange={handleChange("sport")}
                    fullWidth
                  >
                    {favList.length > 0 && <ListSubheader>Favorites</ListSubheader>}
                    {favList.map((option) => (
                      <MenuItem key={`fav-${option}`} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                    {favList.length > 0 && <ListSubheader>All sports</ListSubheader>}
                    {otherSports.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Tooltip title={isCurrentFavorite ? "Unfavorite" : "Favorite this sport"}>
                    <IconButton
                      size="small"
                      onClick={handleToggleFavoriteSport}
                      aria-label="favorite sport"
                    >
                      {isCurrentFavorite ? (
                        <Star fontSize="small" color="warning" />
                      ) : (
                        <StarBorder fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  label="Session type"
                  value={sports.sessionType}
                  onChange={handleChange("sessionType")}
                  fullWidth
                >
                  {SPORTS_SESSION_TYPES.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Duration (min)"
                  type="number"
                  value={sports.durationMinutes}
                  onChange={handleChange("durationMinutes")}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Intensity — RPE (1 easy → 10 max)
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={Number(sports.rpe) || null}
                    onChange={(event, value) => handleChange("rpe")(value == null ? "" : String(value))}
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
            </Grid>

            {competitive && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">Result</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        select
                        label="Result"
                        value={sports.result}
                        onChange={handleChange("result")}
                        fullWidth
                      >
                        {SPORTS_RESULT_OPTIONS.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        label="Score"
                        placeholder="6-4, 6-3"
                        value={sports.score}
                        onChange={handleChange("score")}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        label="Opponent / partner"
                        value={sports.opponent}
                        onChange={handleChange("opponent")}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        label="Position"
                        value={sports.position}
                        onChange={handleChange("position")}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            )}

            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Add details
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px" }}>
                {SPORTS_OPTIONAL_SECTIONS.map((section) => (
                  <Button
                    key={section.key}
                    variant={sectionsOpen[section.key] ? "contained" : "outlined"}
                    color={sectionsOpen[section.key] ? "primary" : "inherit"}
                    size="small"
                    onClick={() => toggleSection(section.key)}
                    startIcon={
                      <Add
                        sx={{
                          transform: sectionsOpen[section.key] ? "rotate(45deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      />
                    }
                  >
                    {section.label}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <TextField
              label="Focus / skills worked on"
              placeholder="e.g., defense, serve, footwork"
              value={sports.skills}
              onChange={handleChange("skills")}
              fullWidth
            />
            <TextField
              label="Notes"
              value={sports.notes}
              onChange={handleChange("notes")}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </Paper>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.effort} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Effort & body</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Avg heart rate"
                    type="number"
                    value={sports.avgHeartRate}
                    onChange={handleChange("avgHeartRate")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    select
                    label="HR zone"
                    value={sports.hrZone}
                    onChange={handleChange("hrZone")}
                    fullWidth
                  >
                    {SPORTS_HR_ZONE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Calories"
                    type="number"
                    value={sports.calories}
                    onChange={handleChange("calories")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                  />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <TextField
                    label="Distance"
                    type="number"
                    value={sports.distance}
                    onChange={handleChange("distance")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: "0.01", inputMode: "decimal" } }}
                  />
                </Grid>
                <Grid size={{ xs: 2, sm: 1 }}>
                  <TextField
                    select
                    label="Unit"
                    value={sports.distanceUnit}
                    onChange={handleChange("distanceUnit")}
                    fullWidth
                  >
                    <MenuItem value="mi">mi</MenuItem>
                    <MenuItem value="km">km</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Collapse>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.environment} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Environment</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    select
                    label="Indoor / outdoor"
                    value={sports.environment}
                    onChange={handleChange("environment")}
                    fullWidth
                  >
                    {SPORTS_ENVIRONMENT_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    select
                    label="Surface"
                    value={sports.surface}
                    onChange={handleChange("surface")}
                    fullWidth
                  >
                    {SPORTS_SURFACE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Location / venue"
                    value={sports.location}
                    onChange={handleChange("location")}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    select
                    label="Weather"
                    value={sports.weather}
                    onChange={handleChange("weather")}
                    fullWidth
                  >
                    {SPORTS_WEATHER_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <TextField
                    label="Temp"
                    type="number"
                    value={sports.temperature}
                    onChange={handleChange("temperature")}
                    fullWidth
                    slotProps={{ htmlInput: { step: "0.1", inputMode: "decimal" } }}
                  />
                </Grid>
                <Grid size={{ xs: 2, sm: 1 }}>
                  <TextField
                    select
                    label="Unit"
                    value={sports.temperatureUnit}
                    onChange={handleChange("temperatureUnit")}
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

      <Grid size={12}>
        <Collapse in={sectionsOpen.gear} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Gear</Typography>
              <TextField
                label="Equipment used"
                placeholder="e.g., racket, cleats, clubs"
                value={sports.gear}
                onChange={handleChange("gear")}
                fullWidth
              />
            </Stack>
          </Paper>
        </Collapse>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.stats} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle1">Stats</Typography>
                <Button variant="outlined" size="small" startIcon={<Add />} onClick={addStat}>
                  Add stat
                </Button>
              </Stack>
              {(sports.stats || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Add any stat that matters — points, rebounds, aces, goals…
                </Typography>
              ) : (
                (sports.stats || []).map((stat, index) => (
                  <Stack key={`stat-${index}`} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TextField
                      label="Stat"
                      placeholder="Points"
                      value={stat.label}
                      onChange={changeStat(index, "label")}
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Value"
                      value={stat.value}
                      onChange={changeStat(index, "value")}
                      sx={{ flex: 1 }}
                    />
                    <IconButton aria-label="remove stat" onClick={() => removeStat(index)}>
                      <RemoveCircle fontSize="small" />
                    </IconButton>
                  </Stack>
                ))
              )}
            </Stack>
          </Paper>
        </Collapse>
      </Grid>
    </>
  );
}
