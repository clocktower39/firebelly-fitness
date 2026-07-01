import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { getMyReadiness, saveReadiness } from "../Redux/actions";
import { readinessApi } from "../api/readinessApi";
import {
  READINESS_FACTORS,
  computeReadinessScore,
  readinessBand,
  dayKey,
} from "../utils/readiness";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

// Fast daily readiness / fatigue check-in (sleep, mood, energy, soreness, joint pain).
// Own view = editable. When clientId is set (a trainer viewing a client's page) it renders read-only
// from that client's data — the trainer can see the status but not fill or edit the client's check-in.
export default function DailyCheckinCard({ clientId = null }) {
  const dispatch = useDispatch();
  const reduxReadiness = useSelector((s) => s.readiness) || { entries: [], loaded: false };
  const readOnly = Boolean(clientId);
  const [clientEntries, setClientEntries] = useState(null); // null = not yet loaded
  const todayKey = dayKey();

  // Source the entries from the viewed client (read-only) or from my own Redux state.
  const entries = readOnly ? clientEntries || [] : reduxReadiness.entries || [];

  const todayEntry = useMemo(
    () => entries.find((e) => String(e.date).slice(0, 10) === todayKey) || null,
    [entries, todayKey]
  );

  const [values, setValues] = useState({});
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load: the viewed client's readiness (read-only) or my own.
  useEffect(() => {
    if (readOnly) {
      let cancelled = false;
      setClientEntries(null);
      readinessApi
        .getClientReadiness(clientId)
        .then((res) => {
          if (!cancelled) setClientEntries(Array.isArray(res) ? res : []);
        })
        .catch(() => {
          if (!cancelled) setClientEntries([]);
        });
      return () => {
        cancelled = true;
      };
    }
    if (!reduxReadiness.loaded) dispatch(getMyReadiness());
    return undefined;
  }, [readOnly, clientId, dispatch, reduxReadiness.loaded]);

  useEffect(() => {
    if (!readOnly && todayEntry) {
      setValues({
        sleep: todayEntry.sleep,
        mood: todayEntry.mood,
        energy: todayEntry.energy,
        soreness: todayEntry.soreness,
        jointPain: todayEntry.jointPain,
      });
      setNote(todayEntry.note || "");
    }
  }, [todayEntry, readOnly]);

  const score = computeReadinessScore(todayEntry && !editing ? todayEntry : values);
  const band = readinessBand(score);
  const canSave = READINESS_FACTORS.some((f) => values[f.key]);

  const trendData = useMemo(
    () =>
      [...entries]
        .map((e) => ({ date: e.date, score: computeReadinessScore(e) }))
        .filter((d) => d.score != null)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-14)
        .map((d) => ({
          label: new Date(d.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          score: d.score,
        })),
    [entries]
  );

  const trendChart =
    trendData.length >= 2 ? (
      <Box sx={{ width: "100%", height: 90, mt: 1.5 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 4, right: 6, left: -28, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="score"
              name="Readiness"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    ) : null;

  const handleSave = async () => {
    setSaving(true);
    await dispatch(saveReadiness({ ...values, note, date: todayKey }));
    setSaving(false);
    setEditing(false);
  };

  // Read-only view for a trainer looking at a client's page: show the client's status, no editing.
  if (readOnly) {
    const loadingClient = clientEntries == null;
    const lastEntry = entries.length
      ? entries.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b))
      : null;
    const lastScore = lastEntry ? computeReadinessScore(lastEntry) : null;
    const lastBand = readinessBand(lastScore);
    const lastLabel = lastEntry
      ? new Date(lastEntry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : null;
    return (
      <Paper sx={{ p: 2, mb: 2, width: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Daily check-in
            </Typography>
            {loadingClient ? (
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            ) : todayEntry ? (
              <Typography variant="body2" color="text.secondary">
                Today ✓ · Readiness: {score != null ? `${score}/100` : "—"}
              </Typography>
            ) : lastEntry ? (
              <Typography variant="body2" color="text.secondary">
                No check-in today · last {lastLabel}: {lastScore != null ? `${lastScore}/100` : "—"}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No check-ins yet
              </Typography>
            )}
          </Box>
          {!loadingClient && todayEntry && <Chip size="small" color={band.color} label={band.label} />}
          {!loadingClient && !todayEntry && lastEntry && (
            <Chip size="small" variant="outlined" color={lastBand.color} label={lastBand.label} />
          )}
        </Stack>
        {todayEntry?.note && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}
          >
            “{todayEntry.note}”
          </Typography>
        )}
        {trendChart}
      </Paper>
    );
  }

  if (todayEntry && !editing) {
    return (
      <Paper sx={{ p: 2, mb: 2, width: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Today's check-in ✓
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Readiness: {score != null ? `${score}/100` : "—"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color={band.color} label={band.label} />
            <Button size="small" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </Stack>
        </Stack>
        {trendChart}
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2, width: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Daily check-in
        </Typography>
        {score != null && <Chip size="small" color={band.color} label={`${score}/100`} />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        A quick fatigue check — helps plan your training. Takes a few seconds.
      </Typography>
      <Stack spacing={1.25}>
        {READINESS_FACTORS.map((f) => (
          <Box key={f.key}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {f.label}
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 52 }}>
                {f.lowLabel}
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={values[f.key] || null}
                onChange={(e, val) => val && setValues((v) => ({ ...v, [f.key]: val }))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <ToggleButton key={n} value={n} sx={{ px: 1.5 }}>
                    {n}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 52, textAlign: "right" }}
              >
                {f.highLabel}
              </Typography>
            </Stack>
          </Box>
        ))}
        <TextField
          size="small"
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          fullWidth
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {editing && <Button onClick={() => setEditing(false)}>Cancel</Button>}
          <Button variant="contained" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save check-in"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
