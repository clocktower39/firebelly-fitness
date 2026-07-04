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
import { WORKOUT_TYPE_ORDER } from "../../features/workout/utils/workoutOrder";

function SortableTypeRow({ type, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: type,
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
          aria-label={`drag ${type}`}
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
        <Typography variant="body1">{type}</Typography>
      </Stack>
    </Paper>
  );
}

// Embeddable "Daily Overview Order" section (rendered inside Workout Preferences). Drag to set the order
// workout types appear on the daily overview when there is more than one workout that day. Empty setting =
// keep the existing order (the default). Saves automatically.
export default function WorkoutTypeOrderField() {
  const dispatch = useDispatch();
  const saved = useSelector((state) => state.user.workoutTypeOrder) || [];
  const isCustom = Array.isArray(saved) && saved.length > 0;

  // Always show all five types: a custom saved order (dropping unknowns, appending any missing in
  // canonical order), or the canonical default when not customized.
  const order = useMemo(() => {
    if (!isCustom) return [...WORKOUT_TYPE_ORDER];
    const base = saved.filter((type) => WORKOUT_TYPE_ORDER.includes(type));
    const missing = WORKOUT_TYPE_ORDER.filter((type) => !base.includes(type));
    return [...base, ...missing];
  }, [saved, isCustom]);

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
    dispatch(updateUserSettings({ workoutTypeOrder: arrayMove(order, oldIndex, newIndex) }));
  };

  const reset = () => dispatch(updateUserSettings({ workoutTypeOrder: [] }));

  return (
    <>
      <Grid size={12} sx={{ mt: 2 }}>
        <Divider />
      </Grid>
      <Grid size={12} sx={{ mt: 1 }}>
        <Typography variant="subtitle1" gutterBottom>
          Daily Overview Order
        </Typography>
        <Typography variant="body2" color="text.secondary">
          When you have more than one workout on a day, this sets the order the types appear on your daily
          overview. By default they stay in the order they were added — drag the handles to set a custom
          order (e.g., Cardio first for a runner). Saves automatically.
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
              {order.map((type, index) => (
                <SortableTypeRow key={type} type={type} index={index} />
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
              Custom order active
            </Typography>
          )}
        </Stack>
      </Grid>
    </>
  );
}
