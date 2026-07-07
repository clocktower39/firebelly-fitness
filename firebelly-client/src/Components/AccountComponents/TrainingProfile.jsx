import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../Redux/actions/accountActions";
import { getGoals, requestLatestMetric } from "../../Redux/actions";
import ProgramReadinessCard from "./ProgramReadinessCard";
import {
  Autocomplete,
  Button,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";

const EXPERIENCE = [
  { value: "beginner", label: "Beginner (< 1 yr / new to lifting)" },
  { value: "intermediate", label: "Intermediate (1–3 yrs)" },
  { value: "advanced", label: "Advanced (3+ yrs)" },
];
const ACTIVITY = [
  { value: "sedentary", label: "Sedentary (desk job, little activity)" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Moderately active" },
  { value: "very_active", label: "Very active (on feet / labor / athlete)" },
];
const STRESS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];
// Suggestions only — the field is free-solo, aligned to the Exercise equipment vocabulary.
const EQUIPMENT_OPTIONS = [
  "Full gym", "Barbell", "Dumbbells", "Kettlebell", "Machine", "Cable", "Bands",
  "Bodyweight", "Pull-up bar", "Bench", "Squat rack", "Cardio machine",
];

// Client Training Profile — the structured intake that (Phase 2) drives program generation.
export default function TrainingProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const goals = useSelector((state) => state.goals);
  const latestMetric = useSelector((state) => state.metrics.latestByUser[user._id]);
  const tp = user.trainingProfile || {};

  useEffect(() => {
    dispatch(getGoals({ requestedBy: "client" }));
    dispatch(requestLatestMetric({}));
  }, [dispatch]);

  const [experience, setExperience] = useState(user.trainingExperience || "");
  const [activity, setActivity] = useState(user.activityLevel || "");
  const [injuries, setInjuries] = useState(user.injuries || []);
  const [mobility, setMobility] = useState(user.mobilityRestrictions || []);
  const [equipment, setEquipment] = useState(user.equipmentAccess || []);
  const [sleepHours, setSleepHours] = useState(tp.sleepHours ?? "");
  const [stressLevel, setStressLevel] = useState(tp.stressLevel || "");
  const [preferredStyle, setPreferredStyle] = useState(tp.preferredStyle || "");
  const [aestheticFocus, setAestheticFocus] = useState(tp.aestheticFocus || "");
  const [notes, setNotes] = useState(tp.notes || "");
  const [confidenceScore, setConfidenceScore] = useState(tp.confidenceScore ?? "");
  const [willTrainDays, setWillTrainDays] = useState(tp.willingnessToTrainDaysPerWeek ?? "");
  const [willNutrition, setWillNutrition] = useState(tp.willingnessToChangeNutrition ?? "");
  const [willDisliked, setWillDisliked] = useState(tp.willingnessToDoDislikedExercises ?? "");
  const [biggestObstacle, setBiggestObstacle] = useState(tp.biggestObstacle || "");
  const [notWilling, setNotWilling] = useState(tp.whatTheyAreNotWillingToChange || "");
  const [saved, setSaved] = useState(false);

  const numOrNull = (v) => (v === "" || v === null ? null : Number(v));

  const save = () => {
    dispatch(
      updateUserSettings({
        trainingExperience: experience,
        activityLevel: activity,
        injuries,
        mobilityRestrictions: mobility,
        equipmentAccess: equipment,
        trainingProfile: {
          sleepHours: sleepHours === "" ? null : Number(sleepHours),
          stressLevel,
          preferredStyle,
          aestheticFocus,
          notes,
          confidenceScore: numOrNull(confidenceScore),
          willingnessToTrainDaysPerWeek: numOrNull(willTrainDays),
          willingnessToChangeNutrition: numOrNull(willNutrition),
          willingnessToDoDislikedExercises: numOrNull(willDisliked),
          biggestObstacle,
          whatTheyAreNotWillingToChange: notWilling,
        },
      })
    );
    setSaved(true);
  };

  const dirty = () => setSaved(false);
  const chips = (label, placeholder, value, setValue) => (
    <Grid size={12}>
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value}
        onChange={(e, v) => { setValue(v); dirty(); }}
        renderInput={(params) => (
          <TextField {...params} label={label} placeholder={placeholder} helperText="Type and press Enter to add" />
        )}
      />
    </Grid>
  );

  const numSelect = (label, value, setValue, lo, hi) => (
    <Grid size={{ xs: 12, sm: 6 }}>
      <FormControl fullWidth>
        <InputLabel id={`ns-${label}`}>{label}</InputLabel>
        <Select
          labelId={`ns-${label}`}
          label={label}
          value={value}
          onChange={(e) => { setValue(e.target.value); dirty(); }}
        >
          <MenuItem value=""><em>—</em></MenuItem>
          {Array.from({ length: hi - lo + 1 }, (_, i) => i + lo).map((n) => (
            <MenuItem key={n} value={n}>{n}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  );

  return (
    <Container maxWidth="md" sx={{ height: "100%" }}>
      <Grid container size={12} sx={{ padding: "15px" }}>
        <Typography color="primary.contrastText" variant="h5" gutterBottom>
          Training Profile
        </Typography>
      </Grid>
      <ProgramReadinessCard user={user} goals={goals} latestWeight={latestMetric?.weight} />
      <Paper>
        <Grid container spacing={2} sx={{ padding: "15px" }}>
          <Grid size={12}>
            <Typography variant="body2" color="text.secondary">
              This helps your coach (and Firebelly&apos;s program builder) tailor training to you.
              Your training days &amp; session length live under Workout Preferences.
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="exp">Training experience</InputLabel>
              <Select labelId="exp" label="Training experience" value={experience}
                onChange={(e) => { setExperience(e.target.value); dirty(); }}>
                {EXPERIENCE.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="act">Current activity level</InputLabel>
              <Select labelId="act" label="Current activity level" value={activity}
                onChange={(e) => { setActivity(e.target.value); dirty(); }}>
                {ACTIVITY.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={12}><Divider sx={{ width: "100%" }} /></Grid>
          <Grid size={12}><Typography variant="subtitle1">Constraints</Typography></Grid>
          {chips("Injuries", "e.g. left knee, lower back", injuries, setInjuries)}
          {chips("Mobility restrictions", "e.g. limited overhead, tight hips", mobility, setMobility)}
          <Grid size={12}>
            <Autocomplete
              multiple
              freeSolo
              options={EQUIPMENT_OPTIONS}
              value={equipment}
              onChange={(e, v) => { setEquipment(v); dirty(); }}
              renderInput={(params) => (
                <TextField {...params} label="Equipment access" placeholder="Add equipment you can train with" />
              )}
            />
          </Grid>

          <Grid size={12}><Divider sx={{ width: "100%" }} /></Grid>
          <Grid size={12}><Typography variant="subtitle1">Recovery &amp; preferences</Typography></Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth type="number" label="Typical sleep (hours/night)" value={sleepHours}
              onChange={(e) => { setSleepHours(e.target.value); dirty(); }}
              slotProps={{ htmlInput: { min: 0, max: 14, step: 0.5 } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="stress">Stress level</InputLabel>
              <Select labelId="stress" label="Stress level" value={stressLevel}
                onChange={(e) => { setStressLevel(e.target.value); dirty(); }}>
                {STRESS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Preferred training style" placeholder="e.g. powerlifting, bodybuilding"
              value={preferredStyle} onChange={(e) => { setPreferredStyle(e.target.value); dirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Aesthetic focus (optional)" placeholder="e.g. shoulders, glutes"
              value={aestheticFocus} onChange={(e) => { setAestheticFocus(e.target.value); dirty(); }} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={2} label="Anything else your coach should know?"
              value={notes} onChange={(e) => { setNotes(e.target.value); dirty(); }} />
          </Grid>

          <Grid size={12}><Divider sx={{ width: "100%" }} /></Grid>
          <Grid size={12}><Typography variant="subtitle1">Commitment &amp; readiness</Typography></Grid>
          {numSelect("Confidence you'll succeed (1–10)", confidenceScore, setConfidenceScore, 1, 10)}
          {numSelect("Days/week willing to train", willTrainDays, setWillTrainDays, 0, 7)}
          {numSelect("Willingness to change nutrition (1–10)", willNutrition, setWillNutrition, 1, 10)}
          {numSelect("Willingness to do disliked exercises (1–10)", willDisliked, setWillDisliked, 1, 10)}
          <Grid size={12}>
            <TextField fullWidth label="Biggest obstacle" placeholder="e.g. travel schedule, low energy"
              value={biggestObstacle} onChange={(e) => { setBiggestObstacle(e.target.value); dirty(); }} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth label="What are you NOT willing to change?" placeholder="e.g. rest days, morning coffee"
              value={notWilling} onChange={(e) => { setNotWilling(e.target.value); dirty(); }} />
          </Grid>

          <Grid container size={12} sx={{ justifyContent: "center", mt: 1 }}>
            <Button variant="contained" onClick={save}>{saved ? "Saved ✓" : "Save"}</Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
