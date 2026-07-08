import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  MobileStepper,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Close as CloseIcon, Delete } from "@mui/icons-material";
import SwipeableViewsModule from "react-swipeable-views";
import { trainingBlockApi } from "../../api/trainingBlockApi";
import {
  getGoals,
  deleteGoal,
  requestExerciseLibrary,
  requestLatestMetric,
  createMetricEntry,
} from "../../Redux/actions";
import { updateUserSettings } from "../../Redux/actions/accountActions";
import { WORKOUT_TYPE_ORDER } from "../../features/workout/utils/workoutColors";
import { EXPERIENCE, ACTIVITY, EQUIPMENT_OPTIONS } from "../../utils/trainingProfileOptions";
import ProgramReadinessCard from "../AccountComponents/ProgramReadinessCard";
import { AddNewGoal, GoalDetails } from "../../Pages/AppPages/Goals";
import ErrorBoundary from "../ErrorBoundary";

const SwipeableViews = SwipeableViewsModule.default ?? SwipeableViewsModule;
const STEP_TITLES = ["Your time period", "Your training context", "Training Block goals", "Review"];

const blockGoalId = (g) => String(g?.trainingBlock?._id || g?.trainingBlock || "");

const isoAddWeeks = (w) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(w || 0) * 7);
  return d.toISOString().slice(0, 10);
};
const isoToWeeks = (iso) => {
  if (!iso) return 12;
  const start = new Date(new Date().toDateString());
  const target = new Date(iso + "T00:00:00");
  return Math.max(1, Math.round((target - start) / (7 * 86400000)));
};

