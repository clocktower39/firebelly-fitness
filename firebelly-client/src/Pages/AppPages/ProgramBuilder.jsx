import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { programApi } from "../../api/programApi";
import { workoutApi } from "../../api/workoutApi";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { upsertWorkout } from "../../Redux/actions";
import {
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
  ListItemButton,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Switch,
  IconButton,
  FormControlLabel,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  DeleteOutlined as DeleteOutlineIcon,
  InfoOutlined as InfoOutlinedIcon,
  FitnessCenter as FitnessCenterIcon,
  DragIndicator as DragIndicatorIcon,
} from "@mui/icons-material";
import { Alert } from "@mui/material";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

// Stable drag id per day slot — travels with the workout when filled so reordering is smooth;
// empty slots fall back to their position (fine — empty cards carry no state).
const dayDndId = (day, i) => (day?.workoutId ? `wo-${day.workoutId}` : `empty-${i}`);

// Short labels for a published program's listing tier.
const VISIBILITY_LABELS = { private: "Private", profile: "On your profile", public: "Public" };

// Sortable wrapper for a day card. Only the drag handle starts a drag, so the card's buttons stay
// clickable. Renders its children with the handle props to attach to the handle icon.
function SortableDay({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <Grid ref={setNodeRef} style={style} size={{ xs: 12, sm: 6, md: 4 }}>
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
    </Grid>
  );
}

const DEFAULT_WEEKS = 4;
const DEFAULT_DAYS = 5;
const AUTOSAVE_MS = 10000;

const buildWeeks = (weeksCount, daysPerWeek, existingWeeks = []) => {
  const weeks = [];
  for (let weekIndex = 0; weekIndex < weeksCount; weekIndex += 1) {
    const days = [];
    for (let dayIndex = 0; dayIndex < daysPerWeek; dayIndex += 1) {
      const existingDay = existingWeeks?.[weekIndex]?.[dayIndex];
      days.push({
        dayIndex: dayIndex + 1,
        workoutId: existingDay?.workoutId || null,
        notes: existingDay?.notes || "",
      });
    }
    weeks.push(days);
  }
  return weeks;
};

const BLOCK_TYPES = [
  { value: "BASE", label: "Base / GPP" },
  { value: "HYPERTROPHY", label: "Hypertrophy" },
  { value: "STRENGTH", label: "Strength" },
  { value: "POWER", label: "Power" },
  { value: "PEAK", label: "Peak" },
];
const BLOCK_COLOR = {
  BASE: "default",
  HYPERTROPHY: "primary",
  STRENGTH: "secondary",
  POWER: "warning",
  PEAK: "error",
  DELOAD: "info",
};
const blockLabel = (type) => BLOCK_TYPES.find((b) => b.value === type)?.label || type || "Block";
const PERIODIZATION_HELP =
  "Macrocycle = your whole plan. Mesocycle = a training block (3–6 weeks) with a focus and an optional deload. Microcycle = one week.";

// Per-week plan from the mesocycle blocks (mirrors the server's expandMesocycles).
const expandMesocycles = (mesocycles = []) => {
  const plan = [];
  let week = 0;
  (mesocycles || []).forEach((m, mi) => {
    const count = Math.max(1, Number(m?.weeks) || 0);
    for (let w = 0; w < count; w += 1) {
      week += 1;
      plan.push({
        week,
        mesocycleIndex: mi,
        type: m?.type || "HYPERTROPHY",
        name: m?.name || "",
        weekInBlock: w + 1,
        blockWeeks: count,
        isDeload: Boolean(m?.deloadLastWeek) && w === count - 1,
      });
    }
  });
  return plan;
};

