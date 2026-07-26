import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiFetch } from "../api/client";
import { conversationApi } from "../api/conversationApi";
import { formatVolume } from "../features/workout/utils/trainingLoad";
import { normalizeWeightUnit } from "../utils/weightUnits";

const buildRecapText = (recap, client, weightUnit) => {
  const monthName = dayjs(`${recap.month}-01`).format("MMMM");
  const lines = [`🔥 ${monthName} recap, ${client.firstName}:`];
  lines.push(
    `• ${recap.workoutsCompleted} workout${recap.workoutsCompleted === 1 ? "" : "s"} completed (${recap.daysTrained} day${recap.daysTrained === 1 ? "" : "s"} trained)`
  );
  if (recap.volume > 0) {
    let delta = "";
    if (recap.prevVolume > 0) {
      const pct = Math.round(((recap.volume - recap.prevVolume) / recap.prevVolume) * 100);
      if (pct !== 0) delta = ` — ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% from ${dayjs(`${recap.month}-01`).subtract(1, "month").format("MMMM")}`;
    }
    lines.push(`• ${formatVolume(recap.volume, weightUnit)} total volume${delta}`);
  }
  if (recap.prExercises?.length) {
    lines.push(`• ${recap.prExercises.length} PR${recap.prExercises.length === 1 ? "" : "s"}: ${recap.prExercises.join(", ")}`);
  }
  if (recap.sessionsAttended > 0) {
    lines.push(`• ${recap.sessionsAttended} training session${recap.sessionsAttended === 1 ? "" : "s"} together`);
  }
  lines.push("");
  return lines.join("\n");
};

// Build a per-client month recap the trainer can edit (add the personal sentence — that's
// the point) and send straight into their 1:1 chat, or copy elsewhere.
export default function MonthlyRecapDialog({ client, open, onClose }) {
  const user = useSelector((state) => state.user);
  const weightUnit = normalizeWeightUnit(user?.workoutWeightUnit);
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { severity, message }
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !client?._id) return undefined;
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    apiFetch("/dashboard/recap", { method: "POST", body: { clientId: client._id, month } })
      .then((recap) => {
        if (cancelled) return;
        if (recap?.error) {
          setNotice({ severity: "error", message: recap.error });
          return;
        }
        setText(buildRecapText(recap, client, weightUnit));
      })
      .catch(() => {
        if (!cancelled) setNotice({ severity: "error", message: "Couldn't build the recap." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, client?._id, month, weightUnit]);  

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const convo = await conversationApi.getOrCreateDirect(client._id);
      const convoId = convo?._id || convo?.conversation?._id;
      if (!convoId) throw new Error("Couldn't open the conversation.");
      const sent = await conversationApi.sendMessage(convoId, text.trim());
      if (sent?.error) throw new Error(sent.error);
      setNotice({ severity: "success", message: `Sent to ${client.firstName}.` });
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Couldn't send the recap." });
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ severity: "success", message: "Copied." });
    } catch {
      setNotice({ severity: "error", message: "Couldn't copy — select the text manually." });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Monthly recap — {client ? `${client.firstName} ${client.lastName}` : ""}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            type="month"
            label="Month"
            size="small"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            sx={{ maxWidth: 200 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            multiline
            minRows={7}
            label="Recap message"
            value={loading ? "Building recap…" : text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
            helperText="Add a personal line at the bottom — that's the part they'll remember."
          />
          {notice && <Alert severity={notice.severity}>{notice.message}</Alert>}
          <Typography variant="caption" color="text.secondary">
            Numbers cover completed workouts and sessions in the selected month; PRs use the
            same records math as the trophy badges.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={handleCopy} disabled={loading || !text.trim()}>
          Copy
        </Button>
        <Button variant="contained" onClick={handleSend} disabled={loading || sending || !text.trim()}>
          Send in chat
        </Button>
      </DialogActions>
    </Dialog>
  );
}
