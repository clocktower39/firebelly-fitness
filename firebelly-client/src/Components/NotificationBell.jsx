import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { notificationApi } from "../api/notificationApi";
import {
  pushSupported,
  isPushSubscribed,
  enablePush,
  disablePush,
} from "../utils/pushManager";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.list({ limit: 20 });
      if (data && !data.error) {
        setItems(data.notifications || []);
        setUnread(data.unread || 0);
      }
    } catch (err) {
      /* best effort */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 45000);
    // Real-time: refetch immediately when a notification arrives over the socket.
    const onPush = () => load();
    window.addEventListener("fb:notification", onPush);
    return () => {
      clearInterval(timer);
      window.removeEventListener("fb:notification", onPush);
    };
  }, [load]);

  const open = (event) => {
    setAnchorEl(event.currentTarget);
    load();
  };
  const close = () => setAnchorEl(null);

  const handleClickItem = async (n) => {
    close();
    if (!n.read) {
      try {
        await notificationApi.markRead({ id: n._id });
      } catch (err) {
        /* best effort */
      }
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await notificationApi.markRead({ all: true });
    } catch (err) {
      /* best effort */
    }
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  useEffect(() => {
    if (pushSupported()) isPushSubscribed().then(setPushOn);
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        await enablePush();
        setPushOn(true);
      }
    } catch (err) {
      /* permission denied / unsupported — leave the toggle as-is */
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <>
      <IconButton color="inherit" onClick={open} aria-label="notifications">
        <Badge badgeContent={unread} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        slotProps={{ paper: { sx: { width: 340, maxWidth: "92vw", maxHeight: 440 } } }}
      >
        <Stack
          direction="row"
          sx={{ px: 2, py: 1, alignItems: "center", justifyContent: "space-between" }}
        >
          <Typography variant="subtitle2">Notifications</Typography>
          {unread > 0 && (
            <Button size="small" onClick={markAll}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </MenuItem>
        ) : (
          items.map((n) => (
            <MenuItem
              key={n._id}
              onClick={() => handleClickItem(n)}
              sx={{
                whiteSpace: "normal",
                alignItems: "flex-start",
                bgcolor: n.read ? "transparent" : "action.hover",
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: n.read ? 400 : 600 }}>
                  {n.title}
                </Typography>
                {n.body && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {n.body}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {dayjs(n.createdAt).format("MMM D, h:mm A")}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
        {pushSupported() && (
          <Box>
            <Divider />
            <MenuItem onClick={togglePush} disabled={pushBusy}>
              <Typography variant="body2" color={pushOn ? "success.main" : "primary"}>
                {pushBusy
                  ? "Working…"
                  : pushOn
                  ? "Push notifications on — tap to turn off"
                  : "Enable push notifications"}
              </Typography>
            </MenuItem>
          </Box>
        )}
      </Menu>
    </>
  );
}
