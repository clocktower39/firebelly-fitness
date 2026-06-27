import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getExerciseList, getExerciseAliases } from "../../Redux/actions";
import { exerciseDisplayName, exerciseMatchesQuery } from "../../utils/exerciseName";

const uniqSorted = (arr) =>
  [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

export default function ExerciseLibrary() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const exerciseList = useSelector((s) => s.progress.exerciseList) || [];
  const aliases = useSelector((s) => s.progress.exerciseAliases) || {};

  const [search, setSearch] = useState("");
  const [primaryMuscles, setPrimaryMuscles] = useState([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [type, setType] = useState("");

  useEffect(() => {
    if (!exerciseList.length) dispatch(getExerciseList());
    dispatch(getExerciseAliases());
  }, [dispatch, exerciseList.length]);

  const primaryMuscleOptions = useMemo(
    () => uniqSorted(exerciseList.flatMap((e) => e.muscleGroups?.primary || [])),
    [exerciseList]
  );
  const secondaryMuscleOptions = useMemo(
    () => uniqSorted(exerciseList.flatMap((e) => e.muscleGroups?.secondary || [])),
    [exerciseList]
  );
  const equipmentOptions = useMemo(
    () => uniqSorted(exerciseList.flatMap((e) => e.equipment || [])),
    [exerciseList]
  );

  const filtered = useMemo(() => {
    return exerciseList
      .filter((e) => {
        if (!exerciseMatchesQuery(e, aliases, search)) return false;
        if (type && e.movementComplexity !== type) return false;
        if (primaryMuscles.length) {
          const pm = e.muscleGroups?.primary || [];
          if (!primaryMuscles.every((sel) => pm.includes(sel))) return false;
        }
        if (secondaryMuscles.length) {
          const sm = e.muscleGroups?.secondary || [];
          if (!secondaryMuscles.every((sel) => sm.includes(sel))) return false;
        }
        if (equipment.length) {
          const eq = e.equipment || [];
          if (!equipment.every((sel) => eq.includes(sel))) return false;
        }
        return true;
      })
      .sort((a, b) =>
        exerciseDisplayName(a, aliases).localeCompare(exerciseDisplayName(b, aliases))
      );
  }, [exerciseList, aliases, search, type, primaryMuscles, secondaryMuscles, equipment]);

  return (
    <Container maxWidth="lg" sx={{ pt: 3, pb: 10 }}>
      <Typography variant="h5" gutterBottom sx={{ color: "text.primary" }}>
        Exercise Library
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Browse every exercise. Tap one to see how it's performed, the muscles it works, and your own history.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid size={12}>
          <TextField
            fullWidth
            size="small"
            label="Search exercises"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Autocomplete
            multiple
            size="small"
            options={primaryMuscleOptions}
            value={primaryMuscles}
            onChange={(e, v) => setPrimaryMuscles(v)}
            renderInput={(p) => <TextField {...p} label="Primary muscle" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Autocomplete
            multiple
            size="small"
            options={secondaryMuscleOptions}
            value={secondaryMuscles}
            onChange={(e, v) => setSecondaryMuscles(v)}
            renderInput={(p) => <TextField {...p} label="Secondary muscle" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Autocomplete
            multiple
            size="small"
            options={equipmentOptions}
            value={equipment}
            onChange={(e, v) => setEquipment(v)}
            renderInput={(p) => <TextField {...p} label="Equipment" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="type-label">Type</InputLabel>
            <Select
              labelId="type-label"
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="compound">Compound</MenuItem>
              <MenuItem value="isolation">Isolation</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary">
        {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
      </Typography>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {filtered.map((ex) => (
          <Grid key={ex._id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                sx={{ height: "100%", alignItems: "flex-start" }}
                onClick={() => navigate(`/exercise-library/${ex._id}`)}
              >
                <CardContent sx={{ width: "100%" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {exerciseDisplayName(ex, aliases)}
                  </Typography>
                  {aliases[ex._id] && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {ex.exerciseTitle}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {(ex.muscleGroups?.primary || []).slice(0, 3).map((m) => (
                      <Chip key={m} label={m} size="small" color="primary" variant="outlined" />
                    ))}
                    {ex.movementComplexity && (
                      <Chip label={ex.movementComplexity} size="small" variant="outlined" />
                    )}
                  </Stack>
                  {(ex.equipment || []).length > 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 1 }}
                    >
                      {(ex.equipment || []).join(" · ")}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {!filtered.length && (
          <Grid size={12}>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {exerciseList.length ? "No exercises match your filters." : "Loading exercises…"}
            </Typography>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
