import React from "react";
import { Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import { scheduleColors, statusColors } from "../constants";
import { formatRange } from "../utils/scheduleUtils";
import AddToCalendarMenu from "./AddToCalendarMenu";

/**
 * Mobile-first Agenda view of the week's schedule, fed by the same resolved
 * events as the week grid / table (`weekEventRows`). A calm, scannable list
 * grouped by day, with per-event "Add to calendar" links. Capacity/roster
 * indicators arrive with the Classes primitive (Phase 2); today's model is
 * appointment-based, so rows show type + status.
 */
export default function AgendaView({
  events = [],
  weekDays = [],
  isTrainerView,
  isClientView,
  selectedDate,
  getEventDisplayName,
  getSessionTypeLabel,
  openActionForEvent,
  openRequestForEvent,
}) {
  const eventsByDay = weekDays.map((day) => ({
    day,
    items: events.filter((event) => dayjs(event.startDateTime).isSame(day, "day")),
  }));
  const hasAny = eventsByDay.some((group) => group.items.length > 0);

  if (!hasAny) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography color="text.secondary">No sessions scheduled this week.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      {eventsByDay.map(({ day, items }) => {
        if (items.length === 0) return null;
        const isToday = selectedDate && day.isSame(selectedDate, "day");
        return (
          <Box key={day.format("YYYY-MM-DD")}>
            <Typography
              variant="overline"
              sx={{ color: isToday ? "primary.main" : "text.secondary", fontWeight: 700 }}
            >
              {day.format("ddd, MMM D")}{isToday ? " · Today" : ""}
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.paper",
                px: 2,
              }}
            >
              <Stack divider={<Divider flexItem />}>
                {items.map((event) => {
                  const isAvailability = event.eventType === "AVAILABILITY";
                  const displayName = isAvailability
                    ? "Open slot"
                    : getEventDisplayName?.(event) || "Booked session";
                  const typeLabel = getSessionTypeLabel?.(event);
                  const calEvent = {
                    title: `Firebelly · ${displayName}`,
                    start: event.startDateTime,
                    end: event.endDateTime,
                    details: typeLabel || "",
                  };
                  return (
                    <Stack key={event._id} direction="row" spacing={2} sx={{ py: 2, alignItems: "flex-start" }}>
                      <Stack sx={{ minWidth: 72, flexShrink: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {dayjs(event.startDateTime).format("h:mm A")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatRange(event).split(" - ")[1] || ""}
                        </Typography>
                      </Stack>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {displayName}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                          <Chip size="small" color={scheduleColors[event.eventType] || "default"} variant="outlined" label={event.eventType} />
                          <Chip size="small" color={statusColors[event.status] || "default"} variant="outlined" label={event.status} />
                          {typeLabel && <Chip size="small" variant="outlined" label={typeLabel} />}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
                          {isTrainerView && openActionForEvent && (
                            <Button size="small" variant="outlined" onClick={(clickEvent) => openActionForEvent(event, clickEvent.currentTarget)}>
                              Details
                            </Button>
                          )}
                          {isClientView && isAvailability && event.status === "OPEN" && openRequestForEvent && (
                            <Button size="small" variant="contained" onClick={() => openRequestForEvent(event)}>
                              Request
                            </Button>
                          )}
                          <AddToCalendarMenu event={calEvent} />
                        </Stack>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
