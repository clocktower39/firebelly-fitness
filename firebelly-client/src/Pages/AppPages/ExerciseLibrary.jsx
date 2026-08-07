import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Star, StarBorder } from "@mui/icons-material";
import {
  getExerciseList,
  getExerciseAliases,
  getExerciseFavorites,
  toggleExerciseFavorite,
} from "../../Redux/actions";
import { exerciseDisplayName, exerciseMatchesQuery } from "../../utils/exerciseName";
import { resolveDemoMedia } from "../../features/exercise/familyDemo";

const uniqSorted = (arr) =>
  [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

// Small demo thumbnail for a browse card: YouTube links use YouTube's thumbnail image,
// video files show a muted first frame, anything else renders as an image/GIF directly.
const mediaThumbFor = (ex) => {
  const url = (ex?.mediaUrl || "").trim();
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: "img", src: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "video", src: url };
  return { type: "img", src: url };
};

export default function ExerciseLibrary() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const exerciseList = useSelector((s) => s.progress.exerciseList) || [];
  const aliases = useSelector((s) => s.progress.exerciseAliases) || {};
  const favorites = useSelector((s) => s.progress.exerciseFavorites) || [];

  const [search, setSearch] = useState("");
  const [primaryMuscles, setPrimaryMuscles] = useState([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [type, setType] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [openFamilies, setOpenFamilies] = useState({}); // familyKey -> expanded

  useEffect(() => {
    if (!exerciseList.length) dispatch(getExerciseList());
    dispatch(getExerciseAliases());
    dispatch(getExerciseFavorites());
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
        if (favoritesOnly && !favorites.includes(e._id)) return false;
        if (verifiedOnly && !e.verified) return false;
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
  }, [exerciseList, aliases, favorites, search, type, primaryMuscles, secondaryMuscles, equipment, verifiedOnly, favoritesOnly]);

  // Family grouping: consecutive-independent groups keyed by familyKey; a family with a single
  // visible member (or no family) renders as a plain card. Order follows the first member.
  const groupedFiltered = useMemo(() => {
    const byKey = new Map();
    const order = [];
    filtered.forEach((ex) => {
      const fam = (ex.familyKey || "").trim();
      const key = fam || `solo:${ex._id}`;
      if (!byKey.has(key)) {
        byKey.set(key, { family: fam, members: [] });
        order.push(key);
      }
      byKey.get(key).members.push(ex);
    });
    return order.map((k) => byKey.get(k));
  }, [filtered]);

  const renderExerciseCard = (ex) => {
    const resolved = resolveDemoMedia(ex, exerciseList);
    const thumb = mediaThumbFor({ mediaUrl: resolved.mediaUrl });
    return (
      <Grid key={ex._id} size={{ xs: 12, sm: 6, md: 4 }}>
        <Card sx={{ height: "100%", position: "relative" }}>
          <IconButton
            size="small"
            aria-label="favorite"
            onClick={(e) => {
              e.stopPropagation();
              dispatch(toggleExerciseFavorite(ex._id));
            }}
            sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}
          >
            {favorites.includes(ex._id) ? (
              <Star fontSize="small" color="warning" />
            ) : (
              <StarBorder fontSize="small" />
            )}
          </IconButton>
          <CardActionArea
            sx={{ height: "100%", alignItems: "flex-start" }}
            onClick={() => navigate(`/exercise-library/${ex._id}`)}
          >
            {thumb &&
              (thumb.type === "video" ? (
                <Box
                  component="video"
                  src={thumb.src}
                  muted
                  playsInline
                  preload="metadata"
                  sx={{ width: "100%", height: 130, objectFit: "cover", display: "block" }}
                />
              ) : (
                <Box
                  component="img"
                  src={thumb.src}
                  alt=""
                  loading="lazy"
                  sx={{ width: "100%", height: 130, objectFit: "cover", display: "block" }}
                />
              ))}
            <CardContent sx={{ width: "100%" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, pr: 3 }}>
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
                {ex.verified && (
                  <Chip label="Verified" size="small" color="success" variant="outlined" />
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
    );
  };

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

      <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />
          }
          label="Favorites only"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
            />
          }
          label="Verified only"
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
      </Typography>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {groupedFiltered.map((group) => {
          if (!group.family || group.members.length < 2) {
            return group.members.map(renderExerciseCard);
          }
          const open = Boolean(openFamilies[group.family]);
          const famResolved = resolveDemoMedia(
            { familyKey: group.family },
            exerciseList
          );
          const famThumb = mediaThumbFor({ mediaUrl: famResolved.mediaUrl });
          const famMuscles = [
            ...new Set(group.members.flatMap((m) => m.muscleGroups?.primary || [])),
          ].slice(0, 3);
          return (
            <React.Fragment key={`fam-${group.family}`}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ height: "100%", position: "relative", borderColor: "primary.main" }} variant="outlined">
                  <CardActionArea
                    sx={{ height: "100%", alignItems: "flex-start" }}
                    onClick={() =>
                      setOpenFamilies((prev) => ({ ...prev, [group.family]: !open }))
                    }
                  >
                    {famThumb &&
                      (famThumb.type === "video" ? (
                        <Box component="video" src={famThumb.src} muted playsInline preload="metadata" sx={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                      ) : (
                        <Box component="img" src={famThumb.src} alt="" loading="lazy" sx={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                      ))}
                    <CardContent sx={{ width: "100%" }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {group.family}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        <Chip
                          size="small"
                          color="primary"
                          label={`${group.members.length} variations ${open ? "▴" : "▾"}`}
                        />
                        {famMuscles.map((m) => (
                          <Chip key={m} label={m} size="small" color="primary" variant="outlined" />
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        {open ? "Tap to collapse" : "Tap to see all variations"}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
              {open && group.members.map(renderExerciseCard)}
            </React.Fragment>
          );
        })}
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
