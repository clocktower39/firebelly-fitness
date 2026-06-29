import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Add, ArrowBackIosNew, AttachFile, Close, Delete, Send } from "@mui/icons-material";
import { conversationApi } from "../../api/conversationApi";
import dayjs from "dayjs";
import {
  getConversations,
  openDirectConversation,
  loadMessages,
  sendMessageTo,
  markConversationRead,
  removeMessage,
  requestClients,
  requestMyTrainers,
  serverURL,
} from "../../Redux/actions";

const fullName = (u) =>
  u?.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u?.username || "User";

const otherParticipants = (convo, meId) =>
  (convo?.participants || []).filter((p) => String(p.user?._id || p.user) !== String(meId));

const convoTitle = (convo, meId) => {
  if (convo?.title) return convo.title;
  const names = otherParticipants(convo, meId).map((p) => fullName(p.user));
  return names.join(", ") || "Conversation";
};

const avatarFor = (u) =>
  u?.profilePicture ? `${serverURL}/user/profilePicture/${u.profilePicture}` : undefined;

export default function Messages() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.user);
  const conversations = useSelector((s) => s.conversations) || [];
  const messagesByConversation = useSelector((s) => s.messagesByConversation) || {};
  const clients = useSelector((s) => s.clients) || [];
  const myTrainers = useSelector((s) => s.myTrainers) || [];
  const [searchParams, setSearchParams] = useSearchParams();
  const [text, setText] = useState("");
  const [pendingAtts, setPendingAtts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const isMobile = useMediaQuery((t) => t.breakpoints.down("md"));
  const endRef = useRef(null);

  const activeId = searchParams.get("c");
  const meId = user?._id;

  useEffect(() => {
    dispatch(getConversations());
  }, [dispatch]);

  // ?u=<userId> → open/create the direct conversation, then switch to ?c=<conversationId>
  useEffect(() => {
    const u = searchParams.get("u");
    if (!u) return;
    dispatch(openDirectConversation(u)).then((convo) => {
      if (convo?._id) setSearchParams({ c: String(convo._id) }, { replace: true });
    });
  }, [searchParams, dispatch, setSearchParams]);

  useEffect(() => {
    if (activeId) dispatch(loadMessages(activeId));
  }, [activeId, dispatch]);

  const activeConvo = useMemo(
    () => conversations.find((c) => String(c._id) === String(activeId)),
    [conversations, activeId]
  );
  const activeMessages = messagesByConversation[activeId] || [];

  // Messages from a guardian (acting for their child) are labeled "· parent" so they're never
  // mistaken for the child.
  const guardianIds = useMemo(
    () =>
      new Set(
        (activeConvo?.participants || [])
          .filter((p) => p.role === "guardian")
          .map((p) => String(p.user?._id || p.user))
      ),
    [activeConvo]
  );

  // Clear unread whenever the open conversation has any (including on a freshly arrived message).
  useEffect(() => {
    if (activeId && activeConvo?.unread > 0) dispatch(markConversationRead(activeId));
  }, [activeId, activeConvo?.unread, dispatch]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeId]);

  const handleSend = async () => {
    const body = text.trim();
    if ((!body && !pendingAtts.length) || !activeId) return;
    const atts = pendingAtts;
    setText("");
    setPendingAtts([]);
    await dispatch(sendMessageTo(activeId, body, atts));
  };

  const handleAttach = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await conversationApi.uploadAttachment(file);
    setUploading(false);
    if (res && res.fileId) {
      setPendingAtts((prev) => [...prev, { fileId: res.fileId, type: res.type, name: res.name }]);
    }
  };

  const selectConversation = (id) => setSearchParams({ c: String(id) });

  // People you can start a conversation with: your accepted clients + your accepted trainers.
  const contacts = useMemo(() => {
    const map = new Map();
    clients.forEach((c) => {
      if (!c.accepted || !c.client?._id) return;
      map.set(String(c.client._id), {
        userId: String(c.client._id),
        name: `${c.client.firstName || ""} ${c.client.lastName || ""}`.trim() || "Client",
        profilePicture: c.client.profilePicture,
      });
    });
    myTrainers.forEach((t) => {
      if (!t.accepted || !t.trainer) return;
      const id = String(t.trainer);
      if (map.has(id)) return;
      map.set(id, {
        userId: id,
        name: `${t.firstName || ""} ${t.lastName || ""}`.trim() || "Trainer",
        profilePicture: t.profilePicture,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, myTrainers]);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.trim().toLowerCase())
  );

  const openCompose = () => {
    if (user?.isTrainer) dispatch(requestClients());
    dispatch(requestMyTrainers());
    setContactSearch("");
    setComposeOpen(true);
  };

  const startConversation = async (userId) => {
    setComposeOpen(false);
    const convo = await dispatch(openDirectConversation(userId));
    if (convo?._id) setSearchParams({ c: String(convo._id) });
  };

  const showList = !isMobile || !activeId;
  const showThread = !isMobile || Boolean(activeId);

  const ConversationList = (
    <Paper sx={{ height: "100%", overflowY: "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ p: 2, pb: 1 }}
      >
        <Typography variant="h6">Messages</Typography>
        <Button size="small" startIcon={<Add />} onClick={openCompose}>
          New
        </Button>
      </Stack>
      <Divider />
      {conversations.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No conversations yet.
        </Typography>
      ) : (
        <List disablePadding>
          {conversations.map((c) => {
            const others = otherParticipants(c, meId);
            const primaryUser = others[0]?.user;
            return (
              <ListItemButton
                key={c._id}
                selected={String(c._id) === String(activeId)}
                onClick={() => selectConversation(c._id)}
              >
                <ListItemAvatar>
                  <Badge color="error" badgeContent={c.unread || 0} overlap="circular">
                    <Avatar src={avatarFor(primaryUser)}>
                      {convoTitle(c, meId)[0]?.toUpperCase()}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={convoTitle(c, meId)}
                  secondary={c.lastMessagePreview || "No messages yet"}
                  primaryTypographyProps={{
                    fontWeight: c.unread ? 700 : 500,
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Paper>
  );

  const Thread = (
    <Paper sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {activeConvo ? (
        <>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5 }}>
            {isMobile && (
              <IconButton size="small" onClick={() => setSearchParams({})}>
                <ArrowBackIosNew fontSize="small" />
              </IconButton>
            )}
            <Typography variant="h6" noWrap>
              {convoTitle(activeConvo, meId)}
            </Typography>
          </Stack>
          <Divider />
          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {activeMessages.map((m) => {
              const mine = String(m.sender?._id || m.sender) === String(meId);
              return (
                <Stack
                  key={m._id}
                  direction="row"
                  justifyContent={mine ? "flex-end" : "flex-start"}
                  sx={{ mb: 1 }}
                >
                  {!mine && (
                    <Avatar
                      src={avatarFor(m.sender)}
                      sx={{ width: 28, height: 28, mr: 1, mt: 0.5 }}
                    >
                      {fullName(m.sender)[0]?.toUpperCase()}
                    </Avatar>
                  )}
                  <Box
                    sx={{
                      maxWidth: "72%",
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: mine ? "primary.main" : "action.hover",
                      color: mine ? "primary.contrastText" : "text.primary",
                    }}
                  >
                    {!mine && (
                      <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                        {fullName(m.sender)}
                        {guardianIds.has(String(m.sender?._id || m.sender)) ? " · parent" : ""}
                      </Typography>
                    )}
                    {m.body && (
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {m.body}
                      </Typography>
                    )}
                    {(m.attachments || []).map((a) => (
                      <Box key={String(a.fileId)} sx={{ mt: 0.5 }}>
                        {a.type === "video" ? (
                          <video
                            src={`${serverURL}/messages/attachment/${a.fileId}`}
                            controls
                            style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }}
                          />
                        ) : a.type === "image" ? (
                          <a
                            href={`${serverURL}/messages/attachment/${a.fileId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={`${serverURL}/messages/attachment/${a.fileId}`}
                              alt={a.name || "attachment"}
                              style={{
                                maxWidth: "100%",
                                maxHeight: 240,
                                borderRadius: 8,
                                display: "block",
                              }}
                            />
                          </a>
                        ) : (
                          <a
                            href={`${serverURL}/messages/attachment/${a.fileId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.name || "Attachment"}
                          </a>
                        )}
                      </Box>
                    ))}
                    <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mt: 0.25 }}>
                      {dayjs(m.createdAt).format("MMM D, h:mm A")}
                    </Typography>
                  </Box>
                  {mine && (
                    <IconButton
                      size="small"
                      sx={{ ml: 0.5 }}
                      onClick={() => dispatch(removeMessage(m._id, activeId))}
                    >
                      <Delete fontSize="inherit" />
                    </IconButton>
                  )}
                </Stack>
              );
            })}
            <div ref={endRef} />
          </Box>
          <Divider />
          <Box sx={{ p: 1.5 }}>
            {pendingAtts.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1, gap: 1 }}>
                {pendingAtts.map((a, i) => (
                  <Chip
                    key={String(a.fileId)}
                    size="small"
                    icon={<AttachFile fontSize="small" />}
                    label={a.name || a.type}
                    onDelete={() => setPendingAtts((prev) => prev.filter((_, idx) => idx !== i))}
                    deleteIcon={<Close fontSize="small" />}
                  />
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={handleAttach}
              />
              <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <AttachFile />
              </IconButton>
              <TextField
                fullWidth
                size="small"
                placeholder={uploading ? "Uploading…" : "Type a message…"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                multiline
                maxRows={4}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={(!text.trim() && !pendingAtts.length) || uploading}
              >
                <Send />
              </IconButton>
            </Stack>
          </Box>
        </>
      ) : (
        <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
          <Typography variant="body2" color="text.secondary">
            Select a conversation
          </Typography>
        </Stack>
      )}
    </Paper>
  );

  return (
    <Box sx={{ height: "calc(100vh - 120px)", p: 1 }}>
      <Grid container spacing={1} sx={{ height: "100%" }}>
        {showList && (
          <Grid size={{ xs: 12, md: 4 }} sx={{ height: "100%" }}>
            {ConversationList}
          </Grid>
        )}
        {showThread && (
          <Grid size={{ xs: 12, md: 8 }} sx={{ height: "100%" }}>
            {Thread}
          </Grid>
        )}
      </Grid>

      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New message</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            size="small"
            autoFocus
            placeholder="Search people…"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            sx={{ mb: 1 }}
          />
          {filteredContacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No contacts found.
            </Typography>
          ) : (
            <List disablePadding>
              {filteredContacts.map((c) => (
                <ListItemButton key={c.userId} onClick={() => startConversation(c.userId)}>
                  <ListItemAvatar>
                    <Avatar src={avatarFor(c)}>{c.name[0]?.toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={c.name} />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
