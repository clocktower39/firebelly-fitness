import React, { useState } from "react";
import { Button, ListItemIcon, Menu, MenuItem, Typography } from "@mui/material";
import { CalendarMonth, Google, Microsoft, Apple, Download } from "@mui/icons-material";
import { googleCalendarUrl, outlookCalendarUrl, downloadICS } from "../utils/calendarLinks";

/**
 * "Add to calendar" control for a single schedule event. Links the session to
 * any mainstream calendar: Google + Outlook via deep links, Apple/other via a
 * downloadable .ics. `event` = { title, start, end, details?, location? }.
 */
export default function AddToCalendarMenu({
  event,
  size = "small",
  variant = "text",
  label = "Add to calendar",
  iconOnly = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const close = () => setAnchorEl(null);

  if (!event?.start || !event?.end) return null;

  const openExternal = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
    close();
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        startIcon={<CalendarMonth fontSize="small" />}
        onClick={(clickEvent) => setAnchorEl(clickEvent.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={{ textTransform: "none" }}
      >
        {iconOnly ? "" : label}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={close}>
        <MenuItem onClick={() => openExternal(googleCalendarUrl(event))}>
          <ListItemIcon><Google fontSize="small" /></ListItemIcon>
          <Typography variant="inherit">Google Calendar</Typography>
        </MenuItem>
        <MenuItem onClick={() => openExternal(outlookCalendarUrl(event))}>
          <ListItemIcon><Microsoft fontSize="small" /></ListItemIcon>
          <Typography variant="inherit">Outlook</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            downloadICS(event);
            close();
          }}
        >
          <ListItemIcon><Apple fontSize="small" /></ListItemIcon>
          <Typography variant="inherit">Apple / .ics</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            downloadICS(event);
            close();
          }}
        >
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <Typography variant="inherit">Download (.ics)</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
