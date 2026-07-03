import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../Redux/actions";
import { Add, RemoveCircle } from "@mui/icons-material";
import {
  Autocomplete,
  Box,
  Button,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  SUB_VALUE_TYPES,
  WORKOUT_COLOR_PALETTE,
  WORKOUT_TYPE_ORDER,
  listSubValueColors,
  subColorKey,
  typeColorKey,
} from "../../features/workout/utils/workoutColors";

function ColorSwatchPicker({ value, onChange, label }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  return (
    <>
      <Tooltip title={value ? "Change color" : "Pick a color"}>
        <Box
          role="button"
          aria-label={label || "pick color"}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            cursor: "pointer",
            border: "2px solid",
            borderColor: "divider",
            backgroundColor: value || "background.paper",
            backgroundImage: value
              ? "none"
              : "repeating-linear-gradient(45deg, #d0d0d0 0 5px, transparent 5px 10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        />
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 1.5, width: 244 }}>
          <Typography variant="caption" color="text.secondary">
            Palette
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px", mt: 0.5 }}>
            {WORKOUT_COLOR_PALETTE.map((color) => (
              <Box
                key={color}
                onClick={() => {
                  onChange(color);
                  setAnchorEl(null);
                }}
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  backgroundColor: color,
                  cursor: "pointer",
                  border: value === color ? "3px solid" : "1px solid",
                  borderColor: value === color ? "text.primary" : "divider",
                }}
              />
            ))}
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center" }}>
            <Button component="label" size="small" variant="outlined">
              Custom
              <input
                type="color"
                value={value || "#1e88e5"}
                onChange={(event) => onChange(event.target.value)}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              />
            </Button>
            <Button
              size="small"
              onClick={() => {
                onChange(null);
                setAnchorEl(null);
              }}
            >
              Clear
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

export default function WorkoutColors() {
  const dispatch = useDispatch();
  const colorMap = useSelector((state) => state.user.workoutColors) || {};

  const [addType, setAddType] = useState("Sports");
  const [addValue, setAddValue] = useState("");
  const [addColor, setAddColor] = useState("");

  const setColor = (key, hex) => {
    const next = { ...(colorMap || {}) };
    if (hex) next[key] = hex;
    else delete next[key];
    dispatch(updateUserSettings({ workoutColors: next }));
  };

  const subValueEntries = listSubValueColors(colorMap);
  const activeTypeMeta = SUB_VALUE_TYPES.find((entry) => entry.type === addType) || SUB_VALUE_TYPES[0];

  const handleAddSpecific = () => {
    const value = (addValue || "").trim();
    if (!value || !addColor) return;
    setColor(subColorKey(addType, value), addColor);
    setAddValue("");
    setAddColor("");
  };

  return (
    <Container maxWidth="md" sx={{ height: "100%" }}>
      <Grid container size={12} sx={{ padding: "15px" }}>
        <Typography color="primary.contrastText" variant="h5" gutterBottom>
          Workout Colors
        </Typography>
      </Grid>
      <Paper>
        <Grid container spacing={2} sx={{ padding: "15px" }}>
          <Grid size={12}>
            <Typography variant="body2" color="text.secondary">
              Color-code your workouts however you like. Set a color per type, and optionally give a
              specific sport, style, or activity its own color (e.g., Jiu-Jitsu purple, Basketball
              orange). Colors show on your workout cards.
            </Typography>
          </Grid>

          <Grid size={12} sx={{ mt: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              By type
            </Typography>
          </Grid>
          {WORKOUT_TYPE_ORDER.map((type) => (
            <Grid key={type} size={12}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <ColorSwatchPicker
                  label={`${type} color`}
                  value={colorMap[typeColorKey(type)] || ""}
                  onChange={(hex) => setColor(typeColorKey(type), hex)}
                />
                <Typography variant="body1">{type}</Typography>
              </Stack>
            </Grid>
          ))}

          <Grid size={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Specific sports, styles & activities
            </Typography>
            <Typography variant="body2" color="text.secondary">
              These override the type color for that specific value.
            </Typography>
          </Grid>

          {subValueEntries.length > 0 && (
            <Grid size={12}>
              <Stack spacing={1}>
                {subValueEntries.map((entry) => (
                  <Stack
                    key={entry.key}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "center" }}
                  >
                    <ColorSwatchPicker
                      label={`${entry.value} color`}
                      value={entry.color || ""}
                      onChange={(hex) => setColor(entry.key, hex)}
                    />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {entry.type} · {entry.value}
                    </Typography>
                    <Tooltip title="Remove">
                      <IconButton aria-label="remove" onClick={() => setColor(entry.key, null)}>
                        <RemoveCircle fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          )}

          <Grid size={12}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", flexWrap: "wrap", gap: "12px" }}
            >
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="add-color-type-label">Type</InputLabel>
                <Select
                  labelId="add-color-type-label"
                  label="Type"
                  value={addType}
                  onChange={(event) => {
                    setAddType(event.target.value);
                    setAddValue("");
                  }}
                >
                  {SUB_VALUE_TYPES.map((entry) => (
                    <MenuItem key={entry.type} value={entry.type}>
                      {entry.type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                freeSolo
                options={activeTypeMeta.options}
                inputValue={addValue}
                onInputChange={(event, newValue) => setAddValue(newValue || "")}
                sx={{ minWidth: 200 }}
                renderInput={(params) => (
                  <TextField {...params} size="small" label={activeTypeMeta.label} />
                )}
              />
              <ColorSwatchPicker
                label="new color"
                value={addColor}
                onChange={(hex) => setAddColor(hex || "")}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                disabled={!addValue.trim() || !addColor}
                onClick={handleAddSpecific}
              >
                Add
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
