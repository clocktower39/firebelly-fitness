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
  YOGA_DIFFICULTY_OPTIONS,
  YOGA_FEELING_OPTIONS,
  YOGA_FOCUS_AREAS,
  YOGA_HEATED_OPTIONS,
  YOGA_INTENTIONS,
  YOGA_OPTIONAL_SECTIONS,
  YOGA_PROPS,
  YOGA_SESSION_TYPES,
  YOGA_STYLES,
} from "../../utils/yogaUtils";

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

export default function YogaDetailsEditor({
  yoga,
  sectionsOpen,
  favoriteYogaStyles,
  onToggleFavoriteStyle,
  handleChange,
  toggleArrayValue,
  toggleSection,
  addPose,
  removePose,
  changePose,
}) {
  const favList = (favoriteYogaStyles || []).filter((option) => YOGA_STYLES.includes(option));
  const otherStyles = YOGA_STYLES.filter((option) => !favList.includes(option));
  const isCurrentFavorite = favList.includes(yoga.style);

  return (
    <>
      <Grid size={12}>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.25}>
              <Typography variant="h6">Yoga</Typography>
              <Typography variant="body2" color="text.secondary">
                Log your yoga practice.
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Autocomplete
                    disableClearable
                    fullWidth
                    options={[...favList, ...otherStyles]}
                    value={yoga.style}
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
                      onClick={() => onToggleFavoriteStyle(yoga.style)}
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
                  value={yoga.sessionType}
                  onChange={handleChange("sessionType")}
                  fullWidth
                >
                  {YOGA_SESSION_TYPES.map((option) => (
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
                  value={yoga.durationMinutes}
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
                    value={Number(yoga.rpe) || null}
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
                {YOGA_OPTIONAL_SECTIONS.map((section) => (
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
              value={yoga.notes}
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
                options={YOGA_FOCUS_AREAS}
                selected={yoga.focusAreas}
                onToggle={(value) => toggleArrayValue("focusAreas", value)}
              />
              <ChipGroup
                label="Intention"
                options={YOGA_INTENTIONS}
                selected={yoga.intentions}
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
                    value={yoga.instructor}
                    onChange={handleChange("instructor")}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Studio"
                    value={yoga.studio}
                    onChange={handleChange("studio")}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    select
                    label="Difficulty"
                    value={yoga.difficulty}
                    onChange={handleChange("difficulty")}
                    fullWidth
                  >
                    {YOGA_DIFFICULTY_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    select
                    label="Heated?"
                    value={yoga.heated}
                    onChange={handleChange("heated")}
                    fullWidth
                  >
                    {YOGA_HEATED_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                {yoga.heated === "Heated" && (
                  <>
                    <Grid size={{ xs: 4, sm: 2 }}>
                      <TextField
                        label="Temp"
                        type="number"
                        value={yoga.temperature}
                        onChange={handleChange("temperature")}
                        fullWidth
                        slotProps={{ htmlInput: { step: "0.1", inputMode: "decimal" } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 2, sm: 2 }}>
                      <TextField
                        select
                        label="Unit"
                        value={yoga.temperatureUnit}
                        onChange={handleChange("temperatureUnit")}
                        fullWidth
                      >
                        <MenuItem value="F">°F</MenuItem>
                        <MenuItem value="C">°C</MenuItem>
                      </TextField>
                    </Grid>
                  </>
                )}
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
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    select
                    label="How it felt"
                    value={yoga.feeling}
                    onChange={handleChange("feeling")}
                    fullWidth
                  >
                    {YOGA_FEELING_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    label="Meditation (min)"
                    type="number"
                    value={yoga.meditationMinutes}
                    onChange={handleChange("meditationMinutes")}
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
        <Collapse in={sectionsOpen.props} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Props & body</Typography>
              <ChipGroup
                label="Props used"
                options={YOGA_PROPS}
                selected={yoga.props}
                onToggle={(value) => toggleArrayValue("props", value)}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Avg heart rate"
                    type="number"
                    value={yoga.avgHeartRate}
                    onChange={handleChange("avgHeartRate")}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Calories"
                    type="number"
                    value={yoga.calories}
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
        <Collapse in={sectionsOpen.poses} unmountOnExit>
          <Paper variant="outlined" sx={{ padding: "16px" }}>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle1">Poses</Typography>
                <Button variant="outlined" size="small" startIcon={<Add />} onClick={addPose}>
                  Add pose
                </Button>
              </Stack>
              {(yoga.poses || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Note the poses or sequence you practiced (with an optional hold time).
                </Typography>
              ) : (
                (yoga.poses || []).map((pose, index) => (
                  <Stack key={`pose-${index}`} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TextField
                      label="Pose"
                      placeholder="Warrior II"
                      value={pose.name}
                      onChange={changePose(index, "name")}
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Hold"
                      placeholder="5 breaths / 30s"
                      value={pose.hold}
                      onChange={changePose(index, "hold")}
                      sx={{ flex: 1 }}
                    />
                    <IconButton aria-label="remove pose" onClick={() => removePose(index)}>
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
