import React, { useEffect, useMemo, useState } from "react";
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
  Link,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { scheduleApi } from "../../api/scheduleApi";
import { billingApi } from "../../api/billingApi";
import { buildCsv, downloadCsv } from "../../utils/csv";
import { requestClients } from "../../Redux/actions";

// Trainer report: pick a client + a date range and list every session (appointment) they've
// had in that window, tagged by status. Read-only — reads the schedule range API. See the
// Session History memo/notes; the calendar (/sessions) is the grid view, this is the list.

const PRESETS = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

// COMPLETED = happened; BOOKED/REQUESTED = still ahead; CANCELLED = called off.
const STATUS_META = {
  COMPLETED: { label: "Completed", color: "success", group: "completed" },
  BOOKED: { label: "Upcoming", color: "info", group: "upcoming" },
  REQUESTED: { label: "Requested", color: "warning", group: "upcoming" },
  CANCELLED: { label: "Cancelled", color: "default", group: "cancelled" },
};

export default function SessionHistory() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);

  const [clientId, setClientId] = useState("");
  const [preset, setPreset] = useState("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [events, setEvents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const highlightEventId = searchParams.get("event");

  useEffect(() => {
    dispatch(requestClients());
    scheduleApi
      .getSessionTypes()
      .then((d) => setSessionTypes(d?.sessionTypes || []))
      .catch(() => setSessionTypes([]));
  }, [dispatch]);

  // Deep-link from the Clients menu: /session-history?client=<id>
  useEffect(() => {
    const c = searchParams.get("client");
    if (c) setClientId(c);
  }, [searchParams]);

  // Deep-link from an invoice line (?date=): widen the range to that session's year so the
  // highlighted session is actually in view even if it isn't in the current year.
  const dateParam = searchParams.get("date");
  useEffect(() => {
    if (!dateParam) return;
    const d = dayjs(dateParam);
    if (!d.isValid()) return;
    setPreset("custom");
    setCustomFrom(d.startOf("year").format("YYYY-MM-DD"));
    setCustomTo(d.endOf("year").format("YYYY-MM-DD"));
  }, [dateParam]);

  const range = useMemo(() => {
    const now = dayjs();
    let start;
    let end;
    if (preset === "week") {
      start = now.startOf("week");
      end = now.endOf("week");
    } else if (preset === "month") {
      start = now.startOf("month");
      end = now.endOf("month");
    } else if (preset === "year") {
      start = now.startOf("year");
      end = now.endOf("year");
    } else {
      start = customFrom ? dayjs(customFrom).startOf("day") : now.startOf("year");
      end = customTo ? dayjs(customTo).endOf("day") : now.endOf("day");
    }
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      label: `${start.format("MMM D, YYYY")} – ${end.format("MMM D, YYYY")}`,
    };
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    if (!clientId) {
      setEvents([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    scheduleApi
      .getRange({
        clientId,
        startDate: range.startISO,
        endDate: range.endISO,
        includeAvailability: false,
      })
      .then((d) => {
        if (!active) return;
        if (d?.error) {
          setError(d.error);
          setEvents([]);
          return;
        }
        // Only this client's actual sessions — drop availability and any busy placeholders.
        setEvents(
          (d.events || []).filter(
            (e) => e.eventType === "APPOINTMENT" && String(e.clientId) === String(clientId)
          )
        );
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message || "Couldn't load sessions.");
        setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, range.startISO, range.endISO]);

  // Pull this client's invoices so we can point each session at the invoice that billed it.
  useEffect(() => {
    if (!clientId) {
      setInvoices([]);
      return;
    }
    let active = true;
    billingApi
      .listInvoices({ trainerId: user._id, clientId, limit: 500 })
      .then((d) => {
        if (active) setInvoices(d && !d.error ? d.invoices || [] : []);
      })
      .catch(() => {
        if (active) setInvoices([]);
      });
    return () => {
      active = false;
    };
  }, [clientId, user._id]);

  // eventId -> the invoice that billed it (via the hard scheduleEventId link on line items).
  const invoiceByEvent = useMemo(() => {
    const map = new Map();
    invoices.forEach((inv) => {
      (inv.lineItems || []).forEach((li) => {
        if (li.scheduleEventId) {
          map.set(String(li.scheduleEventId), {
            _id: inv._id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
          });
        }
      });
    });
    return map;
  }, [invoices]);

  const tz = user.timezone || undefined; // undefined => viewer's local time
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: tz,
    });
  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

  const typeName = (id) => sessionTypes.find((s) => String(s._id) === String(id))?.name || "Session";

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime)),
    [events]
  );

  const summary = useMemo(() => {
    const s = { total: events.length, completed: 0, upcoming: 0, cancelled: 0, dollars: 0, currency: "USD" };
    events.forEach((e) => {
      const group = STATUS_META[e.status]?.group;
      if (group) s[group] += 1;
      if (e.status !== "CANCELLED" && e.priceAmount != null && !Number.isNaN(Number(e.priceAmount))) {
        s.dollars += Number(e.priceAmount);
        s.currency = e.priceCurrency || s.currency;
      }
    });
    return s;
  }, [events]);

  const selectedClientRel = clients.find((c) => c.client?._id === clientId) || null;

  const exportCsv = () => {
    const iso = (d) => {
      try {
        return new Date(d).toLocaleDateString("en-CA", { timeZone: tz });
      } catch (e) {
        return dayjs(d).format("YYYY-MM-DD");
      }
    };
    const columns = [
      { label: "Date", get: (e) => iso(e.startDateTime) },
      { label: "Time", get: (e) => fmtTime(e.startDateTime) },
      { label: "Session type", get: (e) => typeName(e.sessionTypeId) },
      { label: "Status", get: (e) => STATUS_META[e.status]?.label || e.status },
      { label: "Price", get: (e) => (e.priceAmount != null ? Number(e.priceAmount).toFixed(2) : "") },
      { label: "Currency", get: (e) => (e.priceAmount != null ? e.priceCurrency || "USD" : "") },
      { label: "Invoice", get: (e) => invoiceByEvent.get(String(e._id))?.invoiceNumber || "" },
    ];
    const who =
      selectedClientRel &&
      `${selectedClientRel.client.firstName || ""}_${selectedClientRel.client.lastName || ""}`
        .trim()
        .replace(/\s+/g, "-");
    const name = `sessions_${who || "client"}_${range.startISO.slice(0, 10)}_to_${range.endISO.slice(0, 10)}.csv`;
    downloadCsv(name, buildCsv(columns, sorted));
  };

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Typography variant="h4">Session History</Typography>
        <Typography variant="body2" color="text.secondary">
          Every session a client has had, for any date range.
        </Typography>
      </Grid>

      {/* Controls */}
      <Grid size={12}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Autocomplete
                size="small"
                sx={{ maxWidth: 360 }}
                options={clients.filter((c) => c.accepted)}
                getOptionLabel={(o) => `${o.client?.firstName || ""} ${o.client?.lastName || ""}`.trim()}
                isOptionEqualToValue={(o, v) => o.client?._id === v.client?._id}
                value={selectedClientRel}
                onChange={(_, v) => setClientId(v ? v.client._id : "")}
                renderInput={(params) => (
                  <TextField {...params} label="Client" placeholder="Choose a client" />
                )}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={preset}
                  onChange={(_, v) => v && setPreset(v)}
                >
                  {PRESETS.map((p) => (
                    <ToggleButton key={p.key} value={p.key} sx={{ px: 1.5 }}>
                      {p.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {preset === "custom" && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      type="date"
                      label="From"
                      size="small"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      type="date"
                      label="To"
                      size="small"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Stack>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Showing {range.label}
                {tz ? ` · times in ${tz}` : ""}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Summary + list */}
      <Grid size={12}>
        {!clientId ? (
          <Alert severity="info">Pick a client to see their sessions.</Alert>
        ) : loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}
              >
                <Typography variant="h6">
                  {summary.total} session{summary.total === 1 ? "" : "s"}
                </Typography>
                {summary.completed > 0 && (
                  <Chip size="small" color="success" label={`${summary.completed} completed`} />
                )}
                {summary.upcoming > 0 && (
                  <Chip size="small" color="info" label={`${summary.upcoming} upcoming`} />
                )}
                {summary.cancelled > 0 && (
                  <Chip size="small" label={`${summary.cancelled} cancelled`} />
                )}
                {summary.dollars > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${summary.currency} ${summary.dollars.toFixed(2)}`}
                  />
                )}
                {sorted.length > 0 && (
                  <Button size="small" onClick={exportCsv} sx={{ ml: "auto" }}>
                    Export CSV
                  </Button>
                )}
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              {sorted.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No sessions in this range.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {sorted.map((e) => {
                    const meta = STATUS_META[e.status] || { label: e.status, color: "default" };
                    const inv = invoiceByEvent.get(String(e._id));
                    const highlighted = highlightEventId && String(e._id) === String(highlightEventId);
                    return (
                      <Stack
                        key={e._id}
                        direction="row"
                        spacing={1}
                        sx={{
                          py: 1,
                          px: highlighted ? 1 : 0,
                          mx: highlighted ? -1 : 0,
                          borderRadius: 1,
                          bgcolor: highlighted ? "action.selected" : "transparent",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {fmtDate(e.startDateTime)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {fmtTime(e.startDateTime)} · {typeName(e.sessionTypeId)}
                          </Typography>
                          <Stack direction="row" spacing={1.5} sx={{ mt: 0.25, flexWrap: "wrap" }}>
                            {inv ? (
                              <Link
                                component={RouterLink}
                                to={`/invoices?invoice=${inv._id}`}
                                variant="caption"
                                underline="hover"
                              >
                                Invoice {inv.invoiceNumber}
                              </Link>
                            ) : (
                              e.status === "COMPLETED" && (
                                <Typography variant="caption" color="text.disabled">
                                  Not individually invoiced
                                </Typography>
                              )
                            )}
                            {e.workoutId && (
                              <Link
                                component={RouterLink}
                                to={`/workout/${e.workoutId}`}
                                variant="caption"
                                underline="hover"
                              >
                                View workout
                              </Link>
                            )}
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                          {e.priceAmount != null && (
                            <Typography variant="body2" color="text.secondary">
                              {e.priceCurrency || "USD"} {Number(e.priceAmount).toFixed(2)}
                            </Typography>
                          )}
                          <Chip size="small" color={meta.color} label={meta.label} />
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        )}
      </Grid>
    </Grid>
  );
}
