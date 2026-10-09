import React, { useEffect, useState } from "react";
import { editFieldsFor, loggedFieldsFor } from "../../features/workout/utils/exerciseTypes";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  FactCheck,
  Info,
  RemoveCircle,
  MoreVertSharp,
} from "@mui/icons-material";
import { useSelector, useDispatch } from "react-redux";
import { requestExerciseProgress } from "../../Redux/actions";
import LogLoader from "./LogLoader";
import EditLoader from "./EditLoader";
import ExerciseGoalPresetField from "./ExerciseGoalPresetField";
import useExerciseGoalPreset from "./hooks/useExerciseGoalPreset";
import { ModalBarChartHistory } from "../../Pages/AppPages/Progress";
import ExerciseMedia from "../../features/exercise/ExerciseMedia";
import { resolveDemoMedia } from "../../features/exercise/familyDemo";
import ExerciseCommentDialog from "./ExerciseCommentDialog";
import { normalizeWeightUnit } from "../../utils/weightUnits";
import {
  useTechniqueRegistry,
  renderTechniqueDisplay,
  appliesToLabel,
} from "../../utils/techniqueRegistry";
import TechniqueDrawer from "./TechniqueDrawer";
import TechniqueLogger from "./TechniqueLogger";
import SwapExerciseDialog from "./SwapExerciseDialog";
import SetProgressionDialog from "./SetProgressionDialog";

