import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { anchorApi } from "../../api/anchorApi";

// How an exercise advances within one program, and — when it appears more than once in the
// week — how its occurrences relate. One working weight drives them all, so a 5x5 volume day
// and its 80% light day can never drift apart the way independent per-day seeding let them.
const RULES = [
  { value: "feedback", label: "Feedback only", hint: "Loads move from how the sessions actually go. The default." },
  { value: "weekly", label: "Weekly step", hint: "Adds a fixed amount every week, capped by the ceiling." },
  { value: "earned", label: "Earned", hint: "Only after two good sessions at the weight, or an explicit “felt easy”." },
  { value: "hold", label: "Hold", hint: "Never changes. Pins the exercise where it is." },
];

const blankish = (v) => v === null || v === undefined || v === "";

export default function SetProgressionDialog({
  open,
  onClose,
  clientId,
  programId,
  exerciseId,
  exerciseTitle,
  weightUnit = "lbs",
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await anchorApi.forExercise({ clientId, programId, exerciseId });
      if (!res || res.error) throw new Error(res?.error || "Could not load this exercise's progression.");
      setData(res);
      const a = res.anchor;
      setForm({
        rule: a?.rule || "feedback",
        step: a?.step ? String(a.step) : "",
        working: a && Number(a.working) > 0 ? String(a.working) : "",
        ceiling: blankish(a?.ceiling) ? "" : String(a.ceiling),
        unit: a?.unit || res.suggestedUnit || "weight",
        earnsOnDay: blankish(a?.earnsOnDay) ? "" : String(a.earnsOnDay),
        // one row per occurrence; a blank percentage means that slot keeps its own load
        slots: (res.slots || []).map((s) => ({
          day: s.day,
          scheme: s.scheme,
          currentTop: s.currentTop,
          applyTo: s.applyTo || "top",
          percentOfAnchor: blankish(s.percentOfAnchor) ? "" : String(s.percentOfAnchor),
        })),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, programId, exerciseId]);

  useEffect(() => {
    if (open && clientId && programId && exerciseId) load();
  }, [open, clientId, programId, exerciseId, load]);

  const unitLabel = form?.unit === "seconds" ? "seconds" : form?.unit === "reps" ? "reps" : weightUnit;
  const working = Number(form?.working);
  const previewFor = (pct) => {
    if (blankish(pct) || !(working > 0)) return null;
    const raw = (working * Number(pct)) / 100;
    return form.unit === "weight" ? Math.round(raw * 2) / 2 : Math.max(0, Math.round(raw));
  };

  const setSlot = (day, patch) =>
    setForm((f) => ({
      ...f,
      slots: f.slots.map((s) => (s.day === day ? { ...s, ...patch } : s)),
    }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await anchorApi.setAnchor({
        clientId, programId, exerciseId,
        working: form.working === "" ? null : Number(form.working),
        unit: form.unit,
        rule: form.rule,
        step: form.step === "" ? 0 : Number(form.step),
        ceiling: form.ceiling === "" ? null : Number(form.ceiling),
        earnsOnDay: form.earnsOnDay === "" ? null : Number(form.earnsOnDay),
        slots: form.slots.map((s) => ({
          day: s.day,
          percentOfAnchor: s.percentOfAnchor === "" ? null : Number(s.percentOfAnchor),
          applyTo: s.applyTo,
        })),
      });
      if (!res || res.error) throw new Error(res?.error || "Could not save.");
      onClose?.({ saved: true, rendered: res.rendered });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await anchorApi.clearAnchor({ clientId, programId, exerciseId });
      onClose?.({ cleared: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const multi = (form?.slots || []).length > 1;

  return (
    <Dialog open={open} onClose={() => onClose?.()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>
        Set progression
        <Typography variant="body2" color="text.secondary">
          {exerciseTitle}
          {data?.programTitle ? ` · ${data.programTitle}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading && <Typography variant="body2" color="text.secondary">Loading…</Typography>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {form && !loading && (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl>
              <Typography variant="subtitle2" gutterBottom>How it advances</Typography>
              <RadioGroup
                value={form.rule}
                onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))}
              >
                {RULES.map((r) => (
                  <FormControlLabel
                    key={r.value}
                    value={r.value}
                    control={<Radio size="small" />}
                    label={
                      <span>
                        {r.label}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {r.hint}
                        </Typography>
                      </span>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>

            {form.rule === "weekly" && (
              <TextField
                id="progression-step"
                label={`Step each week (${unitLabel})`}
                type="number"
                size="small"
                value={form.step}
                onChange={(e) => setForm((f) => ({ ...f, step: e.target.value }))}
                slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                helperText="Blank uses the normal increment for this equipment."
                sx={{ maxWidth: 260 }}
              />
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="progression-working"
                  label={`Working weight (${unitLabel})`}
                  type="number"
                  size="small"
                  value={form.working}
                  onChange={(e) => setForm((f) => ({ ...f, working: e.target.value }))}
                  slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                  helperText={
                    form.working === ""
                      ? "Not set — the first completed earning day establishes it."
                      : "Every linked day is a percentage of this."
                  }
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="progression-ceiling"
                  label={`Ceiling (${unitLabel})`}
                  type="number"
                  size="small"
                  value={form.ceiling}
                  onChange={(e) => setForm((f) => ({ ...f, ceiling: e.target.value }))}
                  slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                  helperText="Builds to here and holds. Blank for none."
                  fullWidth
                />
              </Grid>
            </Grid>

            <Divider />

            <div>
              <Typography variant="subtitle2">
                {multi
                  ? `Used ${form.slots.length}× this week — loads derive from the working weight`
                  : "Used once a week"}
              </Typography>
              {!form.slots.length && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  This exercise isn't on any upcoming day of this program.
                </Typography>
              )}
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {form.slots.map((s) => {
                  const preview = previewFor(s.percentOfAnchor);
                  return (
                    <Grid container spacing={1} key={s.day} sx={{ alignItems: "center" }}>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="body2">
                          <strong>Day {s.day}</strong>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {s.scheme}
                          </Typography>
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 5, sm: 3 }}>
                        <TextField
                          id={`progression-pct-${s.day}`}
                          label="%"
                          type="number"
                          size="small"
                          value={s.percentOfAnchor}
                          onChange={(e) => setSlot(s.day, { percentOfAnchor: e.target.value })}
                          slotProps={{ htmlInput: { min: 0, step: "5" } }}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 7, sm: 5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {preview !== null
                            ? `→ ${preview} ${unitLabel}`
                            : blankish(s.percentOfAnchor)
                              ? "not linked — keeps its own load"
                              : `→ set a working weight to preview`}
                        </Typography>
                      </Grid>
                    </Grid>
                  );
                })}
              </Stack>
            </div>

            {multi && (
              <FormControl size="small" sx={{ maxWidth: 320 }}>
                <InputLabel id="earns-label">Which day earns a raise</InputLabel>
                <Select
                  labelId="earns-label"
                  id="progression-earns"
                  label="Which day earns a raise"
                  value={form.earnsOnDay}
                  onChange={(e) => setForm((f) => ({ ...f, earnsOnDay: e.target.value }))}
                >
                  <MenuItem value="">Any day</MenuItem>
                  {form.slots.map((s) => (
                    <MenuItem key={s.day} value={String(s.day)}>Day {s.day} ({s.scheme})</MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Any day reporting “too hard” lowers the working weight. Only this one raises it.
                </Typography>
              </FormControl>
            )}

            <FormControl size="small" sx={{ maxWidth: 320 }}>
              <InputLabel id="applyto-label">Percentage applies to</InputLabel>
              <Select
                labelId="applyto-label"
                id="progression-applyto"
                label="Percentage applies to"
                value={form.slots[0]?.applyTo || "top"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slots: f.slots.map((s) => ({ ...s, applyTo: e.target.value })) }))
                }
              >
                <MenuItem value="top">Top set only — the rest of the ramp shifts with it</MenuItem>
                <MenuItem value="all">Every set</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {data?.anchor && (
          <Button color="error" onClick={clear} disabled={saving}>
            Remove
          </Button>
        )}
        <Button onClick={() => onClose?.()} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || loading || !form}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
