import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, FormControl, InputLabel, ListSubheader,
  MenuItem, Paper, Select, Snackbar, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { exerciseMaxApi } from "../../api/exerciseMaxApi";
import { requestClients } from "../../Redux/actions";
import { compareRelationshipsByClientLastName, formatClientLastFirst } from "../../utils/clientRelationships";
import { displayWeightUnit, normalizeWeightUnit } from "../../utils/weightUnits";
import EmptyState from "../../Components/EmptyState";

// A max older than this is probably not what today's percentages should be built on.
const STALE_DAYS = 180;

const daysAgo = (d) => (d ? Math.round((Date.now() - new Date(d).valueOf()) / 86400000) : null);
const shortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

// One lift: the stored max on the left, the evidence from their logged history on the right.
function LiftRow({ row, unit, saving, onSave, onClear }) {
  const [value, setValue] = useState(row.stored?.value != null ? String(row.stored.value) : "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setValue(row.stored?.value != null ? String(row.stored.value) : "");
  }, [row.stored?.value, dirty]);

  const age = daysAgo(row.stored?.testedAt || row.stored?.updatedAt);
  const stale = row.stored && age != null && age > STALE_DAYS;
  const canSave = dirty && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

  const applySuggestion = () => {
    setValue(String(row.suggested));
    setDirty(true);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "flex-start" } }}>
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{row.exerciseTitle}</Typography>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
            {row.stored && (
              <Chip size="small" color={stale ? "warning" : "success"} variant={stale ? "filled" : "outlined"}
                label={stale ? `Set ${age} days ago` : `Source: ${row.stored.source}`} />
            )}
            {row.needsMax && (
              <Chip size="small" color="primary" label="Your program needs this" />
            )}
            {row.suggested != null && !row.suggestedFromRecent && (
              <Chip size="small" color="warning" variant="outlined"
                label="Nothing logged in the last year" />
            )}
            {row.bestSingle && (
              <Chip size="small" variant="outlined"
                label={`Best single ${row.bestSingle.weight} × 1 · ${shortDate(row.bestSingle.date)}`} />
            )}
            {row.bestEstimate && (
              <Tooltip title={`Epley estimate from ${row.bestEstimate.fromWeight} × ${row.bestEstimate.fromReps} on ${shortDate(row.bestEstimate.date)}`}>
                <Chip size="small" variant="outlined"
                  label={`Est. ${row.bestEstimate.value} from ${row.bestEstimate.fromWeight} × ${row.bestEstimate.fromReps}`} />
              </Tooltip>
            )}
            {!row.bestSingle && !row.bestEstimate && row.lastSet && (
              <Chip size="small" variant="outlined"
                label={`Last logged ${row.lastSet.weight} × ${row.lastSet.reps}`} />
            )}
            {!row.bestSingle && !row.bestEstimate && !row.lastSet && (
              <Chip size="small" variant="outlined" label="No loaded sets logged" />
            )}
            {/* All-time context, only when it disagrees with what recent work suggests —
                otherwise it is noise. */}
            {row.allTimeBest && row.suggested != null
              && Number(row.allTimeBest.weight) !== Number(row.suggested) && (
              <Tooltip title={`Heaviest ever recorded, on ${shortDate(row.allTimeBest.date)}. Not used as the suggestion because newer work is a better guide.`}>
                <Chip size="small" variant="outlined" color="default"
                  label={`All-time ${row.allTimeBest.weight}`} />
              </Tooltip>
            )}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            label={`1RM (${displayWeightUnit(unit)})`}
            value={value}
            onChange={(e) => { setValue(e.target.value); setDirty(true); }}
            inputProps={{ inputMode: "decimal" }}
            sx={{ width: 130 }}
          />
          {row.suggested != null && String(row.suggested) !== value && (
            <Button size="small" onClick={applySuggestion}>
              Use {row.suggested}
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!canSave || saving}
            onClick={() => onSave(row, value).then(() => setDirty(false))}
          >
            Save
          </Button>
          {row.stored && (
            <Button size="small" color="inherit" disabled={saving}
              onClick={() => onClear(row).then(() => { setDirty(false); setValue(""); })}>
              Clear
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function MyLifts() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);
  const unit = normalizeWeightUnit(user?.workoutWeightUnit);

  const [clientId, setClientId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user?.isTrainer) return;
    dispatch(requestClients());
  }, [dispatch, user?.isTrainer]);

  const acceptedClients = useMemo(
    () => (clients || []).filter((rel) => rel.accepted && rel.client?._id).sort(compareRelationshipsByClientLastName),
    [clients]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await exerciseMaxApi.forUser(clientId || undefined);
      if (data?.error) throw new Error(data.error);
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message || "Unable to load maxes.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const save = async (row, value) => {
    setSaving(true);
    try {
      // If they accepted the history suggestion verbatim, record where it came from;
      // a hand-typed number is "entered".
      const matchedSuggestion = row.suggested != null && Number(value) === Number(row.suggested);
      const data = await exerciseMaxApi.setMax({
        clientId: clientId || undefined,
        exerciseId: row.exerciseId,
        value: Number(value),
        source: matchedSuggestion ? row.suggestedSource : "entered",
        testedAt: matchedSuggestion ? (row.bestSingle?.date || row.bestEstimate?.date || null) : null,
      });
      if (data?.error) throw new Error(data.error);
      setToast(`${row.exerciseTitle} 1RM saved as ${value} ${displayWeightUnit(unit)}.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const clear = async (row) => {
    setSaving(true);
    try {
      const data = await exerciseMaxApi.setMax({ clientId: clientId || undefined, exerciseId: row.exerciseId, value: "" });
      if (data?.error) throw new Error(data.error);
      setToast(`${row.exerciseTitle} max cleared.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to clear.");
    } finally {
      setSaving(false);
    }
  };

  const needed = rows.filter((r) => r.needsMax);
  const withMax = rows.filter((r) => !r.needsMax && r.stored);
  const withoutMax = rows.filter((r) => !r.needsMax && !r.stored);
  const whose = clientId
    ? formatClientLastFirst(acceptedClients.find((r) => String(r.client._id) === String(clientId))?.client) || "this client"
    : "you";

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
          <Stack spacing={0.5}>
            <Typography variant="h4">My Lifts</Typography>
            <Typography variant="body2" color="text.secondary">
              One max per lift, stored once. Percentage-based program days read from here instead of
              needing the number typed into every workout.
            </Typography>
          </Stack>
          {user?.isTrainer && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="lifts-who">Showing</InputLabel>
              <Select labelId="lifts-who" label="Showing" value={clientId}
                onChange={(e) => setClientId(e.target.value)}>
                <MenuItem value="">Myself</MenuItem>
                {acceptedClients.length > 0 && <ListSubheader>Clients</ListSubheader>}
                {acceptedClients.map((rel) => (
                  <MenuItem key={rel.client._id} value={rel.client._id}>
                    {formatClientLastFirst(rel.client)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

        {loading ? (
          <Stack sx={{ alignItems: "center", py: 6 }}><CircularProgress /></Stack>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FitnessCenterIcon color="disabled" />}
            title="No loaded lifts logged yet"
            hint={`Once ${whose === "you" ? "you log" : `${whose} logs`} a working set with weight on it, that lift shows up here with a suggested max drawn from the history — ready to confirm.`}
          />
        ) : (
          <>
            {needed.length > 0 && (
              <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">Needed for program percentages ({needed.length})</Typography>
                  <Typography variant="body2" color="text.secondary">
                    These lifts appear in a percentage-based workout. Without a max here, those
                    sets show no load at all.
                  </Typography>
                </Stack>
                {needed.map((row) => (
                  <LiftRow key={row.exerciseId} row={row} unit={unit} saving={saving} onSave={save} onClear={clear} />
                ))}
                <Divider />
              </Stack>
            )}

            <Stack spacing={1.5}>
              <Typography variant="h6">
                Maxes on record{withMax.length ? ` (${withMax.length})` : ""}
              </Typography>
              {withMax.length === 0 ? (
                <Alert severity="info">
                  Nothing on record yet. Every lift below has a suggestion worked out from logged
                  history — press <strong>Use</strong> then <strong>Save</strong> to accept one.
                </Alert>
              ) : (
                withMax.map((row) => (
                  <LiftRow key={row.exerciseId} row={row} unit={unit} saving={saving} onSave={save} onClear={clear} />
                ))
              )}
            </Stack>

            {withoutMax.length > 0 && (
              <>
                <Divider />
                <Stack spacing={1.5}>
                  <Stack spacing={0.5}>
                    <Typography variant="h6">Suggested from history ({withoutMax.length})</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ordered by what was trained most recently. A logged single is used as-is; where
                      there is no single, the number is an Epley estimate from the best set of 12 reps
                      or fewer — a starting point, not a tested max. Only work from the last year counts
                      toward a suggestion, so an old personal best will not drive today's percentages.
                    </Typography>
                  </Stack>
                  {withoutMax.map((row) => (
                    <LiftRow key={row.exerciseId} row={row} unit={unit} saving={saving} onSave={save} onClear={clear} />
                  ))}
                </Stack>
              </>
            )}
          </>
        )}
      </Stack>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
