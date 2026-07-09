import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useSearchParams } from "react-router-dom";
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
  const params = useParams();
  // Source the open workout the way the editor does — from the workout buckets by the route
  // id. (state.training is a legacy slice that isn't reliably the currently-open workout, so
  // reading it left the anchor undefined and kept "Apply swap" disabled.)
  const workout = useSelector((state) => {
    for (const bucket of Object.values(state.workouts || {})) {
      const match = (bucket?.workouts || []).find((w) => w._id === params._id);
      if (match) return match;
    }
    return state.training || null;
  });
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
  // Default to just-this-workout. Cascading forward by default was what quietly turned one edit
  // into program-wide rewrites (and duplicates); use "Update later weeks from Week 1" in the
  // builder to push structure forward deliberately.
  const [scope, setScope] = useState("single");
  const [differentEquipmentOnly, setDifferentEquipmentOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const suggestions = useMemo(
    () => findSubstitutes(fullCurrent, exerciseList, { limit: 6, differentEquipmentOnly }),
    [fullCurrent, exerciseList, differentEquipmentOnly]
  );

  const replacement = selected[selected.length - 1] || null;
  const canApply =
    replacement &&
    replacement._id &&
    replacement._id !== currentId &&
    workout?._id &&
    !submitting;

  const forwardLabel = "This and all this client's later workouts";

  const scopeHint =
    scope === "single"
      ? "Only this workout will change."
      : "Also swaps this exercise in the client's future, unfinished workouts. Completed workouts are never changed.";

  const reset = () => {
    setSelected([]);
    setResult(null);
    setError("");
    setScope("single");
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

    // Program templates (the builder) + "just this workout": swap is a LOCAL edit of the open
    // workout. It saves atomically with your other edits via the editor's Save button — no
    // server round-trip against a possibly-stale DB, which is what mis-targeted swaps and
    // created duplicates. To push structure across weeks, use "Update later weeks from Week 1".
    if (isTemplate || scope === "single") {
      if (onApplied) onApplied(replacement);
      setResult({ updatedCount: 1, local: true });
      setSubmitting(false);
      return;
    }

    // Client-dated forward cascade: swap this exercise across the client's future, unfinished
    // workouts (server) — the open anchor is handled locally (excludeAnchor) + saved by the editor.
    const data = await dispatch(
      swapExerciseForward({
        anchorWorkoutId: workout._id,
        fromExercise: currentId,
        toExercise: replacement._id,
        scope: "forward",
        excludeAnchor: true,
        ...(programId ? { programId } : {}),
      })
    );
    setSubmitting(false);
    if (!data || data.error) {
      setError(data?.error || "Something went wrong applying the swap.");
      return;
    }
    if (onApplied) onApplied(replacement);
    setResult({ ...data, updatedCount: (data.updatedCount || 0) + 1 });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Swap exercise</DialogTitle>
      <DialogContent>
        {result ? (
          <Alert severity="success" sx={{ my: 1 }}>
            {result.local
              ? "Exercise swapped in this workout."
              : `Updated ${result.updatedCount} workout${result.updatedCount === 1 ? "" : "s"}.`}
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

            {isTemplate ? (
              <Typography variant="caption" color="text.secondary" display="block">
                This swaps the exercise in this workout only. To apply changes across later weeks,
                use <strong>&ldquo;Update later weeks from Week 1&rdquo;</strong> in the program builder.
              </Typography>
            ) : (
              <>
                <Typography variant="subtitle2">Apply to</Typography>
                <RadioGroup value={scope} onChange={(e) => setScope(e.target.value)}>
                  <FormControlLabel value="single" control={<Radio />} label="Just this workout" />
                  <FormControlLabel value="forward" control={<Radio />} label={forwardLabel} />
                </RadioGroup>
                <Typography variant="caption" color="text.secondary" display="block">
                  {scopeHint}
                </Typography>
              </>
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