// Guided, swipeable "Training Block" setup — groups several goals into one time period,
// with the program-relevant context and a readiness check. Runs for new users + on demand.
export default function TrainingBlockWizard({ open, onClose, resumeBlock = null }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.user);
  const goals = useSelector((state) => state.goals);
  const exerciseLibrary = useSelector((state) => state.exerciseLibrary);
  const latestMetric = useSelector((state) => state.metrics.latestByUser[user._id]);

  const [step, setStep] = useState(0);
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  // Step 0 — time period
  const [title, setTitle] = useState("");
  const [weeks, setWeeks] = useState(12);
  const [targetDate, setTargetDate] = useState(isoAddWeeks(12));

  // Step 1 — training context (pre-filled from profile)
  const [experience, setExperience] = useState("");
  const [activity, setActivity] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [workoutSplit, setWorkoutSplit] = useState({});
  const [equipment, setEquipment] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [mobility, setMobility] = useState([]);

  // Review — fill in any missing profile basics before finishing
  const [dob, setDob] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [savingBasics, setSavingBasics] = useState(false);

  useEffect(() => {
    if (!open) return;
    dispatch(getGoals({ requestedBy: "client" }));
    dispatch(requestExerciseLibrary());
    dispatch(requestLatestMetric({}));
    setStep(0);
    setBlock(null);
    setTitle("");
    setWeeks(12);
    setTargetDate(isoAddWeeks(12));
    setWorkoutSplit({});
    setExperience(user.trainingExperience || "");
    setActivity(user.activityLevel || "");
    setDaysPerWeek(user.weeklyFrequency || "");
    setEquipment(user.equipmentAccess || []);
    setInjuries(user.injuries || []);
    setMobility(user.mobilityRestrictions || []);
    setDob(user.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "");
    setHeight(user.height || "");
    setSex(user.sex || "");
    setBodyWeight("");
    // Resume the specific block passed in (clicked from the Goals list) so you drop back into that plan
    // to keep editing it; with no block passed (the "Plan a Training Block" +) it starts fresh / creates
    // a new one on save. Setting `block` also makes its existing goals show on the goals step.
    if (resumeBlock && resumeBlock._id) {
      setBlock(resumeBlock);
      setTitle(resumeBlock.title || "");
      const wk = Number(resumeBlock.weeks) || 12;
      setWeeks(wk);
      setTargetDate(resumeBlock.targetDate ? String(resumeBlock.targetDate).slice(0, 10) : isoAddWeeks(wk));
      setWorkoutSplit(resumeBlock.workoutSplit || {});
    }
  }, [open]);

  const blockEndISO = targetDate;
  // Weeks and target date stay in sync — set either one and the other follows.
  const handleWeeksChange = (w) => { setWeeks(w); if (w !== "" && Number(w) > 0) setTargetDate(isoAddWeeks(w)); };
  const handleTargetDateChange = (iso) => { setTargetDate(iso); if (iso) setWeeks(isoToWeeks(iso)); };

  const blockGoals = useMemo(
    () => (block ? (goals || []).filter((g) => blockGoalId(g) === String(block._id)) : []),
    [goals, block]
  );

  const ensureBlock = async () => {
    const payload = {
      title: title.trim() || `${weeks}-week block`,
      weeks: Number(weeks) || 12,
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: blockEndISO,
      workoutSplit,
    };
    if (block?._id) {
      const updated = await trainingBlockApi.updateTrainingBlock({ _id: block._id, ...payload });
      setBlock(updated);
      return updated;
    }
    const created = await trainingBlockApi.createTrainingBlock(payload);
    setBlock(created);
    return created;
  };

  const saveContext = () =>
    dispatch(
      updateUserSettings({
        trainingExperience: experience,
        activityLevel: activity,
        weeklyFrequency: daysPerWeek === "" ? undefined : Number(daysPerWeek),
        equipmentAccess: equipment,
        injuries,
        mobilityRestrictions: mobility,
      })
    );

  // Which required basics (not captured elsewhere in the wizard) are still missing.
  const missingBasics = {
    dob: !user.dateOfBirth,
    height: !user.height,
    sex: !user.sex,
    weight: latestMetric?.weight == null,
  };
  const anyBasicMissing = Object.values(missingBasics).some(Boolean);

  const saveBasics = async () => {
    setSavingBasics(true);
    try {
      const profile = {};
      if (dob) profile.dateOfBirth = dob;
      if (height) profile.height = height;
      if (sex) profile.sex = sex;
      if (Object.keys(profile).length) await dispatch(updateUserSettings(profile));
      if (bodyWeight !== "") {
        await dispatch(createMetricEntry({ weight: Number(bodyWeight), recordedAt: new Date().toISOString() }));
        await dispatch(requestLatestMetric({}));
        setBodyWeight("");
      }
    } finally {
      setSavingBasics(false);
    }
  };

  const canLeave = (s) => {
    if (s === 2) return blockGoals.length >= 1;
    return true; // period defaults are valid; context is optional; review is terminal
  };

  // Persist whatever the current step edits so nothing is lost on navigation OR a later crash. Block
  // fields (weeks/target on step 0, the day-split on step 1) -> ensureBlock; profile (experience, days/
  // week, equipment, injuries, mobility) on step 1 -> saveContext. The split is EDITED on step 1, so it
  // must be saved when leaving step 1 (not just at 0->1, which ran before those edits existed).
  const persistStep = async (s) => {
    if (s === 0 || s === 1) await ensureBlock();
    if (s === 1) await saveContext();
  };

  const handleNext = async () => {
    if (!canLeave(step) || busy) return;
    try {
      setBusy(true);
      setErr("");
      await persistStep(step);
      setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
    } catch (e) {
      // Surface instead of silently sticking (e.g. a delegation-scope 403 would otherwise be invisible).
      setErr("Couldn't save the training block. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleBack = async () => {
    if (busy) return;
    try {
      setBusy(true);
      await persistStep(step); // save the current step before leaving, so going back never drops edits
    } catch (e) {
      // non-fatal going back; still let them navigate
    } finally {
      setBusy(false);
      setStep((s) => Math.max(0, s - 1));
    }
  };

  const handleSwipe = (index) => {
    if (index === step + 1) handleNext();
    else if (index === step - 1) handleBack();
  };

  const finish = () => {
    onClose();
    navigate("/goals");
  };

  const chips = (label, placeholder, value, setValue) => (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(e, v) => setValue(v)}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );

  const isLast = step === STEP_TITLES.length - 1;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
        sx={{ "& .MuiDialog-paper": { height: "100%" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {STEP_TITLES[step]}
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          <SwipeableViews
            index={step}
            onChangeIndex={handleSwipe}
            enableMouseEvents
            style={{ height: "100%", width: "100%" }}
            containerStyle={{ height: "100%" }}
            slideStyle={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
          >
            {/* Step 0 — time period */}
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Let&apos;s plan your Training Block</Typography>
                <Typography variant="body2" color="text.secondary">
                  A Training Block is a plan for a program cycle — its timeframe, your training context,
                  and the goals to focus on. We&apos;ll use it later to generate a draft program (it isn&apos;t a
                  workout program yet).
                </Typography>
                <TextField
                  fullWidth
                  label="Name (optional)"
                  placeholder="e.g. Summer strength"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <TextField
                  type="date"
                  fullWidth
                  label="Target date (optional)"
                  value={targetDate}
                  onChange={(e) => handleTargetDateChange(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Have a date in mind? Set it and the length fills in."
                />
                <TextField
                  type="number"
                  fullWidth
                  label="Length (weeks)"
                  value={weeks}
                  onChange={(e) => handleWeeksChange(e.target.value)}
                  slotProps={{ htmlInput: { min: 1, max: 52 } }}
                  helperText={targetDate ? `Ends ${blockEndISO}` : ""}
                />
              </Stack>
            </Box>

            {/* Step 1 — training context */}
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="h6">A bit about your training</Typography>
                <Typography variant="body2" color="text.secondary">
                  Pre-filled from your profile — adjust anything that&apos;s changed.
                </Typography>
                <FormControl fullWidth>
                  <InputLabel id="tbw-exp">Experience</InputLabel>
                  <Select labelId="tbw-exp" label="Experience" value={experience}
                    onChange={(e) => setExperience(e.target.value)}>
                    {EXPERIENCE.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="tbw-act">Current activity level</InputLabel>
                  <Select labelId="tbw-act" label="Current activity level" value={activity}
                    onChange={(e) => setActivity(e.target.value)}>
                    {ACTIVITY.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  select
                  fullWidth
                  label="Training days per week"
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(e.target.value)}
                >
                  <MenuItem value=""><em>—</em></MenuItem>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                {daysPerWeek !== "" && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Days by workout type (optional)
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                      {WORKOUT_TYPE_ORDER.map((t) => (
                        <TextField
                          key={t}
                          select
                          size="small"
                          label={t}
                          value={workoutSplit[t] ?? 0}
                          onChange={(e) => setWorkoutSplit((prev) => ({ ...prev, [t]: Number(e.target.value) }))}
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </TextField>
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {WORKOUT_TYPE_ORDER.reduce((s, t) => s + (Number(workoutSplit[t]) || 0), 0)} of {daysPerWeek} days allocated
                    </Typography>
                  </Box>
                )}
                <Autocomplete
                  multiple freeSolo options={EQUIPMENT_OPTIONS} value={equipment}
                  onChange={(e, v) => setEquipment(v)}
                  renderInput={(params) => <TextField {...params} label="Equipment access" placeholder="Add equipment" />}
                />
                {chips("Injuries", "e.g. left knee", injuries, setInjuries)}
                {chips("Mobility restrictions", "e.g. tight hips", mobility, setMobility)}
              </Stack>
            </Box>

            {/* Step 2 — goals */}
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Training Block goals</Typography>
                <Typography variant="body2" color="text.secondary">
                  Add the goals to focus on this cycle{block?.targetDate ? ", by " + blockEndISO : ""}. These will be used later to generate a draft program.
                </Typography>
                {blockGoals.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No goals yet — add your first one.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {blockGoals.map((g) => (
                      <Paper key={g._id} variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Box sx={{ cursor: "pointer", flex: 1 }} onClick={() => setEditGoal(g)}>
                          <Typography variant="body1">{g.title}</Typography>
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                            {g.importanceScore ? (
                              <Chip size="small" variant="outlined" color="primary" label={`Importance ${g.importanceScore}/10`} />
                            ) : null}
                            <Chip size="small" variant="outlined" label="Tap to edit" />
                          </Stack>
                        </Box>
                        <IconButton size="small" onClick={() => dispatch(deleteGoal(g._id))}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Paper>
                    ))}
                  </Stack>
                )}
                <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setAddGoalOpen(true)}>
                  Add a goal
                </Button>
              </Stack>
            </Box>

            {/* Step 3 — review */}
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Review &amp; readiness</Typography>
                <Typography variant="body2" color="text.secondary">
                  Readiness below reflects only this Training Block&apos;s goals. This block is a plan —
                  it will be used later to generate a draft program.
                </Typography>
                <ProgramReadinessCard user={user} goals={blockGoals} latestWeight={latestMetric?.weight} />
                {anyBasicMissing && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Finish your profile</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                      A few basics are still needed — add them here so your plan is complete.
                    </Typography>
                    <Stack spacing={1.5}>
                      {missingBasics.dob && (
                        <TextField type="date" fullWidth label="Date of birth" value={dob}
                          onChange={(e) => setDob(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                      )}
                      {missingBasics.height && (
                        <TextField fullWidth label="Height" placeholder={"e.g. 5' 10\""} value={height}
                          onChange={(e) => setHeight(e.target.value)} />
                      )}
                      {missingBasics.sex && (
                        <TextField select fullWidth label="Sex" value={sex} onChange={(e) => setSex(e.target.value)}>
                          <MenuItem value="male">Male</MenuItem>
                          <MenuItem value="female">Female</MenuItem>
                          <MenuItem value="Prefer not to answer">Prefer not to answer</MenuItem>
                        </TextField>
                      )}
                      {missingBasics.weight && (
                        <TextField type="number" fullWidth label={`Body weight (${user.workoutWeightUnit || "lbs"})`}
                          value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} />
                      )}
                      <Box>
                        <Button variant="outlined" onClick={saveBasics} disabled={savingBasics}>
                          {savingBasics ? "Saving…" : "Save details"}
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                )}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {title.trim() || `${weeks}-week block`} · {weeks} weeks · by {blockEndISO}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  {[...blockGoals]
                    .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
                    .map((g) => (
                      <Typography key={g._id} variant="body2">
                        • {g.title}{g.importanceScore ? ` (importance ${g.importanceScore})` : ""}
                      </Typography>
                    ))}
                </Paper>
              </Stack>
            </Box>
          </SwipeableViews>
        </DialogContent>
        {err && (
          <Typography variant="caption" color="error" sx={{ px: 2, pb: 0.5, display: "block" }}>
            {err}
          </Typography>
        )}
        <MobileStepper
          variant="dots"
          steps={STEP_TITLES.length}
          position="static"
          activeStep={step}
          sx={{ backgroundColor: "transparent" }}
          backButton={
            <Button size="small" onClick={() => (step === 0 ? onClose() : handleBack())}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
          }
          nextButton={
            isLast ? (
              <Button size="small" variant="contained" onClick={finish} disabled={blockGoals.length === 0}>
                Finish
              </Button>
            ) : (
              <Button size="small" onClick={handleNext} disabled={!canLeave(step) || busy}>
                Next
              </Button>
            )
          }
        />
      </Dialog>

      <ErrorBoundary onReset={() => setAddGoalOpen(false)}>
        <AddNewGoal
          open={addGoalOpen}
          onClose={() => setAddGoalOpen(false)}
          dispatch={dispatch}
          exerciseLibrary={exerciseLibrary}
          latestMetric={latestMetric}
          weightUnit={user.workoutWeightUnit}
          trainingBlockId={block?._id}
          defaultTargetDate={blockEndISO}
        />
      </ErrorBoundary>

      {editGoal && (
        <ErrorBoundary onReset={() => setEditGoal(null)}>
          <GoalDetails
            goal={editGoal}
            open={Boolean(editGoal)}
            onClose={() => setEditGoal(null)}
            dispatch={dispatch}
            user={user}
            exerciseLibrary={exerciseLibrary}
            latestMetric={latestMetric}
            weightUnit={user.workoutWeightUnit}
          />
        </ErrorBoundary>
      )}
    </>
  );
}
