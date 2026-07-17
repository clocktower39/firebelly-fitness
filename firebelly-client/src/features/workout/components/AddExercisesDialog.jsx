import React, { Fragment, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  AppBar,
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Paper,
  Select,
  Slide,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";

const WARMUP_TAG = "Warm-up";
import { Close as CloseIcon } from "@mui/icons-material";
import { getExerciseAliases, requestExerciseProgress } from "../../../Redux/actions";
import { displayWeightUnit, formatWeightList, normalizeWeightUnit } from "../../../utils/weightUnits";
import { exerciseDisplayName } from "../../../utils/exerciseName";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export const ExerciseListAutocomplete = ({ exerciseList, selectedExercises, setSelectedExercises, disableCloseOnSelect = false, }) => {
  const user = useSelector((state) => state.user);
  const aliases = useSelector((state) => state.progress.exerciseAliases) || {};
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getExerciseAliases());
  }, [dispatch]);

  const matchWords = (option, inputValue) => {
    if (!option) return false;
    const words = inputValue.toLowerCase().split(" ").filter(Boolean);
    return words.every((word) => option.toLowerCase().includes(word));
  };

  return (
    <Autocomplete
      multiple
      fullWidth
      value={selectedExercises}
      options={[...exerciseList].sort((a, b) =>
        exerciseDisplayName(a, aliases).localeCompare(exerciseDisplayName(b, aliases))
      )}
      isOptionEqualToValue={(option, value) => option._id === value._id}
      getOptionLabel={(option) => exerciseDisplayName(option, aliases)}
      onChange={(e, newSelection) => {
        setSelectedExercises(newSelection);

        // Find newly added exercise
        const newExercise = newSelection.find(
          (ex) => !selectedExercises.some((sel) => sel._id === ex._id)
        );

        if (newExercise) {
          dispatch(requestExerciseProgress(newExercise, user));
        }
      }}
      filterOptions={(options, { inputValue }) =>
        options.filter(
          (option) =>
            matchWords(option.exerciseTitle, inputValue) ||
            matchWords(aliases[option._id] || "", inputValue)
        )
      }
      renderValue={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            key={option._id}
            variant="outlined"
            label={exerciseDisplayName(option, aliases)}
            {...getTagProps({ index })}
          />
        ))
      }
      renderInput={(params) => <TextField {...params} label="Search" placeholder="Exercises" />}
      disableCloseOnSelect={disableCloseOnSelect}
    />
  );
};

