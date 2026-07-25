import React, { useEffect, useMemo, useState } from "react";
import { workoutApi } from "../../api/workoutApi";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
} from "@mui/icons-material";
import { requestClients } from "../../Redux/actions";

const formatTemplateSummary = (workout) => {
  const totalExercises =
    workout?.training?.reduce((count, circuit) => count + circuit.length, 0) || 0;
  const exerciseLabel = totalExercises === 1 ? "exercise" : "exercises";
  return `${totalExercises} ${exerciseLabel}`;
};

const clientName = (client) =>
  `${client?.firstName || ""} ${client?.lastName || ""}`.trim() || "Unnamed client";

export default function WorkoutTemplates() {
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [ownerFilter, setOwnerFilter] = useState("all");

  // Program week/day docs — loaded only when asked for (there can be hundreds).
  const [programDays, setProgramDays] = useState(null); // null = not loaded yet
  const [loadingProgramDays, setLoadingProgramDays] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // workout being sent to a client
  const [assignClientId, setAssignClientId] = useState("");
  const [assignDate, setAssignDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [assigning, setAssigning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState(null); // { severity, message }

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await workoutApi.getWorkoutTemplates({ includeShared: true });
      if (data?.error) throw new Error(data.error);
      setTemplates(Array.isArray(data.workouts) ? data.workouts : []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load template workouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isTrainer) return;
    loadTemplates();
    dispatch(requestClients());
     
  }, [user?.isTrainer]);

  const loadProgramDays = async () => {
    setLoadingProgramDays(true);
    try {
      const data = await workoutApi.getWorkoutTemplates({ includeProgramDays: true });
      if (data?.error) throw new Error(data.error);
      setProgramDays((data.workouts || []).filter((w) => w.programDay));
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Unable to load program workouts." });
    } finally {
      setLoadingProgramDays(false);
    }
  };

  const acceptedClients = useMemo(
    () =>
      (Array.isArray(clients) ? clients : [])
        .filter((relationship) => relationship?.accepted && relationship?.client?._id)
        .map((relationship) => relationship.client)
        .sort((a, b) => clientName(a).localeCompare(clientName(b))),
    [clients]
  );

  const allMuscleGroups = useMemo(() => {
    const groups = new Set();
    [...templates, ...(programDays || [])].forEach((t) => {
      if (Array.isArray(t.category)) {
        t.category.forEach((c) => groups.add(c));
      }
    });
    return Array.from(groups).sort();
  }, [templates, programDays]);

  const hasSharedTemplates = useMemo(() => templates.some((t) => t.isShared), [templates]);

  const matchesFilters = (t) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matches =
        (t.title || "").toLowerCase().includes(query) ||
        (t.category || []).some((c) => c.toLowerCase().includes(query)) ||
        (t.programTitle || "").toLowerCase().includes(query) ||
        (t.user?.firstName || "").toLowerCase().includes(query) ||
        (t.user?.lastName || "").toLowerCase().includes(query);
      if (!matches) return false;
    }
    if (muscleFilter) {
      if (!Array.isArray(t.category) || !t.category.includes(muscleFilter)) return false;
    }
    return true;
  };

  const filteredAndSortedTemplates = useMemo(() => {
    let result = templates.filter(matchesFilters);

    if (ownerFilter === "mine") {
      result = result.filter((t) => t.isOwn);
    } else if (ownerFilter === "shared") {
      result = result.filter((t) => t.isShared);
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.updatedAt || b.createdAt).valueOf() - new Date(a.updatedAt || a.createdAt).valueOf());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.updatedAt || a.createdAt).valueOf() - new Date(b.updatedAt || b.createdAt).valueOf());
        break;
      case "title-asc":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "title-desc":
        result.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
      case "exercises":
        result.sort((a, b) => {
          const aCount = a.training?.reduce((sum, c) => sum + c.length, 0) || 0;
          const bCount = b.training?.reduce((sum, c) => sum + c.length, 0) || 0;
          return bCount - aCount;
        });
        break;
      default:
        break;
    }

    return result;
     
  }, [templates, searchQuery, muscleFilter, sortBy, ownerFilter]);

  const filteredProgramDays = useMemo(() => {
    if (!programDays) return [];
    return programDays
      .filter(matchesFilters)
      .sort(
        (a, b) =>
          (a.programTitle || "").localeCompare(b.programTitle || "") ||
          (a.title || "").localeCompare(b.title || "")
      );
     
  }, [programDays, searchQuery, muscleFilter]);

  const openWorkout = (workout) =>
    navigate(`/workout/${workout._id}?source=template&return=/workout-templates`);

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      const data = await workoutApi.createTraining({
        title: createTitle.trim(),
        category: [],
        training: [[]],
        isTemplate: true,
      });
      if (data?.error) throw new Error(data.error);
      setCreateOpen(false);
      setCreateTitle("");
      openWorkout(data.training);
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Unable to create the template." });
    } finally {
      setCreating(false);
    }
  };

  const openAssignDialog = (workout) => {
    setAssignTarget(workout);
    setAssignClientId("");
    setAssignDate(dayjs().add(1, "day").format("YYYY-MM-DD"));
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignClientId || !assignDate) return;
    setAssigning(true);
    try {
      const data = await workoutApi.copyWorkoutById({
        _id: assignTarget._id,
        newAccount: assignClientId,
        newDate: assignDate,
        option: "copyGoalOnly",
        asWorkout: true,
      });
      if (data?.error) throw new Error(data.error);
      const client = acceptedClients.find((c) => String(c._id) === String(assignClientId));
      setNotice({
        severity: "success",
        message: `Added "${assignTarget.title || "workout"}" to ${clientName(client)} on ${dayjs(assignDate).format("MMM D")}.`,
      });
      setAssignTarget(null);
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Unable to add the workout." });
    } finally {
      setAssigning(false);
    }
  };

  const handleDuplicate = async (workout, { fromProgramDay = false } = {}) => {
    try {
      const data = await workoutApi.copyWorkoutById({
        _id: workout._id,
        newTitle: fromProgramDay ? `${workout.title || "Workout"} (template)` : `${workout.title || "Workout"} (copy)`,
        option: "copyGoalOnly",
        asTemplate: true,
      });
      if (data?.error) throw new Error(data.error);
      setNotice({ severity: "success", message: "Template created." });
      loadTemplates();
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Unable to duplicate." });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const data = await workoutApi.deleteWorkoutById(deleteTarget._id);
      if (data?.error) throw new Error(data.error);
      setNotice({ severity: "success", message: `Deleted "${deleteTarget.title || "template"}".` });
      setDeleteTarget(null);
      loadTemplates();
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Unable to delete the template." });
    }
  };

  const renderActions = (workout, { programDay = false } = {}) => (
    <>
      <Button size="small" variant="outlined" onClick={() => openWorkout(workout)}>
        Open
      </Button>
      {workout.isOwn && (
        <Button size="small" variant="contained" onClick={() => openAssignDialog(workout)}>
          Use for client
        </Button>
      )}
      {workout.isOwn && !programDay && (
        <>
          <Button size="small" onClick={() => handleDuplicate(workout)}>
            Duplicate
          </Button>
          <Button size="small" color="error" onClick={() => setDeleteTarget(workout)}>
            Delete
          </Button>
        </>
      )}
      {workout.isOwn && programDay && (
        <Button size="small" onClick={() => handleDuplicate(workout, { fromProgramDay: true })}>
          Save as template
        </Button>
      )}
    </>
  );

  const renderChips = (workout) => (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ alignItems: "center", flexWrap: "wrap", minWidth: 0 }}
    >
      <Typography variant="h6">{workout.title || "Untitled Workout"}</Typography>
      {workout.programDay ? (
        <Chip label={`Program: ${workout.programTitle}`} size="small" color="default" variant="outlined" />
      ) : (
        <Chip label="Template" size="small" variant="outlined" />
      )}
      {workout.isShared && (
        <Chip
          label={`From ${workout.user?.firstName} ${workout.user?.lastName}`}
          size="small"
          color="info"
          variant="outlined"
        />
      )}
    </Stack>
  );

  if (!user?.isTrainer) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <Typography variant="h5">Template Workouts</Typography>
          <Typography color="text.secondary">
            Template workouts are only available to trainers.
          </Typography>
          <Button variant="outlined" onClick={() => navigate("/calendar")}>
            Back to calendar
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: "center" }}
        >
          <Typography variant="h4" sx={{ flex: 1 }}>
            Template Workouts
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Template
          </Button>
          <Button variant="outlined" onClick={() => navigate("/calendar")}>
            Workout Calendar
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Reusable workouts that aren't attached to any client or date. Build one once, then use
          "Use for client" to drop it onto anyone's calendar.
        </Typography>

        {!loading && !error && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
            <TextField
              size="small"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ minWidth: 200 }}
            />
            {hasSharedTemplates && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Owner</InputLabel>
                <Select
                  value={ownerFilter}
                  label="Owner"
                  onChange={(e) => setOwnerFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="mine">My Templates</MenuItem>
                  <MenuItem value="shared">Shared with Me</MenuItem>
                </Select>
              </FormControl>
            )}
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Muscle Group</InputLabel>
              <Select
                value={muscleFilter}
                label="Muscle Group"
                onChange={(e) => setMuscleFilter(e.target.value)}
              >
                <MenuItem value="">All Muscle Groups</MenuItem>
                {allMuscleGroups.map((group) => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="newest">Newest</MenuItem>
                <MenuItem value="oldest">Oldest</MenuItem>
                <MenuItem value="title-asc">Title (A-Z)</MenuItem>
                <MenuItem value="title-desc">Title (Z-A)</MenuItem>
                <MenuItem value="exercises">Most Exercises</MenuItem>
              </Select>
            </FormControl>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="grid" aria-label="grid view">
                <GridViewIcon />
              </ToggleButton>
              <ToggleButton value="list" aria-label="list view">
                <ListViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}

        {loading && <Typography>Loading templates...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        {!loading && !error && templates.length === 0 && (
          <Typography color="text.secondary">
            No templates yet — create your first with "New Template". A "New Client Assessment"
            you reuse for every first session is a great place to start.
          </Typography>
        )}
        {!loading && !error && templates.length > 0 && filteredAndSortedTemplates.length === 0 && (
          <Typography color="text.secondary">No templates match your filters.</Typography>
        )}

        {viewMode === "grid" ? (
          <Grid container spacing={2}>
            {filteredAndSortedTemplates.map((workout) => (
              <Grid key={workout._id} size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1} sx={{ minWidth: 0 }}>
                      {renderChips(workout)}
                      <Typography variant="body2" color="text.secondary">
                        {formatTemplateSummary(workout)}
                      </Typography>
                      {workout.category?.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          useFlexGap
                          sx={{ flexWrap: "wrap", minWidth: 0, overflow: "visible" }}
                        >
                          {workout.category.map((group) => (
                            <Chip
                              key={group}
                              label={group}
                              size="small"
                              variant="outlined"
                              sx={{ maxWidth: "100%" }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2, flexWrap: "wrap", gap: 0.5 }}>
                    {renderActions(workout)}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper variant="outlined">
            <List disablePadding>
              {filteredAndSortedTemplates.map((workout, index) => (
                <ListItem
                  key={workout._id}
                  divider={index < filteredAndSortedTemplates.length - 1}
                  sx={{ flexWrap: "wrap", gap: 1 }}
                >
                  <ListItemText
                    primary={renderChips(workout)}
                    secondary={
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{ mt: 0.5, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}
                      >
                        <Typography variant="body2" component="span">
                          {formatTemplateSummary(workout)}
                        </Typography>
                        {workout.category?.map((group) => (
                          <Chip
                            key={group}
                            label={group}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, maxWidth: "100%" }}
                          />
                        ))}
                      </Stack>
                    }
                  />
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {renderActions(workout)}
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* Program week/day workouts — loaded only on request. */}
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          {programDays === null ? (
            <Button variant="outlined" onClick={loadProgramDays} disabled={loadingProgramDays}>
              {loadingProgramDays ? "Loading program workouts…" : "Browse program workouts"}
            </Button>
          ) : (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="h6">Program workouts</Typography>
                <Chip size="small" variant="outlined" label={filteredProgramDays.length} />
                <Button size="small" onClick={() => setProgramDays(null)}>
                  Hide
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Week/day workouts that belong to your programs. Open one, send it to a client, or
                save a copy as a standalone template.
              </Typography>
              {filteredProgramDays.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No program workouts match your filters.
                </Typography>
              ) : (
                <Paper variant="outlined" sx={{ width: "100%" }}>
                  <List disablePadding>
                    {filteredProgramDays.map((workout, index) => (
                      <ListItem
                        key={workout._id}
                        divider={index < filteredProgramDays.length - 1}
                        sx={{ flexWrap: "wrap", gap: 1 }}
                      >
                        <ListItemButton onClick={() => openWorkout(workout)} sx={{ flexGrow: 1, minWidth: 0 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                                <Typography>{workout.title || "Untitled Workout"}</Typography>
                                <Chip
                                  label={workout.programTitle}
                                  size="small"
                                  variant="outlined"
                                />
                              </Stack>
                            }
                            secondary={formatTemplateSummary(workout)}
                          />
                        </ListItemButton>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                          {renderActions(workout, { programDay: true })}
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </>
          )}
        </Stack>
      </Stack>

      {/* New template */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Template name"
            placeholder="e.g. New Client Assessment"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createTitle.trim() || creating}>
            Create & open
          </Button>
        </DialogActions>
      </Dialog>

      {/* Use for client */}
      <Dialog open={Boolean(assignTarget)} onClose={() => setAssignTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Use "{assignTarget?.title || "workout"}" for a client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                value={assignClientId}
                label="Client"
                onChange={(e) => setAssignClientId(e.target.value)}
              >
                {acceptedClients.map((client) => (
                  <MenuItem key={client._id} value={String(client._id)}>
                    {clientName(client)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="date"
              label="Workout date"
              value={assignDate}
              onChange={(e) => setAssignDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Typography variant="caption" color="text.secondary">
              A copy lands on their calendar as a normal workout — the template stays untouched.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!assignClientId || !assignDate || assigning}
          >
            Add to calendar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete "{deleteTarget?.title || "template"}"?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Workouts already copied to client calendars are not affected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={notice?.severity || "info"}
          variant="filled"
          onClose={() => setNotice(null)}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
