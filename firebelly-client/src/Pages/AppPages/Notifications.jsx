import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { notificationApi } from "../../api/notificationApi";

// Full notification history — includes items that were cleared from the bell.
export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // all | unread

  const load = useCallback(async (before) => {
    setLoading(true);
    try {
      const data = await notificationApi.list({ limit: 30, before, includeDismissed: true });
      if (data && !data.error) {
        setItems((prev) =>
          before ? [...prev, ...(data.notifications || [])] : data.notifications || []
        );
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err) {
      /* best effort */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openItem = async (n) => {
    if (!n.read) {
      try {
        await notificationApi.markRead({ id: n._id });
      } catch (err) {
        /* best effort */
      }
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    }
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markRead({ all: true });
    } catch (err) {
      /* best effort */
    }
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const unreadCount = items.filter((n) => !n.read).length;
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">Notifications</Typography>
        {unreadCount > 0 && (
          <Button size="small" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(e, v) => v && setFilter(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="unread">
          Unread{unreadCount ? ` (${unreadCount})` : ""}
        </ToggleButton>
      </ToggleButtonGroup>

      <Paper variant="outlined">
        {shown.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {loading
                ? "Loading…"
                : filter === "unread"
                ? "No unread notifications."
                : "You have no notifications yet."}
            </Typography>
          </Box>
        ) : (
          shown.map((n, i) => (
            <Box key={n._id}>
              {i > 0 && <Divider />}
              <Box
                onClick={() => openItem(n)}
                sx={{
                  p: 2,
                  cursor: n.link ? "pointer" : "default",
                  bgcolor: n.read ? "transparent" : "action.hover",
                  "&:hover": n.link ? { bgcolor: "action.selected" } : undefined,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: n.read ? 500 : 700 }}>
                      {n.title}
                    </Typography>
                    {n.body && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {n.body}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 0.5 }}
                    >
                      {dayjs(n.createdAt).format("MMM D, YYYY · h:mm A")}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    {!n.read && <Chip size="small" color="primary" label="New" />}
                    {n.dismissed && <Chip size="small" variant="outlined" label="Cleared" />}
                  </Stack>
                </Stack>
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {hasMore && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button onClick={() => load(items[items.length - 1]?.createdAt)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </Box>
      )}
    </Container>
  );
}