// Compact, clickable week strip colored by block, with deload weeks marked.
const MacrocycleBar = ({ weekPlan, activeWeekIndex, onSelectWeek }) => (
  <Stack direction="row" spacing={0.5} sx={{ overflowX: "auto", pb: 1 }}>
    {weekPlan.map((wp, i) => (
      <Tooltip
        key={`wk-${i}`}
        title={`${blockLabel(wp.type)} — week ${wp.weekInBlock} of ${wp.blockWeeks}${
          wp.isDeload ? " · deload" : ""
        }`}
      >
        <Box
          onClick={() => onSelectWeek(i)}
          sx={{
            minWidth: 46,
            px: 0.5,
            py: 0.75,
            borderRadius: 1.5,
            cursor: "pointer",
            textAlign: "center",
            border: i === activeWeekIndex ? "2px solid" : "1px solid",
            borderColor: i === activeWeekIndex ? "primary.main" : "divider",
            bgcolor: wp.isDeload ? "action.hover" : "transparent",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
            W{wp.week}
          </Typography>
          <Chip
            size="small"
            label={wp.isDeload ? "Deload" : blockLabel(wp.type).slice(0, 4)}
            color={BLOCK_COLOR[wp.isDeload ? "DELOAD" : wp.type] || "default"}
            sx={{ height: 18, "& .MuiChip-label": { px: 0.75, fontSize: 10 } }}
          />
        </Box>
      </Tooltip>
    ))}
  </Stack>
);

export default function ProgramBuilder() {
  const user = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [program, setProgram] = useState(null);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [workoutCache, setWorkoutCache] = useState({});
  const [equipment, setEquipment] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTarget, setImportTarget] = useState({ weekIndex: null, dayIndex: null });
  const [importSearch, setImportSearch] = useState("");
  const [importSort, setImportSort] = useState("newest");
  const [importCategory, setImportCategory] = useState("");
  const [copyWeekDialogOpen, setCopyWeekDialogOpen] = useState(false);
  const [copyWeekTarget, setCopyWeekTarget] = useState("");
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);
  const [autoProgressOpen, setAutoProgressOpen] = useState(false);
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);
  const [progressForm, setProgressForm] = useState({
    baseWeek: 0,
    scheme: "linear", // "linear" | "rep-range" | "percent"
  });
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState({ weekIndex: null, dayIndex: null });
  const [resyncConfirmOpen, setResyncConfirmOpen] = useState(false);
  const [resyncTarget, setResyncTarget] = useState({ dayIndexes: null, label: "all days" });
  const [isResyncing, setIsResyncing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishVisibility, setPublishVisibility] = useState("private");
  // Small drag threshold so tapping the card's buttons never starts a drag.
  const daySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const saveTimerRef = useRef(null);
  const inFlightRef = useRef(false);

  const setSavedMessage = useCallback((message) => {
    setSaveMessage(message);
    setSaveError("");
  }, []);

  const setErrorMessage = useCallback((message) => {
    setSaveError(message);
    setSaveMessage("");
  }, []);

  const loadProgram = useCallback(
    async (id) => {
      setIsLoading(true);
      try {
        const data = await programApi.getProgram(id);
        if (data?.error) {
          throw new Error(data.error);
        }
        setProgram(data);
        setActiveWeekIndex(0);
        setDirty(false);
      } catch (err) {
        setErrorMessage(err.message || "Unable to load program.");
      } finally {
        setIsLoading(false);
      }
    },
    [setErrorMessage]
  );

  const createProgram = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await programApi.createProgram({
        title: "",
        description: "",
        weeksCount: DEFAULT_WEEKS,
        daysPerWeek: DEFAULT_DAYS,
      });
      if (data?.error) {
        throw new Error(data.error);
      }
      setProgram(data);
      setActiveWeekIndex(0);
      navigate(`/programs/${data._id}/edit`, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Unable to create program.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setErrorMessage]);

  const saveDraft = useCallback(async () => {
    if (!program?._id || inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSaving(true);
    try {
      const data = await programApi.updateProgram(program._id, {
        title: program.title,
        description: program.description,
        weeksCount: program.weeksCount,
        daysPerWeek: program.daysPerWeek,
        mesocycles: program.mesocycles || [],
        price: program.price ?? null,
      });
      if (data?.error) {
        throw new Error(data.error);
      }
      setProgram(data);
      setDirty(false);
      setSavedMessage("Draft saved.");
    } catch (err) {
      setErrorMessage(err.message || "Unable to save draft.");
    } finally {
      inFlightRef.current = false;
      setIsSaving(false);
    }
  }, [program, setErrorMessage, setSavedMessage]);

  // Persist the mesocycle blocks. The server derives weeksCount + rebuilds the week grid
  // from them, so we take its response as the source of truth and clamp the active week.
  const saveMesocycles = useCallback(
    async (nextBlocks) => {
      if (!program?._id) return;
      setProgram((prev) => ({ ...prev, mesocycles: nextBlocks }));
      try {
        const data = await programApi.updateProgram(program._id, {
          title: program.title,
          description: program.description,
          daysPerWeek: program.daysPerWeek,
          mesocycles: nextBlocks,
        });
        if (data?.error) throw new Error(data.error);
        setProgram(data);
        setDirty(false);
        setActiveWeekIndex((i) => Math.min(i, Math.max(0, (data.weeksCount || 1) - 1)));
      } catch (err) {
        setErrorMessage(err.message || "Unable to save training blocks.");
      }
    },
    [program, setErrorMessage]
  );

  const publishProgram = useCallback(
    async (visibility = "private") => {
      if (!program?._id || inFlightRef.current) return;
      inFlightRef.current = true;
      setIsSaving(true);
      try {
        const data = await programApi.publishProgram(program._id, { visibility });
        if (data?.errors?.length) {
          throw new Error(data.errors.join(" "));
        }
        if (data?.error) {
          throw new Error(data.error);
        }
        setProgram(data);
        setDirty(false);
        setPublishDialogOpen(false);
        setSavedMessage(
          visibility === "private"
            ? "Published — private to your clients."
            : "Published and listed on your profile."
        );
      } catch (err) {
        setErrorMessage(err.message || "Unable to publish program.");
      } finally {
        inFlightRef.current = false;
        setIsSaving(false);
      }
    },
    [program, setErrorMessage, setSavedMessage]
  );

  // Change a published program's listing (private ⇄ profile) without re-publishing.
  const changeVisibility = useCallback(
    async (visibility) => {
      if (!program?._id) return;
      setIsSaving(true);
      try {
        const data = await programApi.updateProgram(program._id, { visibility });
        if (data?.error) throw new Error(data.error);
        setProgram(data);
        setSavedMessage(
          visibility === "private"
            ? "Unlisted — private to your clients."
            : visibility === "profile"
            ? "Listed on your profile."
            : "Listed publicly."
        );
      } catch (err) {
        setErrorMessage(err.message || "Unable to update visibility.");
      } finally {
        setIsSaving(false);
      }
    },
    [program, setErrorMessage, setSavedMessage]
  );

  const updateDaySlot = useCallback(
    async (weekIndex, dayIndex, workoutId) => {
      if (!program?._id) return;
      try {
        const data = await programApi.updateProgramDay({
          programId: program._id,
          week: weekIndex + 1,
          day: dayIndex + 1,
          workoutId,
        });
        if (data?.error) {
          throw new Error(data.error);
        }
        setProgram((prev) => ({
          ...prev,
          weeks: data.weeks,
          status: data.status,
          publishedAt: data.publishedAt,
        }));
      } catch (err) {
        setErrorMessage(err.message || "Unable to update day.");
      }
    },
    [program, setErrorMessage]
  );

  const createWorkoutForDay = useCallback(
    async (weekIndex, dayIndex) => {
      if (!program?._id || !user?._id) return;
      // Flush any pending structure change (e.g. days-per-week) so the server has the new
      // day slot — otherwise update_program_day rejects it as out of range and the day is lost.
      if (dirty) await saveDraft();
      try {
        const data = await workoutApi.createTraining({
          userId: user._id,
          title: `${program.title || "Program"} • Week ${weekIndex + 1} Day ${dayIndex + 1}`,
          category: [],
          training: [[]],
          isTemplate: true,
        });
        if (data?.error) {
          throw new Error(data.error);
        }
        const newWorkout = data.training;
        setWorkoutCache((prev) => ({ ...prev, [newWorkout._id]: newWorkout }));
        await updateDaySlot(weekIndex, dayIndex, newWorkout._id);
        navigate(
          `/workout/${newWorkout._id}?source=program&return=${encodeURIComponent(
            location.pathname
          )}`
        );
      } catch (err) {
        setErrorMessage(err.message || "Unable to create workout.");
      }
    },
    [dirty, location.pathname, navigate, program, saveDraft, updateDaySlot, user]
  );

  const handleEditDay = useCallback(
    (weekIndex, dayIndex, workoutId) => {
      if (workoutId) {
        // Pass the programId so the editor can cascade an exercise swap across the program.
        const programParam = program?._id ? `&programId=${program._id}` : "";
        navigate(
          `/workout/${workoutId}?source=program${programParam}&return=${encodeURIComponent(
            location.pathname
          )}`
        );
        return;
      }
      createWorkoutForDay(weekIndex, dayIndex);
    },
    [createWorkoutForDay, location.pathname, navigate, program]
  );

  const loadTemplates = useCallback(async () => {
    try {
      const data = await workoutApi.getWorkoutTemplates();
      if (data?.error) {
        throw new Error(data.error);
      }
      setTemplates(Array.isArray(data.workouts) ? data.workouts : []);
    } catch (err) {
      setErrorMessage(err.message || "Unable to load templates.");
    }
  }, [setErrorMessage]);

  const handleOpenImportDialog = useCallback(
    (weekIndex, dayIndex) => {
      setImportTarget({ weekIndex, dayIndex });
      if (templates.length === 0) {
        loadTemplates();
      }
      setImportDialogOpen(true);
    },
    [loadTemplates, templates.length]
  );

  const handleImportTemplate = useCallback(
    async (templateId) => {
      const { weekIndex, dayIndex } = importTarget;
      if (weekIndex === null || dayIndex === null) return;
      setImportDialogOpen(false);
      if (dirty) await saveDraft();
      await updateDaySlot(weekIndex, dayIndex, templateId);
      setWorkoutCache((prev) => {
        const template = templates.find((t) => t._id === templateId);
        if (template) {
          return { ...prev, [templateId]: template };
        }
        return prev;
      });
    },
    [dirty, importTarget, saveDraft, templates, updateDaySlot]
  );

  const importCategories = useMemo(() => {
    const cats = new Set();
    templates.forEach((t) => {
      if (Array.isArray(t.category)) {
        t.category.forEach((c) => cats.add(c));
      }
    });
    return Array.from(cats).sort();
  }, [templates]);

  const filteredImportTemplates = useMemo(() => {
    let result = [...templates];

    if (importSearch.trim()) {
      const query = importSearch.toLowerCase();
      result = result.filter((t) =>
        (t.title || "").toLowerCase().includes(query) ||
        (t.category || []).some((c) => c.toLowerCase().includes(query))
      );
    }

    if (importCategory) {
      result = result.filter((t) =>
        Array.isArray(t.category) && t.category.includes(importCategory)
      );
    }

    switch (importSort) {
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
      default:
        break;
    }

    return result;
  }, [templates, importSearch, importCategory, importSort]);

  const handleCopyWeekToNext = useCallback(async () => {
    if (!program?._id || copyWeekTarget === "") return;
    const programWeeks = program.weeks || [];
    const programWeeksCount = Number(program.weeksCount) || DEFAULT_WEEKS;
    const sourceWeek = programWeeks[activeWeekIndex];
    const targetWeekIndex = Number(copyWeekTarget);
    
    if (!sourceWeek || targetWeekIndex < 0 || targetWeekIndex >= programWeeksCount) return;

    setIsCopyingWeek(true);
    try {
      for (let dayIndex = 0; dayIndex < sourceWeek.length; dayIndex++) {
        const day = sourceWeek[dayIndex];
        if (day.workoutId) {
          const sourceWorkout = workoutCache[day.workoutId];
          const newTitle = sourceWorkout?.title
            ? sourceWorkout.title.replace(/Week \d+/i, `Week ${targetWeekIndex + 1}`)
            : `Week ${targetWeekIndex + 1} Day ${dayIndex + 1}`;

          const data = await workoutApi.copyWorkoutById({
            _id: day.workoutId,
            newTitle,
            option: "exact",
          });
          if (data?.error) {
            throw new Error(data.error);
          }
          const newWorkoutId = data._id;
          setWorkoutCache((prev) => ({ ...prev, [newWorkoutId]: data }));
          await updateDaySlot(targetWeekIndex, dayIndex, newWorkoutId);
        }
      }
      setCopyWeekDialogOpen(false);
      setCopyWeekTarget("");
      setSavedMessage(`Week ${activeWeekIndex + 1} copied to Week ${targetWeekIndex + 1}`);
    } catch (err) {
      setErrorMessage(err.message || "Unable to copy week.");
    } finally {
      setIsCopyingWeek(false);
    }
  }, [
    activeWeekIndex,
    copyWeekTarget,
    program,
    setErrorMessage,
    setSavedMessage,
    updateDaySlot,
    workoutCache,
  ]);

  // Generate each week after the base week as a progressed copy of the base week —
  // bumping goal weights/reps cumulatively (week N = base + (N - base) × increment).
  const handleAutoProgress = useCallback(async () => {
    if (!program?._id) return;
    const programWeeks = program.weeks || [];
    const weeksTotal = Number(program.weeksCount) || DEFAULT_WEEKS;
    const baseWeekIndex = Number(progressForm.baseWeek) || 0;
    const baseWeek = programWeeks[baseWeekIndex];
    if (!baseWeek) return;

    if (baseWeekIndex >= weeksTotal - 1) {
      setErrorMessage("Pick a base week with later weeks to fill.");
      return;
    }
    const scheme = progressForm.scheme || "linear";
    const plan = expandMesocycles(program.mesocycles || []);

    setIsAutoProgressing(true);
    try {
      // Progression steps accumulate only on normal weeks; a deload week reuses the current
      // level with a lighter cut (and doesn't advance the trajectory).
      let step = 0;
      for (let target = baseWeekIndex + 1; target < weeksTotal; target++) {
        const isDeload = Boolean(plan[target]?.isDeload);
        if (!isDeload) step += 1;
        for (let dayIndex = 0; dayIndex < baseWeek.length; dayIndex++) {
          const day = baseWeek[dayIndex];
          if (!day.workoutId) continue;
          const src = workoutCache[day.workoutId];
          const newTitle = src?.title
            ? src.title.replace(/Week \d+/i, `Week ${target + 1}`)
            : `Week ${target + 1} Day ${dayIndex + 1}`;
          const data = await workoutApi.copyWorkoutById({
            _id: day.workoutId,
            newTitle,
            option: "copyGoalOnly",
            scheme,
            step,
            deload: isDeload,
          });
          if (data?.error) throw new Error(data.error);
          setWorkoutCache((prev) => ({ ...prev, [data._id]: data }));
          await updateDaySlot(target, dayIndex, data._id);
        }
      }
      setAutoProgressOpen(false);
      const deloadCount = plan
        .slice(baseWeekIndex + 1, weeksTotal)
        .filter((p) => p?.isDeload).length;
      setSavedMessage(
        `Progressed weeks ${baseWeekIndex + 2}–${weeksTotal} from week ${baseWeekIndex + 1}` +
          (deloadCount ? ` · ${deloadCount} deload${deloadCount === 1 ? "" : "s"} applied.` : ".")
      );
    } catch (err) {
      setErrorMessage(err.message || "Unable to generate progression.");
    } finally {
      setIsAutoProgressing(false);
    }
  }, [program, progressForm, workoutCache, updateDaySlot, setErrorMessage, setSavedMessage]);

  // Push Week 1's exercise structure (added/removed/reordered exercises) to every later week,
  // re-progressing loads server-side with the generator's own engine. Rewrites later weeks in
  // place and refreshes the builder cache from the returned docs.
  const runResync = useCallback(async () => {
    if (!program?._id) return;
    setIsResyncing(true);
    try {
      const data = await programApi.resyncFromWeekOne(program._id, {
        dayIndexes: resyncTarget?.dayIndexes || null,
      });
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data.workouts) && data.workouts.length) {
        setWorkoutCache((prev) => {
          const next = { ...prev };
          data.workouts.forEach((w) => {
            if (w?._id) next[w._id] = w;
          });
          return next;
        });
        data.workouts.forEach((w) => w?._id && dispatch(upsertWorkout(w)));
      }
      if (data.weeks) setProgram((prev) => ({ ...prev, weeks: data.weeks }));
      setResyncConfirmOpen(false);
      const changed = (data.updated || 0) + (data.created || 0);
      setSavedMessage(
        changed > 0
          ? `Updated ${data.weeksSynced} later week${data.weeksSynced === 1 ? "" : "s"} from Week 1.`
          : "Later weeks already match Week 1 — nothing to update."
      );
    } catch (err) {
      setErrorMessage(err.message || "Unable to update later weeks.");
    } finally {
      setIsResyncing(false);
    }
  }, [program, resyncTarget, dispatch, setErrorMessage, setSavedMessage]);

  useEffect(() => {
    if (programId) {
      loadProgram(programId);
    } else {
      createProgram();
    }
  }, [createProgram, loadProgram, programId]);

  useEffect(() => {
    if (!dirty || !program?._id) return;
    clearInterval(saveTimerRef.current);
    saveTimerRef.current = setInterval(() => {
      saveDraft();
    }, AUTOSAVE_MS);
    return () => clearInterval(saveTimerRef.current);
  }, [dirty, program, saveDraft]);

  // Equipment a client needs to run this program, auto-detected from every exercise. Re-fetched
  // whenever the set of assigned workouts changes (add / import / generate / copy / blocks).
  const equipmentSig = useMemo(
    () => (program?.weeks || []).flat().map((d) => d.workoutId).filter(Boolean).join(","),
    [program?.weeks]
  );
  useEffect(() => {
    if (!program?._id) return undefined;
    let cancelled = false;
    programApi.getProgramEquipment(program._id).then((data) => {
      if (!cancelled && data && !data.error) setEquipment(data.equipment || []);
    });
    return () => {
      cancelled = true;
    };
  }, [program?._id, equipmentSig]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const fetchingWorkoutIds = useRef(new Set());
  useEffect(() => {
    if (!program?.weeks) return;
    const assignedIds = new Set();
    program.weeks.forEach((week) =>
      week.forEach((day) => {
        if (day.workoutId) assignedIds.add(day.workoutId);
      })
    );
    // Only fetch ids we don't already have and aren't already fetching — prevents the re-run cascade
    // from firing duplicate requests (a filled generated program has one per day across every week).
    const missingIds = Array.from(assignedIds).filter(
      (id) => !workoutCache[id] && !fetchingWorkoutIds.current.has(id)
    );
    if (missingIds.length === 0) return;

    missingIds.forEach(async (id) => {
      fetchingWorkoutIds.current.add(id);
      try {
        const data = await workoutApi.getTraining({ _id: id });
        if (data?._id) {
          setWorkoutCache((prev) => ({ ...prev, [data._id]: data }));
          // Also put it in Redux state.workouts so the Workout editor can open it (the editor only
          // reads from there). Without this, server-created templates (e.g. auto-generated programs)
          // show "Workout does not exist" when a day is opened.
          dispatch(upsertWorkout(data));
        }
      } catch (err) {
        setErrorMessage("Unable to load workout details.");
      } finally {
        fetchingWorkoutIds.current.delete(id);
      }
    });
  }, [program, setErrorMessage, workoutCache, dispatch]);

  if (isLoading || !program) {
    return (
      <Box sx={{ px: 2, py: 3 }}>
        <Typography variant="body1">Loading Program Builder...</Typography>
      </Box>
    );
  }

  const weeksCount = Number(program.weeksCount) || DEFAULT_WEEKS;
  const daysPerWeek = Number(program.daysPerWeek) || DEFAULT_DAYS;
  const weeks = program.weeks?.length ? program.weeks : buildWeeks(weeksCount, daysPerWeek);
  const safeWeekIndex = Math.min(activeWeekIndex, Math.max(0, weeksCount - 1));
  const activeWeek = weeks[safeWeekIndex] || [];
  const blocks = program.mesocycles || [];
  const weekPlan = expandMesocycles(blocks);
  const activeWeekPlan = weekPlan[safeWeekIndex] || null;

  // Drag-reorder days. The move applies to EVERY week so each day stays a consistent progression
  // column; optimistic locally, then persisted (server re-stamps dayIndex and is the source of truth).
  const handleDayDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !program?._id) return;
    const ids = activeWeek.map(dayDndId);
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0 || from === to) return;
    setProgram((prev) => ({
      ...prev,
      weeks: (prev.weeks || []).map((week) =>
        arrayMove(week, from, to).map((slot, i) => ({ ...slot, dayIndex: i }))
      ),
    }));
    setSavedMessage("Days reordered.");
    programApi
      .reorderDays(program._id, { from, to })
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        if (data?.weeks) setProgram(data);
      })
      .catch((err) => setErrorMessage(err.message || "Couldn't save the new day order."));
  };

  // Block editor handlers. Text/number edits update locally then commit on blur; discrete
  // edits (focus, deload, add, remove) persist immediately so the grid rebuilds at once.
  const updateBlockLocal = (i, patch) =>
    setProgram((prev) => ({
      ...prev,
      mesocycles: (prev.mesocycles || []).map((b, bi) => (bi === i ? { ...b, ...patch } : b)),
    }));
  const commitBlocks = () => saveMesocycles(program.mesocycles || []);
  const setBlockField = (i, patch) =>
    saveMesocycles((program.mesocycles || []).map((b, bi) => (bi === i ? { ...b, ...patch } : b)));
  const addBlock = () =>
    saveMesocycles([
      ...(program.mesocycles || []),
      {
        name: "",
        type: "HYPERTROPHY",
        // First block inherits the current week count so converting a flat program to blocks
        // doesn't trim already-built weeks.
        weeks: (program.mesocycles || []).length === 0 ? Math.min(12, weeksCount) : 4,
        deloadLastWeek: false,
      },
    ]);
  const removeBlock = (i) =>
    saveMesocycles((program.mesocycles || []).filter((_, bi) => bi !== i));

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4">Program Builder</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Stack spacing={1} sx={{ flex: 1 }}>
            <TextField
              label="Program Title"
              value={program.title}
              onChange={(event) => {
                setProgram((prev) => ({ ...prev, title: event.target.value }));
                setDirty(true);
              }}
              fullWidth
            />
            <TextField
              label="Description (optional)"
              value={program.description}
              onChange={(event) => {
                setProgram((prev) => ({ ...prev, description: event.target.value }));
                setDirty(true);
              }}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Price (USD)"
              type="number"
              value={program.price ?? ""}
              onChange={(event) => {
                const v = event.target.value;
                setProgram((prev) => ({ ...prev, price: v === "" ? null : Math.max(0, Number(v)) }));
                setDirty(true);
              }}
              onBlur={() => saveDraft()}
              helperText="What clients pay on your products page once published. 0 = free."
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              sx={{ maxWidth: 260 }}
            />
          </Stack>
          <Stack spacing={1} alignItems={{ xs: "flex-start", md: "flex-end" }}>
            <Chip
              label={
                program.status === "PUBLISHED"
                  ? `Published · ${VISIBILITY_LABELS[program.visibility] || "Private"}`
                  : "Draft"
              }
              color={program.status === "PUBLISHED" ? "success" : "default"}
              variant={program.status === "PUBLISHED" ? "filled" : "outlined"}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" onClick={saveDraft} disabled={isSaving}>
                Save Draft
              </Button>
              {program.status === "PUBLISHED" ? (
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="program-visibility-label">Visibility</InputLabel>
                  <Select
                    labelId="program-visibility-label"
                    label="Visibility"
                    value={program.visibility || "private"}
                    onChange={(e) => changeVisibility(e.target.value)}
                    disabled={isSaving}
                  >
                    <MenuItem value="private">Private — only your clients</MenuItem>
                    <MenuItem value="profile">Your profile</MenuItem>
                    <MenuItem value="public" disabled>
                      Public marketplace (coming soon)
                    </MenuItem>
                  </Select>
                </FormControl>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => {
                    setPublishVisibility(program.visibility || "private");
                    setPublishDialogOpen(true);
                  }}
                  disabled={isSaving}
                >
                  Publish
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>

        {program.generatedFromBlock && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ Auto-generated draft — review every day before publishing or assigning. Nothing here is final.
            </Typography>
            {program.generationAssumptions?.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary">
                  Assumptions the generator made (confirm each):
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {program.generationAssumptions.map((a, i) => (
                    <Typography component="li" key={i} variant="body2">{a}</Typography>
                  ))}
                </Box>
              </>
            )}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6">Periodization</Typography>
                  <Tooltip title={PERIODIZATION_HELP}>
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </Tooltip>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {weeksCount} week{weeksCount === 1 ? "" : "s"}
                    {blocks.length ? ` · ${blocks.length} block${blocks.length === 1 ? "" : "s"}` : ""}
                  </Typography>
                  <TextField
                    label="Days / week"
                    type="number"
                    size="small"
                    sx={{ width: 120 }}
                    slotProps={{ htmlInput: { min: 1, max: 7 } }}
                    value={daysPerWeek}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                      const next = Math.max(1, Math.min(7, Number(event.target.value)));
                      setProgram((prev) => ({
                        ...prev,
                        daysPerWeek: next,
                        weeks: buildWeeks(prev.weeksCount, next, prev.weeks),
                      }));
                      setDirty(true);
                    }}
                    onBlur={() => saveDraft()}
                  />
                </Stack>
              </Stack>

              {blocks.length > 0 && (
                <MacrocycleBar
                  weekPlan={weekPlan}
                  activeWeekIndex={safeWeekIndex}
                  onSelectWeek={setActiveWeekIndex}
                />
              )}

              {blocks.length > 0 ? (
                <Stack spacing={1.5}>
                  {blocks.map((block, i) => (
                    <Stack
                      key={`block-${i}`}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ sm: "center" }}
                    >
                      <TextField
                        label={`Block ${i + 1} name`}
                        size="small"
                        placeholder="e.g. Base"
                        value={block.name || ""}
                        onChange={(e) => updateBlockLocal(i, { name: e.target.value })}
                        onBlur={commitBlocks}
                        sx={{ flex: 1 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel id={`block-type-${i}`}>Focus</InputLabel>
                        <Select
                          labelId={`block-type-${i}`}
                          label="Focus"
                          value={block.type || "HYPERTROPHY"}
                          onChange={(e) => setBlockField(i, { type: e.target.value })}
                        >
                          {BLOCK_TYPES.map((t) => (
                            <MenuItem key={t.value} value={t.value}>
                              {t.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="Weeks"
                        type="number"
                        size="small"
                        sx={{ width: 90 }}
                        slotProps={{ htmlInput: { min: 1, max: 12 } }}
                        value={block.weeks ?? 4}
                        onFocus={(event) => event.target.select()}
                        onChange={(e) =>
                          updateBlockLocal(i, {
                            weeks: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                          })
                        }
                        onBlur={commitBlocks}
                      />
                      <Tooltip title="Final week of this block is a deload (lighter week)">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={Boolean(block.deloadLastWeek)}
                              onChange={(e) => setBlockField(i, { deloadLastWeek: e.target.checked })}
                            />
                          }
                          label="Deload"
                        />
                      </Tooltip>
                      <IconButton aria-label="Remove block" onClick={() => removeBlock(i)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    size="small"
                    onClick={addBlock}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Add block
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Structure this program into <strong>mesocycles</strong> — blocks of weeks with a
                    focus and an optional deload. The total week count then comes from your blocks.
                    Or keep a simple flat week count.
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
                    <Button
                      startIcon={<AddIcon />}
                      variant="contained"
                      size="small"
                      onClick={addBlock}
                    >
                      Add training block
                    </Button>
                    <TextField
                      label="Weeks (flat)"
                      type="number"
                      size="small"
                      sx={{ width: 130 }}
                      slotProps={{ htmlInput: { min: 1, max: 52 } }}
                      value={weeksCount}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => {
                        const next = Math.max(1, Math.min(52, Number(event.target.value)));
                        setProgram((prev) => ({
                          ...prev,
                          weeksCount: next,
                          weeks: buildWeeks(next, prev.daysPerWeek, prev.weeks),
                        }));
                        setActiveWeekIndex(0);
                        setDirty(true);
                      }}
                      onBlur={() => saveDraft()}
                    />
                  </Stack>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {equipment.length > 0 && (
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <FitnessCenterIcon fontSize="small" color="action" />
                <Typography variant="h6">Equipment needed</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({equipment.length} item{equipment.length === 1 ? "" : "s"})
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {equipment.map((eq) => (
                  <Chip key={eq} label={eq} size="small" />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                Auto-detected from every exercise in this program — what a client needs to run it.
              </Typography>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6">Week {safeWeekIndex + 1}</Typography>
                  {activeWeekPlan && (
                    <>
                      <Chip
                        size="small"
                        label={blockLabel(activeWeekPlan.type)}
                        color={BLOCK_COLOR[activeWeekPlan.type] || "default"}
                      />
                      <Typography variant="body2" color="text.secondary">
                        block week {activeWeekPlan.weekInBlock}/{activeWeekPlan.blockWeeks}
                      </Typography>
                      {activeWeekPlan.isDeload && (
                        <Chip size="small" label="Deload" color="info" variant="outlined" />
                      )}
                    </>
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setProgressForm((f) => ({ ...f, baseWeek: safeWeekIndex }));
                      setAutoProgressOpen(true);
                    }}
                    disabled={!weeks[safeWeekIndex]?.some((day) => day.workoutId)}
                  >
                    Generate progression
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setCopyWeekDialogOpen(true)}
                    disabled={!weeks[safeWeekIndex]?.some((day) => day.workoutId)}
                  >
                    Copy Week
                  </Button>
                  <Tooltip title="Rebuild every later week from Week 1's exercises (loads re-progressed). Overwrites manual changes to later weeks.">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setResyncTarget({ dayIndexes: null, label: "all days" });
                          setResyncConfirmOpen(true);
                        }}
                        disabled={
                          isResyncing ||
                          weeksCount < 2 ||
                          program.status === "PUBLISHED" ||
                          !weeks[0]?.some((day) => day.workoutId)
                        }
                      >
                        Update later weeks
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
              <Tabs
                value={safeWeekIndex}
                onChange={(event, value) => setActiveWeekIndex(value)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {Array.from({ length: weeksCount }, (_, index) => (
                  <Tab
                    key={`week-${index}`}
                    label={`Week ${index + 1}${weekPlan[index]?.isDeload ? " · DL" : ""}`}
                  />
                ))}
              </Tabs>
              {activeWeek.length > 1 && (
                <Typography variant="caption" color="text.secondary">
                  Tip: drag the ⠿ handle on a day to reorder — the new order applies to every week.
                </Typography>
              )}
              <DndContext
                sensors={daySensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToWindowEdges]}
                onDragEnd={handleDayDragEnd}
              >
                <SortableContext items={activeWeek.map(dayDndId)} strategy={rectSortingStrategy}>
                  <Grid container spacing={2}>
                    {activeWeek.map((day, dayIndex) => {
                      const workout = day.workoutId ? workoutCache[day.workoutId] : null;
                      const exerciseCount =
                        workout?.training?.reduce((c, circuit) => c + circuit.length, 0) || 0;
                      const muscleGroups = workout?.category || [];
                      const canReorder = activeWeek.length > 1;
                      return (
                        <SortableDay
                          key={dayDndId(day, dayIndex)}
                          id={dayDndId(day, dayIndex)}
                          disabled={!canReorder}
                        >
                          {({ dragHandleProps }) => (
                      <Card
                        variant="outlined"
                        sx={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          borderColor: day.workoutId ? "primary.light" : "divider",
                        }}
                      >
                        <CardContent sx={{ flex: 1 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="overline" color="text.secondary">
                              Day {dayIndex + 1}
                            </Typography>
                            {canReorder && (
                              <Tooltip title="Drag to reorder — applies to every week">
                                <IconButton
                                  size="small"
                                  {...dragHandleProps}
                                  sx={{ cursor: "grab", touchAction: "none", ml: 1 }}
                                >
                                  <DragIndicatorIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                          {day.workoutId ? (
                            <>
                              <Typography variant="subtitle2" noWrap title={workout?.title || ""}>
                                {workout?.title || "Workout"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                              </Typography>
                              {muscleGroups.length > 0 && (
                                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                                  {muscleGroups.slice(0, 6).map((mg) => (
                                    <Chip key={mg} size="small" variant="outlined" label={mg} />
                                  ))}
                                </Stack>
                              )}
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Empty — add or import a workout
                            </Typography>
                          )}
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2 }}>
                          <Button
                            size="small"
                            variant={day.workoutId ? "outlined" : "contained"}
                            onClick={() => handleEditDay(safeWeekIndex, dayIndex, day.workoutId)}
                          >
                            {day.workoutId ? "Edit" : "Add workout"}
                          </Button>
                          {!day.workoutId && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleOpenImportDialog(safeWeekIndex, dayIndex)}
                            >
                              Import
                            </Button>
                          )}
                          {safeWeekIndex === 0 &&
                            day.workoutId &&
                            weeksCount > 1 &&
                            program.status !== "PUBLISHED" && (
                              <Tooltip title="Apply this day's exercises to the same day in every later week (loads re-progressed).">
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={isResyncing}
                                  onClick={() => {
                                    setResyncTarget({ dayIndexes: [dayIndex], label: `Day ${dayIndex + 1}` });
                                    setResyncConfirmOpen(true);
                                  }}
                                >
                                  Apply to later weeks
                                </Button>
                              </Tooltip>
                            )}
                          {day.workoutId && (
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={() => {
                                setClearTarget({ weekIndex: safeWeekIndex, dayIndex });
                                setClearConfirmOpen(true);
                              }}
                            >
                              Clear
                            </Button>
                          )}
                        </CardActions>
                      </Card>
                          )}
                        </SortableDay>
                      );
                    })}
                  </Grid>
                </SortableContext>
              </DndContext>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Snackbar
        open={Boolean(saveMessage)}
        autoHideDuration={3000}
        onClose={() => setSaveMessage("")}
      >
        <Alert severity="success" variant="filled">
          {saveMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(saveError)}
        autoHideDuration={6000}
        onClose={() => setSaveError("")}
      >
        <Alert severity="error" variant="filled">
          {saveError}
        </Alert>
      </Snackbar>

      <Dialog
        open={importDialogOpen}
        onClose={() => {
          setImportDialogOpen(false);
          setImportSearch("");
          setImportCategory("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import Workout Template</DialogTitle>
        <DialogContent>
          {templates.length === 0 ? (
            <Typography color="text.secondary">No workout templates available.</Typography>
          ) : (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ pt: 1 }}>
                <TextField
                  size="small"
                  placeholder="Search..."
                  value={importSearch}
                  onChange={(e) => setImportSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={importCategory}
                    label="Category"
                    onChange={(e) => setImportCategory(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {importCategories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {cat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Sort</InputLabel>
                  <Select
                    value={importSort}
                    label="Sort"
                    onChange={(e) => setImportSort(e.target.value)}
                  >
                    <MenuItem value="newest">Newest</MenuItem>
                    <MenuItem value="oldest">Oldest</MenuItem>
                    <MenuItem value="title-asc">Title (A-Z)</MenuItem>
                    <MenuItem value="title-desc">Title (Z-A)</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              {filteredImportTemplates.length === 0 ? (
                <Typography color="text.secondary">No templates match your filters.</Typography>
              ) : (
                <List sx={{ maxHeight: 300, overflow: "auto" }}>
                  {filteredImportTemplates.map((template) => (
                    <ListItemButton
                      key={template._id}
                      onClick={() => handleImportTemplate(template._id)}
                    >
                      <ListItemText
                        primary={template.title || "Untitled Workout"}
                        secondary={
                          <>
                            {`${template.training?.reduce((count, circuit) => count + circuit.length, 0) || 0} exercises`}
                            {template.category?.length > 0 && ` • ${template.category.join(", ")}`}
                          </>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setImportDialogOpen(false);
              setImportSearch("");
              setImportCategory("");
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={copyWeekDialogOpen}
        onClose={() => {
          setCopyWeekDialogOpen(false);
          setCopyWeekTarget("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Copy Week {activeWeekIndex + 1}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will copy all workouts from Week {activeWeekIndex + 1} to the selected week, creating new workout templates so modifications won't affect the originals.
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="copy-week-target-label">Copy to</InputLabel>
            <Select
              labelId="copy-week-target-label"
              value={copyWeekTarget}
              label="Copy to"
              onChange={(e) => setCopyWeekTarget(e.target.value)}
            >
              {Array.from({ length: weeksCount }, (_, index) => (
                <MenuItem
                  key={index}
                  value={index}
                  disabled={index === activeWeekIndex}
                >
                  Week {index + 1}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCopyWeekDialogOpen(false);
              setCopyWeekTarget("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCopyWeekToNext}
            disabled={copyWeekTarget === "" || isCopyingWeek}
          >
            {isCopyingWeek ? "Copying..." : "Copy Week"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={autoProgressOpen}
        onClose={() => setAutoProgressOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Generate progression</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Fills every week after the base week with a progressed copy of it. Each exercise
            advances by its <strong>own</strong> rule — barbell +5 (isolation +2.5), dumbbell
            +2.5→5, machine +10, cable +2.5, bodyweight +1 rep, holds +5s. Overwrites those
            weeks&apos; workouts.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="ap-base-label">Base week</InputLabel>
              <Select
                labelId="ap-base-label"
                label="Base week"
                value={progressForm.baseWeek}
                onChange={(e) =>
                  setProgressForm((f) => ({ ...f, baseWeek: Number(e.target.value) }))
                }
              >
                {Array.from({ length: weeksCount }, (_, index) => (
                  <MenuItem key={index} value={index}>
                    Week {index + 1}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="ap-scheme-label">Scheme</InputLabel>
              <Select
                labelId="ap-scheme-label"
                label="Scheme"
                value={progressForm.scheme}
                onChange={(e) => setProgressForm((f) => ({ ...f, scheme: e.target.value }))}
              >
                <MenuItem value="linear">Linear — fixed reps, add weight</MenuItem>
                <MenuItem value="rep-range">Rep range — build reps, then weight</MenuItem>
                <MenuItem value="percent">% of 1RM — raise intensity</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              Cumulative from the base week, rounded to loadable weights. Weeks flagged as a
              deload in your blocks automatically get a lighter (~10%) recovery week.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoProgressOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAutoProgress} disabled={isAutoProgressing}>
            {isAutoProgressing ? "Generating…" : "Generate"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clearConfirmOpen}
        onClose={() => {
          setClearConfirmOpen(false);
          setClearTarget({ weekIndex: null, dayIndex: null });
        }}
        maxWidth="xs"
      >
        <DialogTitle>Clear Workout</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this workout from Day {clearTarget.dayIndex !== null ? clearTarget.dayIndex + 1 : ""}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setClearConfirmOpen(false);
              setClearTarget({ weekIndex: null, dayIndex: null });
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              updateDaySlot(clearTarget.weekIndex, clearTarget.dayIndex, null);
              setClearConfirmOpen(false);
              setClearTarget({ weekIndex: null, dayIndex: null });
            }}
          >
            Clear
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={resyncConfirmOpen}
        onClose={() => !isResyncing && setResyncConfirmOpen(false)}
        maxWidth="xs"
      >
        <DialogTitle>Update later weeks from Week 1</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Rebuild{" "}
            {resyncTarget?.dayIndexes ? resyncTarget.label : "every day"} in weeks 2–{weeksCount}{" "}
            from Week 1's exercises. Later weeks are re-progressed to match Week 1's structure —
            added exercises appear, removed ones drop, and loads ramp per week.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Any manual changes you made to later weeks will be replaced. Week 1 is not changed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResyncConfirmOpen(false)} disabled={isResyncing}>
            Cancel
          </Button>
          <Button variant="contained" onClick={runResync} disabled={isResyncing}>
            {isResyncing ? "Updating…" : "Update later weeks"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={publishDialogOpen}
        onClose={() => !isSaving && setPublishDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Publish program</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Publishing finalizes the program so you can assign it to clients. Choose who can find it:
          </Typography>
          <RadioGroup
            value={publishVisibility}
            onChange={(e) => setPublishVisibility(e.target.value)}
          >
            <FormControlLabel
              value="private"
              control={<Radio />}
              sx={{ alignItems: "flex-start", mb: 0.5 }}
              label={
                <Box sx={{ pt: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Private
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Only your clients get it (via assignment). Not listed anywhere.
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="profile"
              control={<Radio />}
              sx={{ alignItems: "flex-start", mb: 0.5 }}
              label={
                <Box sx={{ pt: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Your profile
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Listed on your trainer page so people can find and buy it.
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="public"
              disabled
              control={<Radio />}
              sx={{ alignItems: "flex-start" }}
              label={
                <Box sx={{ pt: 0.75 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Public marketplace
                    </Typography>
                    <Chip size="small" label="Coming soon" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Discoverable by anyone browsing the marketplace.
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            You can change this anytime after publishing.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialogOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => publishProgram(publishVisibility)}
            disabled={isSaving}
          >
            {isSaving ? "Publishing…" : "Publish"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
