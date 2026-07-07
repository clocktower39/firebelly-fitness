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
} from "../../Redux/actions";
import { updateUserSettings } from "../../Redux/actions/accountActions";
import { EXPERIENCE, ACTIVITY, EQUIPMENT_OPTIONS } from "../../utils/trainingProfileOptions";
import ProgramReadinessCard from "../AccountComponents/ProgramReadinessCard";
import { AddNewGoal, GoalDetails } from "../../Pages/AppPages/Goals";

const SwipeableViews = SwipeableViewsModule.default ?? SwipeableViewsModule;
const STEP_TITLES = ["Your time period", "Your training context", "Training Block goals", "Review"];

const blockGoalId = (g) => String(g?.trainingBlock?._id || g?.trainingBlock || "");

// Guided, swipeable "Training Block" setup — groups several goals into one time period,
// with the program-relevant context and a readiness check. Runs for new users + on demand.
export default function TrainingBlockWizard({ open, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.user);
  const goals = useSelector((state) => state.goals);
  const exerciseLibrary = useSelector((state) => state.exerciseLibrary);
  const latestMetric = useSelector((state) => state.metrics.latestByUser[user._id]);

  const [step, setStep] = useState(0);
  const [block, setBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  // Step 0 — time period
  const [title, setTitle] = useState("");
  const [weeks, setWeeks] = useState(12);

  // Step 1 — training context (pre-filled from profile)
  const [experience, setExperience] = useState("");
  const [activity, setActivity] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [equipment, setEquipment] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [mobility, setMobility] = useState([]);

  useEffect(() => {
    if (!open) return;
    dispatch(getGoals({ requestedBy: "client" }));
    dispatch(requestExerciseLibrary());
    dispatch(requestLatestMetric({}));
    setStep(0);
    setBlock(null);
    setTitle("");
    setWeeks(12);
    setExperience(user.trainingExperience || "");
    setActivity(user.activityLevel || "");
    setDaysPerWeek(user.weeklyFrequency || "");
    setEquipment(user.equipmentAccess || []);
    setInjuries(user.injuries || []);
    setMobility(user.mobilityRestrictions || []);
  }, [open]);

  const blockEndISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + Number(weeks || 0) * 7);
    return d.toISOString().slice(0, 10);
  }, [weeks]);

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

  const canLeave = (s) => {
    if (s === 2) return blockGoals.length >= 1;
    return true; // period defaults are valid; context is optional; review is terminal
  };

  const handleNext = async () => {
    if (!canLeave(step) || busy) return;
    try {
      setBusy(true);
      if (step === 0) await ensureBlock();
      if (step === 1) await saveContext();
      setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
    } finally {
      setBusy(false);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

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
                  select
                  fullWidth
                  label="How long?"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                >
                  {[4, 6, 8, 10, 12, 16, 20, 24].map((w) => (
                    <MenuItem key={w} value={w}>{w} weeks</MenuItem>
                  ))}
                </TextField>
                <Typography variant="caption" color="text.secondary">
                  Target date: {blockEndISO}
                </Typography>
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

      {editGoal && (
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
      )}
    </>
  );
}
