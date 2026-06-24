import React from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

export default function DeleteEventDialog({ open, onClose, deleteEvent, onDelete, onDeleteSeries, dayjs, deleting = false }) {
  const isSeries = Boolean(deleteEvent?.recurrenceGroupId);

  return (
    <Dialog open={open} onClose={deleting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isSeries ? "Delete Recurring Event" : "Delete Event"}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography>
            {isSeries
              ? "This session is part of a recurring series. Choose what to delete."
              : "This will permanently delete the event. This cannot be undone."}
          </Typography>
          {deleteEvent && (
            <Typography variant="body2" color="text.secondary">
              {dayjs(deleteEvent.startDateTime).format("ddd, MMM D h:mm A")} -{" "}
              {dayjs(deleteEvent.endDateTime).format("h:mm A")}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      {isSeries ? (
        <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", gap: 1, p: 2 }}>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={() => onDelete(deleteEvent?._id)}
          >
            Just this session
          </Button>
          <Button
            color="error"
            variant="outlined"
            disabled={deleting}
            onClick={() => onDeleteSeries?.(deleteEvent, "future")}
          >
            This &amp; all future
          </Button>
          <Button
            color="error"
            variant="outlined"
            disabled={deleting}
            onClick={() => onDeleteSeries?.(deleteEvent, "all")}
          >
            Whole series
          </Button>
          <Button disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
        </DialogActions>
      ) : (
        <DialogActions>
          <Button onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => onDelete(deleteEvent?._id)}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
