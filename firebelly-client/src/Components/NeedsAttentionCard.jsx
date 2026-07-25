import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlined as AllClearIcon,
  EventBusy as QuietIcon,
  MonitorHeart as ReadinessIcon,
  PendingActions as RunwayIcon,
  ReceiptLong as InvoiceIcon,
  RequestQuote as UnbilledIcon,
} from "@mui/icons-material";
import { apiFetch } from "../api/client";
import { formatPrice } from "../utils/currency";

const nameList = (items, max = 3) => {
  const names = items.map((item) => item.name || "Client");
  return names.length <= max
    ? names.join(", ")
    : `${names.slice(0, max).join(", ")} +${names.length - max}`;
};

// The trainer's exception report: who and what needs attention today, each row one tap
// from its fix. Assembles the signals the app already tracks — nothing here is new data.
export default function NeedsAttentionCard() {
  const user = useSelector((state) => state.user);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user?.isTrainer) return undefined;
    let cancelled = false;
    apiFetch("/dashboard/attention", { method: "POST", body: {} })
      .then((res) => {
        if (!cancelled && res && !res.error) setData(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.isTrainer]);

  if (!user?.isTrainer || !data) return null;

  const rows = [];
  if (data.unbilled?.sessions > 0) {
    rows.push({
      key: "unbilled",
      icon: <UnbilledIcon color="warning" />,
      primary: `${data.unbilled.sessions} completed session${data.unbilled.sessions === 1 ? "" : "s"} not billed`,
      secondary: `${data.unbilled.clients} client${data.unbilled.clients === 1 ? "" : "s"} · ~${formatPrice(data.unbilled.value)} uncollected (last 30 days)`,
      to: "/session-history",
      action: "Review",
    });
  }
  if (data.pastDue?.count > 0) {
    rows.push({
      key: "pastdue",
      icon: <InvoiceIcon color="error" />,
      primary: `${data.pastDue.count} invoice${data.pastDue.count === 1 ? "" : "s"} past due`,
      secondary: `${formatPrice(data.pastDue.total)} outstanding`,
      to: "/invoices",
      action: "Open",
    });
  }
  if (data.needsProgramming?.length > 0) {
    rows.push({
      key: "runway",
      icon: <RunwayIcon color="warning" />,
      primary: `Programming runs out soon: ${nameList(data.needsProgramming)}`,
      secondary: data.needsProgramming
        .slice(0, 3)
        .map((c) => (c.lastPlannedDate ? `${c.name} → ${dayjs(c.lastPlannedDate).format("MMM D")}` : `${c.name} → nothing scheduled`))
        .join(" · "),
      to: "/programs",
      action: "Assign",
    });
  }
  if (data.quietClients?.length > 0) {
    rows.push({
      key: "quiet",
      icon: <QuietIcon color="info" />,
      primary: `Quiet for ${7}+ days: ${nameList(data.quietClients)}`,
      secondary: "No completed workouts lately — worth a check-in message.",
      to: "/messages",
      action: "Message",
    });
  }
  if (data.lowReadiness?.length > 0) {
    rows.push({
      key: "readiness",
      icon: <ReadinessIcon color="error" />,
      primary: `Low readiness: ${data.lowReadiness.map((c) => `${c.name} (${c.score})`).join(", ")}`,
      secondary: "Fresh check-ins under 40 — consider dialing today back.",
      to: "/clients",
      action: "View",
    });
  }

  return (
    <Grid container size={12} sx={{ marginTop: "10px" }}>
      <Paper elevation={5} sx={{ width: "100%", padding: "12px", margin: "5px" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">Needs Attention</Typography>
          {rows.length > 0 && <Chip size="small" color="warning" label={rows.length} />}
        </Stack>
        {rows.length === 0 ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
            <AllClearIcon color="success" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              All caught up — nothing needs you right now.
            </Typography>
          </Stack>
        ) : (
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {rows.map((row) => (
              <ListItem
                key={row.key}
                disableGutters
                secondaryAction={
                  <Button component={Link} to={row.to} size="small" variant="outlined">
                    {row.action}
                  </Button>
                }
                sx={{ pr: 12 }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>{row.icon}</ListItemIcon>
                <ListItemText primary={row.primary} secondary={row.secondary} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Grid>
  );
}
