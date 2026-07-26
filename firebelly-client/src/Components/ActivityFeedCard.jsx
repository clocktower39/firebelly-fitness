import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowDropDown as ArrowDropDownIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  EmojiEvents as TrophyIcon,
  Whatshot as FireIcon,
} from "@mui/icons-material";
import { apiFetch } from "../api/client";
import { conversationApi } from "../api/conversationApi";
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
  // Quick-comment menu: the trainer's saved replies double as pinned one-tap comments.
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuItem, setMenuItem] = useState(null);
  const [savedReplies, setSavedReplies] = useState(null); // null = not loaded yet
  const [newCommentOpen, setNewCommentOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");

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

  const handleReact = async (item, text = REACT_TEXT) => {
    setReacting(String(item.workoutId));
    try {
      const res = await apiFetch("/dashboard/activity/react", {
        method: "POST",
        body: { workoutId: item.workoutId, text },
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

  // Dismiss = clear from the feed without commenting; the client is never notified.
  const handleDismiss = async (workoutIds) => {
    const idSet = new Set(workoutIds.map(String));
    setItems((prev) => prev.filter((it) => !idSet.has(String(it.workoutId))));
    apiFetch("/dashboard/activity/dismiss", { method: "POST", body: { workoutIds } }).catch(() => {});
  };

  const openQuickMenu = (event, item) => {
    setMenuAnchor(event.currentTarget);
    setMenuItem(item);
    if (savedReplies === null) {
      conversationApi
        .getSavedReplies()
        .then((res) => setSavedReplies(Array.isArray(res) ? res : []))
        .catch(() => setSavedReplies([]));
    }
  };

  const closeQuickMenu = () => {
    setMenuAnchor(null);
    setMenuItem(null);
  };

  const sendQuickComment = (text) => {
    const target = menuItem;
    closeQuickMenu();
    if (target && text) handleReact(target, text);
  };

  const handleSaveNewComment = async () => {
    const text = newCommentText.trim();
    if (!text) return;
    setNewCommentOpen(false);
    setNewCommentText("");
    try {
      const created = await conversationApi.createSavedReply(text);
      if (created && !created.error) {
        setSavedReplies((prev) => [created, ...(prev || [])]);
      }
    } catch { /* saving the reply is best-effort; the comment still sends */ }
    if (menuItem) handleReact(menuItem, text);
    closeQuickMenu();
  };

  return (
    <Grid container size={12} sx={{ marginTop: "10px" }}>
      <Paper elevation={5} sx={{ width: "100%", padding: "12px", margin: "5px" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">Recent Activity</Typography>
          <Button size="small" onClick={() => handleDismiss(items.map((it) => it.workoutId))}>
            Clear all
          </Button>
        </Stack>
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
                  <ButtonGroup size="small" variant="outlined" color="warning">
                    <Button
                      startIcon={<FireIcon />}
                      disabled={reacting === String(item.workoutId)}
                      onClick={() => handleReact(item)}
                    >
                      Nice!
                    </Button>
                    <Button
                      sx={{ px: 0.25 }}
                      aria-label="more quick comments"
                      onClick={(event) => openQuickMenu(event, item)}
                    >
                      <ArrowDropDownIcon fontSize="small" />
                    </Button>
                  </ButtonGroup>
                )}
                <Button component={Link} to={`/workout/${item.workoutId}`} size="small">
                  Open
                </Button>
                <IconButton
                  size="small"
                  aria-label="dismiss from feed"
                  onClick={() => handleDismiss([item.workoutId])}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </ListItem>
          ))}
        </List>
        <Typography variant="caption" color="text.secondary">
          "Nice!" (or a quick comment from the arrow menu) posts on the workout — the client
          gets notified and it shows in your chat thread. The ✕ just clears a row from your
          feed; the client never knows.
        </Typography>

        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeQuickMenu}>
          <MenuItem onClick={() => sendQuickComment(REACT_TEXT)}>{REACT_TEXT}</MenuItem>
          {savedReplies === null && <MenuItem disabled>Loading…</MenuItem>}
          {(savedReplies || []).map((reply) => (
            <MenuItem key={reply._id} onClick={() => sendQuickComment(reply.text)}>
              {reply.text.length > 48 ? `${reply.text.slice(0, 48)}…` : reply.text}
            </MenuItem>
          ))}
          <Divider />
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setNewCommentOpen(true);
            }}
          >
            New quick comment…
          </MenuItem>
        </Menu>

        <Dialog open={newCommentOpen} onClose={() => setNewCommentOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>New quick comment</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Comment"
              placeholder="e.g. 💪 Strong session — proud of you!"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveNewComment();
              }}
              sx={{ mt: 1 }}
              helperText="Saved to your quick comments (also available as a saved reply in Messages), then sent."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewCommentOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveNewComment} disabled={!newCommentText.trim()}>
              Save & send
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Grid>
  );
}
