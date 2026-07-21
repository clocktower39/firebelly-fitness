import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { billingApi } from "../api/billingApi";
import { scheduleApi } from "../api/scheduleApi";

const WEEKDAYS = [
  { label: "Sun", v: 0 },
  { label: "Mon", v: 1 },
  { label: "Tue", v: 2 },
  { label: "Wed", v: 3 },
  { label: "Thu", v: 4 },
  { label: "Fri", v: 5 },
  { label: "Sat", v: 6 },
];

// Bulk-record past sessions for a client as income (backdating), so year-end invoices are complete.
export default function LogSessionsDialog({ open, onClose, clientId, clientName, onLogged }) {
  const [sessionTypes, setSessionTypes] = useState([]);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [price, setPrice] = useState("");
  const [dates, setDates] = useState([]); // ["YYYY-MM-DD"]
  const [oneDate, setOneDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [weekdays, setWeekdays] = useState([]);
  const [payMode, setPayMode] = useState("batch"); // batch | perSession | unpaid
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    if (!open) return;
    scheduleApi
      .getSessionTypes()
      .then((d) => setSessionTypes(d?.sessionTypes || []))
      .catch(() => setSessionTypes([]));
  }, [open]);

  // Selecting a session type fills in its default price — but never over a price the
  // trainer already typed (e.g. a grandfathered rate entered before picking the type).
  const priceEditedRef = useRef(false);
  useEffect(() => {
    const t = sessionTypes.find((s) => s._id === sessionTypeId);
    if (t && !priceEditedRef.current) setPrice(String(t.defaultPrice ?? ""));
  }, [sessionTypeId, sessionTypes]);

  const priceNum = Math.max(0, Number(price) || 0);
  const total = priceNum * dates.length;

  const addOne = () => {
    if (!oneDate) return;
    setDates((prev) => (prev.includes(oneDate) ? prev : [...prev, oneDate].sort()));
    setOneDate("");
  };

  const addRange = () => {
    if (!rangeStart || !rangeEnd || !weekdays.length) return;
    const out = new Set(dates);
    let cur = dayjs(rangeStart);
    const end = dayjs(rangeEnd);
    let guard = 0;
    while ((cur.isSame(end, "day") || cur.isBefore(end)) && guard < 1000) {
      if (weekdays.includes(cur.day())) out.add(cur.format("YYYY-MM-DD"));
      cur = cur.add(1, "day");
      guard += 1;
    }
    setDates([...out].sort());
  };

  const removeDate = (d) => setDates((prev) => prev.filter((x) => x !== d));

  const reset = () => {
    priceEditedRef.current = false;
    setSessionTypeId("");
    setPrice("");
    setDates([]);
    setOneDate("");
    setRangeStart("");
    setRangeEnd("");
    setWeekdays([]);
    setPayMode("batch");
    setPaymentDate("");
    setMethod("");
    setNotes("");
    setError("");
    setResult(null);
    setConfirming(false);
    setChecking(false);
    setDuplicates([]);
    setUndoing(false);
    setUndone(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  // Step 1: from the form, check for already-logged dates, then show the confirmation summary.
  const review = async () => {
    setError("");
    if (!dates.length) {
      setError("Add at least one session date.");
      return;
    }
    setChecking(true);
    const res = await billingApi.checkLoggedDates({ clientId, dates });
    setChecking(false);
    setDuplicates(res && !res.error ? res.duplicates || [] : []);
    setConfirming(true);
  };

  // Step 2: actually create the records.
  const submit = async () => {
    setError("");
    if (!dates.length) {
      setError("Add at least one session date.");
      return;
    }
    setSubmitting(true);
    const data = await billingApi.logSessions({
      clientId,
      sessionTypeId: sessionTypeId || null,
      unitPrice: priceNum,
      dates,
      paid: payMode !== "unpaid",
      paymentMode: payMode === "perSession" ? "perSession" : "batch",
      ...(payMode === "batch" ? { paymentDate: paymentDate || dates[dates.length - 1] } : {}),
      method,
      notes,
    });
    setSubmitting(false);
    if (!data || data.error) {
      setError(data?.error || "Something went wrong logging the sessions.");
      return;
    }
    setConfirming(false);
    setResult(data);
    if (onLogged) onLogged(data);
  };

  // Reverse the whole run (one batch id) — for a fat-fingered client/count/price.
  const undo = async () => {
    if (!result?.batchId || undone) return;
    setUndoing(true);
    const res = await billingApi.undoLoggedSessions({ batchId: result.batchId });
    setUndoing(false);
    if (res && !res.error) {
      setUndone(true);
      if (onLogged) onLogged(res);
    } else {
      setError(res?.error || "Couldn't undo. Remove the invoices manually if needed.");
    }
  };

  const paymentSummary = () => {
    if (payMode === "unpaid") return "Recorded as unpaid (owed).";
    if (payMode === "perSession") return "Paid — one invoice per session, dated to each session.";
    const d = paymentDate || dates[dates.length - 1];
    return `Paid — one payment on ${d ? dayjs(d).format("MMM D, YYYY") : "the last session date"}.`;
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : close} maxWidth="sm" fullWidth>
      <DialogTitle>Log sessions{clientName ? ` — ${clientName}` : ""}</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={1.5} sx={{ my: 1 }}>
            {undone ? (
              <Alert severity="info">
                Undone — those {result.sessionsLogged} record{result.sessionsLogged === 1 ? "" : "s"} were
                removed. Nothing was logged.
              </Alert>
            ) : (
              <Alert severity="success">
                Logged {result.sessionsLogged} session{result.sessionsLogged === 1 ? "" : "s"} ($
                {Number(result.totalAmount).toFixed(2)}) across {result.invoiceCount} invoice
                {result.invoiceCount === 1 ? "" : "s"}. Your year-end report is updated.
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : confirming ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              This records income for <strong>your</strong> reports. It does <strong>not</strong> charge{" "}
              {clientName || "the client"} and does not touch their session credits.
            </Alert>
            <Box>
              <Typography variant="body1">
                Log <strong>{dates.length}</strong> session{dates.length === 1 ? "" : "s"} for{" "}
                <strong>{clientName || "this client"}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dayjs(dates[0]).format("MMM D, YYYY")}
                {dates.length > 1 ? ` – ${dayjs(dates[dates.length - 1]).format("MMM D, YYYY")}` : ""} · $
                {priceNum.toFixed(2)}/session · <strong>${total.toFixed(2)}</strong> total
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {paymentSummary()}
              </Typography>
            </Box>
            {duplicates.length > 0 && (
              <Alert severity="warning">
                {duplicates.length} of these date{duplicates.length === 1 ? " was" : "s were"} already logged
                for {clientName || "this client"} and will be recorded again if you continue:{" "}
                {duplicates.map((d) => dayjs(d).format("MMM D")).join(", ")}.
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                select
                label="Session type"
                value={sessionTypeId}
                onChange={(e) => setSessionTypeId(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              >
                <MenuItem value="">Custom (no type)</MenuItem>
                {sessionTypes.map((s) => (
                  <MenuItem key={s._id} value={s._id}>
                    {s.name} — ${s.defaultPrice}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Price / session"
                type="number"
                value={price}
                onChange={(e) => {
                  priceEditedRef.current = e.target.value !== "";
                  setPrice(e.target.value);
                }}
                size="small"
                sx={{ width: { xs: "100%", sm: 150 } }}
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Stack>

            <Box>
              <Typography variant="subtitle2">Session dates</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                <TextField
                  type="date"
                  label="Add a date"
                  value={oneDate}
                  onChange={(e) => setOneDate(e.target.value)}
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button onClick={addOne} disabled={!oneDate}>
                  Add
                </Button>
              </Stack>

              <Box sx={{ mt: 1, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Or fill a recurring schedule:
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 0.5 }}>
                  <TextField
                    type="date"
                    label="From"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="date"
                    label="To"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <ToggleButtonGroup
                  value={weekdays}
                  onChange={(e, v) => setWeekdays(v)}
                  size="small"
                  sx={{ mt: 1, flexWrap: "wrap" }}
                >
                  {WEEKDAYS.map((w) => (
                    <ToggleButton key={w.v} value={w.v} sx={{ px: 1 }}>
                      {w.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Button
                  size="small"
                  onClick={addRange}
                  disabled={!rangeStart || !rangeEnd || !weekdays.length}
                  sx={{ display: "block", mt: 1 }}
                >
                  Add matching dates
                </Button>
              </Box>

              {dates.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      {dates.length} session{dates.length === 1 ? "" : "s"} selected
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ${total.toFixed(2)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5, maxHeight: 120, overflowY: "auto" }}
                  >
                    {dates.map((d) => (
                      <Chip key={d} size="small" label={dayjs(d).format("MMM D, YY")} onDelete={() => removeDate(d)} />
                    ))}
                  </Box>
                  <Button size="small" color="error" onClick={() => setDates([])}>
                    Clear all
                  </Button>
                </Box>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2">Payment</Typography>
              <RadioGroup value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <FormControlLabel
                  value="batch"
                  control={<Radio size="small" />}
                  label="Paid — one payment on a date (e.g. bought a block of sessions)"
                />
                <FormControlLabel
                  value="perSession"
                  control={<Radio size="small" />}
                  label="Paid — each session on its own day"
                />
                <FormControlLabel value="unpaid" control={<Radio size="small" />} label="Unpaid (owed)" />
              </RadioGroup>
              {payMode === "batch" && (
                <TextField
                  type="date"
                  label="Payment date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="The day they paid. Defaults to the last session date."
                />
              )}
              {payMode !== "unpaid" && (
                <TextField
                  label="Payment method (optional)"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                  placeholder="cash, venmo, card…"
                />
              )}
            </Box>

            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={1}
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <>
            {!undone && (
              <Button color="error" onClick={undo} disabled={undoing || !result.batchId}>
                {undoing ? "Undoing…" : "Undo"}
              </Button>
            )}
            <Button variant="contained" onClick={close}>
              Done
            </Button>
          </>
        ) : confirming ? (
          <>
            <Button onClick={() => setConfirming(false)} disabled={submitting}>
              Back
            </Button>
            <Button variant="contained" onClick={submit} disabled={submitting}>
              {submitting
                ? "Logging…"
                : `Confirm & log ${dates.length} session${dates.length === 1 ? "" : "s"}`}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" onClick={review} disabled={checking || !dates.length}>
              {checking ? "Checking…" : `Review ${dates.length || ""} session${dates.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
