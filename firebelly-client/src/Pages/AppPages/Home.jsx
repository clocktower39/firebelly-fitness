import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import queryString from "query-string";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
import Loading from "../../Components/Loading";
import DailyCheckinCard from "../../Components/DailyCheckinCard";
import CardioSummaryCard from "../../features/workout/components/cardio/CardioSummaryCard";
import SelectedDate from "../../Components/SelectedDate";
import WeeklyClientWorkoutTracker from "../../Components/TrainingComponents/WeeklyClientWorkoutTracker";
import WorkoutOverview from "../../Components/TrainingComponents/WorkoutOverview";
import { sortWorkoutsByTypeOrder } from "../../features/workout/utils/workoutOrder";
import { DAILY_OVERVIEW_ORDER, resolveDailyOverviewOrder } from "../../utils/dailyOverviewSections";
import WeeklyTrainingStatus from "../../Components/TrainingComponents/WeeklyTrainingStatus";
import { requestWorkoutsByDatesIfNeeded, requestLatestMetric, serverURL, getMyReadiness } from "../../Redux/actions";
import { Avatar, Box, Button, Grid, Paper, Stack, Typography } from '@mui/material';

const TrainingBlockWizard = lazy(() => import("../../Components/Goals/TrainingBlockWizard"));
import { formatWeightWithUnit, normalizeWeightUnit } from "../../utils/weightUnits";
import { dayKey } from "../../utils/readiness";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const EMPTY_WORKOUTS = [];
const EMPTY_WORKOUT_USER = {};
const EMPTY_DATES = [];
const EMPTY_TYPE_ORDER = [];
const DATE_QUERY_FORMAT = "YYYYMMDD";
const DATE_INPUT_FORMAT = "YYYY-MM-DD";

const getTrailingWeekDates = (date) =>
  Array.from({ length: 7 }, (_, index) =>
    dayjs(date).subtract(6 - index, "day").format("YYYY-MM-DD")
  );

