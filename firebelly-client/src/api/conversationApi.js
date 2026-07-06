import { apiFetch } from "./client";

export const conversationApi = {
  getConversations: () => apiFetch("/conversations"),

  getOrCreateDirect: (userId) =>
    apiFetch("/conversations/direct", { method: "POST", body: { userId } }),

  getMessages: (conversationId, { before, limit } = {}) => {
    const qs = new URLSearchParams();
    if (before) qs.set("before", before);
    if (limit) qs.set("limit", String(limit));
    const q = qs.toString();
    return apiFetch(`/conversations/${conversationId}/messages${q ? `?${q}` : ""}`);
  },

  sendMessage: (conversationId, body, attachments = []) =>
    apiFetch(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body, attachments },
    }),

  broadcast: (clientIds, body) =>
    apiFetch("/conversations/broadcast", { method: "POST", body: { clientIds, body } }),

  uploadAttachment: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch("/messages/attachment", { method: "POST", body: fd });
  },

  searchMessages: (q) => apiFetch(`/messages/search?q=${encodeURIComponent(q)}`),

  getSavedReplies: () => apiFetch("/saved-replies"),
  createSavedReply: (text) => apiFetch("/saved-replies", { method: "POST", body: { text } }),
  deleteSavedReply: (id) =>
    apiFetch(`/saved-replies/${id}/delete`, { method: "POST", body: {} }),

  markRead: (conversationId) =>
    apiFetch(`/conversations/${conversationId}/read`, { method: "POST", body: {} }),

  muteConversation: (conversationId, muted) =>
    apiFetch(`/conversations/${conversationId}/mute`, { method: "POST", body: { muted } }),

  deleteMessage: (messageId) =>
    apiFetch(`/messages/${messageId}/delete`, { method: "POST", body: {} }),
};
