import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Snackbar,
  Typography,
} from "@mui/material";
import { workoutApi } from "../../api/workoutApi";
import { addExerciseToWorkout } from "../../Redux/actions";
import { exerciseDisplayName } from "../../utils/exerciseName";

// Pick one of the user's upcoming workouts and append the exercise to it.
export default function AddToWorkoutDialog({ open, onClose, exercise }) {
  const dispatch = useDispatch();
  const aliases = useSelector((s) => s.progress.exerciseAliases) || {};
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    workoutApi
      .getWorkoutsByRange({
        rangeStart: dayjs().startOf("day").toISOString(),
        rangeEnd: dayjs().add(28, "day").endOf("day").toISOString(),
      })
      .then((res) => {
        if (!active) return;
        const list = (res?.workouts || [])
          .filter((w) => !w.isTemplate)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setWorkouts(list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const handlePick = async (workout) => {
    setBusyId(workout._id);
    const saved = await dispatch(addExerciseToWorkout({ exercise, workout }));
    setBusyId(null);
    if (saved) {
      setToast(`Added to ${dayjs(workout.date).format("ddd, MMM D")}`);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>Add &ldquo;{exerciseDisplayName(exercise, aliases)}&rdquo; to a workout</DialogTitle>
        <DialogContent dividers>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {!loading && workouts.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No upcoming workouts in the next 4 weeks. Create one from your calendar first, then add
              exercises to it here.
            </Typography>
          )}
          {!loading && workouts.length > 0 && (
            <List disablePadding>
              {workouts.map((w) => (
                <ListItemButton
                  key={w._id}
                  disabled={busyId === w._id}
                  onClick={() => handlePick(w)}
                >
                  <ListItemText
                    primary={dayjs(w.date).format("ddd, MMM D")}
                    secondary={w.title || `${(w.training || []).flat().length} exercises`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast("")}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}
