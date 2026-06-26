import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../Redux/actions/accountActions";
import {
  Button,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  pushSupported,
  isPushSubscribed,
  enablePush,
  disablePush,
} from "../../utils/pushManager";

const DEFAULTS = {
  clientWorkoutCompleted: true,
  goalMet: true,
  workoutReminder: true,
  workoutReminderTime: "08:00",
  workoutOverdue: true,
  workoutOverdueAfterMinutes: 180,
  sessionReminder: true,
  sessionReminderLeadMinutes: 120,
  measurementReminder: false,
  measurementCadence: "MONTHLY",
};

export default function NotificationPreferences() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const [prefs, setPrefs] = useState({ ...DEFAULTS, ...(user.notificationPrefs || {}) });
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pushSupported()) isPushSubscribed().then(setPushOn);
  }, []);

  const set = (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    dispatch(updateUserSettings({ notificationPrefs: prefs }));
    setSaved(true);
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        await enablePush();
        setPushOn(true);
      }
    } catch (e) {
      /* permission denied / unsupported */
    } finally {
      setPushBusy(false);
    }
  };

  const Toggle = ({ field, label }) => (
    <Grid container size={12}>
      <FormControlLabel
        control={
          <Switch checked={Boolean(prefs[field])} onChange={(e) => set(field, e.target.checked)} />
        }
        label={label}
      />
    </Grid>
  );

  return (
    <Container maxWidth="md" sx={{ height: "100%" }}>
      <Grid container size={12} sx={{ padding: "15px" }}>
        <Typography color="primary.contrastText" variant="h5" gutterBottom>
          Notification Preferences
        </Typography>
      </Grid>
      <Paper>
        <Grid container spacing={2} sx={{ padding: "15px" }}>
          <Grid container size={12}>
            <Typography variant="subtitle1">Browser push</Typography>
          </Grid>
          {pushSupported() ? (
            <Grid container size={12} direction="column">
              <FormControlLabel
                control={<Switch checked={pushOn} disabled={pushBusy} onChange={togglePush} />}
                label={pushOn ? "Push notifications enabled" : "Enable push notifications"}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>
                Lets reminders reach you even when the app is closed.
              </Typography>
            </Grid>
          ) : (
            <Grid container size={12}>
              <Typography variant="body2" color="text.secondary">
                Push notifications aren&apos;t supported in this browser.
              </Typography>
            </Grid>
          )}

          <Grid container size={12}>
            <Divider sx={{ width: "100%" }} />
          </Grid>
          <Grid container size={12}>
            <Typography variant="subtitle1">What to notify me about</Typography>
          </Grid>

          {user.isTrainer && <Toggle field="clientWorkoutCompleted" label="A client completes a workout" />}
          <Toggle field="goalMet" label="I hit a goal" />

          <Toggle field="sessionReminder" label="Reminder before a session" />
          {prefs.sessionReminder && (
            <Grid container size={12} sx={{ pl: 6 }}>
              <TextField
                type="number"
                size="small"
                label="Hours before"
                value={Math.round((Number(prefs.sessionReminderLeadMinutes) || 120) / 60)}
                onChange={(e) => set("sessionReminderLeadMinutes", Math.max(1, Number(e.target.value) || 1) * 60)}
                slotProps={{ htmlInput: { min: 1, max: 24 } }}
                sx={{ width: 150 }}
              />
            </Grid>
          )}

          <Toggle field="workoutReminder" label="Reminder on workout days" />
          {prefs.workoutReminder && (
            <Grid container size={12} sx={{ pl: 6 }}>
              <TextField
                type="time"
                size="small"
                label="Reminder time"
                value={prefs.workoutReminderTime || "08:00"}
                onChange={(e) => set("workoutReminderTime", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 170 }}
              />
            </Grid>
          )}

          <Toggle field="workoutOverdue" label="Nudge me if I haven't done my workout" />
          {prefs.workoutOverdue && (
            <Grid container size={12} sx={{ pl: 6 }}>
              <TextField
                type="number"
                size="small"
                label="Hours after it was due"
                value={Math.round((Number(prefs.workoutOverdueAfterMinutes) || 180) / 60)}
                onChange={(e) => set("workoutOverdueAfterMinutes", Math.max(1, Number(e.target.value) || 1) * 60)}
                slotProps={{ htmlInput: { min: 1, max: 24 } }}
                sx={{ width: 180 }}
              />
            </Grid>
          )}

          <Toggle field="measurementReminder" label="Remind me to log measurements" />
          {prefs.measurementReminder && (
            <Grid container size={12} sx={{ pl: 6 }}>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel id="cadence-label">Cadence</InputLabel>
                <Select
                  labelId="cadence-label"
                  label="Cadence"
                  value={prefs.measurementCadence || "MONTHLY"}
                  onChange={(e) => set("measurementCadence", e.target.value)}
                >
                  <MenuItem value="WEEKLY">Weekly</MenuItem>
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid container size={12}>
            <Typography variant="caption" color="text.secondary">
              Reminder times use your timezone{user.timezone ? ` (${user.timezone})` : ""}.
            </Typography>
          </Grid>
          <Grid container size={12} sx={{ justifyContent: "center", mt: 1 }}>
            <Button variant="contained" onClick={save}>
              {saved ? "Saved ✓" : "Save"}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
