import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  FormControl,
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
  FEEDBACK_STATUSES,
  typeLabel,
  statusMeta,
} from "../../api/feedbackApi";

const nameOf = (u) =>
  u?.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u?.email || "Unknown user";

// Admin-only inbox: triage all submitted feedback. Gated on state.user.isAdmin (server also 403s).
export default function FeedbackInbox() {
  const isAdmin = useSelector((state) => state.user?.isAdmin);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [draftNotes, setDraftNotes] = useState({}); // id -> notes being edited

  const load = useCallback(async () => {
    setLoading(true);
    const data = await feedbackApi.listAll();
    if (Array.isArray(data)) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const patch = async (id, updates) => {
    const res = await feedbackApi.update(id, updates);
    if (res && !res.error) {
      setItems((prev) => prev.map((f) => (f._id === id ? { ...f, ...res } : f)));
    }
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="h6">Not authorized</Typography>
        <Typography variant="body2" color="text.secondary">
          This page is only available to admins.
        </Typography>
      </Container>
    );
  }

  const shown =
    statusFilter === "all" ? items : items.filter((f) => f.status === statusFilter);
  const counts = items.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">App feedback</Typography>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="fb-filter">Status</InputLabel>
          <Select
            labelId="fb-filter"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All ({items.length})</MenuItem>
            {FEEDBACK_STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
                {counts[s.value] ? ` (${counts[s.value]})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Paper variant="outlined">
        {shown.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {loading ? "Loading…" : "No feedback here."}
            </Typography>
          </Box>
        ) : (
          shown.map((f, i) => {
            const s = statusMeta(f.status);
            const open = openId === f._id;
            return (
              <Box key={f._id}>
                {i > 0 && <Divider />}
                <Box
                  onClick={() => setOpenId(open ? null : f._id)}
                  sx={{ p: 2, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                >
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2">{f.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {nameOf(f.user)} · {typeLabel(f.type)} ·{" "}
                        {dayjs(f.createdAt).format("MMM D, YYYY")}
                      </Typography>
                    </Box>
                    <Chip size="small" color={s.color} label={s.label} sx={{ flexShrink: 0 }} />
                  </Stack>
                </Box>

                {open && (
                  <Box sx={{ px: 2, pb: 2 }} onClick={(e) => e.stopPropagation()}>
                    {f.idea && (
                      <>
                        <Typography variant="overline" color="text.secondary">
                          Their idea
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: "pre-wrap" }}>
                          {f.idea}
                        </Typography>
                      </>
                    )}
                    {f.implementation && (
                      <>
                        <Typography variant="overline" color="text.secondary">
                          How they&apos;d build it
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: "pre-wrap" }}>
                          {f.implementation}
                        </Typography>
                      </>
                    )}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel id={`st-${f._id}`}>Status</InputLabel>
                        <Select
                          labelId={`st-${f._id}`}
                          label="Status"
                          value={f.status}
                          onChange={(e) => patch(f._id, { status: e.target.value })}
                        >
                          {FEEDBACK_STATUSES.map((st) => (
                            <MenuItem key={st.value} value={st.value}>
                              {st.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {f.user?.email && (
                        <Typography variant="caption" color="text.secondary">
                          {f.user.email}
                        </Typography>
                      )}
                    </Stack>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      label="Internal notes (admin only)"
                      value={draftNotes[f._id] ?? f.adminNotes ?? ""}
                      onChange={(e) =>
                        setDraftNotes((d) => ({ ...d, [f._id]: e.target.value }))
                      }
                    />
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                      <Button
                        size="small"
                        disabled={(draftNotes[f._id] ?? f.adminNotes ?? "") === (f.adminNotes ?? "")}
                        onClick={() => patch(f._id, { adminNotes: draftNotes[f._id] ?? "" })}
                      >
                        Save notes
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Paper>
    </Container>
  );
}
