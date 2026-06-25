import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { scheduleApi } from "../api/scheduleApi";
import { serverURL } from "../../../api/client";

// Build the absolute, publicly-fetchable feed URL (Google fetches it server-side, so it
// must be absolute — not the dev "/api" proxy path).
const absoluteFeedUrl = (feedPath) => {
  const base = /^https?:\/\//i.test(serverURL)
    ? serverURL
    : `${window.location.origin}${serverURL === "/" ? "" : serverURL}`;
  return `${base}${feedPath}`;
};

export default function CalendarSyncDialog({ open, onClose }) {
  const [feedUrl, setFeedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = async (rotate = false) => {
    setLoading(true);
    setErr("");
    setCopied(false);
    try {
      const data = await scheduleApi.getCalendarFeed({ rotate });
      if (data?.error) {
        setErr(data.error);
        return;
      }
      setFeedUrl(absoluteFeedUrl(data.feedPath));
    } catch (e) {
      setErr(e.message || "Unable to load your calendar link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setConfirmReset(false);
      load(false);
    }
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const webcalUrl = feedUrl.replace(/^https?:\/\//i, "webcal://");
  const googleAddUrl = feedUrl
    ? `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(
        feedUrl
      )}`
    : "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sync to your calendar</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Subscribe to this private link in Google Calendar (or Apple / Outlook) and your
            booked sessions appear there and keep refreshing automatically. It&apos;s a
            private link — anyone who has it can see your session times, so don&apos;t share
            it.
          </Typography>

          {err && <Alert severity="error">{err}</Alert>}

          <TextField
            label="Your private calendar link"
            value={loading ? "Loading…" : feedUrl}
            fullWidth
            slotProps={{
              input: {
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={copy}
                      edge="end"
                      aria-label="copy link"
                      disabled={!feedUrl}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {copied && (
            <Typography variant="caption" color="success.main">
              Copied to clipboard.
            </Typography>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="contained"
              component="a"
              href={googleAddUrl || undefined}
              target="_blank"
              rel="noopener"
              disabled={!feedUrl}
            >
              Add to Google Calendar
            </Button>
            <Button
              variant="outlined"
              component="a"
              href={webcalUrl || undefined}
              disabled={!feedUrl}
            >
              Apple / Outlook
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Reliable way in Google Calendar: <strong>Settings → Add calendar → From URL</strong>,
            paste the link, and add. Google refreshes subscribed calendars periodically, so
            new changes can take a few hours to appear.
          </Typography>

          {!confirmReset ? (
            <Button
              color="error"
              size="small"
              onClick={() => setConfirmReset(true)}
              sx={{ alignSelf: "flex-start" }}
              disabled={!feedUrl}
            >
              Reset link
            </Button>
          ) : (
            <Alert
              severity="warning"
              action={
                <>
                  <Button color="inherit" size="small" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setConfirmReset(false);
                      load(true);
                    }}
                  >
                    Reset
                  </Button>
                </>
              }
            >
              Resetting makes a new link and invalidates the old one — you&apos;ll need to
              re-subscribe everywhere you used it.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
