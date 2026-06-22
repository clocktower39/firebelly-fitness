import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
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
import { ContentCopy, Google, Refresh } from "@mui/icons-material";
import { scheduleApi } from "../../../api/scheduleApi";
import { serverURL } from "../../../Redux/actions";

/**
 * "Subscribe to calendar" — exposes the user's secret .ics feed URL so they can
 * subscribe in Google / Apple / Outlook and have their Firebelly schedule
 * auto-update. One-way (Firebelly -> their calendar). The URL is a secret;
 * regenerating revokes the old one.
 */
export default function CalendarSubscribeDialog({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [feedPath, setFeedPath] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const feedBase =
    serverURL && /^https?:\/\//.test(serverURL)
      ? serverURL.replace(/\/$/, "")
      : window.location.origin;
  const feedUrl = feedPath ? `${feedBase}${feedPath}` : "";

  const load = async (rotate = false) => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const data = await scheduleApi.getCalendarFeedToken(rotate);
      setFeedPath(data.feedPath || "");
    } catch (err) {
      setError("Could not load your calendar link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(false);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
    } catch (err) {
      setError("Copy failed — select the URL and copy manually.");
    }
  };

  const googleAddUrl = feedUrl
    ? `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}`
    : "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Subscribe to your schedule</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Add this private link to Google Calendar, Apple Calendar, or Outlook and your
            Firebelly schedule will keep itself up to date.
          </Typography>

          {loading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Preparing your link…</Typography>
            </Stack>
          ) : (
            <>
              <TextField
                label="Your calendar feed URL"
                value={feedUrl}
                fullWidth
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={copy} edge="end" aria-label="Copy URL">
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {copied && <Alert severity="success">Copied to clipboard.</Alert>}
              {error && <Alert severity="error">{error}</Alert>}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<Google />}
                  href={googleAddUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={!feedUrl}
                >
                  Add to Google Calendar
                </Button>
                <Button variant="outlined" startIcon={<ContentCopy />} onClick={copy} disabled={!feedUrl}>
                  Copy for Apple / Outlook
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Apple/Outlook: add a calendar “by URL” (or subscribe) and paste the link.
                Keep it private — anyone with the link can view your schedule.
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button color="inherit" startIcon={<Refresh />} onClick={() => load(true)} disabled={loading}>
          Regenerate link
        </Button>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
