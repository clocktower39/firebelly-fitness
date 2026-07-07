import React, { useState, useEffect, useCallback } from "react";
import { goalApi } from "../../api/goalApi";
import { useSelector, useDispatch } from "react-redux";
import {
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  MobileStepper,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountCircle,
  AddCircle,
  Delete,
} from "@mui/icons-material";
import {
  getGoals,
  updateGoal,
  addGoalComment,
  removeGoalComment,
  addNewGoal,
  deleteGoal,
  requestExerciseLibrary,
  markAchievementSeen,
  requestLatestMetric,
  serverURL,
} from "../../Redux/actions";
import {
  displayWeightUnit,
  formatWeightWithUnit,
  fromStoredLbs,
  normalizeWeightUnit,
  toStoredLbs,
} from "../../utils/weightUnits";

const GOAL_CATEGORIES = ["General", "Strength", "Cardio", "Skill", "Weight"];
const DISTANCE_UNITS = ["Miles", "Kilometers", "Meters", "Yards"];
// Coaching classification (distinct from category, which drives the measurable-target inputs).
const GOAL_TYPES = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Muscle / Hypertrophy" },
  { value: "fat_loss", label: "Fat loss" },
  { value: "performance", label: "Performance" },
  { value: "endurance", label: "Endurance" },
  { value: "mobility", label: "Mobility" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "sport", label: "Sport" },
  { value: "skill", label: "Skill" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];
const goalTypeLabel = (v) => GOAL_TYPES.find((t) => t.value === v)?.label || "";

// How a goal is measured. Chosen once (defaulted from the goal type) — drives which inputs show and
// derives the legacy `category` the server/measurement logic keys off, so there's no second dropdown.
const MEASURE_MODES = [
  { value: "lift", label: "A lift", hint: "weight × reps", category: "Strength" },
  { value: "cardio", label: "Distance / time", hint: "e.g. run a 5k", category: "Cardio" },
  { value: "bodyweight", label: "Body weight", hint: "scale target", category: "Weight" },
  { value: "general", label: "General", hint: "describe it", category: "General" },
];
const defaultMeasureForType = (goalType) => {
  switch (goalType) {
    case "strength": return "lift";
    case "endurance": return "cardio";
    case "fat_loss":
    case "health": return "bodyweight";
    default: return "general"; // hypertrophy, performance, mobility, aesthetic, sport, skill, other, ""
  }
};
const categoryForMeasure = (measureBy) =>
  MEASURE_MODES.find((m) => m.value === measureBy)?.category || "General";
const measureForCategory = (category) => {
  if (category === "Strength") return "lift";
  if (category === "Cardio") return "cardio";
  if (category === "Weight") return "bodyweight";
  return "general";
};
const shrinkLabelSlotProps = { inputLabel: { shrink: true } };
const readOnlyShrinkSlotProps = {
  inputLabel: { shrink: true },
  input: { readOnly: true },
};
const distanceNumberSlotProps = {
  inputLabel: { shrink: true },
  htmlInput: { step: "0.01" },
};
const weightNumberSlotProps = {
  inputLabel: { shrink: true },
  htmlInput: { step: "0.1" },
};
const timeInputSlotProps = {
  inputLabel: { shrink: true },
  htmlInput: { inputMode: "numeric", pattern: "[0-9:]*" },
};
const DISTANCE_UNIT_TO_METERS = {
  Miles: 1609.344,
  Kilometers: 1000,
  Meters: 1,
  Yards: 0.9144,
};

const convertDistanceValue = (value, fromUnit, toUnit) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  const fromFactor = DISTANCE_UNIT_TO_METERS[fromUnit];
  const toFactor = DISTANCE_UNIT_TO_METERS[toUnit];
  if (!fromFactor || !toFactor) return value;
  const converted = (numericValue * fromFactor) / toFactor;
  return Number.isFinite(converted) ? String(converted) : value;
};

