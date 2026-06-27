import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack, AddCircleOutlined } from "@mui/icons-material";
import {
  getExerciseList,
  getExerciseAliases,
  requestExerciseProgress,
  setExerciseAlias,
} from "../../Redux/actions";
import { exerciseDisplayName } from "../../utils/exerciseName";
import AddToWorkoutDialog from "../../features/exercise/AddToWorkoutDialog";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Extra catalog attributes to surface (only shown when populated).
const ATTRIBUTE_FIELDS = [
  { key: "movementPattern", label: "Movement pattern" },
  { key: "bodyPosition", label: "Body position" },
  { key: "anatomicalHandPosition", label: "Grip" },
  { key: "handSetup", label: "Hand setup" },
  { key: "footSetup", label: "Foot setup" },
  { key: "attachments", label: "Attachments" },
  { key: "generalVariation", label: "Variation" },
  { key: "tags", label: "Tags" },
];

// Render one logged session's sets, e.g. "135lbs × 8, 135lbs × 8" or "45s, 45s".
const formatSets = (achieved, measurementType, unit) => {
  const setCount =
    achieved?.sets ||
    Math.max(achieved?.reps?.length || 0, achieved?.weight?.length || 0, achieved?.seconds?.length || 0);
  const parts = [];
  for (let i = 0; i < setCount; i += 1) {
    const w = num(achieved?.weight?.[i]);
    const r = num(achieved?.reps?.[i]);
    const s = num(achieved?.seconds?.[i]);
    if (measurementType === "time" && s) parts.push(`${s}s`);
    else if (w) parts.push(`${w}${unit} × ${r ?? 0}`);
    else if (r != null) parts.push(`${r} reps`);
    else if (s) parts.push(`${s}s`);
  }
  return parts.join(", ");
};

export default function ExerciseDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useSelector((s) => s.user);
  const exerciseList = useSelector((s) => s.progress.exerciseList) || [];
  const aliases = useSelector((s) => s.progress.exerciseAliases) || {};
  const exercise = exerciseList.find((e) => e._id === id);
  const unit = user.workoutWeightUnit || "lbs";
  const [aliasInput, setAliasInput] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!exerciseList.length) dispatch(getExerciseList());
    dispatch(getExerciseAliases());
  }, [dispatch, exerciseList.length]);

  useEffect(() => {
    if (exercise) setAliasInput(aliases[exercise._id] || "");
  }, [exercise, aliases]);

  useEffect(() => {
    if (exercise && user?._id) dispatch(requestExerciseProgress(exercise, user));
  }, [dispatch, exercise, user]);

  const historyLoaded = exercise?.history?.[user?._id] !== undefined;
  const history = useMemo(() => {
    const list = exercise?.history?.[user?._id] || [];
    return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [exercise, user]);

  const prWeight = useMemo(() => {
    const weights = history
      .flatMap((h) => h.achieved?.weight || [])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    return weights.length ? Math.max(...weights) : null;
  }, [history]);

  if (!exercise) {
    return (
      <Container maxWidth="md" sx={{ pt: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/exercise-library")}>
          Library
        </Button>
        <Typography sx={{ mt: 2 }} color="text.secondary">
          {exerciseList.length ? "Exercise not found." : "Loading…"}
        </Typography>
      </Container>
    );
  }

  const { muscleGroups = {}, equipment = [], movementComplexity, measurementType, description } = exercise;

  return (
    <Container maxWidth="md" sx={{ pt: 2, pb: 10 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate("/exercise-library")} sx={{ mb: 1 }}>
        Library
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
        {exerciseDisplayName(exercise, aliases)}
      </Typography>
      {aliases[exercise._id] && (
        <Typography variant="body2" color="text.secondary">
          Catalog name: {exercise.exerciseTitle}
        </Typography>
      )}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1, mb: 2 }}>
        {movementComplexity && <Chip label={movementComplexity} size="small" />}
        {measurementType && <Chip label={measurementType} size="small" variant="outlined" />}
      </Stack>

      <Button
        variant="contained"
        startIcon={<AddCircleOutlined />}
        onClick={() => setAddOpen(true)}
        sx={{ mb: 2 }}
      >
        Add to workout
      </Button>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Your name for this exercise
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Rename it to whatever you call it — it shows for you everywhere, and search still finds the catalog name.
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder={exercise.exerciseTitle}
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            sx={{ minWidth: 240 }}
          />
          <Button
            variant="contained"
            disabled={aliasInput.trim() === (aliases[exercise._id] || "")}
            onClick={() =>
              dispatch(setExerciseAlias({ exerciseId: exercise._id, customName: aliasInput.trim() }))
            }
          >
            Save
          </Button>
          {aliases[exercise._id] && (
            <Button
              color="inherit"
              onClick={() => {
                setAliasInput("");
                dispatch(setExerciseAlias({ exerciseId: exercise._id, customName: "" }));
              }}
            >
              Reset
            </Button>
          )}
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Muscles worked
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Primary
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, mb: 1.5 }}>
              {(muscleGroups.primary || []).length ? (
                muscleGroups.primary.map((m) => <Chip key={m} label={m} size="small" color="primary" />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Secondary
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {(muscleGroups.secondary || []).length ? (
                muscleGroups.secondary.map((m) => (
                  <Chip key={m} label={m} size="small" color="primary" variant="outlined" />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              )}
            </Stack>
            {equipment.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">
                  Equipment
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {equipment.map((eq) => (
                    <Chip key={eq} label={eq} size="small" variant="outlined" />
                  ))}
                </Stack>
              </>
            )}
            {ATTRIBUTE_FIELDS.some((f) => (exercise[f.key] || []).length > 0) && (
              <>
                <Divider sx={{ my: 1.5 }} />
                {ATTRIBUTE_FIELDS.map((f) => {
                  const vals = exercise[f.key] || [];
                  if (!vals.length) return null;
                  return (
                    <Box key={f.key} sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {f.label}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 0.5 }}
                      >
                        {vals.map((v) => (
                          <Chip key={v} label={v} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
              </>
            )}
            {description && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              </>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Your history
            </Typography>
            {!historyLoaded && (
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            )}
            {historyLoaded && history.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                You haven't logged this exercise yet.
              </Typography>
            )}
            {historyLoaded && history.length > 0 && (
              <>
                <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
                  {prWeight != null && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {prWeight}
                        {unit}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Heaviest
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {history.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sessions
                    </Typography>
                  </Box>
                </Stack>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={1}>
                  {history.slice(0, 20).map((h, i) => (
                    <Box key={`${h.date}-${i}`}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {new Date(h.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatSets(h.achieved, measurementType, unit) || "—"}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <AddToWorkoutDialog open={addOpen} onClose={() => setAddOpen(false)} exercise={exercise} />
    </Container>
  );
}