export default function Exercise(props) {
  const {
    workoutUser,
    workoutProgramId,
    exercise,
    setLocalTraining,
    exerciseIndex,
    setIndex,
    localTraining,
    removeExercise,
    swapExercise,
    setHeightToggle,
    weightUnit: weightUnitOverride,
    onToggleWeightUnit,
    weightsLocked,
    onExerciseNote,
  } = props;
  const dispatch = useDispatch();
  const techniqueRegistry = useTechniqueRegistry();
  const [techniqueDrawerOpen, setTechniqueDrawerOpen] = useState(false);
  const [techInfoAnchor, setTechInfoAnchor] = useState(null);
  const [techInfo, setTechInfo] = useState(null);
  const [swapOpen, setSwapOpen] = useState(false);

  const updateTechniques = (nextTechniques) =>
    setLocalTraining((prev) =>
      prev.map((set, sIndex) =>
        sIndex === setIndex
          ? set.map((item, eIndex) =>
              eIndex === exerciseIndex ? { ...item, techniques: nextTechniques } : item
            )
          : set
      )
    );

  const [title, setTitle] = useState(exercise.exercise);
  const [exerciseType, setExerciseType] = useState(exercise.exerciseType || "Reps");
  const [sets, setSets] = useState(exercise.goals.sets || 0);
  const [editMode, setEditMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [targetExerciseProgress, setTargetExerciseProgess] = useState({});
  const handleClose = () => setOpen(false);
  const handleModalToggle = () => setOpen((prev) => !prev);
  const handleModalExercise = () => {
    if (!title) return;
    dispatch(requestExerciseProgress(title, workoutUser)).then(() =>{
      setTargetExerciseProgess(title)
      handleModalToggle()
    });
  };
  const [anchorEl, setAnchorEl] = useState(null);
  const exerciseOptionsOpen = Boolean(anchorEl);
  const handleExerciseOptionsClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExerciseOptionsClose = () => {
    setAnchorEl(null);
  };

  const user = useSelector((state) => state.user);
  const weightUnit = normalizeWeightUnit(weightUnitOverride || user.workoutWeightUnit);
  const exerciseList = useSelector((state) => state.progress.exerciseList);

  const {
    recentHistoryOptions,
    selectedHistoryKey,
    handleExerciseSelectionChange,
    handleHistoryPresetChange,
    resetConfirmationOpen,
    resetConfirmationReason,
    handleResetConfirmationClose,
    handleResetConfirmationSubmit,
  } = useExerciseGoalPreset({
    currentWorkoutExercise: exercise,
    currentExercise: title,
    setCurrentExercise: setTitle,
    exerciseType,
    setExerciseType,
    sets,
    setLocalTraining,
    setIndex,
    exerciseIndex,
    exerciseList,
    workoutUser,
    user,
  });

  const handleTypeChange = (e) => setExerciseType(e.target.value);

  const handleSetChange = (e) => setSets(Number(e.target.value));

  // Per-exercise notes & the trainer's coaching cue. Both mutate the local entry (persisted by
  // the normal save bar); a client note is also mirrored into the workout comment thread by the
  // parent so the trainer gets the usual comment notification.
  const updateEntry = (mutator) =>
    setLocalTraining((prev) =>
      prev.map((set, sIndex) => {
        if (setIndex === sIndex) {
          set.map((ex, eIndex) => {
            if (eIndex === exerciseIndex) mutator(ex);
            return ex;
          });
        }
        return set;
      })
    );

  const handleAddExerciseNote = (text) => {
    const note = {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
      text,
      timestamp: new Date(),
    };
    updateEntry((ex) => {
      ex.feedback = ex.feedback || { difficulty: 1, comments: [] };
      ex.feedback.comments = [...(ex.feedback.comments || []), note];
    });
    onExerciseNote?.(title?.exerciseTitle || "Exercise", text);
  };

  const handleSaveCoachNote = (text) => updateEntry((ex) => {
    ex.coachNote = text;
  });

  // Per-exercise progression within this program: the rule, the working weight, the ceiling,
  // and — when the exercise appears more than once in the week — each day's share of that
  // working weight. Only meaningful on a client's assigned copy, since the working weight is
  // per client; a program-day template has no client to anchor to.
  const [progressionOpen, setProgressionOpen] = useState(false);
  const exerciseLibraryId = title?._id || exercise.exercise?._id || exercise.exercise;
  const canSetProgression = Boolean(
    user?.isTrainer && workoutProgramId && workoutUser && exerciseLibraryId
  );
  const currentCeiling = exercise.progression?.ceiling;
  const currentPercent = exercise.progression?.percentOfAnchor;

  const exerciseNoteCount = (exercise.feedback?.comments || []).filter((c) => !c.deletedAt).length;

  useEffect(() => {
    // Ensures each proptery array length matches the amount of sets
    const setPropertyCheck = (property) => {
      while (Number(property.length) !== Number(sets)) {
        Number(property.length) > Number(sets) ? property.pop() : property.push(0);
      }
    };

    setLocalTraining((prev) => {
      return prev.map((set, sIndex) => {
        if (setIndex === sIndex) {
          set.map((exercise, eIndex) => {
            if (eIndex === exerciseIndex) {
              exercise.exercise = title;
              exercise.exerciseType = exerciseType;
              exercise.goals = {
                ...exercise.goals,
                sets: sets,
              };
              setPropertyCheck(exercise.achieved.reps);
              setPropertyCheck(exercise.achieved.weight);
              setPropertyCheck(exercise.achieved.percent);
              setPropertyCheck(exercise.achieved.seconds);
              setPropertyCheck(exercise.goals.minReps);
              setPropertyCheck(exercise.goals.maxReps);
              setPropertyCheck(exercise.goals.exactReps);
              setPropertyCheck(exercise.goals.weight);
              setPropertyCheck(exercise.goals.percent);
              setPropertyCheck(exercise.goals.seconds);
              exercise.goals.rpe = Array.isArray(exercise.goals.rpe) ? exercise.goals.rpe : [];
              setPropertyCheck(exercise.goals.rpe);
            }
            return exercise;
          });
        }
        return set;
      });
    });
  }, [setLocalTraining, exerciseIndex, setIndex, sets, title, exerciseType]);

  const handleAutoFillExercise = () => {
    setLocalTraining((prev) => {
      return prev.map((set, sIndex) => {
        if (setIndex === sIndex) {
          set.map((exercise, eIndex) => {
            if (eIndex === exerciseIndex) {
              switch (exercise.exerciseType) {
                case "Reps":
                  exercise.achieved.reps = exercise.achieved.reps.map(
                    (rep, repIndex) => (rep = Number(rep) || exercise.goals.exactReps[repIndex])
                  );
                  exercise.achieved.weight = exercise.achieved.weight.map(
                    (weight, weightIndex) =>
                      (weight = Number(weight) || exercise.goals.weight[weightIndex])
                  );
                  break;
                case "Time":
                  exercise.achieved.seconds = exercise.achieved.seconds.map(
                    (second, secondIndex) =>
                      (second = Number(second) || exercise.goals.seconds[secondIndex])
                  );
                  break;
                case "Reps with %":
                  exercise.achieved.reps = exercise.achieved.reps.map(
                    (rep, repIndex) => (rep = Number(rep) || exercise.goals.exactReps[repIndex])
                  );
                  exercise.achieved.weight = exercise.achieved.weight.map(
                    (weight, weightIndex) =>
                      (weight =
                        Number(weight) ||
                        (Number(exercise.goals.percent[weightIndex]) / 100) *
                          exercise.goals.oneRepMax)
                  );
                  break;
                default:
                  break;
              }
            }
            return exercise;
          });
        }
        return set;
      });
    });
  };

  // Field layouts live in features/workout/utils/exerciseTypes — one descriptor per type,
  // shared with the log view, the overview and the reorder list.
  const EditFields = () => {
    const fields = editFieldsFor(exerciseType);
    if (!fields) return <Typography color="text.primary">Type Error</Typography>;
    return fields;
  };

  const LoggedFields = () => loggedFieldsFor(exerciseType) || [];

  const handleEditToggle = () => {
    setEditMode((prev) => !prev);
  };

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({
    confirmFuction: null,
    index: null,
  });

  const handleConfirmDialogOpen = (removeExercise, setIndex, exerciseIndex) => {
    setConfirmDialogData({
      confirmFunction: removeExercise,
      setIndex,
      exerciseIndex,
    });
    setConfirmDialogOpen((prev) => true);
  };
  const handleConfirmDialogClose = () => setConfirmDialogOpen((prev) => false);

  const handleDeleteConfirmationSubmit = () => {
    confirmDialogData.confirmFunction(confirmDialogData.setIndex, confirmDialogData.exerciseIndex);
    handleConfirmDialogClose();
  };
  
  const matchWords = (option, inputValue) => {
    if(!option) return false;
    const words = inputValue.toLowerCase().split(" ").filter(Boolean);
    return words.every((word) => option.toLowerCase().includes(word));
  };

  useEffect(() => {
    setHeightToggle((prev) => !prev);
  }, [editMode, setHeightToggle]);

  return (
    <Card sx={{ mb: 3, width: '100%', overflow: 'visible' }}>
      <CardContent>
        <Grid container spacing={2} sx={{ justifyContent: "center" }}>
          {editMode ? (
            <>
              <Grid container size={12} spacing={1}>
                <Grid size={12}>
                  <Autocomplete
                    disableCloseOnSelect
                    fullWidth
                    value={title}
                    options={exerciseList
                      .sort((a, b) => a.exerciseTitle.localeCompare(b.exerciseTitle))
                      .map((option) => option)}
                    isOptionEqualToValue={(option, value) => option._id === value._id}
                    getOptionLabel={(option) => option.exerciseTitle}
                    onChange={handleExerciseSelectionChange}
                    filterOptions={(options, { inputValue }) => 
                      options.filter(option => matchWords(option.exerciseTitle, inputValue))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Exercise Title"
                        placeholder="Exercises"
                        slotProps={{
                          ...params.slotProps,
                          input: {
                            ...params.slotProps?.input,
                            endAdornment: (
                              <>
                                <Tooltip title="View Progress Chart">
                                  <IconButton variant="contained" onClick={handleModalExercise}>
                                    <Info />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Log Exercise">
                                  <IconButton variant="contained" onClick={handleEditToggle}>
                                    <FactCheck />
                                  </IconButton>
                                </Tooltip>
                                {params.slotProps?.input?.endAdornment}
                              </>
                            ),
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={12}>
                  <ExerciseGoalPresetField
                    recentHistoryOptions={recentHistoryOptions}
                    selectedHistoryKey={selectedHistoryKey}
                    onChange={handleHistoryPresetChange}
                    weightUnit={weightUnit}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, }} >
                  <TextField
                    label="Type"
                    select
                    fullWidth
                    value={exerciseType}
                    onChange={handleTypeChange}
                  >
                    <MenuItem value="Rep Range">Rep Range</MenuItem>
                    <MenuItem value="Reps">Reps</MenuItem>
                    <MenuItem value="Reps with %">Reps with %</MenuItem>
                    <MenuItem value="Time">Time</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, }} >
                  <TextField
                    label="Sets"
                    select
                    fullWidth
                    value={sets}
                    onChange={handleSetChange}
                  >
                    {[...Array(21)].map((x, i) => (
                      <MenuItem key={i} value={i}>
                        {i}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <EditLoader
                  fields={EditFields()}
                  exercise={exercise}
                  sets={sets}
                  setIndex={setIndex}
                  exerciseIndex={exerciseIndex}
                  localTraining={localTraining}
                  setLocalTraining={setLocalTraining}
                  weightUnit={weightUnit}
                  onToggleWeightUnit={onToggleWeightUnit}
                  weightsLocked={weightsLocked}
                />
              </Grid>
              <Grid container size={12} sx={{ alignContent: "center" }}>
                <Grid container size={12} sx={{ justifyContent: "center", alignContent: "center" }}>
                  <Grid >
                    <Tooltip title="Remove exercise">
                      <IconButton
                        onClick={() => handleConfirmDialogOpen(removeExercise, setIndex, exerciseIndex)}
                      >
                        <RemoveCircle />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Grid>
              {confirmDialogOpen && (
                <Dialog open={confirmDialogOpen} onClose={handleConfirmDialogClose}>
                  <DialogTitle>
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
                          Are you sure you would like to remove the exercise?
                        </Typography>
                      </Grid>
                      <Grid container size={12} spacing={2} sx={{ justifyContent: "center" }}>
                        <Grid >
                          <Button
                            color="secondaryButton"
                            variant="contained"
                            onClick={handleConfirmDialogClose}
                          >
                            Cancel
                          </Button>
                        </Grid>
                        <Grid >
                          <Button variant="contained" onClick={handleDeleteConfirmationSubmit}>
                            Confirm
                          </Button>
                        </Grid>
                      </Grid>
                    </Grid>
                  </DialogContent>
                </Dialog>
              )}
              <Dialog open={resetConfirmationOpen} onClose={handleResetConfirmationClose}>
                <DialogTitle>
                  <Grid container>
                    <Grid container size={12}>
                      Discard Logged Progress?
                    </Grid>
                  </Grid>
                </DialogTitle>
                <DialogContent>
                  <Grid container spacing={1} sx={{ padding: "10px 0px" }}>
                    <Grid container size={12}>
                      <Typography variant="body1">
                        {resetConfirmationReason === "preset"
                          ? "Changing the goal preset will clear the achieved values already entered for this exercise. Continue?"
                          : "Changing this exercise will clear the achieved values already entered for it. Continue?"}
                      </Typography>
                    </Grid>
                    <Grid container size={12} spacing={2} sx={{ justifyContent: "center" }}>
                      <Grid>
                        <Button
                          color="secondaryButton"
                          variant="contained"
                          onClick={handleResetConfirmationClose}
                        >
                          Cancel
                        </Button>
                      </Grid>
                      <Grid>
                        <Button variant="contained" onClick={handleResetConfirmationSubmit}>
                          Continue
                        </Button>
                      </Grid>
                    </Grid>
                  </Grid>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              <Grid container size={12} spacing={2}>
                <Grid
                  container
                  size={2}
                  sx={{ justifyContent: "flex-end", alignContent: "center" }}
                ></Grid>
                <Grid
                  container
                  size={8}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography color="text.primary" variant="h6">
                    {title?.exerciseTitle || "Select an exercise"}
                  </Typography>
                  {exercise.feedback?.difficulty === 0 && (
                    <Chip size="small" color="secondary" label="Too easy" />
                  )}
                  {exercise.feedback?.difficulty === 2 && (
                    <Chip size="small" color="error" label="Too hard" />
                  )}
                  {(exercise.techniques || []).map((t) => {
                    const label = renderTechniqueDisplay(techniqueRegistry, t.key, t.params);
                    if (!label) return null;
                    const qualifier = appliesToLabel(t.appliesToSets, sets);
                    return (
                      <Chip
                        key={t._id || t.key}
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={qualifier ? `${label} · ${qualifier}` : label}
                        onClick={(e) => {
                          setTechInfo(t);
                          setTechInfoAnchor(e.currentTarget);
                        }}
                        onDelete={
                          editMode
                            ? () =>
                                updateTechniques(
                                  (exercise.techniques || []).filter((x) => x !== t)
                                )
                            : undefined
                        }
                      />
                    );
                  })}
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<Add fontSize="small" />}
                    label="Technique"
                    onClick={() => setTechniqueDrawerOpen(true)}
                    clickable
                  />
                </Grid>
                <Grid
                  container
                  size={2}
                  sx={{ justifyContent: "flex-start", alignContent: "center" }}
                >
                  <Tooltip title="Exercise Options">
                    <IconButton onClick={handleExerciseOptionsClick} ref={anchorEl}>
                      <MoreVertSharp />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
              {user?.isTrainer
                && ((currentPercent !== null && currentPercent !== undefined)
                  || (currentCeiling !== null && currentCeiling !== undefined)) && (
                <Grid container size={12} sx={{ pl: 0.5, rowGap: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: "100%" }}>
                    {[
                      currentPercent !== null && currentPercent !== undefined
                        ? `${currentPercent}% of the working weight`
                        : "",
                      currentCeiling !== null && currentCeiling !== undefined
                        ? `ceiling ${currentCeiling} ${weightUnit}`
                        : "",
                    ].filter(Boolean).join(" · ")}
                  </Typography>
                </Grid>
              )}
              {(exercise.coachNote || exerciseNoteCount > 0) && (
                <Grid container size={12} sx={{ pl: 0.5, rowGap: 0 }}>
                  {exercise.coachNote && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      // Cues are authored one instruction per line. Without pre-line the whole
                      // block collapses into a single run-on paragraph.
                      sx={{ width: "100%", fontStyle: "italic", whiteSpace: "pre-line" }}
                    >
                      Coach: {exercise.coachNote}
                    </Typography>
                  )}
                  {exerciseNoteCount > 0 && (
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{ cursor: "pointer" }}
                      onClick={() => setNotesOpen(true)}
                    >
                      {exerciseNoteCount} note{exerciseNoteCount === 1 ? "" : "s"}
                    </Typography>
                  )}
                </Grid>
              )}
              <Menu open={exerciseOptionsOpen} onClose={handleExerciseOptionsClose} anchorEl={anchorEl}>
                <MenuItem
                  onClick={() => {
                    handleAutoFillExercise();
                    handleExerciseOptionsClose();
                  }}
                >
                  Autocomplete Exercise
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleModalExercise();
                    handleExerciseOptionsClose();
                  }}
                >
                  View Progress Chart
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setDemoOpen(true);
                    handleExerciseOptionsClose();
                  }}
                >
                  Watch demo
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setNotesOpen(true);
                    handleExerciseOptionsClose();
                  }}
                >
                  {user?.isTrainer ? "Notes & coaching cue" : "Add note"}
                </MenuItem>
                {/* Available to clients too (2026-08-04): the server authorizes by resource
                    ownership, so a client can only ever swap on their own workouts. */}
                <MenuItem
                  onClick={() => {
                    setSwapOpen(true);
                    handleExerciseOptionsClose();
                  }}
                >
                  Swap exercise…
                </MenuItem>
                {canSetProgression && (
                  <MenuItem
                    onClick={() => {
                      setProgressionOpen(true);
                      handleExerciseOptionsClose();
                    }}
                  >
                    Set progression…
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() =>
                    setEditMode((prev) => {
                      handleExerciseOptionsClose();
                      return !prev;
                    })
                  }
                >
                  Edit Exercise
                </MenuItem>
              </Menu>
              <Dialog open={demoOpen} onClose={() => setDemoOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{title?.exerciseTitle || "Exercise demo"}</DialogTitle>
                <DialogContent>
                  {(() => {
                    const resolved = resolveDemoMedia(title, exerciseList);
                    return (
                      <>
                        <ExerciseMedia
                          exercise={
                            resolved.mediaUrl ? { ...title, mediaUrl: resolved.mediaUrl } : title
                          }
                        />
                        {resolved.from && (
                          <Typography variant="caption" color="text.secondary">
                            Demo from {resolved.from} (same movement family)
                          </Typography>
                        )}
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>
              {canSetProgression && (
                <SetProgressionDialog
                  open={progressionOpen}
                  onClose={() => setProgressionOpen(false)}
                  clientId={String(workoutUser?._id || workoutUser)}
                  programId={String(workoutProgramId)}
                  exerciseId={String(exerciseLibraryId)}
                  exerciseTitle={title?.exerciseTitle || "Exercise"}
                  weightUnit={weightUnit}
                />
              )}
              <ExerciseCommentDialog
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                exerciseTitle={title?.exerciseTitle}
                entry={exercise}
                isTrainer={Boolean(user?.isTrainer)}
                onAddNote={handleAddExerciseNote}
                onSaveCue={handleSaveCoachNote}
              />
              <SwapExerciseDialog
                open={swapOpen}
                onClose={() => setSwapOpen(false)}
                currentExercise={title}
                onApplied={(replacement) => {
                  if (!replacement) return;
                  // Update this row's display, then swap EXACTLY this slot via the same persist
                  // path removeExercise uses (immutable rebuild + updateTraining). Index-targeted,
                  // so a duplicate copy of the same exercise elsewhere is never touched.
                  setTitle(replacement);
                  if (replacement.measurementType === "time") setExerciseType("Time");
                  swapExercise(setIndex, exerciseIndex, replacement);
                }}
              />
              <LogLoader
                fields={LoggedFields()}
                exercise={exercise}
                sets={sets}
                setIndex={setIndex}
                exerciseIndex={exerciseIndex}
                localTraining={localTraining}
                setLocalTraining={setLocalTraining}
                weightUnit={weightUnit}
                onToggleWeightUnit={onToggleWeightUnit}
                weightsLocked={weightsLocked}
              />
              <TechniqueLogger
                registry={techniqueRegistry}
                techniques={exercise.techniques || []}
                onChange={updateTechniques}
              />
            </>
          )}

          {open && (
            <ModalBarChartHistory
              workoutUser={workoutUser}
              exerciseList={exerciseList}
              targetExerciseProgress={targetExerciseProgress}
              open={open}
              handleClose={handleClose}
            />
          )}
          <TechniqueDrawer
            open={techniqueDrawerOpen}
            onClose={() => setTechniqueDrawerOpen(false)}
            registry={techniqueRegistry}
            techniques={exercise.techniques || []}
            onChange={updateTechniques}
            exerciseSets={sets}
          />
          <Popover
            open={Boolean(techInfoAnchor)}
            anchorEl={techInfoAnchor}
            onClose={() => setTechInfoAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            {techInfo && (
              <Box sx={{ p: 2, maxWidth: 280 }}>
                <Typography variant="subtitle2">
                  {techniqueRegistry.byKey?.[techInfo.key]?.name || techInfo.key}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {techniqueRegistry.byKey?.[techInfo.key]?.description}
                </Typography>
                {techInfo.notes && (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }}>
                    “{techInfo.notes}”
                  </Typography>
                )}
              </Box>
            )}
          </Popover>
        </Grid>
      </CardContent>
    </Card>
  );
}
