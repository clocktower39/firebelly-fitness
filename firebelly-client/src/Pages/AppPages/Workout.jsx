import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { getAccessToken, getDelegatedReturnAccessToken } from "../../api/client";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useOutletContext, useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Grid,
  Snackbar,
  TextField,
} from "@mui/material";
import WorkoutTrainerSessionDialog from "../../Components/TrainingComponents/WorkoutTrainerSessionDialog";
import { WorkoutOptionModalView } from "../../Components/WorkoutOptionModal";
import AddExercisesDialog from "../../features/workout/components/AddExercisesDialog";
import { requestTraining, updateTraining, getExerciseList } from "../../Redux/actions";
import { workoutApi } from "../../api/workoutApi";
import Loading from "../../Components/Loading";
import CardioDetailsEditor from "../../features/workout/components/cardio/CardioDetailsEditor";
import SportsDetailsEditor from "../../features/workout/components/sports/SportsDetailsEditor";
import YogaDetailsEditor from "../../features/workout/components/yoga/YogaDetailsEditor";
import PilatesDetailsEditor from "../../features/workout/components/pilates/PilatesDetailsEditor";
import { buildCardioTitle } from "../../features/workout/utils/workoutUtils";
import { buildSportsTitle } from "../../features/workout/utils/sportsUtils";
import { buildYogaTitle } from "../../features/workout/utils/yogaUtils";
import { buildPilatesTitle } from "../../features/workout/utils/pilatesUtils";
import StrengthWorkoutEditor from "../../features/workout/components/StrengthWorkoutEditor";
import WorkoutCategoryField from "../../features/workout/components/WorkoutCategoryField";
import WorkoutHeader from "../../features/workout/components/WorkoutHeader";
import DailyCheckinCard from "../../Components/DailyCheckinCard";
import useWorkoutCardio from "../../features/workout/hooks/useWorkoutCardio";
import useWorkoutSports from "../../features/workout/hooks/useWorkoutSports";
import useWorkoutYoga from "../../features/workout/hooks/useWorkoutYoga";
import useWorkoutPilates from "../../features/workout/hooks/useWorkoutPilates";
import useWorkoutDirtyState from "../../features/workout/hooks/useWorkoutDirtyState";
import useWorkoutScheduleEvent from "../../features/workout/hooks/useWorkoutScheduleEvent";
import useWorkoutSocketSync from "../../features/workout/hooks/useWorkoutSocketSync";
import advancedFormat from "dayjs/plugin/advancedFormat";
import utc from "dayjs/plugin/utc";
import { normalizeWeightUnit } from "../../utils/weightUnits";
import { readWorkoutGestures, saveWorkoutGestures } from "../../features/workout/utils/workoutUtils";

dayjs.extend(utc);
dayjs.extend(advancedFormat);

