import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  Add,
  ArrowBackIosNew,
  AttachFile,
  Campaign,
  Close,
  Delete,
  Quickreply,
  Search,
  Send,
} from "@mui/icons-material";
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
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [pendingAtts, setPendingAtts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastSel, setBroadcastSel] = useState([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [savedReplies, setSavedReplies] = useState([]);
  const [replyAnchor, setReplyAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const isMobile = useMediaQuery((t) => t.breakpoints.down("md"));
  const endRef = useRef(null);

  const activeId = searchParams.get("c");
  const meId = user?._id;

  useEffect(() => {
    dispatch(getConversations());
  }, [dispatch]);

  useEffect(() => {
    conversationApi.getSavedReplies().then((r) => Array.isArray(r) && setSavedReplies(r));
  }, []);

  // Debounced message search.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      conversationApi.searchMessages(q).then((r) => Array.isArray(r) && setSearchResults(r));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

  const refreshSavedReplies = () =>
    conversationApi.getSavedReplies().then((r) => Array.isArray(r) && setSavedReplies(r));

  const insertReply = (replyText) => {
    setText((prev) => (prev ? `${prev} ${replyText}` : replyText));
    setReplyAnchor(null);
  };

  const saveCurrentReply = async () => {
    const t = text.trim();
    if (!t) return;
    await conversationApi.createSavedReply(t);
    refreshSavedReplies();
  };

  const removeReply = async (id) => {
    await conversationApi.deleteSavedReply(id);
    refreshSavedReplies();
  };

  const openSearchResult = (conversationId) => {
    if (!conversationId) return;
    setSearchParams({ c: String(conversationId) });
    setSearchQuery("");
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

  const broadcastClients = useMemo(
    () =>
      clients
        .filter((c) => c.accepted && c.client?._id)
        .map((c) => ({
          userId: String(c.client._id),
          name: `${c.client.firstName || ""} ${c.client.lastName || ""}`.trim() || "Client",
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const openBroadcast = () => {
    dispatch(requestClients());
    setBroadcastText("");
    setBroadcastSel([]);
    setBroadcastOpen(true);
  };

  const toggleBroadcast = (userId) =>
    setBroadcastSel((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );

  const handleBroadcast = async () => {
    const body = broadcastText.trim();
    if (!body || !broadcastSel.length) return;
    setBroadcasting(true);
    await conversationApi.broadcast(broadcastSel, body);
    setBroadcasting(false);
    setBroadcastOpen(false);
    dispatch(getConversations());
  };

  const showList = !isMobile || !activeId;
  const showThread = !isMobile || Boolean(activeId);

  const ConversationList = (
    <Paper sx={{ height: "100%", overflowY: "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ p: 2, pb: 1, flexWrap: "wrap", gap: 1 }}
      >
        <Typography variant="h6">Messages</Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
          {user?.isTrainer && (
            <Button
              size="small"
              startIcon={<Campaign />}
              onClick={openBroadcast}
              sx={{ minWidth: "auto" }}
            >
              Broadcast
            </Button>
          )}
          <Button size="small" startIcon={<Add />} onClick={openCompose} sx={{ minWidth: "auto" }}>
            New
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search messages…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Divider />
      {searchQuery.trim().length >= 2 ? (
        searchResults.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No matches.
          </Typography>
        ) : (
          <List disablePadding>
            {searchResults.map((m) => (
              <ListItemButton key={m._id} onClick={() => openSearchResult(m.conversation?._id)}>
                <ListItemText
                  primary={convoTitle(m.conversation, meId)}
                  secondary={m.body}
                  primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        )
      ) : conversations.length === 0 ? (
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
                    {m.context?.label && (
                      <Chip
                        size="small"
                        label={`re: ${m.context.label}`}
                        onClick={() => m.context.link && navigate(m.context.link)}
                        sx={{
                          mb: 0.5,
                          maxWidth: "100%",
                          height: "auto",
                          "& .MuiChip-label": { whiteSpace: "normal", py: 0.25 },
                        }}
                      />
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
              <IconButton onClick={(e) => setReplyAnchor(e.currentTarget)} title="Saved replies">
                <Quickreply />
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
            <Menu
              anchorEl={replyAnchor}
              open={Boolean(replyAnchor)}
              onClose={() => setReplyAnchor(null)}
            >
              {savedReplies.length === 0 && <MenuItem disabled>No saved replies yet</MenuItem>}
              {savedReplies.map((r) => (
                <MenuItem
                  key={r._id}
                  onClick={() => insertReply(r.text)}
                  sx={{ maxWidth: 320, whiteSpace: "normal" }}
                >
                  <ListItemText primary={r.text} primaryTypographyProps={{ variant: "body2" }} />
                  <IconButton
                    size="small"
                    sx={{ ml: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeReply(r._id);
                    }}
                  >
                    <Delete fontSize="inherit" />
                  </IconButton>
                </MenuItem>
              ))}
              <Divider />
              <MenuItem
                disabled={!text.trim()}
                onClick={() => {
                  saveCurrentReply();
                  setReplyAnchor(null);
                }}
              >
                <Add fontSize="small" sx={{ mr: 1 }} /> Save current message
              </MenuItem>
            </Menu>
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

      <Dialog open={broadcastOpen} onClose={() => setBroadcastOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Broadcast a message</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Sends one message to each selected client.
          </Typography>
          {broadcastClients.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              No clients yet.
            </Typography>
          ) : (
            <>
              <Button
                size="small"
                onClick={() =>
                  setBroadcastSel(
                    broadcastSel.length === broadcastClients.length
                      ? []
                      : broadcastClients.map((c) => c.userId)
                  )
                }
              >
                {broadcastSel.length === broadcastClients.length ? "Clear all" : "Select all"}
              </Button>
              <List dense sx={{ maxHeight: 220, overflowY: "auto" }}>
                {broadcastClients.map((c) => (
                  <ListItemButton key={c.userId} onClick={() => toggleBroadcast(c.userId)} dense>
                    <Checkbox
                      edge="start"
                      checked={broadcastSel.includes(c.userId)}
                      tabIndex={-1}
                      disableRipple
                    />
                    <ListItemText primary={c.name} />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
            size="small"
            placeholder="Your message…"
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBroadcastOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBroadcast}
            disabled={!broadcastText.trim() || !broadcastSel.length || broadcasting}
          >
            {broadcasting ? "Sending…" : `Send to ${broadcastSel.length}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
