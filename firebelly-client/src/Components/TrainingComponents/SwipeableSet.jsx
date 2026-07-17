import React, { useEffect, useState, useRef, Fragment, useMemo } from "react";
import { useSelector } from "react-redux";
import { serverURL } from "../../Redux/actions";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormGroup,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  MobileStepper,
  Paper,
  Radio,
  RadioGroup,
  Slide,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  AddCircle,
  RemoveCircle,
  Close as CloseIcon,
} from "@mui/icons-material";
import SwipeableViewsModule from "react-swipeable-views";
import Exercise from "./Exercise";
import CircuitFeedback from "./CircuitFeedback";
import { ExerciseListAutocomplete } from "../../features/workout/components/AddExercisesDialog";
import dayjs from "dayjs";

const SwipeableViews = SwipeableViewsModule.default ?? SwipeableViewsModule;
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// A circuit is a "warm-up" circuit if any of its entries is flagged isWarmup.
const isWarmupCircuit = (group) => Array.isArray(group) && group.some((e) => e?.isWarmup);

function SwipeableSet(props) {
  const {
    workoutUser,
    localTraining,
    newSet,
    removeSet,
    removeExercise,
    swapExercise,
    setLocalTraining,
    newExercise,
    newWarmup,
    toggleNewSet,
    toggleRemoveSet,
    maxSteps,
    selectedDate,
    size,
    workoutCompleteStatus,
    setWorkoutCompleteStatus,
    workoutFeedback,
    setWorkoutFeedback,
    activeStep,
    setActiveStep,
    weightUnit,
    onToggleWeightUnit,
    allowFeedback,
  } = props;

  const [heightToggle, setHeightToggle] = useState(true);
  const ref = useRef(null);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleStepChange = (step) => {
    setActiveStep(step);
  };

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({
    confirmFuction: null,
    index: null,
  });

  const handleConfirmDialogOpen = (removeSet, index) => {
    setConfirmDialogData({
      confirmFunction: removeSet,
      index,
    });
    setConfirmDialogOpen((prev) => true);
  };
  const handleConfirmDialogClose = () => setConfirmDialogOpen((prev) => false);

  const handleDeleteConfirmationSubmit = () => {
    confirmDialogData.confirmFunction(confirmDialogData.index);
    handleConfirmDialogClose();
  };

  const handleWorkoutCompleteCheckbox = () => setWorkoutCompleteStatus((prev) => !prev);

  const allExercises = useMemo(() => {
    return localTraining.flatMap((group) => group.map((ex) => ex));
  }, [localTraining]);

  // Per-circuit label: warm-up circuits show "Warm-up"; main circuits are numbered, skipping warm-ups.
  const circuitLabels = useMemo(
    () =>
      (localTraining || []).reduce((acc, group) => {
        if (isWarmupCircuit(group)) {
          acc.push({ warmup: true });
        } else {
          const priorMain = acc.filter((c) => !c.warmup).length;
          acc.push({ warmup: false, number: priorMain + 1 });
        }
        return acc;
      }, []),
    [localTraining]
  );

  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const handleFeedbackDialogOpen = () => setFeedbackDialogOpen(true);
  const handleFeedbackDialogClose = () => setFeedbackDialogOpen(false);
  const [feedbackSelectedExercises, setFeedbackSelectedExercises] = useState([...allExercises]);

  useEffect(() => {
    const update = () => {
      ref.current?.updateHeight?.();
    };

    // Initial update
    update();

    // Add resize event listener
    window.addEventListener("resize", update);

    // Cleanup resize listener on unmount
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [localTraining, feedbackSelectedExercises, heightToggle]);

  useEffect(() => {
    if (activeStep >= maxSteps - 1) {
      handleStepChange(maxSteps - 2);
    }
  }, [toggleRemoveSet]);

  useEffect(() => {
    // maxSteps -2
    //  -1 for index correlation
    //  -1 for workout complete page
    handleStepChange(maxSteps - 2);
  }, [toggleNewSet]);

  useEffect(() => {
    handleStepChange(0);
  }, [selectedDate]);

  return (
    <Box sx={{ maxWidth: "100%", minHeight: "100%", flexGrow: 1 }}>
      <MobileStepper
        steps={maxSteps}
        position="static"
        activeStep={activeStep}
        nextButton={
          <Button size="small" onClick={handleNext} disabled={activeStep === maxSteps - 1}>
            Next
            <KeyboardArrowRight />
          </Button>
        }
        backButton={
          <Button size="small" onClick={handleBack} disabled={activeStep === 0}>
            <KeyboardArrowLeft />
            Back
          </Button>
        }
      />
      {newWarmup && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
          <Tooltip title="Add movement-based warm-up exercises (won't progress week to week)">
            <Button size="small" startIcon={<AddCircle />} onClick={newWarmup}>
              Add warm-up
            </Button>
          </Tooltip>
        </Box>
      )}
      <SwipeableViews
        axis="x"
        index={activeStep}
        onChangeIndex={handleStepChange}
        animateHeight
        ref={ref}
      >
        {localTraining.map((group, index) => (
          <div key={`training-indexes-${index}/${localTraining.length}`}>
            <Grid size={12}>
              <Grid container size={12}>
                <Grid container size={12} sx={{ justifyContent: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Tooltip title="Remove circuit">
                      <IconButton onClick={() => handleConfirmDialogOpen(removeSet, index)}>
                        <RemoveCircle />
                      </IconButton>
                    </Tooltip>
                    <Typography
                      variant="h5"
                      color={circuitLabels[index]?.warmup ? "info.main" : "text.primary"}
                    >
                      {circuitLabels[index]?.warmup
                        ? "Warm-up"
                        : `Circuit ${circuitLabels[index]?.number ?? index + 1}`}
                    </Typography>
                    <Tooltip title="Add a new circuit">
                      <IconButton onClick={newSet}>
                        <AddCircle />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
              </Grid>
              {group.length > 0 &&
                group.map((exercise, exerciseIndex) =>
                  // All warm-ups (library or custom) render as one compact row — warm-ups don't need
                  // the full exercise editor (sets/weight grid, progress chart, swap, techniques).
                  exercise.isWarmup ? (
                    <WarmupRow
                      key={`warmup-${exercise._id || exercise.customName || exerciseIndex}`}
                      entry={exercise}
                      setIndex={index}
                      exerciseIndex={exerciseIndex}
                      removeExercise={removeExercise}
                      setLocalTraining={setLocalTraining}
                    />
                  ) : (
                    <Exercise
                      key={`exercise-${exercise._id}-${exerciseIndex}`}
                      workoutUser={workoutUser}
                      exercise={exercise}
                      setIndex={index}
                      exerciseIndex={exerciseIndex}
                      removeExercise={removeExercise}
                      swapExercise={swapExercise}
                      localTraining={localTraining}
                      setLocalTraining={setLocalTraining}
                      setHeightToggle={setHeightToggle}
                      size={size}
                      weightUnit={weightUnit}
                      onToggleWeightUnit={onToggleWeightUnit}
                    />
                  )
                )}
              <Grid container size={12}>
                <Grid container size={12} sx={{ justifyContent: "center" }}>
                  <Tooltip title="Add a new exercise to the current set">
                    <IconButton onClick={() => newExercise(index)}>
                      <AddCircle />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
              {allowFeedback && (
                <CircuitFeedback
                  circuit={group}
                  circuitIndex={index}
                  setLocalTraining={setLocalTraining}
                />
              )}
            </Grid>
          </div>
        ))}
        <Box sx={{ padding: "25px 0" }}>
          <Grid size={12}>
            <Grid container size={12}>
              <Grid container size={12} sx={{ justifyContent: "center" }}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={workoutCompleteStatus}
                        onClick={handleWorkoutCompleteCheckbox}
                      />
                    }
                    label="Workout Complete"
                  />
                </FormGroup>
              </Grid>
              <Grid container size={12} spacing={2} sx={{ justifyContent: "center" }}>
                <Grid container size={12} sx={{ justifyContent: "center" }}>
                  <Typography variant="body1">Feedback:</Typography>
                </Grid>
                <Grid container size={12} sx={{ padding: "30px 0" }}>
                  <FeedbackWorkoutInput workoutFeedback={workoutFeedback} setWorkoutFeedback={setWorkoutFeedback} />
                  {/* <TextField
                    label="Overall Feedback"
                    value={workoutFeedback}
                    fullWidth
                    multiline
                    minRows={5}
                    onKeyDown={handleFeedbackKeyDown}
                    onChange={handleFeedbackChange}
                  /> */}
                </Grid>
                {/* <Grid container size={12} sx={{ justifyContent: "center", alignItems: "center" }}>
                  <IconButton onClick={handleFeedbackDialogOpen} >
                    <AddCircle />
                  </IconButton>
                  Choose Exercises
                </Grid> */}
                {/* <Grid container size={12} sx={{ padding: "0px 25px" }}>
                  {feedbackSelectedExercises.map((exercise) => {
                    return <FeedbackExerciseInput exercise={exercise} />;
                  })}
                </Grid> */}
              </Grid>
            </Grid>
          </Grid>
        </Box>
      </SwipeableViews>

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
                  Are you sure you would like to remove the circuit?
                </Typography>
              </Grid>
              <Grid container size={12} spacing={2} sx={{ justifyContent: "center" }}>
                <Grid>
                  <Button
                    color="secondaryButton"
                    variant="contained"
                    onClick={handleConfirmDialogClose}
                  >
                    Cancel
                  </Button>
                </Grid>
                <Grid>
                  <Button variant="contained" onClick={handleDeleteConfirmationSubmit}>
                    Confirm
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </DialogContent>
        </Dialog>
      )}

      {feedbackDialogOpen && (
        <FeedbackDialog
          feedbackDialogOpen={feedbackDialogOpen}
          handleFeedbackDialogClose={handleFeedbackDialogClose}
          exerciseList={allExercises}
          feedbackSelectedExercises={feedbackSelectedExercises}
          setFeedbackSelectedExercises={setFeedbackSelectedExercises}
        />
      )}
    </Box>
  );
}
const FeedbackWorkoutInput = ({ workoutFeedback, setWorkoutFeedback, }) => {
  const user = useSelector((state) => state.user);
  const [feedbackDifficulty, setFeedbackDifficulty] = useState(Number(workoutFeedback.difficulty) || 1);

  const handleFeedbackDifficultyChange = (event) => {
    const newValue = Number(event.target.value);
    setFeedbackDifficulty(newValue);
    setWorkoutFeedback((prev) => ({
      ...prev,
      difficulty: newValue,
    }));
  };

  const [commentText, setCommentText] = useState("");

  const handleFeedbackKeyDown = (e) => {
    // Check if any of Enter, Shift+Enter, Backspace, or Delete is pressed to resize
    if (
      (e.key === "Enter" && !e.shiftKey) || // Regular Enter
      (e.key === "Enter" && e.shiftKey) || // Shift + Enter
      e.key === "Backspace" || // Backspace
      e.key === "Delete" // Delete
    ) {
      setHeightToggle((prev) => !prev);
    }
  };

  const handleMessageSubmit = () => {
    if (!commentText.trim()) return;
    const newComment = {
      user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, profilePicture: user.profilePicture },
      text: commentText.trim(),
      timestamp: new Date(),
    };
    setWorkoutFeedback((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
    }));
    setCommentText("");
  };


  return (
    <Grid container size={12} component={Paper} spacing={1} sx={{ padding: '15px 7.5px', }}>
      <Grid container size={12}>
        <Typography>Overall Workout Feedback:</Typography>
      </Grid>
      <Grid container size={12} sx={{ padding: "0px 15px" }}>
        <Typography sx={{ mb: 1 }}>Rate Difficulty:</Typography>
        <RadioGroup
          row
          value={feedbackDifficulty}
          onChange={handleFeedbackDifficultyChange}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: { xs: "nowrap", sm: "nowrap" },
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <FormControlLabel
            value={0}
            control={
              <Radio
                sx={{
                  "&.Mui-checked": {
                    color: "secondary.main",
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color: feedbackDifficulty === 0 ? "secondary.main" : "text.primary",
                }}
              >
                Too Easy
              </Typography>
            }
          />
          <FormControlLabel
            value={1}
            control={
              <Radio
                sx={{
                  "&.Mui-checked": {
                    color: "primary.main",
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color: feedbackDifficulty === 1 ? "primary.main" : "text.primary",
                }}
              >
                Perfect
              </Typography>
            }
          />
          <FormControlLabel
            value={2}
            control={
              <Radio
                sx={{
                  "&.Mui-checked": {
                    color: "#d32f2f",
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color: feedbackDifficulty === 2 ? "#d32f2f" : "text.primary", // custom red
                }}
              >
                Too Hard
              </Typography>
            }
          />
        </RadioGroup>
      </Grid>
      {workoutFeedback.comments.map(comment => {
        return (
          <Grid container size={12} sx={{ padding: '7.5px 0', }}>
            <Grid container size={2} sx={{ justifyContent: 'center', }}>
              <Avatar src={comment.user.profilePicture ? `${serverURL}/user/profilePicture/${comment.user.profilePicture}` : null} />
            </Grid>
            <Grid container size={8} spacing={0} >
              <Grid container size={12} spacing={1}>
                <Typography variant="body2" display="inline">
                  {comment.user.firstName}{" "}{comment.user.lastName}
                </Typography>
                <Typography
                  variant="subtitle2"
                  display="inline"
                  sx={{
                    opacity: ".33",
                  }}
                >
                  {dayjs(comment.timestamp).format("MM/DD/YYYY h:mm:ss A")}
                </Typography>
              </Grid>
              <Grid container size={12}>
                <Typography variant="body1" display="block">
                  {comment.text}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
        )
      })}
      <Grid container size={12} sx={{ padding: "0px 15px" }}>
        <TextField
          label="Add comment..."
          value={commentText}
          onKeyDown={handleFeedbackKeyDown}
          onChange={(e) => setCommentText(e.target.value)}
          fullWidth
          multiline
          slotProps={{
            input: {
              endAdornment: (
                <Button variant="contained" onClick={handleMessageSubmit}>
                  Submit
                </Button>
              ),
            },
          }}
        />

      </Grid>
    </Grid>
  );
};

const FeedbackExerciseInput = ({ exercise }) => {
  const [feedbackDifficulty, setFeedbackDifficulty] = useState(exercise.feedback.difficulty);

  const handleFeedbackDifficultyChange = (event) => {
    setFeedbackDifficulty(Number(event.target.value));
  };

  return (
    <Grid container size={12} key={exercise._id} component={Paper} spacing={1} sx={{ padding: '15px 7.5px', }}>
      <Grid container size={12}>
        <Typography>{exercise.exercise?.exerciseTitle || exercise.customName || "Exercise"}:</Typography>
      </Grid>
      <Grid container size={12} sx={{ padding: "0px 15px" }}>
        <Typography sx={{ mb: 1 }}>Rate Difficulty:</Typography>
        <RadioGroup
          row
          value={feedbackDifficulty}
          onChange={handleFeedbackDifficultyChange}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: { xs: "nowrap", sm: "nowrap" },
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <FormControlLabel
            value={0}
            control={
              <Radio
                checked={feedbackDifficulty === 0}
                sx={{
                  "&.Mui-checked": {
                    color: "secondary.main",
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color: feedbackDifficulty === 0 ? "secondary.main" : "text.primary",
                }}
              >
                Too Easy
              </Typography>
            }
          />
          <FormControlLabel
            value={1}
            control={
              <Radio
                checked={feedbackDifficulty === 1}
                sx={{
                  "&.Mui-checked": {
                    color: "primary.main",
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color: feedbackDifficulty === 1 ? "primary.main" : "text.primary",
                }}
              >
                Perfect
              </Typography>
            }
          />
          <FormControlLabel
            value={2}
            control={
              <Radio
                checked={feedbackDifficulty === 2}
                sx={{
                  "&.Mui-checked": {
                    color: "#d32f2f",
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color: feedbackDifficulty === 2 ? "#d32f2f" : "text.primary", // custom red
                }}
              >
                Too Hard
              </Typography>
            }
          />
        </RadioGroup>
      </Grid>
      {exercise.feedback.comments.map(comment => {
        return (
          <Grid container sx={{ padding: '25px 0', }}>
            <Grid container size={2} sx={{ justifyContent: 'center', }}>
              <Avatar src={comment.user.profilePicture ? `${serverURL}/user/profilePicture/${comment.user.profilePicture}` : null} />
            </Grid>
            <Grid container size={8}>
              <Typography variant="body2" display="inline">
                {comment.user.firstName}{" "}{comment.user.lastName}
              </Typography>
              <Typography
                variant="subtitle2"
                display="inline"
                sx={{
                  opacity: ".33",
                }}
              >
                {dayjs(comment.timestamp).format("MM/DD/YYYY h:mm:ss A")}
              </Typography>
              <Typography variant="body1" display="block">
                {comment.text}
              </Typography>
            </Grid>
          </Grid>
        )
      })}
      <Grid container size={12} sx={{ padding: "0px 15px" }}>
        <TextField label="Add comment..." fullWidth multiline
          slotProps={{
            input: {
              endAdornment: (
                <Button variant="contained" color="primary" onClick={(e) => handleMessageSubmit(e)}>
                  Submit
                </Button>
              ),
            }
          }} />
      </Grid>
    </Grid>
  );
};

const FeedbackDialog = ({
  feedbackDialogOpen,
  handleFeedbackDialogClose,
  exerciseList,
  feedbackSelectedExercises,
  setFeedbackSelectedExercises,
}) => {
  const [selectedExercises, setSelectedExercises] = useState(feedbackSelectedExercises);

  const allSelected = selectedExercises.length === exerciseList.length;
  const someSelected = selectedExercises.length > 0 && !allSelected;

  const handleToggle = (exercise) => {
    setSelectedExercises((prev) => {
      const isSelected = prev.some((ex) => ex._id === exercise._id);
      return isSelected ? prev.filter((ex) => ex._id !== exercise._id) : [...prev, exercise];
    });
  };

  const handleToggleAll = () => {
    setSelectedExercises(allSelected ? [] : [...exerciseList]);
  };

  const handleConfirm = () => {
    setFeedbackSelectedExercises(selectedExercises);
    handleFeedbackDialogClose();
  };

  return (
    <Dialog
      open={feedbackDialogOpen}
      fullWidth
      maxWidth="sm"
      slots={{ transition: Transition }}
      slotProps={{ paper: { sx: { height: "80%" } } }}
    >
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={handleFeedbackDialogClose}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Select Exercises
          </Typography>
          <Button variant="contained" onClick={handleConfirm}>
            Confirm
          </Button>
        </Toolbar>
      </AppBar>

      <DialogContent>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleToggleAll}
              />
            }
            label="Select All"
            sx={{ userSelect: "none" }}
          />
          <Divider sx={{ my: 1 }} />
          {exerciseList
            .filter((exercise) => exercise.exercise?._id)
            .map((exercise) => (
              <FormControlLabel
                key={exercise.exercise._id}
                control={
                  <Checkbox
                    checked={selectedExercises.some((ex) => ex.exercise?._id === exercise.exercise._id)}
                    onChange={() => handleToggle(exercise)}
                  />
                }
                label={exercise.exercise.exerciseTitle}
                sx={{ userSelect: "none" }}
              />
            ))}
        </FormGroup>
      </DialogContent>
    </Dialog>
  );
};

// One compact row for EVERY warm-up (library exercise or free-text custom). Warm-ups don't need the
// full exercise editor, so this shows just: name + an editable target (Minutes / Reps / As needed) +
// an optional "Done" log (loggable, never required) + remove.
const WarmupRow = ({ entry, setIndex, exerciseIndex, removeExercise, setLocalTraining }) => {
  const exerciseList = useSelector((state) => state.progress.exerciseList) || [];
  const exId = String(entry.exercise?._id || entry.exercise || "");
  const libName = entry.exercise?.exerciseTitle || exerciseList.find((e) => e._id === exId)?.exerciseTitle;
  const name = entry.customName || libName || "Warm-up";

  const g = entry.goals || {};
  const secs = Number((g.seconds || [])[0]) || 0;
  const reps = Number((g.exactReps || [])[0]) || 0;
  const measure = entry.exerciseType === "Time" || secs > 0 ? "time" : reps > 0 ? "reps" : "none";
  const amount = measure === "time" ? Math.round(secs / 60) : measure === "reps" ? reps : "";

  const ach = entry.achieved || {};
  const achVal =
    measure === "time"
      ? Number((ach.seconds || [])[0])
        ? Math.round(Number(ach.seconds[0]) / 60)
        : ""
      : measure === "reps"
      ? Number((ach.reps || [])[0]) || ""
      : "";

  const patchEntry = (fn) =>
    setLocalTraining((prev) =>
      (prev || []).map((circuit, ci) =>
        ci !== setIndex ? circuit : circuit.map((e, ei) => (ei !== exerciseIndex ? e : fn({ ...e })))
      )
    );

  const setMeasure = (m) =>
    patchEntry((e) => {
      const goals = { ...(e.goals || {}), sets: 1, minReps: [0], maxReps: [0], exactReps: [0], weight: [0], percent: [0], seconds: [0] };
      let exerciseType = "Reps";
      if (m === "time") {
        exerciseType = "Time";
        goals.seconds = ["300"];
      } else if (m === "reps") {
        goals.exactReps = ["10"];
      }
      return { ...e, exerciseType, goals };
    });

  const setAmount = (v) =>
    patchEntry((e) => {
      const n = Math.max(0, Number(v) || 0);
      const goals = { ...(e.goals || {}), sets: 1 };
      if (measure === "time") goals.seconds = [String(n * 60)];
      else if (measure === "reps") goals.exactReps = [String(n)];
      return { ...e, goals };
    });

  const setAchieved = (v) =>
    patchEntry((e) => {
      const n = Math.max(0, Number(v) || 0);
      const achieved = { ...(e.achieved || {}), sets: 1 };
      if (measure === "time") achieved.seconds = [String(n * 60)];
      else if (measure === "reps") achieved.reps = [String(n)];
      return { ...e, achieved };
    });

  return (
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, width: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: "1 1 140px" }}>
          {name}
        </Typography>
        <TextField
          select
          size="small"
          label="Target"
          value={measure}
          onChange={(e) => setMeasure(e.target.value)}
          sx={{ minWidth: 110 }}
        >
          <MenuItem value="time">Minutes</MenuItem>
          <MenuItem value="reps">Reps</MenuItem>
          <MenuItem value="none">As needed</MenuItem>
        </TextField>
        {measure !== "none" && (
          <TextField
            size="small"
            type="number"
            label={measure === "time" ? "Min" : "Reps"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{ width: 80 }}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        )}
        {measure !== "none" && (
          <TextField
            size="small"
            type="number"
            label="Done"
            value={achVal}
            onChange={(e) => setAchieved(e.target.value)}
            sx={{ width: 80 }}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        )}
        <Tooltip title="Remove warm-up">
          <IconButton size="small" onClick={() => removeExercise(setIndex, exerciseIndex)}>
            <RemoveCircle />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
};

export default SwipeableSet;
