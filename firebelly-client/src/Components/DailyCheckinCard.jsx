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
import {
  READINESS_FACTORS,
  computeReadinessScore,
  readinessBand,
  dayKey,
} from "../utils/readiness";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

// Fast daily readiness / fatigue check-in (sleep, mood, energy, soreness, joint pain).
export default function DailyCheckinCard() {
  const dispatch = useDispatch();
  const readiness = useSelector((s) => s.readiness) || { entries: [], loaded: false };
  const todayKey = dayKey();

  const todayEntry = useMemo(
    () => (readiness.entries || []).find((e) => String(e.date).slice(0, 10) === todayKey) || null,
    [readiness.entries, todayKey]
  );

  const [values, setValues] = useState({});
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!readiness.loaded) dispatch(getMyReadiness());
  }, [dispatch, readiness.loaded]);

  useEffect(() => {
    if (todayEntry) {
      setValues({
        sleep: todayEntry.sleep,
        mood: todayEntry.mood,
        energy: todayEntry.energy,
        soreness: todayEntry.soreness,
        jointPain: todayEntry.jointPain,
      });
      setNote(todayEntry.note || "");
    }
  }, [todayEntry]);

  const score = computeReadinessScore(todayEntry && !editing ? todayEntry : values);
  const band = readinessBand(score);
  const canSave = READINESS_FACTORS.some((f) => values[f.key]);

  const trendData = useMemo(
    () =>
      [...(readiness.entries || [])]
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
    [readiness.entries]
  );

  const handleSave = async () => {
    setSaving(true);
    await dispatch(saveReadiness({ ...values, note, date: todayKey }));
    setSaving(false);
    setEditing(false);
  };

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
        {trendData.length >= 2 && (
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
        )}
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
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
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
