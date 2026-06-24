import { apiFetch } from "./client";

export const notificationApi = {
  list: ({ limit = 30 } = {}) =>
    apiFetch("/notifications/list", { method: "POST", body: { limit } }),

  markRead: ({ id, all } = {}) =>
    apiFetch("/notifications/read", {
      method: "POST",
      body: all ? { all: true } : { id },
    }),
};
