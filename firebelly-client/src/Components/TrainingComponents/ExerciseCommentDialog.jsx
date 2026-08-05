import React, { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { serverURL } from "../../api/client";

const nameOf = (u) => (u?.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : "User");
const avatarFor = (u) =>
  u?.profilePicture ? `${serverURL}/user/profilePicture/${u.profilePicture}` : undefined;

// Per-exercise notes shared between client and trainer, plus the trainer's coaching cue.
// Notes are stored on the exercise entry (feedback.comments) and mirrored into the workout's
// comment thread by the caller; the cue lives in entry.coachNote and shows under the title.
export default function ExerciseCommentDialog({
  open,
  onClose,
  exerciseTitle,
  entry,
  isTrainer,
  onAddNote,
  onSaveCue,
}) {
  const [noteText, setNoteText] = useState("");
  const [cueText, setCueText] = useState("");

  useEffect(() => {
    if (open) setCueText(entry?.coachNote || "");
  }, [open, entry?.coachNote]);

  const notes = (entry?.feedback?.comments || []).filter((c) => !c.deletedAt);

  const addNote = () => {
    const t = noteText.trim();
    if (!t) return;
    onAddNote(t);
    setNoteText("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{exerciseTitle || "Exercise"} — notes</DialogTitle>
      <DialogContent dividers>
        {isTrainer && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <TextField
              label="Coaching cue"
              value={cueText}
              onChange={(e) => setCueText(e.target.value)}
              onBlur={() => onSaveCue(cueText.trim())}
              size="small"
              fullWidth
              multiline
              maxRows={3}
              placeholder="e.g. Elbows tucked, 3 seconds down"
            />
            <Typography variant="caption" color="text.secondary">
              Always visible under the exercise name — for the client, on every copy of this
              workout.
            </Typography>
          </Stack>
        )}
        {notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No notes yet. Notes are shared between you and{" "}
            {isTrainer ? "the client" : "your trainer"}.
          </Typography>
        ) : (
          <List dense disablePadding>
            {notes.map((c, i) => (
              <ListItem key={c._id || i} disableGutters alignItems="flex-start">
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar src={avatarFor(c.user)} sx={{ width: 28, height: 28 }}>
                    {nameOf(c.user)[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={c.text}
                  secondary={`${nameOf(c.user)} · ${dayjs(c.timestamp).format("MMM D, h:mm A")}`}
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Add a note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addNote();
              }
            }}
            multiline
            maxRows={3}
          />
          <Button variant="contained" onClick={addNote} disabled={!noteText.trim()}>
            Add
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