const formatRaceTime = (value) => {
  const digitsOnly = String(value).replace(/\D/g, "");
  if (!digitsOnly) return "";
  const padded = digitsOnly.slice(-6).padStart(6, "0");
  const hours = padded.slice(0, 2);
  const minutes = Math.min(Number(padded.slice(2, 4)), 59).toString().padStart(2, "0");
  const seconds = Math.min(Number(padded.slice(4, 6)), 59).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const getCategoryColor = (category) => {
  switch (category) {
    case "Strength":
      return "error";
    case "Cardio":
      return "info";
    case "Skill":
      return "secondary";
    case "Weight":
      return "success";
    default:
      return "default";
  }
};

const GoalCard = ({ goal, onOpen, weightUnit = "lbs" }) => {
  const isStrengthGoal = goal.category === "Strength" && goal.exercise;
  const hasUnseenAchievement = goal.achievedDate && !goal.achievementSeen;

  return (
    <Grid
      container
      size={{ xs: 12, sm: 6, md: 4, }}
      sx={{ justifyContent: "center" }}
    >
      <Box sx={{ width: "100%" }}>
        <Badge
          badgeContent="Achieved!"
          color="success"
          invisible={!hasUnseenAchievement}
          sx={{ width: "100%", "& .MuiBadge-badge": { fontSize: "0.7rem" } }}
        >
          <Card
            sx={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              '& .MuiPaper-root': {
                backgroundColor: 'white',
              },
              ...(hasUnseenAchievement && {
                border: "2px solid",
                borderColor: "success.main",
              }),
            }}
          >
            <CardActionArea onClick={() => onOpen(goal)}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    {goal.category && (
                      <Chip
                        label={goal.category}
                        size="small"
                        color={getCategoryColor(goal.category)}
                      />
                    )}
                    {goal.goalType && (
                      <Chip label={goalTypeLabel(goal.goalType)} size="small" variant="outlined" />
                    )}
                    {goal.importanceScore ? (
                      <Chip label={`Importance ${goal.importanceScore}/10`} size="small" variant="outlined" color="primary" />
                    ) : null}
                    {goal.achievedDate && (
                      <Chip
                        label="Achieved"
                        size="small"
                        color="success"
                        variant={hasUnseenAchievement ? "filled" : "outlined"}
                      />
                    )}
                    <Typography variant="h5" component="div">
                      {goal.title}
                    </Typography>
                  </Stack>
                  {isStrengthGoal ? (
                    <Typography variant="body2" color="text.secondary">
                      Target: {formatWeightWithUnit(goal.targetWeight, weightUnit)} × {goal.targetReps} reps
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {goal.description}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Badge>
      </Box>
    </Grid>
  );
};

const GoalDetails = ({ goal, open, onClose, dispatch, user, exerciseLibrary, latestMetric, weightUnit = "lbs" }) => {
  const normalizedWeightUnit = normalizeWeightUnit(weightUnit);
  const weightUnitLabel = displayWeightUnit(normalizedWeightUnit);
  const [title, setTitle] = useState(goal.title || '');
  const [description, setDescription] = useState(goal.description || '');
  const [motivation, setMotivation] = useState(goal.motivation || '');
  const [status, setStatus] = useState(goal.status || 'active');
  const [goalType, setGoalType] = useState(goal.goalType || '');
  const [importanceScore, setImportanceScore] = useState(goal.importanceScore || '');
  const [measureBy, setMeasureBy] = useState(measureForCategory(goal.category));
  const [selectedExercise, setSelectedExercise] = useState(goal.exercise || null);
  const [targetWeight, setTargetWeight] = useState(
    goal.targetWeight ? String(fromStoredLbs(goal.targetWeight, normalizedWeightUnit)) : ''
  );
  const [targetReps, setTargetReps] = useState(goal.targetReps || '');
  const [distanceUnit, setDistanceUnit] = useState(goal.distanceUnit || 'Miles');
  const [distanceValue, setDistanceValue] = useState(goal.distanceValue || '');
  const [goalTime, setGoalTime] = useState(goal.goalTime || '');
  const [goalWeight, setGoalWeight] = useState(
    goal.goalWeight ? String(fromStoredLbs(goal.goalWeight, normalizedWeightUnit)) : ''
  );
  const [currentMax, setCurrentMax] = useState(null);
  const [startingWeight, setStartingWeight] = useState(
    goal.startingWeight ? String(fromStoredLbs(goal.startingWeight, normalizedWeightUnit)) : ''
  );
  const [startingEdited, setStartingEdited] = useState(Boolean(goal.startingWeight));
  const [targetDate, setTargetDate] = useState(goal.targetDate || '');
  const [achievedDate, setAchievedDate] = useState(goal.achievedDate || '');
  const [newComment, setNewComment] = useState('');
  const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false);

  const isStrengthGoal = measureBy === "lift";
  const isCardioGoal = measureBy === "cardio";
  const isWeightGoal = measureBy === "bodyweight";

  const handleChange = (e, setter) => setter(e.target.value);
  const handleDistanceUnitChange = (nextUnit) => {
    if (distanceValue !== '') {
      setDistanceValue(convertDistanceValue(distanceValue, distanceUnit, nextUnit));
    }
    setDistanceUnit(nextUnit);
  };
  const handleGoalTimeChange = (e) => setGoalTime(formatRaceTime(e.target.value));

  const fetchCurrentMax = useCallback(async () => {
    if (!selectedExercise?._id || !targetReps) {
      setCurrentMax(null);
      return;
    }
    try {
      const data = await goalApi.getExerciseMaxAtReps({
        exerciseId: selectedExercise._id,
        targetReps: Number(targetReps),
      });
      setCurrentMax(data.maxWeight || 0);
    } catch (err) {
      console.error("Error fetching current max:", err);
    }
  }, [selectedExercise?._id, targetReps]);

  useEffect(() => {
    if (isStrengthGoal) {
      fetchCurrentMax();
    }
  }, [isStrengthGoal, fetchCurrentMax]);

  const saveGoal = () => {
    const goalData = {
      _id: goal._id,
      title: isStrengthGoal && selectedExercise ? selectedExercise.exerciseTitle : title,
      description,
      motivation,
      status,
      goalType,
      importanceScore: importanceScore === '' ? null : Number(importanceScore),
      category: categoryForMeasure(measureBy),
      targetDate,
    };
    if (isStrengthGoal) {
      goalData.exercise = selectedExercise?._id;
      goalData.targetWeight = toStoredLbs(targetWeight, normalizedWeightUnit);
      goalData.targetReps = Number(targetReps);
      goalData.startingWeight = startingWeight === '' ? null : toStoredLbs(startingWeight, normalizedWeightUnit);
      // achievedDate is auto-calculated for strength goals
      goalData.distanceUnit = null;
      goalData.distanceValue = null;
      goalData.goalTime = null;
      goalData.goalWeight = null;
    } else if (isCardioGoal) {
      goalData.distanceUnit = distanceUnit;
      goalData.distanceValue = distanceValue === '' ? null : Number(distanceValue);
      goalData.goalTime = goalTime || null;
      goalData.goalWeight = null;
      goalData.achievedDate = achievedDate;
    } else if (isWeightGoal) {
      goalData.distanceUnit = null;
      goalData.distanceValue = null;
      goalData.goalTime = null;
      goalData.goalWeight = goalWeight === '' ? null : toStoredLbs(goalWeight, normalizedWeightUnit);
      goalData.achievedDate = achievedDate;
    } else {
      goalData.distanceUnit = null;
      goalData.distanceValue = null;
      goalData.goalTime = null;
      goalData.goalWeight = null;
      goalData.achievedDate = achievedDate;
    }
    dispatch(updateGoal(goalData));
  };

  // Auto-fill the (editable) current-max field from logged history, unless a value is already set.
  useEffect(() => {
    if (isStrengthGoal && currentMax > 0 && !startingEdited) {
      setStartingWeight(String(fromStoredLbs(currentMax, normalizedWeightUnit)));
    }
  }, [isStrengthGoal, currentMax, startingEdited, normalizedWeightUnit]);

  const resetEdit = () => {
    setTitle(goal.title || '');
    setDescription(goal.description || '');
    setMotivation(goal.motivation || '');
    setStatus(goal.status || 'active');
    setGoalType(goal.goalType || '');
    setImportanceScore(goal.importanceScore || '');
    setMeasureBy(measureForCategory(goal.category));
    setSelectedExercise(goal.exercise || null);
    setTargetWeight(goal.targetWeight ? String(fromStoredLbs(goal.targetWeight, normalizedWeightUnit)) : '');
    setStartingWeight(goal.startingWeight ? String(fromStoredLbs(goal.startingWeight, normalizedWeightUnit)) : '');
    setStartingEdited(Boolean(goal.startingWeight));
    setTargetReps(goal.targetReps || '');
    setDistanceUnit(goal.distanceUnit || 'Miles');
    setDistanceValue(goal.distanceValue || '');
    setGoalTime(goal.goalTime || '');
    setGoalWeight(goal.goalWeight ? String(fromStoredLbs(goal.goalWeight, normalizedWeightUnit)) : '');
    setTargetDate(goal.targetDate || '');
    setAchievedDate(goal.achievedDate || '');
  };

  const handleCommentSubmit = () => {
    if (newComment !== '') {
      dispatch(addGoalComment(goal._id, newComment))
        .then(() => setNewComment(''));
    }
  };

  const handleOpenDeleteConfirmation = () => setOpenDeleteConfirmation(true);
  const handleCloseDeleteConfirmation = () => setOpenDeleteConfirmation(false);

  const DeleteConfirmation = ({ goalId, open, onClose }) => {
    const submitDelete = () => dispatch(deleteGoal(goalId));
    return (
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        sx={{
          '& .MuiDialog-paper': {
            width: "80%",
          }
        }}
      >
        <DialogTitle id="alert-dialog-title">
          <Grid container>
            <Grid container size={12}>
              Delete Confirmation
            </Grid>
          </Grid>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1} sx={{ padding: "10px 0px" }}>
            <Grid container size={12}>
              <Typography variant="body1">
                Are you sure you would like to permanently delete this goal?
              </Typography>
            </Grid>
            <Grid container size={12} spacing={2} sx={{ justifyContent: 'center' }}>
              <Grid>
                <Button color='secondaryButton' variant="contained" onClick={onClose}>
                  Cancel
                </Button>
              </Grid>
              <Grid>
                <Button variant="contained" onClick={submitDelete}>
                  Confirm
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    );
  };

  const goalId = goal?._id;

  useEffect(() => {
    if (!goalId) return;
    setTitle(goal.title || '');
    setDescription(goal.description || '');
    setCategory(goal.category || '');
    setSelectedExercise(goal.exercise || null);
    setTargetWeight(goal.targetWeight ? String(fromStoredLbs(goal.targetWeight, normalizedWeightUnit)) : '');
    setTargetReps(goal.targetReps || '');
    setDistanceUnit(goal.distanceUnit || 'Miles');
    setDistanceValue(goal.distanceValue || '');
    setGoalTime(goal.goalTime || '');
    setGoalWeight(goal.goalWeight ? String(fromStoredLbs(goal.goalWeight, normalizedWeightUnit)) : '');
    setTargetDate(goal.targetDate || '');
    setAchievedDate(goal.achievedDate || '');
  }, [goalId, goal, normalizedWeightUnit]);

  // Mark achievement as seen when opening a goal with unseen achievement
  useEffect(() => {
    if (open && goal?.achievedDate && !goal?.achievementSeen) {
      dispatch(markAchievementSeen(goal._id));
    }
  }, [open, goal?._id, goal?.achievedDate, goal?.achievementSeen, dispatch]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      sx={{
        '& .MuiDialog-paper': {
          height: '100%',
          width: "100%",
        }
      }}
    >
      <DialogTitle id="alert-dialog-title">
        <Grid container>
          <Grid container size={6}>
            Goal Details
          </Grid>
          <Grid container size={6} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
            <Tooltip title="Delete">
              <IconButton variant="contained" onClick={handleOpenDeleteConfirmation}>
                <Delete />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={1} sx={{ padding: "10px 0px" }}>
          <Grid container size={12}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                How it&apos;s measured
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={measureBy}
                onChange={(e, v) => v && setMeasureBy(v)}
                sx={{ flexWrap: "wrap" }}
              >
                {MEASURE_MODES.map((m) => (
                  <ToggleButton key={m.value} value={m.value} sx={{ textTransform: "none" }}>
                    {m.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Grid>
          {isStrengthGoal ? (
            <>
              <Grid container size={{ xs: 12, sm: 8 }}>
                <Autocomplete
                  fullWidth
                  options={exerciseLibrary || []}
                  getOptionLabel={(option) => option?.exerciseTitle || ''}
                  value={selectedExercise}
                  onChange={(e, newValue) => setSelectedExercise(newValue)}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Exercise"
                      slotProps={{
                        ...params.slotProps,
                        inputLabel: {
                          ...params.slotProps?.inputLabel,
                          shrink: true,
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid container size={{ xs: 6, sm: 3 }}>
                <TextField
                  type="number"
                  fullWidth
                  label={`Target Weight (${weightUnitLabel})`}
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
              <Grid container size={{ xs: 6, sm: 3 }}>
                <TextField
                  type="number"
                  fullWidth
                  label="Target Reps"
                  value={targetReps}
                  onChange={(e) => setTargetReps(e.target.value)}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
              <Grid container size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="number"
                  fullWidth
                  label={`Current Max (${weightUnitLabel})`}
                  value={startingWeight}
                  onChange={(e) => { setStartingWeight(e.target.value); setStartingEdited(true); }}
                  helperText={currentMax > 0 ? "Pulled from your history — edit if needed" : "Enter your current best (optional)"}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
            </>
          ) : (
            <>
              <Grid container size={{ xs: 12, sm: 8 }}>
                <TextField
                  type="text"
                  fullWidth
                  label="Title"
                  value={title}
                  onChange={(e) => handleChange(e, setTitle)}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
              {isCardioGoal && (
                <>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel>Distance Unit</InputLabel>
                      <Select
                        value={distanceUnit}
                        label="Distance Unit"
                      onChange={(e) => handleDistanceUnitChange(e.target.value)}
                      >
                        {DISTANCE_UNITS.map((unit) => (
                          <MenuItem key={unit} value={unit}>
                            {unit}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="number"
                      fullWidth
                      label="Distance"
                      value={distanceValue}
                      onChange={(e) => setDistanceValue(e.target.value)}
                      slotProps={distanceNumberSlotProps}
                    />
                  </Grid>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="text"
                      fullWidth
                      label="Goal Time"
                      value={goalTime}
                      onChange={handleGoalTimeChange}
                      placeholder="HH:MM:SS"
                      helperText="Format: HH:MM:SS (minutes/seconds 00-59)"
                      slotProps={timeInputSlotProps}
                    />
                  </Grid>
                </>
              )}
              {isWeightGoal && (
                <>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="text"
                      fullWidth
                      label={`Current Weight (${weightUnitLabel})`}
                      value={formatWeightWithUnit(latestMetric?.weight, normalizedWeightUnit)}
                      helperText={latestMetric?.weight ? "Pulled from Body Metrics" : "No metrics yet"}
                      slotProps={readOnlyShrinkSlotProps}
                    />
                  </Grid>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="number"
                      fullWidth
                      label={`Goal Weight (${weightUnitLabel})`}
                      value={goalWeight}
                      onChange={(e) => setGoalWeight(e.target.value)}
                      slotProps={weightNumberSlotProps}
                    />
                  </Grid>
                </>
              )}
              {isWeightGoal && (
                <>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="text"
                      fullWidth
                      label={`Current Weight (${weightUnitLabel})`}
                      value={formatWeightWithUnit(latestMetric?.weight, normalizedWeightUnit)}
                      helperText={latestMetric?.weight ? "Pulled from Body Metrics" : "No metrics yet"}
                      slotProps={readOnlyShrinkSlotProps}
                    />
                  </Grid>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="number"
                      fullWidth
                      label={`Goal Weight (${weightUnitLabel})`}
                      value={goalWeight}
                      onChange={(e) => setGoalWeight(e.target.value)}
                      slotProps={weightNumberSlotProps}
                    />
                  </Grid>
                </>
              )}
            </>
          )}
          <Grid container size={{ xs: 12, sm: isStrengthGoal ? 12 : 6 }}>
            <TextField
              type="date"
              fullWidth
              label="Target Date"
              value={targetDate.substr(0, 10)}
              onChange={(e) => handleChange(e, setTargetDate)}
              slotProps={shrinkLabelSlotProps}
            />
          </Grid>
          {isStrengthGoal ? (
            goal.achievedDate && (
              <Grid container size={12}>
                <TextField
                  fullWidth
                  label="Achieved Date"
                  value={new Date(goal.achievedDate).toLocaleDateString()}
                  slotProps={readOnlyShrinkSlotProps}
                  disabled
                  helperText="Automatically set when goal is achieved in a workout"
                />
              </Grid>
            )
          ) : (
            <Grid container size={{ xs: 12, sm: 6 }}>
              <TextField
                type="date"
                fullWidth
                label="Achieved Date"
                value={achievedDate.substr(0, 10)}
                onChange={(e) => handleChange(e, setAchievedDate)}
                slotProps={shrinkLabelSlotProps}
              />
            </Grid>
          )}
          <Grid container size={12}>
            <TextField
              type="text"
              fullWidth
              multiline
              label="Description"
              value={description}
              onChange={(e) => handleChange(e, setDescription)}
              slotProps={shrinkLabelSlotProps}
            />
          </Grid>
          <Grid container size={12}>
            <TextField
              type="text"
              fullWidth
              multiline
              label="Why does this matter?"
              value={motivation}
              onChange={(e) => handleChange(e, setMotivation)}
              slotProps={shrinkLabelSlotProps}
            />
          </Grid>
          <Grid container size={12}>
            <TextField
              select
              fullWidth
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              slotProps={shrinkLabelSlotProps}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="achieved">Achieved</MenuItem>
              <MenuItem value="dropped">Dropped</MenuItem>
            </TextField>
          </Grid>
          <Grid container size={12} spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                select
                fullWidth
                label="Goal type"
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                slotProps={shrinkLabelSlotProps}
              >
                <MenuItem value=""><em>Not set</em></MenuItem>
                {GOAL_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                label="Importance (1–10)"
                value={importanceScore}
                onChange={(e) => setImportanceScore(e.target.value)}
                slotProps={shrinkLabelSlotProps}
              >
                <MenuItem value=""><em>—</em></MenuItem>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Grid container size={12} spacing={2} sx={{ justifyContent: 'center' }}>
            <Grid>
              <Button color='secondaryButton' variant="contained" onClick={resetEdit}>
                Reset
              </Button>
            </Grid>
            <Grid>
              <Button variant="contained" onClick={saveGoal}>
                Save
              </Button>
            </Grid>
          </Grid>

          <DialogTitle id="alert-dialog-title">
            Comments
          </DialogTitle>
          <Grid container spacing={1} size={12} sx={{ padding: "10px 0px", justifyContent: 'center', }}>
            {goal.comments && goal.comments.length > 0
              ? goal.comments.map(comment => (
                <Grid key={comment._id} container size={12} sx={{ padding: "12px 0px" }}>
                  <Grid container size={2} sx={{ justifyContent: 'center', alignItems: 'center', }}>
                    <Avatar src={comment?.user?.profilePicture ? `${serverURL}/user/profilePicture/${comment.user.profilePicture}` : null} />
                  </Grid>
                  <Grid container size={10} sx={{ minWidth: 0 }}>
                    <Grid
                      container
                      size={12}
                      sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}
                    >
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body1">
                          {comment?.user?.firstName} {comment?.user?.lastName}
                        </Typography>
                        <Typography variant="caption" component="p" sx={{ padding: 0 }}>
                          {comment.createdDate.substr(0, 10)}
                        </Typography>
                      </Stack>
                      {comment?.user?._id === user?._id && (
                        <Tooltip title="Delete comment">
                          <IconButton
                            size="small"
                            onClick={() => dispatch(removeGoalComment(goal._id, comment._id))}
                          >
                            <Delete fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Grid>
                    <Grid size={11}>
                      <Typography variant="body2">{comment.comment}</Typography>
                    </Grid>
                  </Grid>
                </Grid>
              ))
              : <Typography variant="body1">No comments</Typography>}
          </Grid>
          <Grid container size={12} sx={{ flexGrow: 1, alignContent: 'flex-end', flex: 'initial', }}>
            <TextField
              fullWidth
              multiline
              variant="outlined"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              label="Note"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  endAdornment: (
                    <Button variant="contained" sx={{}} onClick={handleCommentSubmit}>
                      Submit
                    </Button>
                  ),
                },
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DeleteConfirmation open={openDeleteConfirmation} onClose={handleCloseDeleteConfirmation} goalId={goal._id} />
    </Dialog>
  );
};

const AddNewGoal = ({ open, onClose, dispatch, exerciseLibrary, latestMetric, weightUnit = "lbs" }) => {
  const normalizedWeightUnit = normalizeWeightUnit(weightUnit);
  const weightUnitLabel = displayWeightUnit(normalizedWeightUnit);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [motivation, setMotivation] = useState('');
  const [goalType, setGoalType] = useState('');
  const [importanceScore, setImportanceScore] = useState(5);
  const [measureBy, setMeasureBy] = useState('general');
  const [step, setStep] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('Miles');
  const [distanceValue, setDistanceValue] = useState('');
  const [goalTime, setGoalTime] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [currentMax, setCurrentMax] = useState(null);
  const [startingWeight, setStartingWeight] = useState('');
  const [startingEdited, setStartingEdited] = useState(false);
  const [targetDate, setTargetDate] = useState('');

  const isStrengthGoal = measureBy === "lift";
  const isCardioGoal = measureBy === "cardio";
  const isWeightGoal = measureBy === "bodyweight";

  // Picking a goal type pre-selects how it's measured (the user can still change it in step 2).
  const handleGoalTypeChange = (value) => {
    setGoalType(value);
    setMeasureBy(defaultMeasureForType(value));
  };

  const handleChange = (e, setter) => setter(e.target.value);
  const handleDistanceUnitChange = (nextUnit) => {
    if (distanceValue !== '') {
      setDistanceValue(convertDistanceValue(distanceValue, distanceUnit, nextUnit));
    }
    setDistanceUnit(nextUnit);
  };
  const handleGoalTimeChange = (e) => setGoalTime(formatRaceTime(e.target.value));

  const fetchCurrentMax = useCallback(async () => {
    if (!selectedExercise?._id || !targetReps) {
      setCurrentMax(null);
      return;
    }
    try {
      const data = await goalApi.getExerciseMaxAtReps({
        exerciseId: selectedExercise._id,
        targetReps: Number(targetReps),
      });
      setCurrentMax(data.maxWeight || 0);
    } catch (err) {
      console.error("Error fetching current max:", err);
    }
  }, [selectedExercise?._id, targetReps]);

  useEffect(() => {
    if (isStrengthGoal) {
      fetchCurrentMax();
    }
  }, [isStrengthGoal, fetchCurrentMax]);

  // Auto-fill the (editable) current-max field from logged history, unless the client typed their own.
  useEffect(() => {
    if (isStrengthGoal && currentMax > 0 && !startingEdited) {
      setStartingWeight(String(fromStoredLbs(currentMax, normalizedWeightUnit)));
    }
  }, [isStrengthGoal, currentMax, startingEdited, normalizedWeightUnit]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMotivation('');
    setGoalType('');
    setImportanceScore(5);
    setMeasureBy('general');
    setStep(0);
    setSelectedExercise(null);
    setTargetWeight('');
    setTargetReps('');
    setDistanceUnit('Miles');
    setDistanceValue('');
    setGoalTime('');
    setGoalWeight('');
    setCurrentMax(null);
    setStartingWeight('');
    setStartingEdited(false);
    setTargetDate('');
  };

  const submitNewGoal = () => {
    const goalData = {
      title: isStrengthGoal && selectedExercise ? selectedExercise.exerciseTitle : title,
      description,
      motivation,
      goalType,
      importanceScore: importanceScore === '' ? null : Number(importanceScore),
      category: categoryForMeasure(measureBy),
      targetDate,
    };
    if (isStrengthGoal) {
      goalData.exercise = selectedExercise?._id;
      goalData.targetWeight = toStoredLbs(targetWeight, normalizedWeightUnit);
      goalData.targetReps = Number(targetReps);
      goalData.startingWeight = startingWeight === '' ? null : toStoredLbs(startingWeight, normalizedWeightUnit);
    } else if (isCardioGoal) {
      goalData.distanceUnit = distanceUnit;
      goalData.distanceValue = distanceValue === '' ? null : Number(distanceValue);
      goalData.goalTime = goalTime || null;
    } else if (isWeightGoal) {
      goalData.goalWeight = goalWeight === '' ? null : toStoredLbs(goalWeight, normalizedWeightUnit);
    }
    dispatch(addNewGoal(goalData))
      .then(() => {
        resetForm();
        onClose();
      });
  };

  const hasName = isStrengthGoal ? Boolean(selectedExercise) : Boolean(title.trim());
  const canAdvance = step === 0 ? (Boolean(goalType) && hasName) : true;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      sx={{
        '& .MuiDialog-paper': {
          height: '100%',
          width: "100%",
        }
      }}
    >
      <DialogTitle id="alert-dialog-title">
        {["Your goal", "Why & how important"][step]}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ maxWidth: 600, mx: "auto", py: 1 }}>
          {step === 0 && (
            <Stack spacing={2.5}>
              <Typography variant="h6">What do you want to achieve?</Typography>
              <TextField
                select
                fullWidth
                label="Goal type"
                value={goalType}
                onChange={(e) => handleGoalTypeChange(e.target.value)}
                slotProps={shrinkLabelSlotProps}
              >
                <MenuItem value=""><em>Choose a type…</em></MenuItem>
                {GOAL_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  How will you measure it?
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={measureBy}
                  onChange={(e, v) => v && setMeasureBy(v)}
                  sx={{ flexWrap: "wrap" }}
                >
                  {MEASURE_MODES.map((m) => (
                    <ToggleButton key={m.value} value={m.value} sx={{ textTransform: "none" }}>
                      {m.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
              <Grid container spacing={1}>
          {isStrengthGoal ? (
            <>
              <Grid container size={{ xs: 12, sm: 8 }}>
                <Autocomplete
                  fullWidth
                  options={exerciseLibrary || []}
                  getOptionLabel={(option) => option?.exerciseTitle || ''}
                  value={selectedExercise}
                  onChange={(e, newValue) => setSelectedExercise(newValue)}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Exercise"
                      slotProps={{
                        ...params.slotProps,
                        inputLabel: {
                          ...params.slotProps?.inputLabel,
                          shrink: true,
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid container size={{ xs: 6, sm: 3 }}>
                <TextField
                  type="number"
                  fullWidth
                  label={`Target Weight (${weightUnitLabel})`}
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
              <Grid container size={{ xs: 6, sm: 3 }}>
                <TextField
                  type="number"
                  fullWidth
                  label="Target Reps"
                  value={targetReps}
                  onChange={(e) => setTargetReps(e.target.value)}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
              <Grid container size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="number"
                  fullWidth
                  label={`Current Max (${weightUnitLabel})`}
                  value={startingWeight}
                  onChange={(e) => { setStartingWeight(e.target.value); setStartingEdited(true); }}
                  helperText={currentMax > 0 ? "Pulled from your history — edit if needed" : "Enter your current best (optional)"}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
            </>
          ) : (
            <>
              <Grid container size={{ xs: 12, sm: 8 }}>
                <TextField
                  type="text"
                  fullWidth
                  label="Title"
                  value={title}
                  onChange={(e) => handleChange(e, setTitle)}
                  slotProps={shrinkLabelSlotProps}
                />
              </Grid>
              {isCardioGoal && (
                <>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel>Distance Unit</InputLabel>
                      <Select
                        value={distanceUnit}
                        label="Distance Unit"
                      onChange={(e) => handleDistanceUnitChange(e.target.value)}
                      >
                        {DISTANCE_UNITS.map((unit) => (
                          <MenuItem key={unit} value={unit}>
                            {unit}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="number"
                      fullWidth
                      label="Distance"
                      value={distanceValue}
                      onChange={(e) => setDistanceValue(e.target.value)}
                      slotProps={distanceNumberSlotProps}
                    />
                  </Grid>
                  <Grid container size={{ xs: 12, sm: 4 }}>
                    <TextField
                      type="text"
                      fullWidth
                      label="Goal Time"
                      value={goalTime}
                      onChange={handleGoalTimeChange}
                      placeholder="HH:MM:SS"
                      helperText="Format: HH:MM:SS (minutes/seconds 00-59)"
                      slotProps={timeInputSlotProps}
                    />
                  </Grid>
                </>
              )}
            </>
          )}
                {isWeightGoal && (
                  <Grid container size={{ xs: 12, sm: 6 }}>
                    <TextField
                      type="number"
                      fullWidth
                      label={`Target Body Weight (${weightUnitLabel})`}
                      value={goalWeight}
                      onChange={(e) => setGoalWeight(e.target.value)}
                      slotProps={shrinkLabelSlotProps}
                    />
                  </Grid>
                )}
                <Grid container size={12}>
                  <TextField
                    type="date"
                    fullWidth
                    label="Target date — by when?"
                    value={targetDate.substr(0, 10)}
                    onChange={(e) => handleChange(e, setTargetDate)}
                    slotProps={shrinkLabelSlotProps}
                  />
                </Grid>
                <Grid container size={12}>
                  <TextField
                    type="text"
                    fullWidth
                    multiline
                    label="Notes (optional)"
                    value={description}
                    onChange={(e) => handleChange(e, setDescription)}
                    slotProps={shrinkLabelSlotProps}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
          {step === 1 && (
            <Stack spacing={2}>
              <Typography variant="h6">Why &amp; how important?</Typography>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Why does this matter to you?"
                placeholder="The real reason behind it"
                value={motivation}
                onChange={(e) => handleChange(e, setMotivation)}
                slotProps={shrinkLabelSlotProps}
              />
              <Box sx={{ px: 2, pt: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  How important is this goal?
                </Typography>
                <Slider
                  value={Number(importanceScore) || 5}
                  onChange={(e, v) => setImportanceScore(v)}
                  min={1}
                  max={10}
                  step={1}
                  marks
                  valueLabelDisplay="on"
                />
                <Typography variant="caption" color="text.secondary">
                  1 = nice to have · 10 = top priority
                </Typography>
              </Box>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Summary</Typography>
                <Typography variant="body2">
                  {goalTypeLabel(goalType) || "Goal"} — {(isStrengthGoal && selectedExercise) ? selectedExercise.exerciseTitle : (title || "—")}
                </Typography>
                {targetDate && (
                  <Typography variant="body2" color="text.secondary">By {targetDate.substr(0, 10)}</Typography>
                )}
                {motivation && (
                  <Typography variant="body2" color="text.secondary">Why: {motivation}</Typography>
                )}
              </Paper>
            </Stack>
          )}
        </Box>
      </DialogContent>
      <MobileStepper
        variant="dots"
        steps={2}
        position="static"
        activeStep={step}
        sx={{ backgroundColor: "transparent", px: 2, pb: 1 }}
        backButton={
          <Button
            size="small"
            onClick={() => { if (step === 0) { resetForm(); onClose(); } else { setStep(step - 1); } }}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
        }
        nextButton={
          step < 1 ? (
            <Button size="small" onClick={() => setStep(step + 1)} disabled={!canAdvance}>
              Next
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={submitNewGoal} disabled={!hasName}>
              Save goal
            </Button>
          )
        }
      />
    </Dialog>
  );
};

export default function Goals({ view = "client", client, }) {
  const dispatch = useDispatch();
  const goals = useSelector((state) => state.goals);
  const user = useSelector((state) => state.user);
  const exerciseLibrary = useSelector((state) => state.exerciseLibrary);
  const latestMetric = useSelector(
    (state) => state.metrics.latestByUser[(client?._id || user._id)]
  );
  const weightUnit = normalizeWeightUnit(user.workoutWeightUnit);

  const [selectedGoal, setSelectedGoal] = useState({});
  const [openGoalDetails, setOpenGoalDetails] = useState(false);
  const [openAddNewGoal, setOpenAddNewGoal] = useState(false);

  const handleOpenGoalDetails = (goal) => {
    setSelectedGoal(goal);
    setOpenGoalDetails(true);
  };
  const handleCloseGoalDetails = () => setOpenGoalDetails(false);

  const handleOpenAddNewGoal = () => setOpenAddNewGoal(true);
  const handleCloseAddNewGoal = () => setOpenAddNewGoal(false);

  // Order goals by how important they are (then by achieved-last), so the list self-ranks
  // without the client fiddling with manual up/down controls.
  const sortedGoals = Array.isArray(goals)
    ? [...goals].sort(
        (a, b) =>
          Number(Boolean(a.achievedDate)) - Number(Boolean(b.achievedDate)) ||
          (b.importanceScore || 0) - (a.importanceScore || 0) ||
          (a.priority ?? 0) - (b.priority ?? 0)
      )
    : [];

  useEffect(() => {
    setSelectedGoal(prev => {
      return prev ? goals.filter(goal => goal._id === prev._id)[0] : prev;
    });
  }, [goals]);

  useEffect(() => {
    dispatch(getGoals({ requestedBy: view, client: client?._id }));
    dispatch(requestExerciseLibrary());
    dispatch(requestLatestMetric({ userId: view === "trainer" ? client?._id : undefined }));
  }, [dispatch, view, client?._id]);

  return (
    <>
      <Container maxWidth="md" sx={{ height: "100%", padding: "15px 0px" }}>
        <Paper sx={{ padding: "5px 15px", borderRadius: "15px", minHeight: "100%", }}>

          <Grid container size={12} sx={{ justifyContent: 'center', paddingBottom: "15px", alignSelf: 'flex-start', flex: 'initial', }}>
            <Typography variant="h4">
              Goals
            </Typography>
            <Tooltip title="New Goal">
              <IconButton onClick={handleOpenAddNewGoal}><AddCircle /></IconButton>
            </ Tooltip>
          </Grid>

          <Grid container size={12} spacing={1} sx={{ alignSelf: 'flex-start', alignContent: 'flex-start', overflowY: 'scroll', scrollbarWidth: 'none', flex: 'auto', }}>
            {sortedGoals.map((goal) => (
              <GoalCard
                key={goal._id}
                goal={goal}
                onOpen={handleOpenGoalDetails}
                weightUnit={weightUnit}
              />
            ))}
          </Grid>

        </Paper>
      </Container>

      {selectedGoal && (
        <GoalDetails
          goal={selectedGoal}
          open={openGoalDetails}
          onClose={handleCloseGoalDetails}
          dispatch={dispatch}
          user={user}
          exerciseLibrary={exerciseLibrary}
          latestMetric={latestMetric}
          weightUnit={weightUnit}
        />
      )}
      <AddNewGoal
        open={openAddNewGoal}
        onClose={handleCloseAddNewGoal}
        dispatch={dispatch}
        exerciseLibrary={exerciseLibrary}
        latestMetric={latestMetric}
        weightUnit={weightUnit}
      />
    </>
  );
}
