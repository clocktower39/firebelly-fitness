import React, { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Stack, Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { billingApi } from "../api/billingApi";
import { formatPrice } from "../utils/currency";

// Does each client's session-credit balance match reality?
//
// The ledger drifts silently: "Log sessions" creates BACKFILL invoices that never grant
// credits, while every completed session still debits one. Sell a package that way and the
// balance sinks a little further each week until a booking is refused — months after the
// mistake. This shows billed vs taken vs what the ledger believes, so the gap is visible.
const BillingReconciliationDialog = ({ open, onClose }) => {
  const [rows, setRows] = useState(null);
  const [totals, setTotals] = useState(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setRows(null);
    setError("");
    setDetail(null);
    setDetailFor(null);
    (async () => {
      const data = await billingApi.reconciliation();
      if (cancelled) return;
      if (data?.error) { setError(data.error); setRows([]); return; }
      setRows(data.rows || []);
      setTotals(data.totals || null);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const openDetail = async (row) => {
    setDetailFor(row);
    setLoadingDetail(true);
    const data = await billingApi.clientSessionLedger({ clientId: row.clientId });
    setLoadingDetail(false);
    if (data?.error) { setError(data.error); return; }
    setDetail(data);
  };

  const driftChip = (drift) => {
    if (drift === 0) return <Chip size="small" color="success" label="matches" />;
    return (
      <Chip
        size="small"
        color={Math.abs(drift) >= 10 ? "error" : "warning"}
        label={`${drift > 0 ? "+" : ""}${drift}`}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Session balance check</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!detailFor && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <strong>Expected</strong> is what each client should have left — sessions billed
              minus sessions taken. <strong>Drift</strong> is how far the credit ledger is from
              that. Drift usually means a package was sold through "Log sessions", which records
              income but never grants session credits.
            </Typography>

            {totals && (
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
                <Chip size="small" label={`${totals.clients} clients`} />
                <Chip size="small" color={totals.drifted ? "warning" : "success"} label={`${totals.drifted} drifted`} />
                <Chip size="small" color={totals.negativeBalance ? "error" : "success"} label={`${totals.negativeBalance} negative balance`} />
              </Stack>
            )}

            {rows === null ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 3 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Checking every client…</Typography>
              </Stack>
            ) : rows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No billing history yet.</Typography>
            ) : (
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} sx={{ px: 1 }}>
                  <Typography variant="caption" sx={{ flex: 1 }}>Client</Typography>
                  <Typography variant="caption" sx={{ width: 60, textAlign: "right" }}>Billed</Typography>
                  <Typography variant="caption" sx={{ width: 60, textAlign: "right" }}>Taken</Typography>
                  <Typography variant="caption" sx={{ width: 70, textAlign: "right" }}>Expected</Typography>
                  <Typography variant="caption" sx={{ width: 60, textAlign: "right" }}>Ledger</Typography>
                  <Typography variant="caption" sx={{ width: 80, textAlign: "right" }}>Drift</Typography>
                </Stack>
                <Divider />
                {rows.map((r) => (
                  <Stack
                    key={r.clientId}
                    direction="row"
                    spacing={1}
                    onClick={() => openDetail(r)}
                    sx={{
                      alignItems: "center", px: 1, py: 0.75, borderRadius: 1, cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{r.clientName}</Typography>
                      {r.backfillCount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {r.backfillCount} of {r.invoiceCount} invoices are backfill
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ width: 60, textAlign: "right" }}>{r.billed}</Typography>
                    <Typography variant="body2" sx={{ width: 60, textAlign: "right" }}>{r.completed}</Typography>
                    <Typography variant="body2" sx={{ width: 70, textAlign: "right" }}>{r.expected}</Typography>
                    <Typography
                      variant="body2"
                      sx={{ width: 60, textAlign: "right", color: r.ledgerBalance < 0 ? "error.main" : "text.primary" }}
                    >
                      {r.ledgerBalance}
                    </Typography>
                    <Box sx={{ width: 80, textAlign: "right" }}>{driftChip(r.drift)}</Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </>
        )}

        {detailFor && (
          <>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <Button size="small" onClick={() => { setDetailFor(null); setDetail(null); }}>← All clients</Button>
              <Typography variant="subtitle1">{detailFor.clientName}</Typography>
            </Stack>
            {loadingDetail || !detail ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 3 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Loading sessions…</Typography>
              </Stack>
            ) : (
              <>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                  <Chip size="small" label={`${detail.sessions.length} sessions`} />
                  <Chip size="small" color={detail.unlinked ? "warning" : "success"}
                        label={`${detail.unlinked} completed with no invoice`} />
                  <Chip size="small" label={`ledger ${detail.summary.ledgerBalance}, expected ${detail.summary.expected}`} />
                </Stack>
                <Stack spacing={0.25}>
                  {detail.sessions.map((s) => (
                    <Stack
                      key={s.eventId}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", px: 1, py: 0.5, borderRadius: 1,
                            bgcolor: !s.invoiceNumber && s.status === "COMPLETED" ? "warning.light" : "transparent" }}
                    >
                      <Typography variant="body2" sx={{ width: 96 }}>
                        {s.date ? dayjs(s.date).format("MMM D, YYYY") : "—"}
                      </Typography>
                      <Typography variant="caption" sx={{ width: 84 }}>{s.status}</Typography>
                      <Typography variant="caption" sx={{ width: 90 }}>{s.billingStatus}</Typography>
                      <Typography variant="caption" sx={{ width: 60, textAlign: "right" }}>
                        {s.price != null ? formatPrice(s.price, "USD") : "—"}
                      </Typography>
                      <Typography variant="caption" sx={{ flex: 1, textAlign: "right" }} noWrap>
                        {s.invoiceNumber
                          ? `${s.invoiceNumber}${s.invoiceSource === "BACKFILL" ? " (backfill)" : ""}`
                          : s.status === "COMPLETED" ? "no invoice" : ""}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillingReconciliationDialog;
