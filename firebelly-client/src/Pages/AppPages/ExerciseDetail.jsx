import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack, AddCircleOutlined, Star, StarBorder } from "@mui/icons-material";
import {
  getExerciseList,
  getExerciseAliases,
  getExerciseFavorites,
  requestExerciseProgress,
  setExerciseAlias,
  toggleExerciseFavorite,
} from "../../Redux/actions";
import { exerciseDisplayName } from "../../utils/exerciseName";
import AddToWorkoutDialog from "../../features/exercise/AddToWorkoutDialog";
import { findSubstitutes } from "../../utils/exerciseSubstitutes";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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
  const favorites = useSelector((s) => s.progress.exerciseFavorites) || [];
  const exercise = exerciseList.find((e) => e._id === id);
  const unit = user.workoutWeightUnit || "lbs";
  const [aliasInput, setAliasInput] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [diffEquipOnly, setDiffEquipOnly] = useState(false);

  useEffect(() => {
    if (!exerciseList.length) dispatch(getExerciseList());
    dispatch(getExerciseAliases());
    dispatch(getExerciseFavorites());
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

  const historyStats = useMemo(() => {
    if (!history.length) return null;
    const asc = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const anyWeight = asc.some((h) => (h.achieved?.weight || []).some((w) => Number(w) > 0));
    const anySeconds = asc.some((h) => (h.achieved?.seconds || []).some((s) => Number(s) > 0));
    const metric = anyWeight
      ? "weight"
      : exercise?.measurementType === "time" || anySeconds
      ? "seconds"
      : "reps";
    const suffix = metric === "weight" ? unit : metric === "seconds" ? "s" : "";
    const bestLabel = metric === "weight" ? "Heaviest" : metric === "seconds" ? "Longest" : "Most reps";
    const sessionBest = (h) => {
      const vals = (h.achieved?.[metric] || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      return vals.length ? Math.max(...vals) : 0;
    };
    const chartData = asc.map((h) => ({
      label: new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: sessionBest(h),
    }));
    let bestE1RM = 0;
    if (metric === "weight") {
      asc.forEach((h) => {
        const w = h.achieved?.weight || [];
        const r = h.achieved?.reps || [];
        w.forEach((wi, i) => {
          const W = Number(wi);
          const R = Number(r[i]);
          if (W > 0 && R > 0) bestE1RM = Math.max(bestE1RM, W * (1 + R / 30)); // Epley estimate
        });
      });
    }
    return {
      metric,
      suffix,
      bestLabel,
      chartData,
      best: chartData.reduce((mx, d) => Math.max(mx, d.value), 0),
      bestE1RM: Math.round(bestE1RM),
      sessions: asc.length,
      last: asc[asc.length - 1].date,
    };
  }, [history, exercise, unit]);

  const substitutes = useMemo(
    () => findSubstitutes(exercise, exerciseList, { limit: 8, differentEquipmentOnly: diffEquipOnly }),
    [exercise, exerciseList, diffEquipOnly]
  );

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
        {exercise.verified && (
          <Chip label="Verified" size="small" color="success" variant="outlined" />
        )}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Add to workout
        </Button>
        <IconButton
          aria-label="favorite"
          onClick={() => dispatch(toggleExerciseFavorite(exercise._id))}
        >
          {favorites.includes(exercise._id) ? <Star color="warning" /> : <StarBorder />}
        </IconButton>
      </Stack>

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
            {historyLoaded && history.length > 0 && historyStats && (
              <>
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {historyStats.best}
                      {historyStats.suffix}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {historyStats.bestLabel}
                    </Typography>
                  </Box>
                  {historyStats.bestE1RM > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {historyStats.bestE1RM}
                        {unit}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Est. 1RM
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {historyStats.sessions}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sessions
                    </Typography>
                  </Box>
                </Stack>

                {historyStats.chartData.length >= 2 && (
                  <Box sx={{ width: "100%", height: 180, mb: 1.5 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={historyStats.chartData}
                        margin={{ top: 5, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                        <YAxis tick={{ fontSize: 11 }} width={36} domain={["auto", "auto"]} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name={historyStats.bestLabel}
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}

                <Divider sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Last performed{" "}
                  {new Date(historyStats.last).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {history.slice(0, 12).map((h, i) => (
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

      <Paper sx={{ p: 2, mt: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Similar exercises
          </Typography>
          {(exercise.equipment || []).length > 0 && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={diffEquipOnly}
                  onChange={(e) => setDiffEquipOnly(e.target.checked)}
                />
              }
              label="Different equipment"
            />
          )}
        </Stack>
        {substitutes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No similar exercises found{diffEquipOnly ? " with different equipment" : ""}.
          </Typography>
        ) : (
          <List disablePadding>
            {substitutes.map((s) => (
              <ListItemButton key={s._id} onClick={() => navigate(`/exercise-library/${s._id}`)}>
                <ListItemText
                  primary={exerciseDisplayName(s, aliases)}
                  secondary={
                    (s.equipment || []).join(" · ") ||
                    (s.muscleGroups?.primary || []).join(" · ")
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      <AddToWorkoutDialog open={addOpen} onClose={() => setAddOpen(false)} exercise={exercise} />
    </Container>
  );
}
