import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import { Box, Button, Divider, Grid, Paper, Stack, Typography } from "@mui/material";
import { EventAvailable as EventAvailableIcon } from "@mui/icons-material";
import { scheduleApi } from "../api/scheduleApi";
import { billingApi } from "../api/billingApi";
import { formatPrice } from "../utils/currency";

const OPEN_STATUSES = new Set(["SENT", "PARTIAL", "PAST_DUE"]);

// Client-facing "Where do I stand?" card: prepaid sessions left, booked ahead, what's owed,
// and the next session — the answers clients otherwise have to ask their trainer for.
// Renders nothing for accounts with no trainer or no billing/schedule activity.
export default function ClientStandingCard() {
  const user = useSelector((state) => state.user);
  const myTrainers = useSelector((state) => state.myTrainers) || [];
  const [standing, setStanding] = useState(null); // { summary, invoices, nextEvent, trainerName }

  const trainer = useMemo(
    () => (Array.isArray(myTrainers) ? myTrainers.find((t) => t?.accepted && t?.trainer) : null),
    [myTrainers]
  );

  useEffect(() => {
    if (!user?._id || user?.isTrainer || !trainer?.trainer) {
      setStanding(null);
      return undefined;
    }
    let cancelled = false;
    const trainerId = String(trainer.trainer);
    const now = dayjs();

    Promise.all([
      scheduleApi.getSessionSummary({ trainerId, clientId: String(user._id) }).catch(() => null),
      billingApi.listInvoices({ limit: 50 }).catch(() => null),
      scheduleApi
        .getRange({
          trainerId,
          clientId: String(user._id),
          startDate: now.startOf("day").toISOString(),
          endDate: now.add(60, "day").toISOString(),
          includeAvailability: false,
        })
        .catch(() => null),
    ]).then(([summary, invoiceData, rangeData]) => {
      if (cancelled) return;
      const invoices = (invoiceData?.invoices || []).filter(
        (invoice) => OPEN_STATUSES.has(invoice.status) && Number(invoice.balanceDue) > 0
      );
      const nextEvent = (rangeData?.events || [])
        .filter(
          (event) =>
            event.eventType === "APPOINTMENT" &&
            event.status === "BOOKED" &&
            String(event.clientId?._id || event.clientId) === String(user._id) &&
            dayjs(event.startDateTime).isAfter(now)
        )
        .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))[0] || null;
      setStanding({ summary, invoices, nextEvent });
    });

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.isTrainer, trainer?.trainer]);

  if (!standing) return null;

  const { summary, invoices, nextEvent } = standing;
  const remaining = Math.max(0, Number(summary?.remainingSessions) || 0);
  const booked = Math.max(0, Number(summary?.bookedSessions) || 0);
  const unbooked = Math.max(0, Number(summary?.unbookedSessions) || 0);
  const balanceDue = invoices.reduce((sum, invoice) => sum + (Number(invoice.balanceDue) || 0), 0);
  const currency = invoices[0]?.currency || "USD";

  const hasAnything = remaining > 0 || booked > 0 || invoices.length > 0 || nextEvent;
  if (!hasAnything) return null;

  return (
    <Grid container size={12} sx={{ marginTop: "10px" }}>
      <Paper elevation={5} sx={{ width: "100%", padding: "12px", margin: "5px" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="h6" color="text.primary">
            My Sessions &amp; Balance
          </Typography>
          <Button component={Link} to="/sessions" size="small" variant="outlined">
            Book a session
          </Button>
        </Stack>

        <Stack
          direction="row"
          spacing={3}
          sx={{ mt: 1.5, mb: 1, justifyContent: "space-around", textAlign: "center" }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{remaining}</Typography>
            <Typography variant="caption" color="text.secondary">sessions left</Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{booked}</Typography>
            <Typography variant="caption" color="text.secondary">booked ahead</Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{unbooked}</Typography>
            <Typography variant="caption" color="text.secondary">ready to book</Typography>
          </Box>
        </Stack>

        {nextEvent && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: invoices.length ? 1 : 0 }}>
            <EventAvailableIcon fontSize="small" color="success" />
            <Typography variant="body2">
              Next session: {dayjs(nextEvent.startDateTime).format("ddd, MMM D · h:mm A")}
            </Typography>
          </Stack>
        )}

        {invoices.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
              <Typography variant="subtitle2">Balance due</Typography>
              <Typography variant="h6" color="warning.main" sx={{ fontWeight: 700 }}>
                {formatPrice(balanceDue, currency)}
              </Typography>
            </Stack>
            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
              {invoices.slice(0, 3).map((invoice) => (
                <Typography key={invoice._id} variant="caption" color="text.secondary">
                  {invoice.invoiceNumber} · {formatPrice(invoice.balanceDue, invoice.currency)}
                  {invoice.dueAt ? ` · due ${dayjs(invoice.dueAt).format("MMM D")}` : ""}
                  {invoice.status === "PAST_DUE" ? " · past due" : ""}
                </Typography>
              ))}
              {invoices.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{invoices.length - 3} more
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Message your trainer to arrange payment.
            </Typography>
          </>
        )}
      </Paper>
    </Grid>
  );
}
