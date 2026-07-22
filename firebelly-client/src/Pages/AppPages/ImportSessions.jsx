import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import { billingApi } from "../../api/billingApi";
import { scheduleApi } from "../../api/scheduleApi";
import { requestClients } from "../../Redux/actions";
import { toMatrix, detectRoles, buildRows, COLUMN_ROLES } from "../../utils/sessionImportParse";

// Import → Reconcile → Commit: paste a client's session sheet, review the server's
// classified plan against the calendar + invoices, apply it in one undoable batch.
// The self-serve replacement for hand-reconciling spreadsheets against the app.

const ROLE_LABELS = {
  date: "Session date",
  price: "Price",
  method: "Method",
  paymentDate: "Paid on",
  ignore: "Ignore",
};

const CAL_META = {
  CREATE: { label: "Create session", color: "primary" },
  COMPLETE: { label: "Mark completed", color: "primary" },
  USE_EXISTING: { label: "Existing session", color: "success" },
  NONE: { label: "Future — income only", color: "default" },
  AMBIGUOUS: { label: "Needs a choice", color: "warning" },
  SKIP: { label: "No calendar change", color: "default" },
};

const INCOME_META = {
  LOG: { label: "Log income", color: "success" },
  SKIP_ALREADY_LOGGED: { label: "Already logged", color: "default" },
  SKIP_ALREADY_INVOICED: { label: "Already invoiced", color: "default" },
  SKIP_CREDIT_CHARGED: { label: "Paid by credits", color: "warning" },
  SKIP: { label: "Skip income", color: "default" },
};

const WARNING_TEXT = {
  PRICE_MISMATCH: "Sheet price differs from the appointment's price",
  CREDIT_CHARGED: "This session was paid with prepaid credits — logging income would double-count it",
  FUTURE_DATE: "Future date: income can be logged, but no completed session will be created",
  MULTIPLE_APPTS: "More than one appointment on this date — pick which one this session was",
  CANCELLED_APPT_ON_DATE: "Only a cancelled appointment exists on this date; a new one will be created",
  DUPLICATE_ROW: "Duplicate date in the sheet — only the first row is used",
  UNEXPECTED_STATUS: "Appointment is in an unexpected state",
};

const fmt12 = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = String(hhmm).split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