export default function Workout({ socket }) {
  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const returnPath = searchParams.get("return");
  const sourceView = searchParams.get("source");
  const isProgramBuilder = sourceView === "program";

  const user = useSelector((state) => state.user);
  const exerciseList = useSelector((state) => state.progress.exerciseList) || [];
  const defaultWorkoutWeightUnit = normalizeWeightUnit(user.workoutWeightUnit);
  const training = useSelector((state) => {
    const workoutBuckets = Object.values(state.workouts || {});
    for (const bucket of workoutBuckets) {
      const match = (bucket?.workouts || []).find((workout) => workout._id === params._id);
      if (match) return match;
    }
    return null;
  });
  const [size = 900, setBorderHighlight] = useOutletContext();

  const isPersonalWorkout = useCallback(
    () => user._id.toString() === training?.user?._id?.toString(),
    [user._id, training?.user?._id]
  );

  const [localTraining, setLocalTraining] = useState([]);
  const [trainingCategory, setTrainingCategory] = useState([]);

  // Auto-add each exercise's primary muscle groups to the workout's categories (additive —
  // never removes what the trainer set). Looks the exercise up in the library by id so it
  // works for both freshly-picked and saved exercises (saved ones only carry _id + title).
  useEffect(() => {
    if (!exerciseList.length) return;
    const byId = new Map(exerciseList.map((e) => [String(e._id), e]));
    const groups = new Set();
    (localTraining || []).forEach((circuit) =>
      (circuit || []).forEach((ex) => {
        const id = String(ex?.exercise?._id || ex?.exercise || "");
        (byId.get(id)?.muscleGroups?.primary || []).forEach((mg) => mg && groups.add(mg));
      })
    );
    if (!groups.size) return;
    setTrainingCategory((prev) => {
      const next = new Set(prev || []);
      let changed = false;
      groups.forEach((mg) => {
        if (!next.has(mg)) {
          next.add(mg);
          changed = true;
        }
      });
      return changed ? [...next] : prev;
    });
  }, [localTraining, exerciseList]);
  const [trainingTitle, setTrainingTitle] = useState("");
  const [titleAuto, setTitleAuto] = useState(false);
  const [workoutCompleteStatus, setWorkoutCompleteStatus] = useState(training?.complete || false);
  const [loading, setLoading] = useState(true);
  const [workoutFeedback, setWorkoutFeedback] = useState(training?.workoutFeedback || { difficulty: 1, comments: [] });
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [nextWorkout, setNextWorkout] = useState(null);
  const [openTrainerSessionDialog, setOpenTrainerSessionDialog] = useState(false);
  const [workoutType, setWorkoutType] = useState(training?.workoutType || "Strength");
  const [activeWorkoutWeightUnit, setActiveWorkoutWeightUnit] = useState(defaultWorkoutWeightUnit);
  const [workoutGestures, setWorkoutGestures] = useState(readWorkoutGestures);
  const weightLabelUnitToggleEnabled = Boolean(workoutGestures.tapWeightLabelToSwitchUnit);
  const activeWorkoutType = workoutType || training?.workoutType || "Strength";
  const isCardio = activeWorkoutType === "Cardio";
  const isSports = activeWorkoutType === "Sports";
  const isYoga = activeWorkoutType === "Yoga";
  const isPilates = activeWorkoutType === "Pilates";
  const isActivityLog = isCardio || isSports || isYoga || isPilates;
  const handleWorkoutWeightUnitChange = (event, nextUnit) => {
    if (!nextUnit) return;
    setActiveWorkoutWeightUnit(normalizeWeightUnit(nextUnit));
  };
  const toggleWorkoutWeightUnit = () => {
    setActiveWorkoutWeightUnit((prev) => (normalizeWeightUnit(prev) === "kg" ? "lbs" : "kg"));
  };
  const updateWorkoutGesture = (key, value) => {
    setWorkoutGestures((prev) => {
      const nextGestures = {
        ...prev,
        [key]: value,
      };
      saveWorkoutGestures(nextGestures);
      return nextGestures;
    });
  };
  const {
    cardioDetails,
    cardioNotice,
    editorProps: cardioEditorProps,
    handleCardioNoticeClose,
    hydrateCardio,
  } = useWorkoutCardio({ isCardio, training, user });

  const {
    sports: sportsDetails,
    editorProps: sportsEditorProps,
    hydrateSports,
  } = useWorkoutSports({ training });

  const {
    yoga: yogaDetails,
    editorProps: yogaEditorProps,
    hydrateYoga,
  } = useWorkoutYoga({ training });

  const {
    pilates: pilatesDetails,
    editorProps: pilatesEditorProps,
    hydratePilates,
  } = useWorkoutPilates({ training });

  const trainerAccessToken = user?.isTrainer
    ? getAccessToken()
    : getDelegatedReturnAccessToken("trainer");
  const activeTrainerId = user?.isTrainer ? user._id : user?.trainerId || null;
  const canManageTrainerSession =
    !!trainerAccessToken &&
    !!activeTrainerId &&
    !!training?.user?._id &&
    String(activeTrainerId) !== String(training.user._id);

  const { buildLocalComposite, isDirty, setBaseline } = useWorkoutDirtyState({
    cardioDetails,
    sportsDetails,
    yogaDetails,
    pilatesDetails,
    localTraining,
    trainingCategory,
    trainingTitle,
    workoutCompleteStatus,
    workoutFeedback,
    workoutType,
  });

  const { emitWorkoutUpdate, suppressNextSocketEmit } = useWorkoutSocketSync({
    buildLocalComposite,
    localTraining,
    setLocalTraining,
    socket,
    training,
    userId: user._id,
    workoutId: params._id,
  });
  const { scheduleEvent, setScheduleEvent } = useWorkoutScheduleEvent({
    locationSearch: location.search,
    workoutId: params._id,
  });

  // Tracks which workout's cardio we've hydrated, so a background/live training update to the SAME
  // workout doesn't re-hydrate (and wipe) cardio fields the user is actively editing.
  const cardioHydratedIdRef = useRef(null);

  // Hydrate locals when Redux training changes and set the baseline snapshot
  useEffect(() => {
    if (!training?._id) return;

    suppressNextSocketEmit();
    // Optional: hydrate local UI from Redux when workout is loaded/switched
    setLocalTraining(training.training ?? []);
    setTrainingCategory(training.category ?? []);
    setTrainingTitle(training.title ?? "");
    setWorkoutCompleteStatus(!!training.complete);
    setWorkoutFeedback(training.workoutFeedback ?? { difficulty: 1, comments: [] });
    setWorkoutType(training.workoutType || "Strength");
    // Only (re)hydrate cardio when the workout itself changes — otherwise a background training
    // update (socket sync, save round-trip) would clobber cardio fields being typed.
    if (cardioHydratedIdRef.current !== training._id) {
      cardioHydratedIdRef.current = training._id;
      hydrateCardio(training.cardio, user?.isTrainer);
      hydrateSports(training.sports);
      hydrateYoga(training.yoga);
      hydratePilates(training.pilates);
      // Auto-title only when this workout has no manual title yet.
      setTitleAuto(!training.title);
    }

    setBaseline({
      title: training.title ?? "",
      category: training.category ?? [],
      complete: !!training.complete,
      workoutFeedback: training.workoutFeedback ?? { difficulty: 1, comments: [] },
      training: training.training ?? [],
      workoutType: training.workoutType ?? "Strength",
      cardio: training.cardio ?? {},
      sports: training.sports ?? {},
      yoga: training.yoga ?? {},
      pilates: training.pilates ?? {},
    });

    if (training.user?._id) {
      setBorderHighlight(!isPersonalWorkout());
    }

    setLoading(false);
  }, [
    hydrateCardio,
    hydrateSports,
    hydrateYoga,
    hydratePilates,
    isPersonalWorkout,
    setBaseline,
    setBorderHighlight,
    suppressNextSocketEmit,
    training,
    user?.isTrainer,
  ]);

  useEffect(() => {
    setActiveWorkoutWeightUnit(defaultWorkoutWeightUnit);
  }, [defaultWorkoutWeightUnit, params._id]);

  const [toggleNewSet, setToggleNewSet] = useState(false);
  const [toggleRemoveSet, setToggleRemoveSet] = useState(false);

  // Keep a cardio workout's title in sync with its details until the user types their own.
  useEffect(() => {
    if (!isCardio || !titleAuto) return;
    const suggested = buildCardioTitle(cardioEditorProps?.activeCardio);
    if (suggested) setTrainingTitle(suggested);
  }, [isCardio, titleAuto, cardioEditorProps?.activeCardio]);

  useEffect(() => {
    if (!isSports || !titleAuto) return;
    const suggested = buildSportsTitle(sportsDetails);
    if (suggested) setTrainingTitle(suggested);
  }, [isSports, titleAuto, sportsDetails]);

  useEffect(() => {
    if (!isYoga || !titleAuto) return;
    const suggested = buildYogaTitle(yogaDetails);
    if (suggested) setTrainingTitle(suggested);
  }, [isYoga, titleAuto, yogaDetails]);

  useEffect(() => {
    if (!isPilates || !titleAuto) return;
    const suggested = buildPilatesTitle(pilatesDetails);
    if (suggested) setTrainingTitle(suggested);
  }, [isPilates, titleAuto, pilatesDetails]);

  // Warn before a browser refresh / tab-close / external navigation drops unsaved changes.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleTitleChange = (e) => {
    setTitleAuto(false);
    setTrainingTitle(e.target.value);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const handleModalToggle = () => {
    setModalOpen((prev) => !prev);
    setModalActionType("");
  };

  const [modalActionType, setModalActionType] = useState("");
  const handleSetModalAction = (actionType) => setModalActionType(actionType);

  const handleAddExerciseOpen = () => setAddExerciseOpen(true);
  const handleAddExerciseClose = () => setAddExerciseOpen(false);

  const categories = [
    "Abdominals",
    "Back",
    "Biceps",
    "Calves",
    "Chest",
    "Core",
    "Forearms",
    "Full Body",
    "Glutes",
    "Hamstrings",
    "Legs",
    "Quadriceps",
    "Shoulders",
    "Triceps",
  ];

  // When true, the next confirmed add creates a WARM-UP circuit (flagged isWarmup) at the front,
  // instead of adding to the current circuit.
  const [addingWarmup, setAddingWarmup] = useState(false);

  const newExercise = (index) => {
    setAddingWarmup(false);
    handleAddExerciseOpen();
  };

  // Open the picker to add a movement-based warm-up (its exercises become a warm-up circuit).
  const newWarmup = () => {
    setAddingWarmup(true);
    handleAddExerciseOpen();
  };

  // Build a library-exercise entry (optionally flagged as a warm-up), seeding goals from history.
  const buildExerciseEntry = (exercise, isWarmup, setCount, selectedHistoryByExercise, exerciseList) => {
    const reduxExercise = exerciseList.find((item) => item._id === exercise._id);
    const history = reduxExercise?.history?.[user._id] || [];
    const selectedHistoryId = selectedHistoryByExercise?.[exercise._id];
    const selectedHistory =
      history.find((item) => item._id === selectedHistoryId) || history[history.length - 1];
    const achieved = selectedHistory?.achieved || {};
    const normalizeToSets = (values) => {
      const source = Array.isArray(values) ? values : [];
      return Array.from({ length: setCount }, (_, idx) => source[idx] ?? 0);
    };
    return {
      exercise,
      exerciseType: "Reps",
      isWarmup,
      goals: {
        sets: setCount,
        minReps: Array(setCount).fill(0),
        maxReps: Array(setCount).fill(0),
        exactReps: normalizeToSets(achieved.reps),
        weight: normalizeToSets(achieved.weight),
        percent: normalizeToSets(achieved.percent),
        seconds: normalizeToSets(achieved.seconds),
      },
      achieved: {
        sets: 0,
        reps: Array(setCount).fill(0),
        weight: Array(setCount).fill(0),
        percent: Array(setCount).fill(0),
        seconds: Array(setCount).fill(0),
      },
      techniques: [],
    };
  };

  // Build a library warm-up entry in the SIMPLE single-target shape (warm-ups render in a compact row,
  // not the full sets/weight grid). Default target seeded from the exercise's measurement type.
  const buildWarmupLibraryEntry = (exercise) => {
    const isTime = exercise?.measurementType === "time";
    return {
      exercise,
      customName: "",
      isWarmup: true,
      exerciseType: isTime ? "Time" : "Reps",
      goals: {
        sets: 1,
        minReps: [0],
        maxReps: [0],
        exactReps: [isTime ? 0 : "10"],
        weight: [0],
        percent: [0],
        seconds: [isTime ? "300" : 0],
      },
      achieved: { sets: 0, reps: [0], weight: [0], percent: [0], seconds: [0] },
      techniques: [],
    };
  };

  // Build a free-text custom warm-up entry (no library exercise). measure: "time" (min) | "reps" | "none".
  const buildCustomWarmupEntry = ({ name, measure, amount }) => {
    const label = (name || "").trim();
    if (!label) return null;
    const n = Math.max(0, Number(amount) || 0);
    let exerciseType = "Reps";
    const goals = { sets: 1, minReps: [0], maxReps: [0], exactReps: [0], weight: [0], percent: [0], seconds: [0] };
    if (measure === "time") {
      exerciseType = "Time";
      goals.seconds = [String(n * 60)];
    } else if (measure === "reps") {
      goals.exactReps = [String(n)];
    }
    return {
      exercise: null,
      customName: label,
      isWarmup: true,
      exerciseType,
      goals,
      achieved: { sets: 0, reps: [0], weight: [0], percent: [0], seconds: [0] },
      techniques: [],
    };
  };

  // Create a new exercise on the current set. Added exercises inherit the target circuit's warm-up
  // status (so adding to a warm-up circuit keeps them warm-ups). Warm-up adds go via confirmedWarmups.
  const confirmedNewExercise = (
    index,
    selectedExercises,
    setSelectedExercises,
    setCount,
    setSelectedExercisesSetCount,
    selectedHistoryByExercise,
    exerciseList,
  ) => {
    if (selectedExercises.length > 0) {
      const targetIsWarmup = (localTraining[index] || []).some((e) => e.isWarmup);
      const newTraining = localTraining.map((group, i) => {
        if (index === i) {
          selectedExercises.forEach((exercise) =>
            group.push(
              targetIsWarmup
                ? buildWarmupLibraryEntry(exercise)
                : buildExerciseEntry(exercise, false, setCount, selectedHistoryByExercise, exerciseList)
            )
          );
        }
        return group;
      });
      dispatch(
        updateTraining(training._id, {
          ...training,
          category: [...trainingCategory],
          training: [...newTraining],
        })
      );
    }
    setSelectedExercises([]);
    setSelectedExercisesSetCount(4);
    setAddingWarmup(false);
    handleAddExerciseClose();
  };

  // Warm-up confirm: post ALL staged custom warm-ups AND all searched library warm-ups together, as
  // one front warm-up circuit (created if there isn't one). Called once from the modal's Confirm.
  const confirmedWarmups = ({ selectedExercises, customWarmups }) => {
    const entries = [
      ...(customWarmups || []).map(buildCustomWarmupEntry).filter(Boolean),
      ...(selectedExercises || []).map(buildWarmupLibraryEntry),
    ];
    if (entries.length) {
      const frontIsWarmup = (localTraining[0] || []).some((e) => e.isWarmup);
      const newTraining = frontIsWarmup
        ? localTraining.map((g, i) => (i === 0 ? [...g, ...entries] : g))
        : [entries, ...localTraining];
      dispatch(
        updateTraining(training._id, {
          ...training,
          category: [...trainingCategory],
          training: [...newTraining],
        })
      );
      setActiveStep(0);
    }
    setAddingWarmup(false);
    handleAddExerciseClose();
  };

  // Create a new set on the current day
  const newSet = () => {
    setLocalTraining((prev) => {
      prev.push([]);
      return prev;
    });
    setToggleNewSet((prev) => !prev);
  };

  // Remove the current set
  const removeSet = (setIndex) => {
    if (localTraining.length > 1) {
      setLocalTraining((prev) => prev.filter((item, index) => index !== setIndex));
      setToggleRemoveSet((prev) => !prev);
    }
  };

  // Remove the current exercise
  const removeExercise = (setIndex, exerciseIndex) => {
    const newTraining = localTraining.map((set, index) => {
      if (index === setIndex) {
        set = set.filter((item, index) => index !== exerciseIndex);
      }
      return set;
    });

    dispatch(
      updateTraining(training._id, {
        ...training,
        category: [...trainingCategory],
        training: [...newTraining],
      })
    );
  };

  // Swap ONE exercise entry — the exact [setIndex][exerciseIndex] slot only, never any other copy
  // of the same exercise. Uses the SAME persist path as removeExercise (immutable rebuild +
  // updateTraining), so it saves atomically and re-hydrates cleanly instead of racing local state.
  const swapExercise = (setIndex, exerciseIndex, replacement) => {
    if (!replacement) return;
    const isTime = replacement.measurementType === "time";
    const newTraining = localTraining.map((set, index) =>
      index !== setIndex
        ? set
        : set.map((entry, eIndex) =>
            eIndex !== exerciseIndex
              ? entry
              : { ...entry, exercise: replacement, ...(isTime ? { exerciseType: "Time" } : {}) }
          )
    );
    setLocalTraining(newTraining); // optimistic — the updateTraining round-trip confirms it
    dispatch(
      updateTraining(training._id, {
        ...training,
        category: [...trainingCategory],
        training: [...newTraining],
      })
    );
  };

  // Save all changes to training
  const save = async (overrides) => {
    const complete =
      typeof overrides?.complete === "boolean" ? overrides.complete : workoutCompleteStatus;
    const payload = {
      ...training,
      title: trainingTitle,
      category: [...trainingCategory],
      training: localTraining,
      complete,
      workoutFeedback: workoutFeedback,
      workoutType: activeWorkoutType,
      cardio: cardioDetails,
      sports: sportsDetails,
      yoga: yogaDetails,
      pilates: pilatesDetails,
    };

    return dispatch(
      updateTraining(training._id, {
        ...payload,
      })
    ).then((savedWorkout) => {
      if (!savedWorkout) return null;
      const workout = savedWorkout?._id ? savedWorkout : payload;
      emitWorkoutUpdate(workout);
      return workout;
    });
  };

  const handleCompleteAndSave = () => {
    setWorkoutCompleteStatus(true);
    save({ complete: true });
  };

  const handleReopenWorkout = () => {
    setWorkoutCompleteStatus(false);
    save({ complete: false });
  };

  const handleBackNavigation = async () => {
    if (returnPath) {
      await save();
      navigate(returnPath);
      return;
    }

    if (training.date) {
      const dateKey = dayjs.utc(training.date).format("YYYYMMDD");
      const link = isPersonalWorkout()
        ? `/?date=${dateKey}`
        : `/?date=${dateKey}&client=${training.user._id}`;

      await save();
      navigate(link);
      return;
    }

    await save();
    navigate(training.isTemplate ? "/workout-templates" : "/sessions");
  };

  useEffect(() => {
    dispatch(getExerciseList());
  }, [dispatch]);

  useEffect(() => {
    setLocalTraining([]);
    setLoading(true);

    dispatch(requestTraining(params._id)).then(() => {
      setLoading(false);
    });
  }, [dispatch, params._id]);

  // Pre-fetch the next workout (for the "Next workout" button) + reset to the first step
  // whenever we move to a different workout.
  useEffect(() => {
    setNextWorkout(null);
    setActiveStep(0);
    workoutApi
      .getNextWorkout({ _id: params._id })
      .then((data) => {
        if (data && !data.error) setNextWorkout(data.next || null);
      })
      .catch(() => {});
  }, [params._id]);

  return (
    <>
      {loading ? (
        <Loading />
      ) : training?._id ? (
        <>
          <WorkoutOptionModalView
            modalOpen={modalOpen}
            handleModalToggle={handleModalToggle}
            handleSetModalAction={handleSetModalAction}
            modalActionType={modalActionType}
            training={training}
            setLocalTraining={setLocalTraining}
            localTraining={localTraining}
            allowTrainingReorder
            weightUnit={activeWorkoutWeightUnit}
            weightLabelUnitToggleEnabled={weightLabelUnitToggleEnabled}
            setWeightLabelUnitToggleEnabled={(enabled) =>
              updateWorkoutGesture("tapWeightLabelToSwitchUnit", enabled)
            }
          />
          <Snackbar
            open={cardioNotice.open}
            autoHideDuration={3000}
            onClose={handleCardioNoticeClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert onClose={handleCardioNoticeClose} severity={cardioNotice.severity} variant="filled">
              {cardioNotice.message}
            </Alert>
          </Snackbar>
          {training?._id ? (
            <>
              <Grid
                container
                sx={{
                  justifyContent: "flex-start",
                  minHeight: "100%",
                  paddingTop: "15px",
                  paddingBottom: "84px",
                }}
              >
                <WorkoutHeader
                  activeWorkoutType={activeWorkoutType}
                  activeWorkoutWeightUnit={activeWorkoutWeightUnit}
                  canManageTrainerSession={canManageTrainerSession}
                  isPersonalWorkout={isPersonalWorkout()}
                  isProgramBuilder={isProgramBuilder}
                  onBack={handleBackNavigation}
                  onOpenSettings={handleModalToggle}
                  onOpenTrainerSessionDialog={() => setOpenTrainerSessionDialog(true)}
                  onWorkoutWeightUnitChange={handleWorkoutWeightUnitChange}
                  scheduleEvent={scheduleEvent}
                  training={training}
                />

                <Grid container size={12} spacing={2} sx={{ paddingTop: "15px" }}>
                  <Grid size={12} container sx={{ alignContent: "center" }}>
                    <TextField
                      label="Title"
                      placeholder="Workout Title"
                      value={trainingTitle}
                      onChange={handleTitleChange}
                      fullWidth
                    />
                  </Grid>
                  {isCardio ? (
                    <CardioDetailsEditor {...cardioEditorProps} />
                  ) : isSports ? (
                    <SportsDetailsEditor {...sportsEditorProps} />
                  ) : isYoga ? (
                    <YogaDetailsEditor {...yogaEditorProps} />
                  ) : isPilates ? (
                    <PilatesDetailsEditor {...pilatesEditorProps} />
                  ) : (
                    <WorkoutCategoryField
                      categories={categories}
                      onChange={setTrainingCategory}
                      trainingCategory={trainingCategory}
                    />
                  )}
                </Grid>
                {!isCardio && !isSports && !isYoga && !isPilates && (
                  <StrengthWorkoutEditor
                    activeStep={activeStep}
                    activeWorkoutWeightUnit={activeWorkoutWeightUnit}
                    allowFeedback={!training.isTemplate}
                    localTraining={localTraining}
                    newExercise={newExercise}
                    newWarmup={newWarmup}
                    newSet={newSet}
                    onToggleWeightUnit={
                      weightLabelUnitToggleEnabled ? toggleWorkoutWeightUnit : undefined
                    }
                    removeExercise={removeExercise}
                    swapExercise={swapExercise}
                    removeSet={removeSet}
                    save={save}
                    selectedDate={training.date}
                    setActiveStep={setActiveStep}
                    setLocalTraining={setLocalTraining}
                    setWorkoutCompleteStatus={setWorkoutCompleteStatus}
                    setWorkoutFeedback={setWorkoutFeedback}
                    showSets={training.training.length > 0}
                    size={size}
                    toggleNewSet={toggleNewSet}
                    toggleRemoveSet={toggleRemoveSet}
                    workoutCompleteStatus={workoutCompleteStatus}
                    workoutFeedback={workoutFeedback}
                    workoutUser={training.user}
                  />
                )}
                {isActivityLog && workoutCompleteStatus && (
                  <Grid container size={12} sx={{ paddingTop: "10px", justifyContent: "center" }}>
                    <Button size="small" color="success" onClick={handleReopenWorkout}>
                      ✓ Workout complete — mark incomplete
                    </Button>
                  </Grid>
                )}
                {/* Trainer looking at a client's workout: show the client's daily check-in for this day,
                    read-only (trainer never fills it) or a "not filled out yet" marker.
                    - View-as / delegated session: acting AS the client, so "my" readiness IS theirs.
                    - Direct trainer view (not delegated): fetch the client's readiness by id. */}
                {training?.date &&
                  training?.user?._id &&
                  (user?.delegationMode === "trainer_client" || !isPersonalWorkout()) && (
                    <Grid container size={12} sx={{ pt: 2 }}>
                      {user?.delegationMode === "trainer_client" ? (
                        <DailyCheckinCard readOnly date={training.date} />
                      ) : (
                        <DailyCheckinCard clientId={training.user._id} date={training.date} />
                      )}
                    </Grid>
                  )}
              </Grid>
              <Box
                sx={{
                  position: "fixed",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: (theme) => theme.zIndex.appBar,
                  backgroundColor: "background.default",
                  boxShadow: "0 -4px 12px -6px rgba(0,0,0,0.35)",
                  px: 2,
                  py: 1,
                }}
              >
                <Box sx={{ maxWidth: 900, mx: "auto", display: "flex", gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={save}
                    disabled={loading}
                    color={isDirty ? "warning" : "primary"}
                    sx={{ flex: isActivityLog && !workoutCompleteStatus ? 7 : 1 }}
                  >
                    Save
                  </Button>
                  {isActivityLog && !workoutCompleteStatus && (
                    <Button
                      variant="contained"
                      color="success"
                      disabled={loading}
                      onClick={handleCompleteAndSave}
                      sx={{ flex: 5 }}
                    >
                      Complete &amp; Save
                    </Button>
                  )}
                </Box>
              </Box>

              {nextWorkout && activeStep >= localTraining.length && (
                <Grid container size={12} sx={{ paddingBottom: "5px" }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate(`/workout/${nextWorkout._id}`)}
                  >
                    Next workout: {nextWorkout.title || "Untitled"} &rarr;
                  </Button>
                </Grid>
              )}

              <AddExercisesDialog
                user={training.user}
                addExerciseOpen={addExerciseOpen}
                handleAddExerciseClose={handleAddExerciseClose}
                confirmedNewExercise={confirmedNewExercise}
                confirmedWarmups={confirmedWarmups}
                activeStep={activeStep}
                weightUnit={activeWorkoutWeightUnit}
                warmup={addingWarmup}
              />
              <WorkoutTrainerSessionDialog
                open={openTrainerSessionDialog}
                onClose={() => setOpenTrainerSessionDialog(false)}
                workouts={
                  training?._id
                    ? [
                        {
                          ...training,
                          title: trainingTitle || training.title,
                          complete: workoutCompleteStatus,
                        },
                      ]
                    : []
                }
                initialWorkoutId={training?._id || ""}
                onSaved={(event) => setScheduleEvent(event)}
              />
            </>
          ) : (
            <Grid
              container
              size={12}
              sx={{
                justifyContent: "center",
                alignContent: "center",
                flexGrow: 1,
              }}
            >
              <Button variant="contained" onClick={() => null}>
                Create Workout
              </Button>
            </Grid>
          )}
        </>
      ) : (
        <>Workout does not exist</>
      )}
    </>
  );
}
