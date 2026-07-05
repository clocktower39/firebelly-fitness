import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography,
} from "@mui/material";
import { ExerciseListAutocomplete } from "../../features/workout/components/AddExercisesDialog";
import { findSubstitutes } from "../../utils/exerciseSubstitutes";
import { swapExerciseForward } from "../../Redux/actions";

// Swap the current exercise for another and (optionally) cascade the change to every later
// workout in the same program. The cascade preserves each downstream workout's programmed
// scheme — only the exercise changes. Server figures out "later" from the anchor workout
// (later week/day for a program template; the client's future, unfinished workouts for an
// assigned schedule) and never rewrites a completed workout.
export default function SwapExerciseDialog({ open, onClose, currentExercise, onApplied }) {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const workout = useSelector((state) => state.training);
  const exerciseList = useSelector((state) => state.progress.exerciseList) || [];

  const isTemplate = Boolean(workout?.isTemplate);
  // Program templates carry no programId on the doc — the builder passes it in the URL.
  const programId = workout?.programId || searchParams.get("programId") || null;

  const currentId = currentExercise?._id;
  // The entry only carries { _id, exerciseTitle }; pull the full library record so
  // findSubstitutes can rank by muscle groups / equipment / complexity.
  const fullCurrent = useMemo(
    () => exerciseList.find((e) => e._id === currentId) || currentExercise,
    [exerciseList, currentId, currentExercise]
  );

  const [selected, setSelected] = useState([]); // single replacement, kept as a 1-item array
  const [scope, setScope] = useState("forward");
  const [differentEquipmentOnly, setDifferentEquipmentOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const suggestions = useMemo(
    () => findSubstitutes(fullCurrent, exerciseList, { limit: 6, differentEquipmentOnly }),
    [fullCurrent, exerciseList, differentEquipmentOnly]
  );

  const replacement = selected[selected.length - 1] || null;
  const cannotCascadeTemplate = isTemplate && !programId;
  const canApply =
    replacement &&
    replacement._id &&
    replacement._id !== currentId &&
    workout?._id &&
    !submitting &&
    !(scope === "forward" && cannotCascadeTemplate);

  const forwardLabel = isTemplate
    ? "This and all later weeks in this program"
    : "This and all later workouts in this program";

  const scopeHint =
    scope === "single"
      ? "Only this workout will change."
      : isTemplate
      ? "Changes cascade to later weeks of the program template. Clients already assigned this program are not affected."
      : "Changes cascade to this client's future, unfinished workouts. Completed workouts are never changed.";

  const reset = () => {
    setSelected([]);
    setResult(null);
    setError("");
    setScope("forward");
    setDifferentEquipmentOnly(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleApply = async () => {
    if (!canApply) return;
    setSubmitting(true);
    setError("");
    const data = await dispatch(
      swapExerciseForward({
        anchorWorkoutId: workout._id,
        fromExercise: currentId,
        toExercise: replacement._id,
        scope,
        ...(programId ? { programId } : {}),
      })
    );
    setSubmitting(false);
    if (!data || data.error) {
      setError(data?.error || "Something went wrong applying the swap.");
      return;
    }
    // Keep the open editor entry in sync immediately (the swapped anchor also re-hydrates
    // from the server, but the entry component won't remount, so refresh its selection).
    if (onApplied) onApplied(replacement);
    setResult(data);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Swap exercise</DialogTitle>
      <DialogContent>
        {result ? (
          <Alert severity="success" sx={{ my: 1 }}>
            Updated {result.updatedCount} workout{result.updatedCount === 1 ? "" : "s"}.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Replace{" "}
              <strong>{fullCurrent?.exerciseTitle || currentExercise?.exerciseTitle || "this exercise"}</strong>{" "}
              with a harder or easier movement:
            </Typography>

            {suggestions.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Suggested alternatives (same muscles)
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                  {suggestions.map((s) => (
                    <Chip
                      key={s._id}
                      label={s.exerciseTitle}
                      size="small"
                      color={replacement?._id === s._id ? "primary" : "default"}
                      variant={replacement?._id === s._id ? "filled" : "outlined"}
                      onClick={() => setSelected([s])}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={differentEquipmentOnly}
                  onChange={(e) => setDifferentEquipmentOnly(e.target.checked)}
                />
              }
              label="Only suggest different equipment"
            />

            <Box sx={{ mt: 1 }}>
              <ExerciseListAutocomplete
                exerciseList={exerciseList}
                selectedExercises={selected}
                setSelectedExercises={(next) =>
                  setSelected(next.length ? [next[next.length - 1]] : [])
                }
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2">Apply to</Typography>
            <RadioGroup value={scope} onChange={(e) => setScope(e.target.value)}>
              <FormControlLabel value="single" control={<Radio />} label="Just this workout" />
              <FormControlLabel value="forward" control={<Radio />} label={forwardLabel} />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary" display="block">
              {scopeHint}
            </Typography>

            {cannotCascadeTemplate && scope === "forward" && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Open this workout from the program builder to cascade the swap across the program.
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{result ? "Close" : "Cancel"}</Button>
        {!result && (
          <Button variant="contained" onClick={handleApply} disabled={!canApply}>
            {submitting ? "Applying…" : "Apply swap"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