const AddExercisesDialog = ({ addExerciseOpen, handleAddExerciseClose, confirmedNewExercise, confirmedWarmups, activeStep, user, weightUnit: weightUnitOverride, warmup = false, }) => {
  const exerciseList = useSelector((state) => state.progress.exerciseList);
  const weightUnit = normalizeWeightUnit(weightUnitOverride || user.workoutWeightUnit);

  const [selectedExercises, setSelectedExercises] = useState([]);
  const [selectedExercisesSetCount, setSelectedExercisesSetCount] = useState(4);
  const [selectedHistoryByExercise, setSelectedHistoryByExercise] = useState({});
  // Warm-up mode: lead the picker with warm-up-tagged movements (toggle to search everything), plus
  // a free-text custom warm-up entry for anything not in the library.
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMeasure, setCustomMeasure] = useState("time");
  const [customAmount, setCustomAmount] = useState("5");
  // Custom warm-ups staged in the modal — they post together with any searched library warm-ups
  // when Confirm is clicked (so you don't have to reopen the modal to add more).
  const [stagedCustomWarmups, setStagedCustomWarmups] = useState([]);

  const pickerList =
    warmup && !showAllExercises
      ? (exerciseList || []).filter((e) => (e.tags || []).includes(WARMUP_TAG))
      : exerciseList;

  const measureLabel = (cw) =>
    cw.measure === "time"
      ? `${cw.amount} min`
      : cw.measure === "reps"
      ? `${cw.amount} reps`
      : "as needed";

  // "Add" stages the typed custom warm-up in the list and clears the fields — it does NOT submit.
  const handleAddCustomWarmup = () => {
    if (!customName.trim()) return;
    setStagedCustomWarmups((prev) => [
      ...prev,
      { name: customName.trim(), measure: customMeasure, amount: customAmount },
    ]);
    setCustomName("");
    setCustomMeasure("time");
    setCustomAmount("5");
  };

  const resetDialog = () => {
    setSelectedExercises([]);
    setSelectedExercisesSetCount(4);
    setStagedCustomWarmups([]);
    setCustomName("");
    setCustomMeasure("time");
    setCustomAmount("5");
    setShowAllExercises(false);
  };

  // One Confirm for warm-up mode: gather staged customs (plus any typed-but-not-yet-added one) and
  // the searched library selections, and post them all together.
  const handleConfirm = () => {
    if (warmup) {
      const customWarmups = [...stagedCustomWarmups];
      if (customName.trim()) {
        customWarmups.push({ name: customName.trim(), measure: customMeasure, amount: customAmount });
      }
      confirmedWarmups({
        selectedExercises,
        customWarmups,
        setCount: selectedExercisesSetCount,
        selectedHistoryByExercise,
        exerciseList,
      });
      resetDialog();
    } else {
      confirmedNewExercise(
        activeStep,
        selectedExercises,
        setSelectedExercises,
        selectedExercisesSetCount,
        setSelectedExercisesSetCount,
        selectedHistoryByExercise,
        exerciseList
      );
    }
  };

  const confirmDisabled =
    warmup && !selectedExercises.length && !stagedCustomWarmups.length && !customName.trim();

  const handleSelectedExercisesSetCountChange = (e) =>
    setSelectedExercisesSetCount(Number(e.target.value));

  useEffect(() => {
    setSelectedHistoryByExercise((prev) => {
      const next = { ...prev };
      selectedExercises.forEach((exercise) => {
        if (next[exercise._id] !== undefined) return;
        const reduxExercise = exerciseList.find((item) => item._id === exercise._id);
        const history = reduxExercise?.history?.[user._id] || [];
        next[exercise._id] = history.length > 0 ? history[history.length - 1]._id : "";
      });
      Object.keys(next).forEach((exerciseId) => {
        if (!selectedExercises.some((exercise) => exercise._id === exerciseId)) {
          delete next[exerciseId];
        }
      });
      return next;
    });
  }, [exerciseList, selectedExercises, user._id]);

  const formatHistoryLabel = (historyItem) => {
    if (!historyItem) return "No history";
    const achieved = historyItem.achieved || {};
    const weight = Array.isArray(achieved.weight) ? formatWeightList(achieved.weight, weightUnit) : "";
    const reps = Array.isArray(achieved.reps) ? achieved.reps.filter(Boolean) : [];
    const seconds = Array.isArray(achieved.seconds) ? achieved.seconds.filter(Boolean) : [];
    const percent = Array.isArray(achieved.percent) ? achieved.percent.filter(Boolean) : [];
    const details = [];
    if (reps.length) details.push(`${reps.join(", ")} reps`);
    if (weight.length) details.push(`${weight} ${displayWeightUnit(weightUnit)}`);
    if (seconds.length) details.push(`${seconds.join(", ")} sec`);
    if (percent.length) details.push(`${percent.join(", ")}%`);
    const summary = details.length ? ` • ${details.join(" | ")}` : "";
    return `${dayjs(historyItem.date).format("MM/DD/YYYY")}${summary}`;
  };

  return (
    <Dialog
      open={addExerciseOpen}
      fullWidth
      maxWidth='sm'
      slots={{
        transition: Transition,
      }}
      slotProps={{
        paper: {
          sx: {
            height: "80%",
          },
        },
      }}
    >
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => {
              resetDialog();
              handleAddExerciseClose();
            }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            {warmup ? "Add Warm-up Exercises" : "Add Exercises"}
          </Typography>
          <Button variant="contained" onClick={handleConfirm} disabled={confirmDisabled}>
            Confirm
          </Button>
        </Toolbar>
      </AppBar>
      <DialogContent>
        <Grid container spacing={1} sx={{ padding: "10px 0px" }}>
          {warmup && (
            <Grid container size={12}>
              <Paper variant="outlined" sx={{ p: 1.5, width: "100%" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Custom warm-up (not in the library)
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
                  <TextField
                    label="Name"
                    placeholder="e.g. Foam roll IT band"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Measure"
                    value={customMeasure}
                    onChange={(e) => setCustomMeasure(e.target.value)}
                    size="small"
                    sx={{ minWidth: 130 }}
                  >
                    <MenuItem value="time">Minutes</MenuItem>
                    <MenuItem value="reps">Reps</MenuItem>
                    <MenuItem value="none">As needed</MenuItem>
                  </TextField>
                  {customMeasure !== "none" && (
                    <TextField
                      label={customMeasure === "time" ? "Min" : "Reps"}
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      size="small"
                      sx={{ width: 90 }}
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                  )}
                  <Button
                    variant="outlined"
                    onClick={handleAddCustomWarmup}
                    disabled={!customName.trim()}
                  >
                    Add to list
                  </Button>
                </Stack>
                {stagedCustomWarmups.length > 0 && (
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1.25 }}>
                    {stagedCustomWarmups.map((cw, i) => (
                      <Chip
                        key={`${cw.name}-${i}`}
                        label={`${cw.name} · ${measureLabel(cw)}`}
                        onDelete={() =>
                          setStagedCustomWarmups((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        size="small"
                      />
                    ))}
                  </Stack>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Add as many as you like, then press <strong>Confirm</strong> — custom and searched
                  warm-ups post together.
                </Typography>
              </Paper>
              <Divider sx={{ width: "100%", my: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  or pick from the library
                </Typography>
              </Divider>
            </Grid>
          )}
          <Grid container size={12}>
            <ExerciseListAutocomplete
              exerciseList={pickerList}
              selectedExercises={selectedExercises}
              setSelectedExercises={setSelectedExercises}
            />
          </Grid>
          {warmup && (
            <Grid container size={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={showAllExercises}
                    onChange={(e) => setShowAllExercises(e.target.checked)}
                  />
                }
                label="Show all exercises (not just warm-ups)"
              />
            </Grid>
          )}
          <Grid container size={12}>
            <TextField
              label="Sets"
              select
              slotProps={{ select: { native: true } }}
              fullWidth
              value={selectedExercisesSetCount}
              onChange={handleSelectedExercisesSetCountChange}
            >
              {[...Array(21)].map((x, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </TextField>

            {selectedExercises.length > 0 && (
              <List sx={{ bgcolor: "background.paper", width: "100%" }}>
                {selectedExercises.map((exercise, exerciseIndex, exercises) => {
                  const reduxExercise = exerciseList.find((ex) => ex._id === exercise._id);
                  const history = reduxExercise?.history?.[user._id];
                  const historyOptions = history ? history.slice(history.length - 3, history.length) : [];

                  return (
                    <Fragment key={`${exercise.exerciseTitle}-${exerciseIndex}`} >
                      <ListItem >
                        <Stack spacing={1} sx={{ width: "100%" }}>
                          <Typography variant="subtitle1">{exercise?.exerciseTitle}</Typography>
                          {historyOptions.length > 0 ? (
                            <FormControl fullWidth size="small">
                              <InputLabel>Use previous achieved</InputLabel>
                              <Select
                                label="Use previous achieved"
                                value={selectedHistoryByExercise[exercise._id] ?? ""}
                                onChange={(event) =>
                                  setSelectedHistoryByExercise((prev) => ({
                                    ...prev,
                                    [exercise._id]: event.target.value,
                                  }))
                                }
                              >
                                {historyOptions.map((historyItem) => (
                                  <MenuItem key={historyItem._id} value={historyItem._id}>
                                    {formatHistoryLabel(historyItem)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No recent history for this exercise.
                            </Typography>
                          )}
                        </Stack>
                      </ListItem>
                      {exerciseIndex !== exercises.length - 1 && <Divider component="li" />}
                    </Fragment>
                  );
                })}
              </List>
            )}
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default AddExercisesDialog;
