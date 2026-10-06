import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { programApi } from "../../api/programApi";
import { formatClientLastFirst } from "../../utils/clientRelationships";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Shared by the programs list and the builder, so assigning behaves identically in both and
// there is only one place to fix. "Myself" is a real option: a trainer running their own
// programming is their own client here, and the server allows it without a relationship.
export default function AssignProgramDialog({
  open,
  program,
  onClose,
  onAssigned,
  acceptedClients = [],
}) {
  const user = useSelector((state) => state.user);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dayMap, setDayMap] = useState([]);
  const [dayMapTouched, setDayMapTouched] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset whenever a different program is opened, so last time's picks don't leak across.
  useEffect(() => {
    if (!open) return;
    setClientId("");
    setStartDate("");
    setDayMap([]);
    setDayMapTouched(false);
    setStatus("");
  }, [open, program?._id]);

  // Default the weekday map to consecutive days from the start date, until the trainer
  // touches it — then their choices stand.
  useEffect(() => {
    if (!program || dayMapTouched) return;
    const daysPerWeek = program.daysPerWeek || 0;
    if (!daysPerWeek) { setDayMap([]); return; }
    const parsed = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const startDay = parsed && !Number.isNaN(parsed.valueOf()) ? parsed.getDay() : 0;
    setDayMap(Array.from({ length: daysPerWeek }, (_, i) => (startDay + i) % 7));
  }, [program, startDate, dayMapTouched]);

  const sortedClients = useMemo(
    () => (acceptedClients || []).filter((rel) => rel?.client?._id),
    [acceptedClients]
  );

  const assign = async () => {
    if (!program?._id || !clientId || !startDate) return;
    setSaving(true);
    setStatus("");
    try {
      const payload = { clientId, startDate };
      if (dayMap.length) payload.dayMap = dayMap;
      const data = await programApi.assignProgram(program._id, payload);
      if (data?.error) throw new Error(data.error);
      const isSelf = String(clientId) === String(user?._id);
      const who = isSelf
        ? "you"
        : formatClientLastFirst(sortedClients.find((r) => String(r.client._id) === String(clientId))?.client) || "the client";
      onAssigned?.({
        count: data.count || 0,
        message: `Assigned ${data.count || 0} workouts to ${who}.`,
      });
      onClose?.();
    } catch (err) {
      setStatus(err.message || "Unable to assign program.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose?.()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        Assign program
        {program?.title && (
          <Typography variant="body2" color="text.secondary">{program.title}</Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Choose who it's for and when it starts.
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="assign-who-label">Assign to</InputLabel>
            <Select
              labelId="assign-who-label"
              id="assign-who"
              label="Assign to"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <MenuItem value={String(user?._id || "")}>
                Myself{user?.firstName ? ` — ${user.firstName} ${user.lastName || ""}`.trimEnd() : ""}
              </MenuItem>
              {sortedClients.length > 0 && <ListSubheader>Clients</ListSubheader>}
              {sortedClients.map((rel) => (
                <MenuItem key={rel.client._id} value={rel.client._id}>
                  {formatClientLastFirst(rel.client)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="assign-start-date"
            label="Start date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          {!!program?.daysPerWeek && (
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Which weekday each program day lands on.
              </Typography>
              <Grid container spacing={1}>
                {Array.from({ length: program.daysPerWeek }, (_, index) => (
                  <Grid key={`assign-day-${index}`} size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`assign-day-label-${index}`}>{`Day ${index + 1}`}</InputLabel>
                      <Select
                        labelId={`assign-day-label-${index}`}
                        id={`assign-day-${index}`}
                        label={`Day ${index + 1}`}
                        value={dayMap[index] ?? ""}
                        onChange={(event) => {
                          const next = [...dayMap];
                          next[index] = event.target.value;
                          setDayMap(next);
                          setDayMapTouched(true);
                        }}
                      >
                        {WEEKDAYS.map((label, dayIndex) => (
                          <MenuItem key={`${label}-${dayIndex}`} value={dayIndex}>{label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          )}
          {status && (
            <Typography variant="caption" color="error">{status}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.()} disabled={saving}>Close</Button>
        <Button variant="contained" onClick={assign} disabled={saving || !clientId || !startDate}>
          {saving ? "Assigning…" : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
