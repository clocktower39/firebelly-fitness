import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../Redux/actions";
import { DragHandle as DragHandleIcon } from "@mui/icons-material";
import { Box, Button, Divider, Grid, Paper, Stack, Typography } from "@mui/material";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  DAILY_OVERVIEW_SECTIONS,
  DAILY_OVERVIEW_LABELS,
  resolveDailyOverviewOrder,
} from "../../utils/dailyOverviewSections";

function SortableSectionRow({ id, label, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <Paper ref={setNodeRef} style={style} variant="outlined" sx={{ p: 1, mb: 0.75 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box
          {...attributes}
          {...listeners}
          aria-label={`drag ${label}`}
          sx={{
            touchAction: "none",
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
          }}
        >
          <DragHandleIcon fontSize="small" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ width: 22 }}>
          {index + 1}.
        </Typography>
        <Typography variant="body1">{label}</Typography>
      </Stack>
    </Paper>
  );
}

// Embeddable "Daily Overview Layout" section (rendered inside Workout Preferences). Drag to set the order
// the cards appear on the daily overview screen. The date selector and weekly status strip stay pinned at
// the top and are not listed here. Empty setting = keep the default order. Saves automatically.
export default function DailyOverviewLayoutField() {
  const dispatch = useDispatch();
  const isTrainer = useSelector((state) => state.user.isTrainer);
  const saved = useSelector((state) => state.user.dailyOverviewOrder) || [];
  const isCustom = Array.isArray(saved) && saved.length > 0;

  // Only sections relevant to this account are shown/reordered (e.g. Daily Coverage is trainer-only).
  const visibleKeys = useMemo(
    () =>
      DAILY_OVERVIEW_SECTIONS.filter((section) => !section.trainerOnly || isTrainer).map(
        (section) => section.key
      ),
    [isTrainer]
  );

  // Resolve the full saved order, then drop any sections that don't apply to this account.
  const order = useMemo(
    () => resolveDailyOverviewOrder(saved).filter((key) => visibleKeys.includes(key)),
    [saved, visibleKeys]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    dispatch(updateUserSettings({ dailyOverviewOrder: arrayMove(order, oldIndex, newIndex) }));
  };

  const reset = () => dispatch(updateUserSettings({ dailyOverviewOrder: [] }));

  return (
    <>
      <Grid size={12} sx={{ mt: 2 }}>
        <Divider />
      </Grid>
      <Grid size={12} sx={{ mt: 1 }}>
        <Typography variant="subtitle1" gutterBottom>
          Daily Overview Layout
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Set the order the cards appear on your daily overview screen. The date selector and weekly
          status bar stay pinned at the top. Drag the handles to reorder (e.g., put your check-in or
          cardio summary first). Saves automatically.
        </Typography>
      </Grid>
      <Grid size={12}>
        <Box sx={{ maxWidth: 360 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((key, index) => (
                <SortableSectionRow
                  key={key}
                  id={key}
                  label={DAILY_OVERVIEW_LABELS[key] || key}
                  index={index}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Box>
      </Grid>
      <Grid size={12}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button size="small" variant="outlined" onClick={reset} disabled={!isCustom}>
            Reset to default
          </Button>
          {isCustom && (
            <Typography variant="caption" color="text.secondary">
              Custom layout active
            </Typography>
          )}
        </Stack>
      </Grid>
    </>
  );
}
