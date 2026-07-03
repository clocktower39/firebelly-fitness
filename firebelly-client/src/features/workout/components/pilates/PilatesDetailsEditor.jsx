import React from "react";
import { Add, RemoveCircle, Star, StarBorder } from "@mui/icons-material";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Collapse,
  Grid,
  IconButton,
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
  PILATES_DIFFICULTY_OPTIONS,
  PILATES_EQUIPMENT,
  PILATES_EXERCISES,
  PILATES_FEELING_OPTIONS,
  PILATES_FOCUS_AREAS,
  PILATES_INTENTIONS,
  PILATES_OPTIONAL_SECTIONS,
  PILATES_SESSION_TYPES,
  PILATES_STYLES,
} from "../../utils/pilatesUtils";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ChipGroup = ({ label, options, selected, onToggle }) => (
  <Stack spacing={0.5}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px" }}>
      {options.map((option) => {
        const isOn = (selected || []).includes(option);
        return (
          <Chip
            key={option}
            label={option}
            size="small"
            clickable
            color={isOn ? "primary" : "default"}
            variant={isOn ? "filled" : "outlined"}
            onClick={() => onToggle(option)}
          />
        );
      })}
    </Stack>
  </Stack>
);

export default function PilatesDetailsEditor({
  pilates,
  sectionsOpen,
  favoritePilatesStyles,
  onToggleFavoriteStyle,
  handleChange,
  toggleArrayValue,
  toggleSection,
  addExercise,
  removeExercise,
  changeExercise,
}) {
  const favList = (favoritePilatesStyles || []).filter((option) => PILATES_STYLES.includes(option));
  const otherStyles = PILATES_STYLES.filter((option) => !favList.includes(option));
  const isCurrentFavorite = favList.includes(pilates.style);

  return (
    <>
      <Grid size={12}>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.25}>
              <Typography variant="h6">Pilates</Typography>
              <Typography variant="body2" color="text.secondary">
                Log your Pilates session.
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Autocomplete
                    disableClearable
                    fullWidth
                    options={[...favList, ...otherStyles]}
                    value={pilates.style}
                    onChange={(event, newValue) => {
                      if (newValue) handleChange("style")(newValue);
                    }}
                    groupBy={
                      favList.length > 0
                        ? (option) => (favList.includes(option) ? "★ Favorites" : "All styles")
                        : undefined
                    }
                    renderInput={(params) => <TextField {...params} label="Style" />}
                  />
                  <Tooltip title={isCurrentFavorite ? "Unfavorite" : "Favorite this style"}>
                    <IconButton
                      size="small"
                      onClick={() => onToggleFavoriteStyle(pilates.style)}
                      aria-label="favorite style"
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
                  value={pilates.sessionType}
                  onChange={handleChange("sessionType")}
                  fullWidth
                >
                  {PILATES_SESSION_TYPES.map((option) => (
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
                  value={pilates.durationMinutes}
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
                    value={Number(pilates.rpe) || null}
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

            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Add details
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px" }}>
                {PILATES_OPTIONAL_SECTIONS.map((section) => (
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
              label="Notes"
              value={pilates.notes}
              onChange={handleChange("notes")}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </Paper>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.focus} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Focus</Typography>
              <ChipGroup
                label="Focus areas"
                options={PILATES_FOCUS_AREAS}
                selected={pilates.focusAreas}
                onToggle={(value) => toggleArrayValue("focusAreas", value)}
              />
              <ChipGroup
                label="Intention"
                options={PILATES_INTENTIONS}
                selected={pilates.intentions}
                onToggle={(value) => toggleArrayValue("intentions", value)}
              />
            </Stack>
          </Paper>
        </Collapse>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.class} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Class details</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Instructor"
                    value={pilates.instructor}
                    onChange={handleChange("instructor")}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Studio"
                    value={pilates.studio}
                    onChange={handleChange("studio")}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Difficulty"
                    value={pilates.difficulty}
                    onChange={handleChange("difficulty")}
                    fullWidth
                  >
                    {PILATES_DIFFICULTY_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Collapse>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.mindBody} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Mind-body</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="How it felt"
                    value={pilates.feeling}
                    onChange={handleChange("feeling")}
                    fullWidth
                  >
                    {PILATES_FEELING_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Collapse>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.equipment} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Equipment</Typography>
              <ChipGroup
                label="Apparatus & props"
                options={PILATES_EQUIPMENT}
                selected={pilates.equipment}
                onToggle={(value) => toggleArrayValue("equipment", value)}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Avg heart rate"
                    type="number"
                    value={pilates.avgHeartRate}
                    onChange={handleChange("avgHeartRate")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Calories"
                    type="number"
                    value={pilates.calories}
                    onChange={handleChange("calories")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                  />
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Collapse>
      </Grid>

      <Grid size={12}>
        <Collapse in={sectionsOpen.exercises} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle1">Exercises</Typography>
                <Button variant="outlined" size="small" startIcon={<Add />} onClick={addExercise}>
                  Add exercise
                </Button>
              </Stack>
              {(pilates.exercises || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Note the exercises you did (with optional reps) — e.g., The Hundred, Teaser, Footwork.
                </Typography>
              ) : (
                (pilates.exercises || []).map((exercise, index) => (
                  <Stack
                    key={`exercise-${index}`}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Autocomplete
                      freeSolo
                      disableClearable
                      options={PILATES_EXERCISES}
                      inputValue={exercise.name || ""}
                      onInputChange={(event, newValue) =>
                        changeExercise(index, "name")(newValue || "")
                      }
                      sx={{ flex: 2 }}
                      renderInput={(params) => (
                        <TextField {...params} label="Exercise" placeholder="The Hundred" />
                      )}
                    />
                    <TextField
                      label="Reps"
                      placeholder="10 / 3 sets"
                      value={exercise.reps}
                      onChange={changeExercise(index, "reps")}
                      sx={{ flex: 1 }}
                    />
                    <IconButton aria-label="remove exercise" onClick={() => removeExercise(index)}>
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
