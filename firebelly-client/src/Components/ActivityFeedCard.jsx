import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  Check as CheckIcon,
  EmojiEvents as TrophyIcon,
  Whatshot as FireIcon,
} from "@mui/icons-material";
import { apiFetch } from "../api/client";
import { formatVolume } from "../features/workout/utils/trainingLoad";
import { normalizeWeightUnit } from "../utils/weightUnits";

dayjs.extend(utc);

const REACT_TEXT = "🔥 Great work!";

// Recent completions across clients with one-tap acknowledgment — reacting posts a real
// workout comment, so it notifies the client and lands in the chat thread like any reply.
export default function ActivityFeedCard() {
  const user = useSelector((state) => state.user);
  const weightUnit = normalizeWeightUnit(user?.workoutWeightUnit);
  const [items, setItems] = useState(null);
  const [reacting, setReacting] = useState("");

  useEffect(() => {
    if (!user?.isTrainer) return undefined;
    let cancelled = false;
    apiFetch("/dashboard/activity", { method: "POST", body: {} })
      .then((res) => {
        if (!cancelled && res && !res.error) setItems(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.isTrainer]);

  if (!user?.isTrainer || !items || items.length === 0) return null;

  const handleReact = async (item) => {
    setReacting(String(item.workoutId));
    try {
      const res = await apiFetch("/dashboard/activity/react", {
        method: "POST",
        body: { workoutId: item.workoutId, text: REACT_TEXT },
      });
      if (!res?.error) {
        setItems((prev) =>
          prev.map((it) =>
            it.workoutId === item.workoutId
              ? { ...it, acknowledged: true, commentCount: (it.commentCount || 0) + 1 }
              : it
          )
        );
      }
    } finally {
      setReacting("");
    }
  };

  return (
    <Grid container size={12} sx={{ marginTop: "10px" }}>
      <Paper elevation={5} sx={{ width: "100%", padding: "12px", margin: "5px" }}>
        <Typography variant="h6">Recent Activity</Typography>
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {items.map((item) => (
            <ListItem key={item.workoutId} disableGutters sx={{ alignItems: "flex-start" }}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.clientName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.title} · {dayjs.utc(item.date).format("ddd, MMM D")}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    component="span"
                    sx={{ flexWrap: "wrap", mt: 0.5, alignItems: "center" }}
                  >
                    {item.volume > 0 && (
                      <Chip size="small" variant="outlined" label={formatVolume(item.volume, weightUnit)} />
                    )}
                    {item.hardSets > 0 && (
                      <Chip size="small" variant="outlined" label={`${item.hardSets} sets`} />
                    )}
                    {item.prExercises?.length > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        icon={<TrophyIcon />}
                        label={`PR: ${item.prExercises.slice(0, 2).join(", ")}${item.prExercises.length > 2 ? ` +${item.prExercises.length - 2}` : ""}`}
                      />
                    )}
                  </Stack>
                }
                secondaryTypographyProps={{ component: "div" }}
              />
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, mt: 0.5 }}>
                {item.acknowledged ? (
                  <Chip size="small" icon={<CheckIcon />} label="Replied" variant="outlined" color="success" />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<FireIcon />}
                    disabled={reacting === String(item.workoutId)}
                    onClick={() => handleReact(item)}
                  >
                    Nice!
                  </Button>
                )}
                <Button component={Link} to={`/workout/${item.workoutId}`} size="small">
                  Open
                </Button>
              </Stack>
            </ListItem>
          ))}
        </List>
        <Typography variant="caption" color="text.secondary">
          "Nice!" posts a comment on the workout — the client gets notified and it shows in
          your chat thread.
        </Typography>
      </Paper>
    </Grid>
  );
}
