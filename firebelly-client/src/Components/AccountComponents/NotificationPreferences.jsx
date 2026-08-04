import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../Redux/actions/accountActions";
import { getConversations, setConversationMuted } from "../../Redux/actions";
import {
  Button,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Delete, PlayArrow } from "@mui/icons-material";
import {
  pushSupported,
  isPushSubscribed,
  enablePush,
  disablePush,
} from "../../utils/pushManager";
import MessageSoundDialog from "../MessageSoundDialog";
import { soundApi } from "../../api/soundApi";
import { BUILTIN_SOUNDS, playMessageSound } from "../../utils/messageSounds";

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
  readinessReminder: false,
  readinessReminderTime: "08:00",
};

export default function NotificationPreferences() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const [prefs, setPrefs] = useState({ ...DEFAULTS, ...(user.notificationPrefs || {}) });
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const conversations = useSelector((state) => state.conversations) || [];
  const messageSounds = user.messageSounds || {};
  const [mySounds, setMySounds] = useState([]);
  const [defaultSoundOpen, setDefaultSoundOpen] = useState(false);

  useEffect(() => {
    if (pushSupported()) isPushSubscribed().then(setPushOn);
  }, []);

  useEffect(() => {
    soundApi.list().then((r) => Array.isArray(r) && setMySounds(r));
  }, []);

  useEffect(() => {
    dispatch(getConversations());
  }, [dispatch]);

  const meId = user._id;
  const nameOf = (u) =>
    u?.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u?.username || "User";
  const titleOf = (c) =>
    c.title ||
    (c.participants || [])
      .filter((p) => String(p.user?._id || p.user) !== String(meId))
      .map((p) => nameOf(p.user))
      .join(", ") ||
    "Conversation";
  const mutedConvos = conversations.filter((c) =>
    (c.participants || []).some(
      (p) => String(p.user?._id || p.user) === String(meId) && p.muted
    )
  );

  // ---- Message sounds (the messageSounds user setting + uploaded tones) ----
  const soundLabelOf = (ref) => {
    if (!ref) return "None";
    if (ref === "none") return "Silent";
    if (ref.startsWith("builtin:")) {
      const b = BUILTIN_SOUNDS.find((s) => s.id === ref.slice("builtin:".length));
      return b ? b.label : "Built-in tone";
    }
    if (ref.startsWith("file:")) {
      const f = mySounds.find((s) => String(s.fileId) === ref.slice("file:".length));
      return f?.name || "Uploaded sound";
    }
    return ref;
  };

  const labelForSoundKey = (key) => {
    if (key.startsWith("conv:")) {
      const c = conversations.find((x) => String(x._id) === key.slice("conv:".length));
      return c ? `Chat: ${titleOf(c)}` : "Chat (no longer available)";
    }
    if (key.startsWith("user:")) {
      const id = key.slice("user:".length);
      for (const c of conversations) {
        const p = (c.participants || []).find((x) => String(x.user?._id || x.user) === id);
        if (p?.user?.firstName || p?.user?.username) return `Person: ${nameOf(p.user)}`;
      }
      return "Person";
    }
    return key;
  };

  const soundAssignments = Object.entries(messageSounds).filter(([k]) => k !== "default");

  const removeSoundAssignment = (key) => {
    const next = { ...messageSounds };
    delete next[key];
    dispatch(updateUserSettings({ messageSounds: next }));
  };

  const deleteUploadedSound = async (fileId) => {
    await soundApi.remove(fileId);
    setMySounds((prev) => prev.filter((s) => String(s.fileId) !== String(fileId)));
    // Scrub any assignments pointing at the deleted file so they don't linger as dead refs.
    const ref = `file:${fileId}`;
    const next = Object.fromEntries(Object.entries(messageSounds).filter(([, v]) => v !== ref));
    if (Object.keys(next).length !== Object.keys(messageSounds).length) {
      dispatch(updateUserSettings({ messageSounds: next }));
    }
  };

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

          <Toggle field="readinessReminder" label="Daily check-in reminder" />
          {prefs.readinessReminder && (
            <Grid container size={12} sx={{ pl: 6 }}>
              <TextField
                type="time"
                size="small"
                label="Reminder time"
                value={prefs.readinessReminderTime || "08:00"}
                onChange={(e) => set("readinessReminderTime", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 170 }}
              />
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

          <Grid container size={12}>
            <Divider sx={{ width: "100%" }} />
          </Grid>
          <Grid container size={12}>
            <Typography variant="subtitle1">Message sounds</Typography>
          </Grid>
          <Grid container size={12} direction="column">
            <Typography variant="caption" color="text.secondary">
              Sounds play while the app is open. Give a chat or a person their own sound with the
              music-note button in the chat window — or set one default for all messages here. You
              can use any audio file on your phone.
            </Typography>
            <List disablePadding sx={{ width: "100%" }}>
              <ListItem
                disableGutters
                secondaryAction={
                  <>
                    {messageSounds.default && messageSounds.default !== "none" && (
                      <IconButton
                        size="small"
                        onClick={() => playMessageSound(messageSounds.default)}
                        title="Preview"
                      >
                        <PlayArrow fontSize="small" />
                      </IconButton>
                    )}
                    <Button size="small" onClick={() => setDefaultSoundOpen(true)}>
                      Change
                    </Button>
                  </>
                }
              >
                <ListItemText
                  primary="All messages"
                  secondary={soundLabelOf(messageSounds.default)}
                />
              </ListItem>
              {soundAssignments.map(([key, ref]) => (
                <ListItem
                  key={key}
                  disableGutters
                  secondaryAction={
                    <>
                      {ref !== "none" && (
                        <IconButton size="small" onClick={() => playMessageSound(ref)} title="Preview">
                          <PlayArrow fontSize="small" />
                        </IconButton>
                      )}
                      <Button size="small" onClick={() => removeSoundAssignment(key)}>
                        Remove
                      </Button>
                    </>
                  }
                >
                  <ListItemText primary={labelForSoundKey(key)} secondary={soundLabelOf(ref)} />
                </ListItem>
              ))}
            </List>
            {mySounds.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  My uploaded sounds
                </Typography>
                <List dense disablePadding sx={{ width: "100%" }}>
                  {mySounds.map((s) => (
                    <ListItem
                      key={String(s.fileId)}
                      disableGutters
                      secondaryAction={
                        <>
                          <IconButton
                            size="small"
                            onClick={() => playMessageSound(`file:${s.fileId}`)}
                            title="Preview"
                          >
                            <PlayArrow fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => deleteUploadedSound(s.fileId)}
                            title="Delete"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </>
                      }
                    >
                      <ListItemText primary={s.name || "Custom sound"} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Grid>

          <Grid container size={12}>
            <Divider sx={{ width: "100%" }} />
          </Grid>
          <Grid container size={12}>
            <Typography variant="subtitle1">Muted chats</Typography>
          </Grid>
          <Grid container size={12}>
            {mutedConvos.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No muted chats. Mute a conversation from its chat window or the messages list.
              </Typography>
            ) : (
              <List disablePadding sx={{ width: "100%" }}>
                {mutedConvos.map((c) => (
                  <ListItem
                    key={c._id}
                    disableGutters
                    secondaryAction={
                      <Button size="small" onClick={() => dispatch(setConversationMuted(c._id, false))}>
                        Unmute
                      </Button>
                    }
                  >
                    <ListItemText primary={titleOf(c)} secondary="Notifications muted" />
                  </ListItem>
                ))}
              </List>
            )}
          </Grid>
        </Grid>
      </Paper>

      <MessageSoundDialog
        open={defaultSoundOpen}
        onClose={() => setDefaultSoundOpen(false)}
        targets={[{ key: "default", label: "All messages" }]}
      />
    </Container>
  );
}
