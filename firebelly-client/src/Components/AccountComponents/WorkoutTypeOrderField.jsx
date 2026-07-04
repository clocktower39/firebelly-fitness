import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../Redux/actions";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { Button, Divider, Grid, IconButton, Stack, Typography } from "@mui/material";
import { WORKOUT_TYPE_ORDER } from "../../features/workout/utils/workoutOrder";

// Embeddable "Daily Overview Order" section (rendered inside Workout Preferences). Lets a user set the
// order workout types appear on the daily overview when there is more than one workout that day. Empty
// setting = keep the existing order (the default). Saves automatically.
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

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    dispatch(updateUserSettings({ workoutTypeOrder: next }));
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
          overview. By default they stay in the order they were added — set a custom order to always show
          your favorite first (e.g., Cardio first for a runner). Saves automatically.
        </Typography>
      </Grid>
      <Grid size={12}>
        <Stack spacing={0.5} sx={{ maxWidth: 360 }}>
          {order.map((type, index) => (
            <Stack key={type} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 22 }}>
                {index + 1}.
              </Typography>
              <Typography variant="body1" sx={{ flexGrow: 1 }}>
                {type}
              </Typography>
              <IconButton
                size="small"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`move ${type} up`}
              >
                <ArrowUpward fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`move ${type} down`}
              >
                <ArrowDownward fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
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
