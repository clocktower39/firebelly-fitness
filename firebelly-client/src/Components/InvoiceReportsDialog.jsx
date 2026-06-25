import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { billingApi } from "../api/billingApi";
import { formatPrice } from "../utils/currency";

const csvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildCsv = (columns, rows) => {
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(",")).join("\n");
  return `${header}\n${body}`;
};

const downloadCsv = (filename, text) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const fmtDate = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "");

const INVOICE_COLUMNS = [
  { label: "Invoice #", get: (r) => r.invoiceNumber },
  { label: "Status", get: (r) => r.status },
  { label: "Client", get: (r) => r.billToName },
  { label: "Issued", get: (r) => fmtDate(r.issuedAt) },
  { label: "Due", get: (r) => fmtDate(r.dueAt) },
  { label: "Paid", get: (r) => fmtDate(r.paidAt) },
  { label: "Currency", get: (r) => r.currency },
  { label: "Subtotal", get: (r) => Number(r.subtotal || 0).toFixed(2) },
  { label: "Tax", get: (r) => Number(r.tax || 0).toFixed(2) },
  { label: "Discount", get: (r) => Number(r.discount || 0).toFixed(2) },
  { label: "Total", get: (r) => Number(r.total || 0).toFixed(2) },
  { label: "Amount Paid", get: (r) => Number(r.amountPaid || 0).toFixed(2) },
  { label: "Balance Due", get: (r) => Number(r.balanceDue || 0).toFixed(2) },
];

const PAYMENT_COLUMNS = [
  { label: "Date", get: (r) => fmtDate(r.paidAt) },
  { label: "Invoice #", get: (r) => r.invoiceNumber },
  { label: "Client", get: (r) => r.billToName },
  { label: "Type", get: (r) => r.type },
  { label: "Method", get: (r) => r.method },
  { label: "Processor", get: (r) => r.processor },
  { label: "Reference", get: (r) => r.reference },
  { label: "Amount", get: (r) => Number(r.amount || 0).toFixed(2) },
  { label: "Currency", get: (r) => r.currency },
];

const StatCard = ({ label, value, color }) => (
  <Grid size={{ xs: 6, sm: 4 }}>
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" color={color || "text.primary"}>
        {value}
      </Typography>
    </Box>
  </Grid>
);

export default function InvoiceReportsDialog({ open, onClose }) {
  const [from, setFrom] = useState(dayjs().startOf("year").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("year").format("YYYY-MM-DD"));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await billingApi.invoiceReport({ from, to });
      if (data?.error) {
        setErr(data.error);
        setReport(null);
      } else {
        setReport(data);
      }
    } catch (e) {
      setErr(e.message || "Unable to load report.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const setRange = (start, end) => {
    setFrom(start.format("YYYY-MM-DD"));
    setTo(end.format("YYYY-MM-DD"));
  };

  const s = report?.summary;
  // The summary sums across whatever currencies exist; rows carry per-row currency.
  const money = (v) => formatPrice(v || 0, "USD");
  const rangeLabel = `${from}_to_${to}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reports &amp; export</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip
              label="This year"
              size="small"
              onClick={() => setRange(dayjs().startOf("year"), dayjs().endOf("year"))}
            />
            <Chip
              label="Last year"
              size="small"
              onClick={() =>
                setRange(
                  dayjs().subtract(1, "year").startOf("year"),
                  dayjs().subtract(1, "year").endOf("year")
                )
              }
            />
            <Chip
              label="This quarter"
              size="small"
              onClick={() => setRange(dayjs().startOf("quarter"), dayjs().endOf("quarter"))}
            />
            <Chip
              label="This month"
              size="small"
              onClick={() => setRange(dayjs().startOf("month"), dayjs().endOf("month"))}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>

          {err && (
            <Typography variant="body2" color="error">
              {err}
            </Typography>
          )}

          {loading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : s ? (
            <>
              <Grid container spacing={1}>
                <StatCard label="Collected" value={money(s.collected)} color="success.main" />
                <StatCard label="Outstanding" value={money(s.outstanding)} />
                <StatCard label="Overdue" value={money(s.overdue)} color="warning.main" />
                <StatCard label="Invoiced" value={money(s.invoiced)} />
                <StatCard label="Tax billed" value={money(s.tax)} />
                <StatCard label="Refunded" value={money(s.refunded)} />
              </Grid>
              <Typography variant="caption" color="text.secondary">
                Collected = payments received in range (minus refunds), cash basis.
                Outstanding/overdue are current balances. {s.invoiceCount} invoice
                {s.invoiceCount === 1 ? "" : "s"} issued in range.
              </Typography>

              <Divider />
              <Typography variant="subtitle2">Export (CSV)</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={!report.invoiceRows?.length}
                  onClick={() =>
                    downloadCsv(
                      `invoices_${rangeLabel}.csv`,
                      buildCsv(INVOICE_COLUMNS, report.invoiceRows)
                    )
                  }
                >
                  Invoices ({report.invoiceRows?.length || 0})
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={!report.paymentRows?.length}
                  onClick={() =>
                    downloadCsv(
                      `payments_${rangeLabel}.csv`,
                      buildCsv(PAYMENT_COLUMNS, report.paymentRows)
                    )
                  }
                >
                  Payments ({report.paymentRows?.length || 0})
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Both import into QuickBooks / Wave / Xero. Payments = your cash-received
                ledger for taxes; Invoices = per-invoice totals and tax.
              </Typography>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
