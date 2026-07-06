import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import {
  feedbackApi,
  FEEDBACK_TYPES,
  typeLabel,
  statusMeta,
} from "../../api/feedbackApi";

// User-facing feedback page: submit a feature request/change, and see your past submissions +
// their status. Models on the account form pages (Container/Paper/Grid/TextField).
export default function Feedback() {
  const [type, setType] = useState("feature");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [implementation, setImplementation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState([]);

  const loadMine = useCallback(async () => {
    const data = await feedbackApi.listMine();
    if (Array.isArray(data)) setMine(data);
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const submit = async () => {
    if (!title.trim()) {
      setError("Please add a short title.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await feedbackApi.submit({ type, title: title.trim(), idea, implementation });
    setSubmitting(false);
    if (!res || res.error) {
      setError(res?.error || "Something went wrong sending your feedback.");
      return;
    }
    setSent(true);
    setTitle("");
    setIdea("");
    setImplementation("");
    setType("feature");
    loadMine();
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        Send feedback
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Have an idea for something the app should add or change? Tell us what you&apos;re thinking
        and how you picture it working — it goes straight to the team.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          {sent && (
            <Grid size={12}>
              <Alert severity="success" onClose={() => setSent(false)}>
                Thanks! Your feedback was sent to the team.
              </Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel id="fb-type">Type</InputLabel>
              <Select
                labelId="fb-type"
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {FEEDBACK_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              fullWidth
              label="Title"
              placeholder="A short summary of your idea"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={Boolean(error) && !title.trim()}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Your idea — what would you like, and why?"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="How do you picture it working? (optional)"
              value={implementation}
              onChange={(e) => setImplementation(e.target.value)}
            />
          </Grid>
          {error && (
            <Grid size={12}>
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            </Grid>
          )}
          <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={submit} disabled={submitting}>
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Your submissions
      </Typography>
      <Paper variant="outlined">
        {mine.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              You haven&apos;t sent any feedback yet.
            </Typography>
          </Box>
        ) : (
          mine.map((f, i) => {
            const s = statusMeta(f.status);
            return (
              <Box key={f._id}>
                {i > 0 && <Divider />}
                <Box sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2">{f.title}</Typography>
                      {f.idea && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {f.idea}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {typeLabel(f.type)} · {dayjs(f.createdAt).format("MMM D, YYYY")}
                      </Typography>
                    </Box>
                    <Chip size="small" color={s.color} label={s.label} sx={{ flexShrink: 0 }} />
                  </Stack>
                </Box>
              </Box>
            );
          })
        )}
      </Paper>
    </Container>
  );
}
