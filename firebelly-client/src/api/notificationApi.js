import { apiFetch } from "./client";

export const notificationApi = {
  list: ({ limit = 30, before, includeDismissed } = {}) =>
    apiFetch("/notifications/list", {
      method: "POST",
      body: { limit, before, includeDismissed },
    }),

  markRead: ({ id, all } = {}) =>
    apiFetch("/notifications/read", { method: "POST", body: all ? { all: true } : { id } }),

  dismiss: ({ id, all } = {}) =>
    apiFetch("/notifications/dismiss", { method: "POST", body: all ? { all: true } : { id } }),
};