const newIdempotencyKey = () =>
  `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function ImportSessions() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const clients = useSelector((state) => state.clients);

  const [clientId, setClientId] = useState("");
  const [step, setStep] = useState("import"); // import | preview | done

  // --- import state ---
  const [pasteText, setPasteText] = useState("");
  const [matrix, setMatrix] = useState([]);
  const [roles, setRoles] = useState([]);
  const [fallbackYear, setFallbackYear] = useState(String(dayjs().year()));
  const [removedDates, setRemovedDates] = useState(new Set());

  // --- defaults panel ---
  const [sessionTypes, setSessionTypes] = useState([]);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const priceEditedRef = useRef(false);
  const [defaultTime, setDefaultTime] = useState("");
  const [paymentMode, setPaymentMode] = useState("perSession");
  const [batchPaymentDate, setBatchPaymentDate] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");

  // --- preview/commit state ---
  const [preview, setPreview] = useState(null);
  const [overrides, setOverrides] = useState({}); // date -> {calendarAction?, eventId?, incomeAction?, time?, price?}
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(null);

  useEffect(() => {
    dispatch(requestClients());
    scheduleApi
      .getSessionTypes()
      .then((d) => setSessionTypes(d?.sessionTypes || []))
      .catch(() => setSessionTypes([]));
  }, [dispatch]);

  // Deep-link: /import-sessions?client=<id>. Optional &dates=YYYY-MM-DD,... (from the
  // Session History "not yet billed" sweep) pre-fills the rows — no pasting needed.
  useEffect(() => {
    const c = searchParams.get("client");
    if (c) setClientId(c);
    const datesParam = searchParams.get("dates");
    if (datesParam) {
      const dates = [
        ...new Set(
          datesParam
            .split(",")
            .map((d) => d.trim())
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && dayjs(d).isValid())
        ),
      ].sort();
      if (dates.length) {
        setPasteText(dates.join("\n"));
        setMatrix(dates.map((d) => [d]));
        setRoles(["date"]);
        setRemovedDates(new Set());
      }
    }
  }, [searchParams]);

  // Selecting a session type fills its default price — never over a hand-typed one.
  useEffect(() => {
    const t = sessionTypes.find((s) => s._id === sessionTypeId);
    if (t && !priceEditedRef.current) setDefaultPrice(String(t.defaultPrice ?? ""));
  }, [sessionTypeId, sessionTypes]);

  const selectedClientRel = clients.find((c) => c.client?._id === clientId) || null;
  const clientName = selectedClientRel
    ? `${selectedClientRel.client.firstName || ""} ${selectedClientRel.client.lastName || ""}`.trim()
    : "";

  // Parsed rows from the matrix + role assignment, minus hand-removed dates.
  const parsedResult = useMemo(() => {
    if (!matrix.length || !roles.length) return { rows: [], skipped: [], deduped: 0 };
    return buildRows(matrix, roles, fallbackYear);
  }, [matrix, roles, fallbackYear]);
  const rows = useMemo(
    () => parsedResult.rows.filter((r) => !removedDates.has(r.date)),
    [parsedResult, removedDates]
  );
  const hasDateRole = roles.includes("date");
  const anyYearless = useMemo(
    () => matrix.some((r) => r.some((c) => /^\d{1,2}\/\d{1,2}$/.test(String(c || "").trim()))),
    [matrix]
  );

  const parsePaste = () => {
    const m = toMatrix(pasteText);
    setMatrix(m);
    setRoles(detectRoles(m, fallbackYear));
    setRemovedDates(new Set());
    setError(m.length ? "" : "Nothing to parse — paste rows first.");
  };

  const options = useMemo(
    () => ({
      sessionTypeId: sessionTypeId || null,
      ...(defaultPrice !== "" ? { defaultPrice: Math.max(0, Number(defaultPrice) || 0) } : {}),
      ...(defaultTime ? { defaultTime } : {}),
      paymentMode,
      ...(paymentMode === "batch" && batchPaymentDate ? { paymentDate: batchPaymentDate } : {}),
      ...(method ? { method } : {}),
      ...(notes ? { notes } : {}),
    }),
    [sessionTypeId, defaultPrice, defaultTime, paymentMode, batchPaymentDate, method, notes]
  );

  // Rows as sent to the API: parsed sheet data + any per-row time/price edits from preview.
  const apiRows = useMemo(
    () =>
      rows.map((r) => {
        const o = overrides[r.date] || {};
        return {
          date: r.date,
          ...(o.time ? { time: o.time } : {}),
          ...(o.price !== undefined && o.price !== ""
            ? { price: Math.max(0, Number(o.price) || 0) }
            : r.price !== undefined
              ? { price: r.price }
              : {}),
          ...(r.method ? { method: r.method } : {}),
          ...(r.paymentDate ? { paymentDate: r.paymentDate } : {}),
        };
      }),
    [rows, overrides]
  );

  const runPreview = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await billingApi.reconcilePreview({ clientId, rows: apiRows, options });
      if (d?.error) throw new Error(d.error);
      setPreview(d);
      setIdempotencyKey(newIdempotencyKey());
      setStep("preview");
    } catch (e) {
      setError(e.message || "Preview failed.");
    } finally {
      setBusy(false);
    }
  };

  // Merge the server plan with local overrides for display + commit.
  const planRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows.map((r) => {
      const o = overrides[r.date] || {};
      const calendarAction =
        o.calendarAction || (r.calendarAction === "AMBIGUOUS" || r.calendarAction === "NONE" ? (r.calendarAction === "NONE" ? "NONE" : "SKIP") : r.calendarAction);
      const incomeAction = o.incomeAction || (r.incomeAction === "LOG" ? "LOG" : "SKIP");
      return {
        ...r,
        chosenCalendar: calendarAction,
        chosenEventId: o.eventId || r.eventId || null,
        chosenIncome: incomeAction,
        editedTime: o.time || r.time,
        editedPrice: o.price !== undefined ? o.price : r.price,
      };
    });
  }, [preview, overrides]);

  const planSummary = useMemo(() => {
    const s = { create: 0, complete: 0, existing: 0, skip: 0, log: 0, incomeTotal: 0 };
    planRows.forEach((r) => {
      if (r.chosenCalendar === "CREATE") s.create += 1;
      else if (r.chosenCalendar === "COMPLETE") s.complete += 1;
      else if (r.chosenCalendar === "USE_EXISTING") s.existing += 1;
      else s.skip += 1;
      if (r.chosenIncome === "LOG") {
        s.log += 1;
        s.incomeTotal += Math.max(0, Number(r.editedPrice) || 0);
      }
    });
    return s;
  }, [planRows]);

  const setOverride = (date, patch) =>
    setOverrides((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));

  const commit = async () => {
    setBusy(true);
    setError("");
    try {
      const commitRows = planRows.map((r) => ({
        date: r.date,
        ...(r.editedTime ? { time: r.editedTime } : {}),
        price: Math.max(0, Number(r.editedPrice) || 0),
        ...(r.method ? { method: r.method } : {}),
        ...(r.paymentDate ? { paymentDate: r.paymentDate } : {}),
        calendarAction: r.chosenCalendar === "NONE" ? "SKIP" : r.chosenCalendar,
        incomeAction: r.chosenIncome,
        ...(r.chosenEventId ? { eventId: String(r.chosenEventId) } : {}),
      }));
      const d = await billingApi.reconcileCommit({
        clientId,
        rows: commitRows,
        options,
        idempotencyKey,
      });
      if (d?.error) {
        // Partial commit still returns a batchId so undo works.
        if (d.batchId) setResult({ ...d, partial: true });
        throw new Error(d.error);
      }
      setResult(d);
      setStep("done");
    } catch (e) {
      setError(e.message || "Commit failed.");
      if (result?.partial) setStep("done");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!result?.batchId) return;
    setUndoing(true);
    setError("");
    try {
      const d = await billingApi.reconcileUndo({ batchId: result.batchId });
      if (d?.error) throw new Error(d.error);
      setUndone(d);
    } catch (e) {
      setError(e.message || "Undo failed.");
    } finally {
      setUndoing(false);
    }
  };

  const resetAll = () => {
    setStep("import");
    setPreview(null);
    setOverrides({});
    setResult(null);
    setUndone(null);
    setError("");
    setIdempotencyKey(newIdempotencyKey());
  };

  const previewGridDirty = false; // per-row edits are sent on commit; server re-validates

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Typography variant="h4">Import Sessions</Typography>
        <Typography variant="body2" color="text.secondary">
          Paste a session sheet, review how it reconciles against the calendar and invoices, then
          apply it in one undoable step.
        </Typography>
      </Grid>

      {/* Client */}
      <Grid size={12}>
        <Card variant="outlined">
          <CardContent>
            <Autocomplete
              size="small"
              sx={{ maxWidth: 360 }}
              options={clients.filter((c) => c.accepted)}
              getOptionLabel={(o) => `${o.client?.firstName || ""} ${o.client?.lastName || ""}`.trim()}
              isOptionEqualToValue={(o, v) => o.client?._id === v.client?._id}
              value={selectedClientRel}
              onChange={(_, v) => {
                setClientId(v ? v.client._id : "");
                resetAll();
              }}
              renderInput={(params) => (
                <TextField {...params} label="Client" placeholder="Choose a client" />
              )}
            />
          </CardContent>
        </Card>
      </Grid>

      {error && (
        <Grid size={12}>
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        </Grid>
      )}

      {/* ---------------- STEP 1: IMPORT ---------------- */}
      {clientId && step === "import" && (
        <>
          <Grid size={12}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">1 · Paste from your spreadsheet</Typography>
                  <TextField
                    multiline
                    minRows={5}
                    maxRows={14}
                    placeholder={"Copy the cells straight from Excel / Google Sheets, e.g.\n1/9/2026\t$60\tCashapp\n1/16/2026\t$60\tCashapp"}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Button variant="contained" onClick={parsePaste} disabled={!pasteText.trim()}>
                      Parse
                    </Button>
                    {anyYearless && (
                      <TextField
                        select
                        size="small"
                        label="Year for dates like 1/9"
                        value={fallbackYear}
                        onChange={(e) => setFallbackYear(e.target.value)}
                        sx={{ width: 180 }}
                      >
                        {[0, 1, 2].map((back) => {
                          const y = String(dayjs().year() - back);
                          return (
                            <MenuItem key={y} value={y}>
                              {y}
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    )}
                    {matrix.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {matrix.length} pasted line{matrix.length === 1 ? "" : "s"} → {rows.length}{" "}
                        session{rows.length === 1 ? "" : "s"}
                        {parsedResult.deduped > 0 && ` · ${parsedResult.deduped} duplicate date(s) merged`}
                        {parsedResult.skipped.length > 0 && ` · ${parsedResult.skipped.length} line(s) skipped`}
                      </Typography>
                    )}
                  </Stack>

                  {matrix.length > 0 && (
                    <>
                      <Divider />
                      <Typography variant="subtitle2">Columns</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {roles.map((role, i) => (
                          <TextField
                            key={i}
                            select
                            size="small"
                            label={`Column ${i + 1}`}
                            helperText={(matrix.find((r) => r[i]) || [])[i] || ""}
                            value={role}
                            onChange={(e) => {
                              const next = [...roles];
                              next[i] = e.target.value;
                              setRoles(next);
                            }}
                            sx={{ width: 170 }}
                          >
                            {COLUMN_ROLES.map((r) => (
                              <MenuItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </MenuItem>
                            ))}
                          </TextField>
                        ))}
                      </Stack>
                      {!hasDateRole && (
                        <Alert severity="warning">
                          No column is assigned as the session date — pick one above.
                        </Alert>
                      )}

                      {rows.length > 0 && (
                        <Box sx={{ overflowX: "auto" }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Price</TableCell>
                                <TableCell>Method</TableCell>
                                <TableCell>Paid on</TableCell>
                                <TableCell />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rows.map((r) => (
                                <TableRow key={r.date}>
                                  <TableCell>{dayjs(r.date).format("ddd, MMM D, YYYY")}</TableCell>
                                  <TableCell>{r.price !== undefined ? `$${r.price}` : "—"}</TableCell>
                                  <TableCell>{r.method || "—"}</TableCell>
                                  <TableCell>
                                    {r.paymentDate ? dayjs(r.paymentDate).format("MMM D, YYYY") : "—"}
                                  </TableCell>
                                  <TableCell align="right">
                                    <IconButton
                                      size="small"
                                      aria-label={`Remove ${r.date}`}
                                      onClick={() =>
                                        setRemovedDates((prev) => new Set([...prev, r.date]))
                                      }
                                    >
                                      <CloseIcon fontSize="inherit" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {rows.length > 0 && (
            <Grid size={12}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">2 · Defaults</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
                      <TextField
                        select
                        size="small"
                        label="Session type"
                        value={sessionTypeId}
                        onChange={(e) => setSessionTypeId(e.target.value)}
                        sx={{ width: 230 }}
                      >
                        <MenuItem value="">(none)</MenuItem>
                        {sessionTypes.map((s) => (
                          <MenuItem key={s._id} value={s._id}>
                            {s.name} — ${s.defaultPrice}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        type="number"
                        label="Default price"
                        helperText="Used when a row has no price"
                        value={defaultPrice}
                        onChange={(e) => {
                          priceEditedRef.current = e.target.value !== "";
                          setDefaultPrice(e.target.value);
                        }}
                        sx={{ width: 150 }}
                        slotProps={{ htmlInput: { min: 0 } }}
                      />
                      <TextField
                        size="small"
                        type="time"
                        label="Default time"
                        helperText="Blank = their usual slot"
                        value={defaultTime}
                        onChange={(e) => setDefaultTime(e.target.value)}
                        sx={{ width: 170 }}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <TextField
                        size="small"
                        label="Payment method"
                        helperText="Used when a row has none"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        sx={{ width: 170 }}
                      />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={paymentMode}
                        onChange={(_, v) => v && setPaymentMode(v)}
                      >
                        <ToggleButton value="perSession" sx={{ px: 1.5 }}>
                          Paid per session
                        </ToggleButton>
                        <ToggleButton value="batch" sx={{ px: 1.5 }}>
                          Paid in blocks
                        </ToggleButton>
                        <ToggleButton value="unpaid" sx={{ px: 1.5 }}>
                          Unpaid (owed)
                        </ToggleButton>
                      </ToggleButtonGroup>
                      {paymentMode === "batch" && (
                        <TextField
                          size="small"
                          type="date"
                          label="Payment date (rows without one)"
                          value={batchPaymentDate}
                          onChange={(e) => setBatchPaymentDate(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                          sx={{ width: 230 }}
                        />
                      )}
                    </Stack>
                    {paymentMode === "batch" && (
                      <Typography variant="caption" color="text.secondary">
                        Blocks: rows sharing a “Paid on” date become one invoice paid that day.
                      </Typography>
                    )}
                    <TextField
                      size="small"
                      label="Notes (on the invoices)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <Box>
                      <Button
                        variant="contained"
                        disabled={busy || !hasDateRole || !rows.length}
                        onClick={runPreview}
                      >
                        {busy ? <CircularProgress size={22} /> : `Preview reconciliation (${rows.length})`}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}
        </>
      )}

      {/* ---------------- STEP 2: PREVIEW ---------------- */}
      {clientId && step === "preview" && preview && (
        <Grid size={12}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h6">3 · Review the plan — {clientName}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => setStep("import")}>
                      Back
                    </Button>
                    <Button size="small" onClick={runPreview} disabled={busy}>
                      Refresh preview
                    </Button>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" color="primary" variant="outlined" label={`Create ${planSummary.create}`} />
                  <Chip size="small" color="primary" variant="outlined" label={`Complete ${planSummary.complete}`} />
                  <Chip size="small" color="success" variant="outlined" label={`Existing ${planSummary.existing}`} />
                  <Chip size="small" variant="outlined" label={`No change ${planSummary.skip}`} />
                  <Chip
                    size="small"
                    color="success"
                    label={`Income: ${planSummary.log} session${planSummary.log === 1 ? "" : "s"} · $${planSummary.incomeTotal.toFixed(2)}`}
                  />
                </Stack>
                {preview.usualSample > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    New sessions default to {fmt12(preview.usualTime)} ({clientName}’s usual slot) ·
                    times in {preview.tz}
                  </Typography>
                )}

                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Calendar</TableCell>
                        <TableCell>Income</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {planRows.map((r) => {
                        const calMeta = CAL_META[r.chosenCalendar] || CAL_META.SKIP;
                        const lockedIncome =
                          r.incomeAction === "SKIP_ALREADY_LOGGED" ||
                          r.incomeAction === "SKIP_ALREADY_INVOICED";
                        const incomeMeta =
                          INCOME_META[
                            r.chosenIncome === "LOG"
                              ? "LOG"
                              : lockedIncome || r.incomeAction === "SKIP_CREDIT_CHARGED"
                                ? r.incomeAction
                                : "SKIP"
                          ];
                        return (
                          <TableRow key={r.date} hover>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>
                              {dayjs(r.date).format("ddd, MMM D, YYYY")}
                            </TableCell>
                            <TableCell>
                              {r.chosenCalendar === "CREATE" ? (
                                <TextField
                                  size="small"
                                  type="time"
                                  value={r.editedTime || ""}
                                  onChange={(e) => setOverride(r.date, { time: e.target.value })}
                                  sx={{ width: 125 }}
                                />
                              ) : (
                                <Typography variant="body2">
                                  {r.eventId && r.candidates === undefined
                                    ? fmt12(r.time)
                                    : r.chosenCalendar === "NONE"
                                      ? "—"
                                      : fmt12(r.editedTime)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={r.editedPrice ?? ""}
                                onChange={(e) => setOverride(r.date, { price: e.target.value })}
                                sx={{ width: 90 }}
                                slotProps={{ htmlInput: { min: 0 } }}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 190 }}>
                              {r.calendarAction === "AMBIGUOUS" ? (
                                <TextField
                                  select
                                  size="small"
                                  value={
                                    r.chosenEventId && r.chosenCalendar !== "SKIP"
                                      ? `${r.chosenCalendar}:${r.chosenEventId}`
                                      : "SKIP"
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "SKIP") {
                                      setOverride(r.date, { calendarAction: "SKIP", eventId: null });
                                    } else {
                                      const [action, id] = v.split(":");
                                      setOverride(r.date, { calendarAction: action, eventId: id });
                                    }
                                  }}
                                  sx={{ width: 220 }}
                                >
                                  <MenuItem value="SKIP">Skip — don’t touch calendar</MenuItem>
                                  {(r.candidates || []).map((c) => (
                                    <MenuItem
                                      key={c.eventId}
                                      value={`${c.status === "COMPLETED" ? "USE_EXISTING" : "COMPLETE"}:${c.eventId}`}
                                    >
                                      {c.status === "COMPLETED"
                                        ? `Use ${fmt12(c.time)} (completed)`
                                        : `Complete ${fmt12(c.time)} (${c.status.toLowerCase()})`}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              ) : (
                                <Chip size="small" color={calMeta.color} variant="outlined" label={calMeta.label} />
                              )}
                            </TableCell>
                            <TableCell sx={{ minWidth: 170 }}>
                              {lockedIncome ? (
                                <Tooltip
                                  title={
                                    r.existingInvoice
                                      ? `Invoice ${r.existingInvoice.invoiceNumber}`
                                      : "Logged in a previous run"
                                  }
                                >
                                  <Chip size="small" variant="outlined" label={incomeMeta.label} />
                                </Tooltip>
                              ) : (
                                <TextField
                                  select
                                  size="small"
                                  value={r.chosenIncome}
                                  onChange={(e) => setOverride(r.date, { incomeAction: e.target.value })}
                                  sx={{ width: 165 }}
                                >
                                  <MenuItem value="LOG">Log income</MenuItem>
                                  <MenuItem value="SKIP">
                                    {r.incomeAction === "SKIP_CREDIT_CHARGED" ? "Skip (paid by credits)" : "Skip"}
                                  </MenuItem>
                                </TextField>
                              )}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {(r.warnings || [])
                                  .filter((w) => WARNING_TEXT[w])
                                  .map((w) => (
                                    <Tooltip key={w} title={WARNING_TEXT[w]}>
                                      <Chip
                                        size="small"
                                        color={w === "CREDIT_CHARGED" || w === "MULTIPLE_APPTS" ? "warning" : "default"}
                                        variant="outlined"
                                        label={w.replaceAll("_", " ").toLowerCase()}
                                      />
                                    </Tooltip>
                                  ))}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>

                <Alert severity="info">
                  Applying will {planSummary.create ? `create ${planSummary.create} completed session(s), ` : ""}
                  {planSummary.complete ? `mark ${planSummary.complete} booked session(s) completed, ` : ""}
                  log ${planSummary.incomeTotal.toFixed(2)} of income for your records — and it will{" "}
                  <strong>not</strong> charge or notify {clientName || "the client"}. One click undoes
                  the whole run.
                </Alert>
                <Box>
                  <Button variant="contained" onClick={commit} disabled={busy || previewGridDirty}>
                    {busy ? <CircularProgress size={22} /> : "Apply"}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* ---------------- STEP 3: DONE ---------------- */}
      {clientId && step === "done" && result && (
        <Grid size={12}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">
                  {result.partial ? "Partially applied" : undone ? "Undone" : "Applied"} — {clientName}
                </Typography>
                {result.partial && (
                  <Alert severity="warning">
                    The run stopped partway. Everything applied so far is recorded — Undo below
                    reverts it.
                  </Alert>
                )}
                {undone ? (
                  <Alert severity="success">
                    Undo complete: {undone.invoicesDeleted} invoice(s) deleted, {undone.eventsDeleted}{" "}
                    created session(s) removed, {undone.statusesRestored} status(es) restored.
                    {undone.keptEventIds?.length
                      ? ` ${undone.keptEventIds.length} created session(s) kept because a workout is attached.`
                      : ""}
                  </Alert>
                ) : (
                  <>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`Sessions created: ${result.summary?.created ?? 0}`} />
                      <Chip size="small" label={`Marked completed: ${result.summary?.completed ?? 0}`} />
                      <Chip size="small" label={`Invoices: ${result.summary?.invoiceCount ?? 0}`} />
                      <Chip
                        size="small"
                        color="success"
                        label={`Income logged: $${Number(result.summary?.incomeTotal || 0).toFixed(2)}`}
                      />
                    </Stack>
                    {(result.summary?.conflicts || []).length > 0 && (
                      <Alert severity="warning">
                        {result.summary.conflicts.length} row(s) skipped because the calendar or
                        billing changed since preview:{" "}
                        {result.summary.conflicts
                          .map((c) => `${dayjs(c.date).format("MMM D")} (${String(c.reason).replaceAll("_", " ").toLowerCase()})`)
                          .join(", ")}
                      </Alert>
                    )}
                  </>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {!undone && (
                    <Button color="error" variant="outlined" onClick={undo} disabled={undoing}>
                      {undoing ? <CircularProgress size={20} /> : "Undo this run"}
                    </Button>
                  )}
                  <Button component={RouterLink} to={`/session-history?client=${clientId}`}>
                    View Session History
                  </Button>
                  <Button component={RouterLink} to={`/invoices?client=${clientId}`}>
                    View Invoices
                  </Button>
                  <Button onClick={resetAll}>Import more</Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
