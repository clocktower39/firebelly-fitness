import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Chip,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { CheckCircle } from "@mui/icons-material";
import { requestClients } from "../../Redux/actions";
import { accountApi } from "../../api/accountApi";

const DAYS = [
  { value: 0, label: "Su" },
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
];

const clientName = (c) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "Client";

// Trainer home card: set each client's workout days and see at a glance who still needs them set.
// The days drive the client's coverage + the default days for new programs.
export default function ClientWorkoutDaysChecklist() {
  const dispatch = useDispatch();
  const clients = useSelector((s) => s.clients) || [];

  const accepted = useMemo(
    () =>
      (Array.isArray(clients) ? clients : [])
        .filter((r) => r.accepted && r.client?._id)
        .sort((a, b) => clientName(a.client).localeCompare(clientName(b.client))),
    [clients]
  );

  const [daysByClient, setDaysByClient] = useState({});

  useEffect(() => {
    dispatch(requestClients());
  }, [dispatch]);

  // Sync local state whenever the clients list (re)loads. We don't refetch after each save, so
  // optimistic toggles below aren't clobbered between renders.
  useEffect(() => {
    const map = {};
    accepted.forEach((r) => {
      map[String(r.client._id)] = (r.client.preferredWorkoutDays || []).map(Number);
    });
    setDaysByClient(map);
  }, [accepted]);

  const handleToggle = async (clientId, newDays) => {
    setDaysByClient((prev) => ({ ...prev, [clientId]: newDays }));
    await accountApi.setClientWorkoutPreferences(clientId, { preferredWorkoutDays: newDays });
  };

  if (accepted.length === 0) return null;

  const setCount = accepted.filter(
    (r) => (daysByClient[String(r.client._id)] || []).length > 0
  ).length;
  const allSet = setCount === accepted.length;

  return (
    <Paper sx={{ p: 2, width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="h6">Client Workout Days</Typography>
        <Chip size="small" color={allSet ? "success" : "warning"} label={`${setCount}/${accepted.length} set`} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Set the days each client trains so their coverage and new programs land on the right days.
      </Typography>
      <Stack spacing={1.5}>
        {accepted.map((r) => {
          const id = String(r.client._id);
          const days = daysByClient[id] || [];
          const isSet = days.length > 0;
          return (
            <Box key={id}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <CheckCircle color={isSet ? "success" : "disabled"} fontSize="small" />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  {clientName(r.client)}
                </Typography>
                {!isSet && (
                  <Typography variant="caption" color="warning.main">
                    No days set
                  </Typography>
                )}
              </Stack>
              <ToggleButtonGroup
                value={days}
                onChange={(e, next) => handleToggle(id, next)}
                size="small"
                sx={{ flexWrap: "wrap" }}
                aria-label={`workout days for ${clientName(r.client)}`}
              >
                {DAYS.map((d) => (
                  <ToggleButton key={d.value} value={d.value} sx={{ px: 1.25 }}>
                    {d.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