function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const { date, client, } = queryString.parse(location.search);
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const [size = 900, setBorderHighlight] = useOutletContext();
  const isPersonalWorkout = useCallback(
    () => client ? user._id.toString() === client : true,
    [user._id, client]
  );
  const workoutAccountId = isPersonalWorkout() ? user._id : client;
  const workouts = useSelector((state) => {
    return state.workouts?.[workoutAccountId]?.workouts ?? EMPTY_WORKOUTS;
  });
  const workoutsUser = useSelector((state) => {
    return state.workouts?.[workoutAccountId]?.user ?? EMPTY_WORKOUT_USER;
  });
  const loadedWorkoutDates = useSelector((state) => {
    return state.workouts?.[workoutAccountId]?.loadedDates ?? EMPTY_DATES;
  });
  // Per-account preferred order of workout types on the daily overview (empty = keep existing order).
  const workoutTypeOrder = useSelector((state) => state.user?.workoutTypeOrder) || EMPTY_TYPE_ORDER;
  // Per-account preferred order of the daily overview's cards/sections (empty = keep the default order).
  const dailyOverviewOrder = useSelector((state) => state.user?.dailyOverviewOrder) || EMPTY_TYPE_ORDER;
  const latestMetric = useSelector(
    (state) => state.metrics.latestByUser[(client || user._id)] || null
  );
  const readiness = useSelector((state) => state.readiness) || { entries: [], loaded: false };
  const goals = useSelector((state) => state.goals);
  const [openBlockWizard, setOpenBlockWizard] = useState(false);
  // Wait a beat before deciding "no goals" so existing users don't flash the get-started card on load.
  const [goalsSettled, setGoalsSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGoalsSettled(true), 1200);
    return () => clearTimeout(t);
  }, []);
  const showGetStarted =
    goalsSettled && !user?.isTrainer && Array.isArray(goals) && goals.length === 0;
  // The daily check-in is always for today; once it's done, the card moves below the workout.
  const todayCheckinDone =
    readiness.loaded &&
    (readiness.entries || []).some((e) => String(e.date).slice(0, 10) === dayKey());
  const [loading, setLoading] = useState(true);
  const activeWorkoutUser = !isPersonalWorkout() && workoutsUser?._id ? workoutsUser : user;

  const isValidDate = (date) => {
    return dayjs(date, DATE_QUERY_FORMAT, true).isValid();
  };

  const formatDate = (date) => {
    return dayjs(date, DATE_QUERY_FORMAT, true).format(DATE_INPUT_FORMAT);
  };

  const today = dayjs().format(DATE_INPUT_FORMAT);
  const initialDate = isValidDate(date) ? formatDate(date) : today;
  const weightUnit = normalizeWeightUnit(user.workoutWeightUnit);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [weeklyStatusDate, setWeeklyStatusDate] = useState(initialDate);
  const [weeklyStatusDateLocked, setWeeklyStatusDateLocked] = useState(false);
  const selectedDateKey = dayjs(selectedDate).format(DATE_INPUT_FORMAT);
  const weeklyStatusDates = useMemo(() => getTrailingWeekDates(weeklyStatusDate), [weeklyStatusDate]);
  const requiredWorkoutDates = useMemo(
    () => [...new Set([...weeklyStatusDates, selectedDateKey])],
    [selectedDateKey, weeklyStatusDates]
  );
  const missingWorkoutDates = useMemo(() => {
    const loadedDateSet = new Set(loadedWorkoutDates);
    return requiredWorkoutDates.filter((dateKey) => !loadedDateSet.has(dateKey));
  }, [loadedWorkoutDates, requiredWorkoutDates]);

  const [localWorkouts, setLocalWorkouts] = useState(() => {
    return [];
  });

  const handleCancelEdit = () => {
    const matchedDateWorkouts = sortWorkoutsByTypeOrder(
      workouts.filter((workout) =>
        dayjs.utc(workout.date).isSame(dayjs.utc(selectedDate), "day")
      ),
      workoutTypeOrder
    );
    setLocalWorkouts([...matchedDateWorkouts]);
  };

  const [openCreateWorkoutDialog, setOpenCreateWorkoutDialog] = useState(false);
  const handleOpenCreateWorkoutDialog = () => setOpenCreateWorkoutDialog(true);
  const handleCloseCreateWorkoutDialog = () => setOpenCreateWorkoutDialog(false);

  const [modalOpen, setModalOpen] = useState(false);
  const handleModalToggle = () => {
    setModalOpen((prev) => !prev);
    setModalActionType("");
  };

  const [modalActionType, setModalActionType] = useState("");
  const handleSetModalAction = (actionType) => setModalActionType(actionType);

  useEffect(() => {
    const queryDate = isValidDate(date) ? formatDate(date) : today;

    setSelectedDate((prev) => (prev === queryDate ? prev : queryDate));
  }, [date, today]);

  useEffect(() => {
    if (!selectedDateKey) return;
    if (weeklyStatusDateLocked) return;
    setWeeklyStatusDate((prev) => (prev === selectedDateKey ? prev : selectedDateKey));
  }, [selectedDateKey, weeklyStatusDateLocked]);

  useEffect(() => {
    const matchedDateWorkouts = sortWorkoutsByTypeOrder(
      workouts.filter((workout) =>
        dayjs.utc(workout.date).isSame(dayjs.utc(selectedDate), "day")
      ),
      workoutTypeOrder
    );

    const isDifferent =
      matchedDateWorkouts.length !== localWorkouts.length ||
      matchedDateWorkouts.some((w, i) => w !== localWorkouts[i]);

    if (isDifferent) {
      setLocalWorkouts(matchedDateWorkouts);
    }
  }, [workouts, selectedDate, workoutTypeOrder]);

  useEffect(() => {
    if (selectedDate) {
      const newDate = dayjs(selectedDate).format(DATE_QUERY_FORMAT);
      const currentQuery = queryString.parse(location.search);
      const nextQuery = { ...currentQuery, date: newDate };
      const nextSearch = queryString.stringify(nextQuery, {
        skipNull: true,
        skipEmptyString: true,
      });
      const currentSearch = location.search.replace(/^\?/, "");

      if (nextSearch !== currentSearch) {
        navigate(`/?${nextSearch}`, { replace: true });
      }
    }
  }, [client, location.search, navigate, selectedDate]);

  useEffect(() => {
    if (!requiredWorkoutDates.length) return;
    if (!missingWorkoutDates.length) {
      setBorderHighlight(!isPersonalWorkout());
      setLoading(false);
      return;
    }

    if (missingWorkoutDates.includes(selectedDateKey)) {
      setLoading(true);
    }

    dispatch(requestWorkoutsByDatesIfNeeded(missingWorkoutDates, client)).finally(() => {
      setBorderHighlight(!isPersonalWorkout());
      setLoading(false);
    });
  }, [requiredWorkoutDates, missingWorkoutDates, selectedDateKey, client, isPersonalWorkout]);

  useEffect(() => {
    dispatch(requestLatestMetric({ userId: isPersonalWorkout() ? undefined : client }));
  }, [dispatch, isPersonalWorkout, client]);

  // Load today's readiness up front so the check-in card is placed in the right spot without a flash.
  useEffect(() => {
    if (isPersonalWorkout() && !readiness.loaded) dispatch(getMyReadiness());
  }, [dispatch, isPersonalWorkout, readiness.loaded]);

  // Build the reorderable daily-overview cards as keyed section nodes (null = not shown for this
  // context). The date selector + weekly status strip above stay pinned and are not part of this.
  const personal = isPersonalWorkout();
  // A trainer viewing the client's account via view-as (delegated session): the app acts AS the client,
  // so `personal` is true. Show that client's check-in read-only (trainer never fills it) and below the
  // workout — never pinned to the top like the client's own nudge-to-fill card.
  const inClientAccount = user?.delegationMode === "trainer_client";
  const sectionNodes = {
    checkin:
      personal && readiness.loaded ? (
        <Grid container size={12} sx={{ p: 1 }}>
          <DailyCheckinCard
            readOnly={inClientAccount}
            date={inClientAccount ? selectedDate : undefined}
          />
        </Grid>
      ) : !personal && client ? (
        <Grid container size={12} sx={{ p: 1 }}>
          <DailyCheckinCard clientId={client} date={selectedDate} />
        </Grid>
      ) : null,
    metrics: latestMetric ? (
      <Grid container size={12} sx={{ marginTop: "10px" }}>
        <Paper elevation={5} sx={{ width: "100%", padding: "5px", margin: "5px" }}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
          >
            <Typography variant="h6" color="text.primary">Latest Body Metrics</Typography>
            <Button
              component={Link}
              to={`/progress?${client ? `client=${client}&` : ""}tab=metrics`}
              size="small"
              variant="outlined"
            >
              View Body Metrics
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {new Date(latestMetric.recordedAt).toLocaleDateString()}{" "}
            {new Date(latestMetric.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Typography>
          <Paper sx={{ padding: "4px 8px", marginTop: "6px" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ "& p": { color: "text.primary" } }}
            >
              <Typography variant="body1">
                Weight: {formatWeightWithUnit(latestMetric.weight, weightUnit) || "—"}
              </Typography>
              <Typography variant="body1">Body Fat: {latestMetric.bodyFatPercent ?? "—"}%</Typography>
              <Typography variant="body1">BMI: {latestMetric.bmi ?? "—"}</Typography>
              <Typography variant="body1">RHR: {latestMetric.restingHeartRate ?? "—"} bpm</Typography>
            </Stack>
          </Paper>
        </Paper>
      </Grid>
    ) : null,
    workouts: localWorkouts ? (
      <WorkoutOverview
        localWorkouts={localWorkouts}
        setLocalWorkouts={setLocalWorkouts}
        selectedDate={selectedDate}
        handleCancelEdit={handleCancelEdit}
        workoutOptionModalViewProps={{
          modalOpen,
          handleModalToggle,
          handleSetModalAction,
          modalActionType,
          openCreateWorkoutDialog,
          handleOpenCreateWorkoutDialog,
          handleCloseCreateWorkoutDialog,
          setSelectedDate,
        }}
        user={activeWorkoutUser}
      />
    ) : null,
    cardio: <CardioSummaryCard client={client} />,
    coverage:
      user.isTrainer && !client ? (
        <WeeklyClientWorkoutTracker
          selectedDate={selectedDate}
          mode="day"
          title="Daily Coverage"
          description={`Quick view of clients expected on ${dayjs(selectedDate).format(
            "dddd, MMM D"
          )} and who still needs workouts entered.`}
          showViewFullButton
        />
      ) : null,
  };

  // Resolve the render order. A custom order is honored literally; otherwise use the default order but
  // keep the existing nicety: today's check-in sits at the top until it's done, then drops below the
  // workout (and a client's check-in shows below like before).
  const hasCustomLayout = Array.isArray(dailyOverviewOrder) && dailyOverviewOrder.length > 0;
  let orderedKeys;
  if (hasCustomLayout) {
    orderedKeys = resolveDailyOverviewOrder(dailyOverviewOrder);
  } else {
    orderedKeys = DAILY_OVERVIEW_ORDER.filter((key) => key !== "checkin");
    // The "pin to top until done" nudge is for the client filling in their own check-in — not for a
    // trainer in a view-as session, where the check-in stays below the workout.
    if (personal && !todayCheckinDone && !inClientAccount) {
      orderedKeys.unshift("checkin");
    } else {
      const cardioIndex = orderedKeys.indexOf("cardio");
      orderedKeys.splice(cardioIndex + 1, 0, "checkin");
    }
  }

  const orderedSections = orderedKeys.map((key) =>
    sectionNodes[key] ? <React.Fragment key={key}>{sectionNodes[key]}</React.Fragment> : null
  );

  return loading ? (
    <Loading />
  ) : (
    <>
      {!isPersonalWorkout() && workoutsUser.firstName && (
        <Grid container size={12} sx={{ justifyContent: "center", alignItems: "center" }}>
          <Avatar
            src={
              workoutsUser?.profilePicture &&
              `${serverURL}/user/profilePicture/${workoutsUser.profilePicture}`
            }
            sx={{ maxHeight: "35px", maxWidth: "35px", margin: "0 15px" }}
            alt={workoutsUser ? `${workoutsUser.firstName[0]} ${workoutsUser.lastName[0]}` : 'loading'}
          />
          <Typography variant="h5">
            {workoutsUser.firstName} {workoutsUser.lastName}
          </Typography>
        </Grid>
      )}
      <SelectedDate selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      <WeeklyTrainingStatus
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        visibleDate={weeklyStatusDate}
        setVisibleDate={setWeeklyStatusDate}
        visibleDateLocked={weeklyStatusDateLocked}
        setVisibleDateLocked={setWeeklyStatusDateLocked}
        workouts={workouts}
      />
      {showGetStarted && (
        <Grid container size={12} sx={{ p: 1 }}>
          <Paper sx={{ p: 2, width: "100%", borderRadius: "12px" }}>
            <Stack spacing={1}>
              <Typography variant="h6">Plan your first Training Block</Typography>
              <Typography variant="body2" color="text.secondary">
                Set a timeframe, your training context, and the goals to focus on — we&apos;ll use it later
                to generate a draft program.
              </Typography>
              <Box>
                <Button variant="contained" onClick={() => setOpenBlockWizard(true)}>
                  Plan a Training Block →
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      )}
      {orderedSections}
      {openBlockWizard && (
        <Suspense fallback={null}>
          <TrainingBlockWizard open={openBlockWizard} onClose={() => setOpenBlockWizard(false)} />
        </Suspense>
      )}
    </>
  );
}

export default Home;
